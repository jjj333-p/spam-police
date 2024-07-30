/*
This code is provided on an as-is warranty-free basis by Joseph Winkie <jjj333.p.1325@gmail.com>

This code is licensed under the A-GPL 3.0 license found both in the "LICENSE" file of the root of this repository
as well as https://www.gnu.org/licenses/agpl-3.0.en.html. Read it to know your rights.

A complete copy of this codebase as well as runtime instructions can be found at 
https://github.com/jjj333-p/spam-police/
*/

import crypto from "node:crypto";

class EventCatcher {
	constructor() {
		this.associations = [];
	}

	//reserves a condition to be caught
	catch(conditional, run) {
		this.associations.push({ id: this.newID(), conditional, run });
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

	newID() {
		return crypto.randomBytes(32).toString("base64");
	}
}

export { EventCatcher };
