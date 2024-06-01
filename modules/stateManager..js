import { ConfigManager } from "./configManager";

class StateManager {
	constructor(clients) {
		this.clients = clients;
		this.config = new ConfigManager(clients);
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

		for (const r in rooms) {
			const fetchedState = await this.clients
				.makeSDKrequest(
					{ acceptableServers: [server] },
					true,
					async (c) => await c.getRoomState(r),
				)
				//deliberately throw and catch an error to stop progression
				.catch(() => {});
		}
	}
}

export { StateManager };
