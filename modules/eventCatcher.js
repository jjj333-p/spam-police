class EventCatcher {
	constructor() {
		this.associations = [];
	}

	//reserves a condition to be caught
	catch(conditional, run) {
		this.associations.push({ id: this.associations.length, conditional, run });
	}

	check(event, roomID) {
		//find the event hold
		const hold = this.associations.find((a) => a.conditional(event, roomID));

		//if there isnt one retun false that there isnt
		if (!hold) return false;

		//if there is one, remove it for future
		this.associations = this.associations.filter((a) => a.id !== hold.id);

		hold.run(event, roomID);

		return true;
	}
}

export { EventCatcher };
