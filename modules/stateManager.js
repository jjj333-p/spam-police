import { ConfigManager } from "./configManager.js";

class StateManager {
	constructor(clients) {
		//this class sits between the clients and some niche case handlers
		this.clients = clients;
		this.config = new ConfigManager(clients);

		//hold the stae somewhere
		this.stateCache = new Map();
		this.stateCacheBlame = new Map();
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
				async (c) => c.sendMessage(this.clients.consoleRoom, err),
			);
		}

		//for each room fetch the state and cache it
		for (const r of rooms) {
			let fetchedState;
			try {
				fetchedState = await this.clients.makeSDKrequest(
					{ acceptableServers: [server] },
					true,
					async (c) => {
						const res = await c.getRoomState(r);
						return res;
					},
				);
				//deliberately throw and catch an error to stop progression
			} catch (e) {
				const err = `${server} was unable to return room state in ${r}\n${e}`;
				console.error(err);
				this.clients.makeSDKrequest(
					{ rejectedServers: server },
					false,
					async (c) => c.sendMessage(this.clients.consoleRoom, err),
				);
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

	async onStateEvent(roomID, event, server) {}
}

export { StateManager };

/*
- get first to respond to get state
- next ones, try to find event with same key and type
- check if same event id, if not report state diverge
- if cannot find, report state reset
- run through already cached events and do same against new events 
	(catch all missing on either side)


- on new event, check if its already in cache or previous event is
	- need event.unsigned.replaces_state
- if new event, wait and timeout on other servers recieving it.
- update cache

- runnof classes for config and banlist reading
*/
