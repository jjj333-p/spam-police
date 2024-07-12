/*
This code is provided on an as-is warranty-free basis by Joseph Winkie <jjj333.p.1325@gmail.com>

This code is licensed under the A-GPL 3.0 license found both in the "LICENSE" file of the root of this repository
as well as https://www.gnu.org/licenses/agpl-3.0.en.html. Read it to know your rights.

A complete copy of this codebase as well as runtime instructions can be found at 
https://github.com/jjj333-p/spam-police/
*/

class BanlistReader {
	constructor(clients, eventCatcher) {
		this.clients = clients;
		this.eventCatcher = eventCatcher;
	}
	getRulesForUserOnRoom(mxid, roomID) {
		this.clients.stateManager.getState(roomID, (e) => {});
	}
	getRulesForUser(mxid) {
		//get banlists config and return if there is none
		const config = this.clients.stateManager.getConfig(roomID);
		const banlists = config?.banlists;
		if (!banlists) return;

		//store results
		results = [];

		//for each followed banlist
		for (const shortCode in banlists) {
			//get rules, and on each of them
			for (const event of this.getRulesForUserOnRoom(
				mxid,
				banlists[shortCode],
			)) {
				//add them to results
				results.push({
					shortCode,
					roomID: banlists[shortCode],
					event,
				});
			}
		}

		return results;
	}
}
