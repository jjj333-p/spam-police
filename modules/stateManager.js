/*
This code is provided on an as-is warranty-free basis by Joseph Winkie <jjj333.p.1325@gmail.com>

This code is licensed under the A-GPL 3.0 license found both in the "LICENSE" file of the root of this repository
as well as https://www.gnu.org/licenses/agpl-3.0.en.html. Read it to know your rights.

A complete copy of this codebase as well as runtime instructions can be found at 
https://github.com/jjj333-p/spam-police/
*/

class StateManager {
	constructor(clients) {
		//this class sits bethind clients
		this.clients = clients;

		//hold the stae somewhere
		this.stateCache = new Map();
		this.stateCacheBlame = new Map();

		//dont need to fetch ♾️ times
		this.processing = new Map();
	}

	//will run on each server as soon as the client is set to be online
	async initPerServer(server) {
		//fetch roomlist so we can get the state of each room
		let rooms;
		try {
			rooms = await this.clients.makeSDKrequest(
				{ acceptableServers: [server] },
				true,
				async (c) => await c.getJoinedRooms(),
			);
		} catch (e) {
			const err = `${server} was unable to return a joined rooms list, client is likely not syncing\n${e}`;
			console.error(err);
			this.clients.makeSDKrequest(
				{ rejectedServers: server },
				false,
				async (c) => await c.sendMessage(this.clients.consoleRoom, err),
			);
		}

		try {
			//for each room fetch the state and cache it
			for (const r of rooms) {
				this.initPerRoomOnServer(server, r);
			}
		} catch (e) {
			console.error(`Room list returned by ${server} not iterable\n${e}`);
		}
	}

	//too lazy to rename r in my cut paste, its roomID
	async initPerRoomOnServer(server, r) {
		//no need to duplicate process
		if (this.processing.get(server + r)) return;

		//indicate busy
		this.processing.set(server + r, true);

		//queue up join event

		await this.clients.makeSDKrequest(
			{ acceptableServers: [server] },
			false, //the rest will return an error, no need duplicate code
			async (c) =>
				await c.joinRoom(r, Array.from(this.clients.accounts.keys())),
		);

		let fetchedState;
		try {
			fetchedState = await this.clients.makeSDKrequest(
				{ acceptableServers: [server] },
				true,
				async (c) => await c.getRoomState(r),
			);
			//deliberately throw and catch an error to stop progression
		} catch (e) {
			const err = `${server} was unable to return room state in ${r}\n${e}`;
			console.error(err);
			this.clients.makeSDKrequest(
				{ rejectedServers: server },
				false,
				async (c) => await c.sendNotice(this.clients.consoleRoom, err),
			);
		}

		if (!Array.isArray(fetchedState)) {
			const err = `${server} returned empty state in ${r}\n`;
			console.error(err);
			this.clients.makeSDKrequest(
				{ rejectedServers: server },
				false,
				async (c) => await c.sendNotice(this.clients.consoleRoom, err),
			);

			//no longer processing
			this.processing.delete(server + r);

			return; //not much we can do here
		}

		//if we have an existing cache we verify against it
		if (this.stateCache.has(r)) {
			const existingCache = this.stateCache.get(r);

			//we gotta verify the events one by one, as we only need to verify some bits of the json
			//the rest is the server dag's problem
			for (const event of fetchedState) {
				//find result
				const foundResult = existingCache.find(
					(e) => e.type === event.type && e.state_key === event.state_key,
				);

				//if there isnt already an event in a cache that exists, its missing from somewhere
				if (!foundResult) {
					//actions to add later
					this.missingEvent(r, event, server, "cache");

					//add it to the cache, as it we may have not checked all other servers
					//and we want to have the most comprehensive room view
					existingCache.push(event);
					this.stateCacheBlame.set(event.event_id, [server]);

					//state diverge
				} else if (foundResult.event_id !== event.event_id) {
					this.disagreeEvent(
						r,
						foundResult,
						JSON.stringify(this.stateCacheBlame.get(foundResult.event_id)),
						event,
						server,
					);

					//everything matches up
				} else {
					//note that youve also gotten that event
					this.stateCacheBlame.get(event.event_id).push(server);
				}
			}

			//now make sure every previous event we've found is on this server too
			for (const event of existingCache) {
				//find result
				const foundResult = fetchedState.find(
					(e) => e.type === event.type && e.state_key === event.state_key,
				);

				//if there isnt already an event in a cache that exists, its missing from somewhere
				if (!foundResult) {
					//actions to add later
					this.missingEvent(
						r,
						event,
						JSON.stringify(this.stateCacheBlame.get(event.event_id)),
						server,
					);

					//dont need to add to cache what we pulled from it
				}
			}
		} else {
			//and if we dont, we just blindly store it for now
			this.stateCache.set(r, fetchedState);

			//assign blame
			for (const e of fetchedState) {
				this.stateCacheBlame.set(e.event_id, [server]);
			}
		}

		//no longer processing
		this.processing.delete(server + r);
	}

	async initPerRoom(roomID) {
		for (const server in this.clients.accounts) {
			this.initPerRoomOnServer(server, roomID);
		}
	}

	async missingEvent(roomID, event, serverWith, serverWithout) {
		console.warn(
			`MISSING STATE EVENT: in room ${roomID}, ${serverWithout} is missing event of ID ${event.event_id}, type ${event.type}, and key ${event.state_key}, found on ${serverWith}.`,
		);
	}

	async disagreeEvent(roomID, event1, server1, event2, server2) {
		console.warn(
			`STATE DIVERGE:  in room ${roomID}, under type ${event1.type} and key ${event1.state_key}, ${server1} sees event ${event1.event_id} and ${server2} sees ${event2.event_id}`,
		);
	}

	async onStateEvent(server, roomID, event) {
		const cache = this.stateCache.get(roomID);

		if (cache) {
			// check event id or prev event id here
			const matchFromCache = cache.find(
				(e) => e.type === event.type && e.state_key === event.state_key,
			);

			if (!matchFromCache) {
				//new state
				cache.push(event);
				this.stateCacheBlame.set(event.event_id, [server]);
			} else if (matchFromCache.event_id === event.unsigned?.replaces_state) {
				//all events not with that relational id
				const hold = cache.filter(
					(e) => e.type !== event.type || e.state_key !== event.state_key,
				);

				//add our new event to that filter, and push it
				hold.push(event);
				this.stateCacheBlame.set(event.event_id, [server]);

				//now write that to the cache
				this.stateCache.set(roomID, hold);

				//this will be very interesting if v8 doesnt have a really good garbage collector
			} else if (matchFromCache.event_id === event.event_id) {
				this.stateCacheBlame.get(event.event_id).push(server);
				//handle duplicate catching in normal timeline syncing
			} else {
				//TODO: error
				this.disagreeEvent(
					roomID,
					matchFromCache,
					JSON.stringify(this.stateCacheBlame.get(matchFromCache.event_id)),
					event,
					server,
				);
			}
		} else {
			//if not cached, need to init sync
			this.initPerRoom(roomID);
		}
	}

	getState(roomID, conditional) {
		// if (roomID === "!odwJFwanVTgIblSUtg:matrix.org") {
		// 	let a;
		// }

		const state = this.stateCache.get(roomID);

		//there should be something but if there isnt go ahead and fetch in the background for next time
		if (!state) this.initPerRoom(roomID);

		if (state && !Array.isArray(state)) {
			console.error(`State is not an array for roomID ${roomID}:`, state);
		}

		//return as filtered
		return Array.isArray(state) ? state.filter(conditional) : undefined;
	}

	async redactStateEvent(roomID, event_id) {
		const event = this.getState(roomID, (e) => e.event_id === event_id)?.[0];

		if (event) event.content = {};

		return;
	}

	getRawConfig(roomID) {
		return this.getState(
			roomID,
			(e) => e.type === "agency.pain.anti-scam.config" && e.state_key === "",
		)?.[0]?.content;
	}

	//verifies the room's parents and spits it out
	getParent(roomID) {
		const parent = this.getRawConfig(roomID)?.parent;

		//if no parent it adopts itself (for code convenience)
		if (!parent) {
			return roomID;
		}

		const children = this.getRawConfig(parent)?.children;

		if (Object.values(children).includes(roomID)) return parent;

		/*else*/ return roomID;
	}

	//config that actually applies to the room
	getConfig(roomID) {
		return this.getRawConfig(this.getParent(roomID));
	}

	//verifies the room's children and spits it out
	getChildren(roomID) {
		const res = {
			map: new Map(),
			ids: [],
			shortCodes: [],
		};

		//get from config
		const claimedChildrenObj = this.getRawConfig(roomID)?.children;

		//if no children in config, no children
		if (!claimedChildrenObj) return res;

		//pull shortcodes for easy commands
		const childShortCodes = Object.keys(this.getRawConfig(roomID)?.children);

		//check each one for validity
		for (const shortCode of childShortCodes) {
			//resolve
			const id = claimedChildrenObj[shortCode];

			//verify
			if (this.getParent(id) !== roomID) continue;

			//add to res
			res.map.set(shortCode, id);
			res.shortCodes.push(shortCode);
			res.ids.push(id);
		}

		return res;
	}

	//combines parent and children
	getFamily(roomID) {
		const parent = this.getParent(roomID);
		const res = this.getChildren(parent);
		res.map.set("parent", parent);
		res.shortCodes.push("parent");
		res.ids.push(parent);
	}
}

export { StateManager };
