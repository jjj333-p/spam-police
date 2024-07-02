import { ConfigManager } from "./configManager.js";

class StateManager {
	constructor(clients) {
		//this class sits between the clients and some niche case handlers
		this.clients = clients;
		this.config = new ConfigManager(clients);

		//hold the stae somewhere
		this.stateCache = new Map();
	}

	async initPerServer(server) {
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
			let b;
		}
	}
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
- if new event, wait and timeout on other servers recieving it.
- update cache

- runnof classes for config and banlist reading
*/
