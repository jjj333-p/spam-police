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

	try {
		await clients.makeSDKrequest(
			{ preferredServers: [s], roomID },
			true,
			async (c) => await c.banUser(event.sender, roomID, reason),
		);
	} catch (e) {
		const parent = clients.stateManager.getParent(roomID);

		const errMessage = `Attempted to ban ${event.sender} for reason ${reason}, failed with error:\n<pre><code>${e}\n</code></pre>\n`;

		console.error(errMessage);

		clients.makeSDKrequest({ roomID }, false, async (c) =>
			c.sendHtmlNotice(roomID, errMessage),
		);
	}
}
