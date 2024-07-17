/*
This code is provided on an as-is warranty-free basis by Joseph Winkie <jjj333.p.1325@gmail.com>

This code is licensed under the A-GPL 3.0 license found both in the "LICENSE" file of the root of this repository
as well as https://www.gnu.org/licenses/agpl-3.0.en.html. Read it to know your rights.

A complete copy of this codebase as well as runtime instructions can be found at 
https://github.com/jjj333-p/spam-police/
*/

import {
	AutojoinRoomsMixin,
	MatrixClient,
	SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import { StateManager } from "./stateManager.js";
class Clients {
	constructor(login) {
		this.stateManager = new StateManager(this);

		this.consoleRoom = login["console-room"];

		this.filter = {
			//in the case presence shows up its irrelevant to this bot
			presence: { senders: [] },
			room: {
				//ephemeral events are never used in this bot, are mostly inconsequentail and irrelevant
				ephemeral: { senders: [] },
				//we fetch state manually later, hopefully with better load balancing
				state: {
					senders: [],
					not_types: [
						"im.vector.modular.widgets",
						"im.ponies.room_emotes",
						"m.room.pinned_events",
					],
					lazy_load_members: true,
				},
				//we will manually fetch events before wakeup anyways, this is an acceptable amount for online sync
				timeline: {
					limit: 20,
				},
			},
		};

		//something iteratable array to convert from config to working memory
		const serverID = Object.keys(login.accounts);

		//store the client objects
		this.accounts = new Map();

		//keep track of what messages have been recieved
		this.messageCache = new Map();

		//request queueing
		this.busy = new Map();
		this.requestQueue = [];

		//joined rooms array
		this.joinedRooms = [];

		// biome-ignore lint/complexity/noForEach: <easier to do async function>
		serverID.forEach(async (server) => {
			//convenience
			const thisLogin = login.accounts[server];

			try {
				//store the sync token and filter
				const storage = new SimpleFsStorageProvider(`./db/sync_${server}.json`);

				//initialize client
				const client = new MatrixClient(
					thisLogin.url,
					thisLogin.token,
					storage,
				);

				//pass any emited events into the internal handler to deal with later
				client.on("room.event", async (roomID, event) => {
					this.internalOnEvent(server, roomID, event);
				});

				//push on join
				//leave is irrelevant as it can silently error, too much room for error
				client.on("room.join", (r) => {
					if (!this.joinedRooms.includes(r)) this.joinedRooms.push(r);
				});

				await client.start(this.filter);

				//push any rooms its in, into the rooms array
				client.getJoinedRooms().then((rooms) => {
					for (const r of rooms) {
						if (!this.joinedRooms.includes(r)) this.joinedRooms.push(r);
					}
				});

				this.accounts.set(server, client);
			} catch (e) {
				//warn
				console.warn(`Error connecting client for server ${server}:\n${e}`);

				//delete instance to keep running regardless
				this.accounts.delete(server);

				//exit loop for this `server`, others will still initialize
				return;
			}

			this.accounts
				.get(server)
				.sendText(this.consoleRoom, `Successfully logged in to ${server}`);

			this.stateManager.initPerServer(server);
		});
	}

	async internalOnEvent(server, roomID, event) {
		//if its a state event, divert
		if (typeof event.state_key !== "undefined") {
			if (typeof this.stateManager.onStateEvent === "function") {
				this.stateManager.onStateEvent(server, roomID, event);
			} else if (this.stateManager.onStateEvent) {
				console.error(
					`Tried to call .onStateEvent, but recieved ${typeof this
						.onStateEvent} instead of a function.`,
				);
			} else {
				console.warn("function .onStateEvent not supplied");
			}
		}

		const ts = Date.now();

		//if its already recieved, only compare latency, dont run OnEvent
		console.log(`Recieved ${event.event_id}, on ${server}, at ${ts}`);
		if (this.messageCache.has(event.event_id)) {
			this.messageCache.get(event.event_id).rank.set(server, ts);
			return;
		}

		//set timestamp cache
		const m = new Map();
		m.set(server, ts);
		this.messageCache.set(event.event_id, {
			rank: m,
			first: {
				time: ts,
				server: server,
			},
			event: event,
		});

		//system logging for my knowledge
		setTimeout(() => {
			//for every account that could recieve events
			for (const s in this.accounts) {
				//if it has a rank it was recieved within the timeout
				if (!this.messageCache.get(event.event_id).rank.has(s)) {
					const msg = `<code>${server}</code> <b>has not recieved event<b> <code>${event.event_id}</code> of type <code>${event.type}</code> in <code>${roomID}</code> <b>within 30 seconds</b> of other servers.`;

					console.log(msg);

					this.makeSDKrequest({}, false, async (c) => {
						await c.sendHtmlNotice(this.consoleRoom, msg);
					});
				}
			}
		}, 30_000);

		//configurable warning about servers not getting events
		const fedDelayAllowed =
			this.stateManager.getConfig(roomID)?.fedDelayAllowed;
		if (fedDelayAllowed && event.type !== "m.reaction") {
			//delay and see if its been added
			setTimeout(() => {
				//for every account that could recieve events
				for (const s in this.accounts) {
					//if it has a rank it was recieved within the timeout
					if (!this.messageCache.get(event.event_id).rank.has(s)) {
						//react on the ones that dont
						this.makeSDKrequest(
							{ preferredServers: [server], roomID },
							false,
							async (c) => {
								await c.sendEvent(roomID, "m.reaction", {
									"m.relates_to": {
										event_id: event.event_id,
										key: `❌ | ${s}`,
										rel_type: "m.annotation",
									},
								});
							},
						);
					}
				}
			}, fedDelayAllowed * 1000);
		}
		//this is a mess to read but idk how to do it better, and biomejs wont let me space it more

		//redaction for state events
		if (event.type === "m.room.redaction")
			this.stateManager.redactStateEvent(roomID, event.redacts);

		//run actual event loop
		if (typeof this.onTimelineEvent === "function") {
			this.onTimelineEvent(server, roomID, event);
		} else if (this.onTimelineEvent) {
			console.error(
				`Tried to call .onTimelineEvent, but recieved ${typeof this
					.onTimelineEvent} instead of a function.`,
			);
		} else {
			console.warn("function .onTimelineEvent not supplied");
		}
	}

	/*
    performs `request` with whichever of `acceptableServers` (array) is available first.
    If acceptableServers is empty, the request will be be performed on any server not in rejectedServers
    If one of the servers in preferredServers is available, it will be used
    */
	makeSDKrequest(preference, throwError, request) {
		//create promise so that it can be stored in the queue and resolved at any time
		let resolve;
		let reject;
		const promise = new Promise((rslv, rjct) => {
			resolve = rslv;
			reject = rjct;
		});

		//actually go and make/queue the request
		this.internalMakeSDKrequest({
			requestedServers: preference,
			request,
			throwError,
			promise: {
				resolve,
				reject,
			},
		});

		//return the promise
		return promise;
	}

	//assist the horrible function below
	async nextRequest() {
		const args = this.requestQueue.shift();

		if (args) this.internalMakeSDKrequest(args);
	}

	//i am so sorry for the recursive horrors emitting from this function
	async internalMakeSDKrequest(args) {
		if (!args) throw "Why the fuck is there no args supplied??";

		const request = args.request;
		const throwError = args.throwError;
		const promise = args.promise;

		let acceptableServers;
		let rejectedServers;
		let preferredServers;
		let roomID;

		if (args.preference) {
			acceptableServers = args.preference.acceptableServers;
			rejectedServers = args.preference.rejectedServers;
			preferredServers = args.preference.preferredServers;
			roomID = args.preference.roomID;
		}

		//store the client
		let server;

		//😭
		if (roomID) {
			for (const s in this.accounts) {
				if (!(await this.accounts.get(s).getJoinedRooms())?.includes(roomID)) {
					if (rejectedServers) {
						rejectedServers.push(s);
					} else {
						rejectedServers = [s];
					}
				}
			}
		}

		//if one of the preferred options exists and is available, use it
		if (preferredServers) {
			server = preferredServers.find(
				(s) => !this.busy.get(s) && this.accounts.has(s),
			);
		}

		// if none of the preferred is found
		if (!server) {
			//if a list of acceptable servers are supplied, we will only check within that
			if (acceptableServers)
				server = acceptableServers.find(
					(s) => !this.busy.get(s) && this.accounts.has(s),
				);
			else {
				const servers = Array.from(this.accounts.keys());

				//if there is any servers we cannot use, lets find any that are not that
				if (rejectedServers)
					server = servers.find(
						(s) => !(rejectedServers.includes(s) || this.busy.get(s)),
					);
				//if theres no preference on servers, just find one that isnt busy
				else server = servers.find((s) => !this.busy.get(s));
			}
		}

		if (!server) {
			this.requestQueue.push(args);
			return;
		}

		this.busy.set(server, true);
		const client = this.accounts.get(server);

		let result;
		try {
			result = await request(client);
		} catch (e) {
			//matrix ratelimit spec
			if (e?.retryAfterMs) {
				this.internalMakeSDKrequest(args);
				setTimeout(async () => {
					//no longer timed out
					this.busy.delete(server);
					this.nextRequest();
				}, e.retryAfterMs);
				console.log(`Timed out on server ${server} for ${e.retryAfterMs} ms.`);
			} else if (
				//m.org shitting up the connection
				e?.code === "ESOCKETTIMEDOUT" ||
				e?.code === "ETIMEDOUT" ||
				e?.code === "ECONNRESET" ||
				e?.error === "Server is unavailable"
			) {
				const retryAfterMs = 60_000;
				this.internalMakeSDKrequest(args);
				setTimeout(async () => {
					//no longer timed out
					this.busy.delete(server);
					this.nextRequest();
				}, retryAfterMs);
				console.log(`Timed out on server ${server} for ${retryAfterMs} ms.`);
			} else if (throwError) {
				//throw the error, then no need to shit up the queue
				promise.reject(e);
				this.busy.delete(server);
				this.nextRequest();
			} else {
				//log error and return nothing
				console.warn(
					`UNCAUGHT ERROR WHEN MAKING SDK REQUEST ON SERVER ${server}\n${e}`,
				);
				promise.resolve();

				//onto the next
				this.busy.delete(server);
				this.nextRequest();
			}
		}

		//return whatever we got
		promise.resolve(result);

		//onto the next
		this.busy.delete(server);
		this.nextRequest();
	}

	async neverResolve() {
		return new Promise(() => {});
	}

	/*
	Set a callback to call when a new timeline event is recieved.
	This is deduplicated, and callback will be called on first occurance
	onTimelineEvent(server, roomID, event)
	*/
	async setOnTimelineEvent(f) {
		this.onTimelineEvent = f;
		return new Promise(() => {});
	}
}

export { Clients };
