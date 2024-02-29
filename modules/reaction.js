class Reaction {
	constructor(logRoom) {
		this.logRoom = logRoom;
	}

	async run({ client, roomId, event, mxid, reactionQueue }) {
		//should never happen but aparently it does
		//https://matrix.pain.agency/_matrix/media/v3/download/pain.agency/51cc6283f64310640f67daa84f284ae8e7a08a969bd2f7f57920a4d30aa83c00
		if (!event.content["m.relates_to"]) return;
		if (!event.content["m.relates_to"].event_id) return;

		if (roomId === this.logRoom) {
			//get queued function
			const qf = reactionQueue.get(event.content["m.relates_to"].event_id);

			//make sure the reaction was to a scam entry
			if (!qf) {
				return;
			}

			qf(event);
		}
	}
}

export { Reaction };
