import { ConfigManager } from "./configManager";

class StateManager {
	constructor(clients) {
		this.clients = clients;
		this.config = new ConfigManager(clients);
	}

	async initPerServer(server) {
		// try {
		// }
	}
}

export { StateManager };
