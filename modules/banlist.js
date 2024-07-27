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
	ruleMatchesUser(mxid, e) {
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
	}
	getRulesForUserOnRoom(mxid, roomID) {
		return this.clients.stateManager.getState(roomID, (e) =>
			this.ruleMatchesUser(mxid, e),
		);
	}
	getRulesForUser(mxid, roomID) {
		//get banlists config and return if there is none
		const config = this.clients.stateManager.getConfig(roomID);
		const banlists = config?.banlists;
		if (typeof banlists !== "object") return;

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

	async banCheck(server, roomID, event) {
		//this will be the end of the timeline event loop. it comes after everything
		const rules = this.getRulesForUser(event.sender, roomID);
		if (!(rules?.length > 0)) return;

		//generate reason
		let reason = "";
		for (const rule of rules) {
			reason += `${rule.shortCode} (${rule.event.content?.reason}) `;
		}

		const s = event.sender.split(":")[1];

		const parent = this.clients.stateManager.getParent(roomID);

		try {
			await this.clients.makeSDKrequest(
				{ preferredServers: [s], roomID },
				true,
				async (c) =>
					await c.sendStateEvent(roomID, "m.room.member", event.sender, {
						membership: "ban",
						reason,
						policy: rules,
					}),
			);
		} catch (e) {
			const errMessage = `Attempted to ban ${event.sender} in <a href=\"https://matrix.to/#/${roomID}\">${roomID}</a> for reason <code>${reason}</code>, failed with error:\n<pre><code>${e}\n</code></pre>\n`;

			console.error(errMessage);

			//notify cant ban
			this.clients.makeSDKrequest(
				{ roomID },
				false,
				async (c) => await c.sendHtmlNotice(parent, errMessage),
			);

			return;
		}

		//notify of ban
		this.clients.makeSDKrequest(
			{ roomID },
			false,
			async (c) =>
				await c.sendHtmlNotice(
					parent,
					`Banned ${event.sender} in <a href=\"https://matrix.to/#/${roomID}\">${roomID}</a> for reason <code>${reason}</code>.`,
				),
		);
	}

	async newUserRule(server, roomID, event) {
		if (
			event.content?.recommendation !== "org.matrix.mjolnir.ban" &&
			event.content?.recommendation !== "m.ban"
		)
			return;

		//async as this can happen at the same time or after
		this.clients
			.makeSDKrequest(
				{ roomID },
				true, //if we lack perms to react
				async (c) =>
					await c.sendMessage(roomID, {
						"m.relates_to": {
							event_id: "$Q1r6Kp010eKhqzNV4J67Ga-SUmWmjcUi9aVUFz9Jfs0",
							key: "✅",
							rel_type: "m.annotation",
						},
					}),
			)
			.catch(() =>
				this.clients.makeSDKrequest(
					{ roomID },
					false, //if we cant send a read receipt how did we get the event??
					async (c) => await c.sendReadReceipt(roomID, event.event_id),
				),
			);

		for (const r of this.clients.joinedRooms) {
			//get banlists config and return if there is none
			const config = this.clients.stateManager.getConfig(r);
			const banlists = config?.banlists;
			if (typeof banlists !== "object") continue;

			const parent = this.clients.stateManager.getParent(r);

			//lazy
			for (const shortCode in banlists) {
				if (banlists[shortCode] !== roomID) continue;

				const reason = `${shortCode} (${event.content?.reason})`;

				//all users in room matching policy
				const banworthyUsers = this.clients.stateManager.getState(
					r,
					(e) =>
						e.type === "m.room.member" &&
						(e.content.membership === "join" ||
							e.content.membership === "invite") &&
						this.ruleMatchesUser(e.state_key, event),
				);

				//for each ^
				for (const { state_key: user } of banworthyUsers) {
					//if possible ban on the server the user is on, prevent softfailed events and fedi lag where important
					const s = event.content.entity?.split(":")[1];

					try {
						await this.clients.makeSDKrequest(
							{ preferredServers: [s], roomID: r },
							true,
							async (c) =>
								await c.sendStateEvent(r, "m.room.member", user, {
									membership: "ban",
									reason,
									policy: [event],
								}),
						);
					} catch (e) {
						const errMessage = `Attempted to ban ${user} in <a href=\"https://matrix.to/#/${r}\">${r}</a> for reason <code>${reason}</code>, failed with error:\n<pre><code>${e}\n</code></pre>\n`;

						console.error(errMessage);

						//notify cant ban
						this.clients.makeSDKrequest(
							{ r },
							false,
							async (c) => await c.sendHtmlNotice(parent, errMessage),
						);

						//only one of the for loop should succeed
						//save a tiny bit of cpu
						break;
					}

					//notify of ban
					this.clients.makeSDKrequest(
						{ parent },
						false,
						async (c) =>
							await c.sendHtmlNotice(
								parent,
								`Banned ${user} in <a href=\"https://matrix.to/#/${r}\">${r}</a> for reason <code>${reason}</code>.`,
							),
					);
				}
			}
		}
	}
}

export { BanlistReader };
