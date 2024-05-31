class ConfigManager {
	constructor(clients) {
		this.clients = clients;
		this.internalConfigMap = new Map();
	}
	async newConfigStateEvent(roomID, event) {
		this.internalConfigMap.set(roomID, event.content);
	}
	//return the raw config content as found
	getRaw(roomID) {
		return this.internalConfigMap.get(roomID);
	}
	//todo: updaters and fetchers
}

export { ConfigManager };
