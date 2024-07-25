/*
This code is provided on an as-is warranty-free basis by Joseph Winkie <jjj333.p.1325@gmail.com>

This code is licensed under the A-GPL 3.0 license found both in the "LICENSE" file of the root of this repository
as well as https://www.gnu.org/licenses/agpl-3.0.en.html. Read it to know your rights.

A complete copy of this codebase as well as runtime instructions can be found at 
https://github.com/jjj333-p/spam-police/
*/

//Import dependencies
import { readFileSync } from "node:fs";
import { parse } from "yaml";
// import mps from "@gnuxie/matrix-protection-suite";

//Import modules
import { Clients } from "./modules/clients.js";
import { EventCatcher } from "./modules/eventCatcher.js";
import { BanlistReader } from "./modules/banlist.js";

// import { blacklist } from "./modules/blacklist.js";
// import { redaction } from "./modules/redaction.js";
// import { database } from "./modules/db.js";
// import { message } from "./modules/message.js";
// import { Reaction } from "./modules/reaction.js";
// import { BanlistReader } from "./modules/banlistReader.js";

//Parse YAML configuration file
const loginFile = readFileSync("./db/login.yaml", "utf8");
const loginParsed = parse(loginFile);

const clients = new Clients(loginParsed);
const eventCatcher = new EventCatcher();
const banlist = new BanlistReader(clients, eventCatcher);

await clients.setOnTimelineEvent(async (server, roomID, event) => {
	//if there was a hold on that event we wont handle it externally
	if (eventCatcher.check(event, roomID)) return;

	//check for ban async
	banCheck(server, roomID, event);

	switch (event.type) {
		//this many nested for loops could get out of hand very quick
		case "m.policy.rule.user":
			if (
				event.content?.recommendation !== "org.matrix.mjolnir.ban" &&
				event.content?.recommendation !== "m.ban"
			)
				break;

			//TODO: indicate receipt

			//async as this can happen at the same time or after
			clients
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
					clients.makeSDKrequest(
						{ roomID },
						false, //if we cant send a read receipt how did we get the event??
						async (c) => await c.sendReadReceipt(roomID, event.event_id),
					),
				);

			for (const r of clients.joinedRooms) {
				//get banlists config and return if there is none
				const config = clients.stateManager.getConfig(r);
				const banlists = config?.banlists;
				if (typeof banlists !== "object") continue;

				const parent = clients.stateManager.getParent(r);

				//lazy
				for (const shortCode in banlists) {
					const reason = `${shortCode} (${event.content?.reason})`;

					if (banlists[shortCode] !== roomID) continue;

					//all users in room matching policy
					const banworthyUsers = clients.stateManager.getState(
						r,
						(e) =>
							e.type === "m.room.member" &&
							(e.content.membership === "join" ||
								e.content.membership === "invite") &&
							banlist.ruleMatchesUser(e.state_key, event),
					);

					//for each ^
					for (const user of banworthyUsers) {
						//if possible ban on the server the user is on, prevent softfailed events and fedi lag where important
						const s = event.content.entity?.split(":")[1];

						try {
							await clients.makeSDKrequest(
								{ preferredServers: [s], roomID: parent },
								true,
								async (c) => await c.banUser(user, r, reason),
							);
						} catch (e) {
							const errMessage = `Attempted to ban ${user} in <a href=\"https://matrix.to/#/${r}\">${r}</a> for reason <code>${reason}</code>, failed with error:\n<pre><code>${e}\n</code></pre>\n`;

							console.error(errMessage);

							//notify cant ban
							clients.makeSDKrequest(
								{ r },
								false,
								async (c) => await c.sendHtmlNotice(parent, errMessage),
							);

							//only one of the for loop should succeed
							//save a tiny bit of cpu
							break;
						}

						//notify of ban
						clients.makeSDKrequest(
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

			break;
	}
});

async function banCheck(server, roomID, event) {
	//this will be the end of the timeline event loop. it comes after everything
	const rules = banlist.getRulesForUser(event.sender, roomID);
	if (!(rules?.length > 0)) return;

	//generate reason
	let reason = "";
	for (const rule of rules) {
		reason += `${rule.shortCode} (${rule.event.content?.reason}) `;
	}

	const s = event.sender.split(":")[1];

	const parent = clients.stateManager.getParent(roomID);

	try {
		await clients.makeSDKrequest(
			{ preferredServers: [s], roomID },
			true,
			async (c) => await c.banUser(event.sender, roomID, reason),
		);
	} catch (e) {
		const errMessage = `Attempted to ban ${event.sender} in <a href=\"https://matrix.to/#/${roomID}\">${roomID}</a> for reason <code>${reason}</code>, failed with error:\n<pre><code>${e}\n</code></pre>\n`;

		console.error(errMessage);

		//notify cant ban
		clients.makeSDKrequest(
			{ roomID },
			false,
			async (c) => await c.sendHtmlNotice(parent, errMessage),
		);

		return;
	}

	//notify of ban
	clients.makeSDKrequest(
		{ roomID },
		false,
		async (c) =>
			await c.sendHtmlNotice(
				parent,
				`Banned ${event.sender} in <a href=\"https://matrix.to/#/${roomID}\">${roomID}</a> for reason <code>${reason}</code>.`,
			),
	);
}
