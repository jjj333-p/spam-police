/*
This code is provided on an as-is warranty-free basis by Joseph Winkie <jjj333.p.1325@gmail.com>

This code is licensed under the A-GPL 3.0 license found both in the "LICENSE" file of the root of this repository
as well as https://www.gnu.org/licenses/agpl-3.0.en.html. Read it to know your rights.

A complete copy of this codebase as well as runtime instructions can be found at 
https://github.com/jjj333-p/spam-police/
*/

//this file is mostly just orchestrating the different componets together

//Import dependencies
import { readFileSync } from "node:fs";
import { parse } from "yaml";
// import mps from "@gnuxie/matrix-protection-suite";

//Import modules
import { Clients } from "./modules/clients.js";
import { EventCatcher } from "./modules/eventCatcher.js";
import { BanlistReader } from "./modules/banlist.js";
import { BanHandler } from "./modules/ban.js";

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
const banHandler = new BanHandler(clients, eventCatcher);

const commandHandlerMap = new Map();

//organize events
const eventHandlerMap = new Map();
eventHandlerMap.set("m.policy.rule.user", (...args) =>
	banlist.newUserRule(...args),
);
eventHandlerMap.set("m.room.member", (...args) =>
	banHandler.membershipChange(...args),
);
eventHandlerMap.set("m.room.message", async (server, roomID, event) => {
	const prefix =
		clients.stateManager.getConfig(roomID)?.prefix ||
		loginParsed?.prefix ||
		console.error("No prefix supplied in login.yaml, using + as the prefix.") ||
		"+";

	//prefix required for command
	if (!event.content?.body?.startsWith(prefix)) {
		//get all mxids
		const mxids = [];
		for (const client of Array.from(clients.accounts.values()))
			mxids.push(await client.getUserId());

		//check for display name
		if (
			event.content?.body?.includes(loginParsed.displayname) ||
			mxids.some((m) => event.content?.body?.includes(m))
		) {
			clients.makeSDKrequest(
				{ preferredServers: [server], roomID },
				false,
				async (c) => {
					await c.sendEvent(roomID, "m.reaction", {
						"m.relates_to": {
							event_id: event.event_id,
							key: `${prefix}help`,
							rel_type: "m.annotation",
						},
					});
				},
			);
		}
	}
});

clients.setOnTimelineEvent(async (server, roomID, event) => {
	//if there was a hold on that event we wont handle it externally
	if (eventCatcher.check(event, roomID)) return;

	//check for ban async
	banlist.banCheck(server, roomID, event);

	//if theres an event handler, run it
	eventHandlerMap.get(event.type)?.(server, roomID, event);
});
