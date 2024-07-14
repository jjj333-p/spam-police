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
		return this.clients.stateManager.getState(roomID, (e) => {
			let matchMXID = mxid;

			//if the ban was erased
			if (!e.content) {
				return false;
			}

			//parce out the mxid from the key
			const potentialMXID = e.content?.entity;

			//if mismatch, its invalid
			//mothet sidev
			if (
				e.content.recommendation !== "org.matrix.mjolnir.ban" &&
				e.content.recommendation !== "m.ban"
			) {
				return false;
			}

			//if exact match, it is match
			if (potentialMXID === matchMXID) {
				return true;
			}

			//if theres no wildcards, and not an exact match, its not a match
			if (!potentialMXID.includes("*")) {
				return false;
			}

			//split around the wildcards
			const p = potentialMXID.split("*");

			//check before first wildcard
			const firstpart = p.shift();
			if (!matchMXID.startsWith(firstpart)) {
				return false;
			}

			//check after last wildcard
			const lastpart = p.pop();
			if (!matchMXID.endsWith(lastpart)) {
				return false;
			}

			//parce off the evaluated start and end
			matchMXID = matchMXID.substring(
				firstpart.length,
				matchMXID.length - lastpart.length,
			);

			//loop until a condition to return arises
			while (true) {
				//if there is no more parts to match and everything else around wildcards matched
				//it is match
				if (p.length < 1) {
					return true;
				}

				//if one of the bits between wildcards doesnt exist, it cant be a match
				if (!matchMXID.includes(p[0])) {
					return false;
				}

				//match the remaining parts in order starting with the first one left to match, then removing everything
				//before it, and going back through the process untill theres nothing left to match
				//have to use a substring of the original in case there was multiple matches of the next item to match
				const nexttomatch = p.shift();
				const r = matchMXID.split(nexttomatch);
				matchMXID = matchMXID.substring(nexttomatch.length + r[0]);
			}
		});
	}
	getRulesForUser(mxid, roomID) {
		//get banlists config and return if there is none
		const config = this.clients.stateManager.getConfig(roomID);
		const banlists = config?.banlists;
		if (!banlists) return;

		//store results
		const results = [];

		//for each followed banlist
		for (const shortCode in banlists) {
			//get rules, and on each of them

			const r = this.getRulesForUserOnRoom(mxid, banlists[shortCode]);

			if (!r) continue;

			for (const event of r) {
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

export { BanlistReader };
