import {
	AutojoinRoomsMixin,
	MatrixClient,
	SimpleFsStorageProvider,
} from "matrix-bot-sdk";

class Clients {
	constructor(login) {
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

				await client.start(this.filter);

				this.accounts.set(server, client);

				//wait 1 second for the other clients to at least attempt to login and settle before queueing events
				setTimeout(async () => {
					//for every room this account is in, attempt to join with other accounts
					for (const roomID of await client.getJoinedRooms()) {
						for (const s of Array.from(this.accounts.keys())) {
							//dont need to join the room in our joined list
							if (s === server) continue;

							//queue up join event
							this.makeSDKrequest(
								{ acceptableServers: [s] },
								async (c) => await c.joinRoom(roomID, server),
								(err) => {
									console.warn(
										`Account on ${s} unable to join ${roomID} which ${server} is joined to, with error\n${err}`,
									);

									//send warning in room (MAY BE REMOVED LATER)
									this.makeSDKrequest(
										{ acceptableServers: [server] },
										async (client) => {
											await client.sendNotice(
												roomID,
												`Unable to join this room with ${await this.accounts
													.get(s)
													.getUserId()}.`,
											);
										},
									);
								},
							);
						}
					}
				}, 1000);
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
				.sendText(
					this.consoleRoom,
					`Successfully logged in to <code>${server}</code> instance.`,
				);
		});
	}

	async internalOnEvent(server, roomID, event) {
		//if its a state event, divert
		if (typeof event.state_key !== "undefined") {
			if (typeof this.onStateEvent === "function") {
				this.onStateEvent(server, roomID, event);
			} else if (this.onStateEvent) {
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
		if (this.messageCache.has(event.event_id)) {
			this.messageCache.get(event.event_id).rank.set(server, ts);
			console.log(`Recieved ${event.event_id}, on ${server}, at ${ts}`);
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
	async makeSDKrequest(
		{ acceptableServers, rejectedServers, preferredServers },
		request,
		onError,
	) {
		//store the client
		let server;

		//promise to return

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
			let resolve;
			let reject;
			const promise = new Promise((rslv, rjct) => {
				resolve = rslv;
				reject = rjct;
			});

			this.requestQueue.push({
				request,
				acceptableServers,
				rejectedServers,
				preferredServers,
				promise: { resolve, reject },
			});

			//this wil be resolved when it makes it through the queue
			//this way it can be successfully awaited
			return promise;
		}

		this.busy.set(server, true);
		let timedout = false;
		const client = this.accounts.get(server);

		try {
			await request(client);
		} catch (e) {
			if (e?.retryAfterMs) {
				timedout = true;
				let resolve;
				let reject;
				const promise = new Promise((rslv, rjct) => {
					resolve = rslv;
					reject = rjct;
				});
				this.requestQueue.push({
					request,
					acceptableServers,
					rejectedServers,
					preferredServers,
					promise: { resolve, reject },
				});
				setTimeout(() => {
					timedout = false;
				}, e.retryAfterMs);
				console.log(`Timed out on server ${server} for ${e.retryAfterMs} ms.`);
			} else if (onError) {
				onError(e);
			} else {
				console.warn(
					`UNCAUGHT ERROR WHEN MAKING SDK REQUEST ON SERVER ${server}\n${e}`,
				);
			}
		}

		const i = setInterval(async () => {
			//will keep looping until not timed out and can go through this loop until caught up
			if (timedout) return;

			const qr = this.requestQueue.pop();

			if (!qr) {
				clearInterval(i);
				this.busy.delete(server);
				return;
			}

			//if a list of acceptable servers was passed and this is not it, or its in the rejected list
			//put it back at the end of the queue and keep chugging
			if (
				(qr.acceptableServers && !qr.acceptableServers.includes(server)) ||
				qr.rejectedServers?.includes(server)
			) {
				this.requestQueue.push(qr);
				return;
			}

			try {
				await qr.request(client, server);
			} catch (e) {
				if (e?.retryAfterMs) {
					timedout = true;
					this.requestQueue.push(qr);
					setTimeout(() => {
						timedout = false;
					}, e.retryAfterMs);
					console.log(
						`Timed out on server ${server} for ${e.retryAfterMs} ms.`,
					);
				} else if (onError) {
					onError(e);
				} else {
					console.warn(
						`UNCAUGHT ERROR WHEN MAKING SDK REQUEST ON SERVER ${server}\n${e}`,
					);
					qr.promise.reject(e);
				}
				return;
			}
			qr.promise.resolve();
		}, 100);
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

	/*
	Set a callback to call when a new state event is recieved.
	This is NOT deduplicated, and callback will be called on every reception
	onStateEvent(server, roomID, event)
	*/
	async setOnStateEvent(f) {
		this.onTimelineEvent = f;
		return new Promise(() => {});
	}
}

export { Clients };
