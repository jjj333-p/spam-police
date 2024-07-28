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

//organize events
const eventHandlerMap = new Map();
eventHandlerMap.set("m.policy.rule.user", (...args) =>
	banlist.newUserRule(...args),
);

await clients.setOnTimelineEvent(async (server, roomID, event) => {
	//if there was a hold on that event we wont handle it externally
	if (eventCatcher.check(event, roomID)) return;

	//check for ban async
	banlist.banCheck(server, roomID, event);

	//if theres an event handler, run it
	eventHandlerMap.get(event.type)?.(server, roomID, event);
});

async function membershipChange(server, roomID, event) {
	//ban sync is disabled
	// if(!clients.stateManager.getConfig(roomID)?.sync_bans) return;

	const parent = clients.stateManager.getParent(roomID);

	let childShortCode = "here"
	if (parent !== roomID) {
		childShortCode = Object.keys(clients.stateManager.getConfig(parent)?.children)
	}

	const eventLink = `<a href="https://matrix.to/#/${roomID}/${event.event_id}?via=${server}">${childShortCode}</a>`

	const banlistOBJ = clients.stateManager.getConfig(parent)?.banlists
	const banlistShortCodes = Object.keys(banlistOBJ)

	if (
		event.content?.membership === "ban" &&
		event.unsigned?.prev_content?.membership !== "ban"
	) {
		//attempt to message in parent room before reacting
		let msgID
		try {
			msgID = await clients.makeSDKrequest(
				{ roomID:parent },
				true,
				async (c) =>
					await c.sendHtmlText(parent, `${event.state_key} banned in ${childShortCode} for reason ${event.content?.reason} by ${event.sender}. If you would like to write this ban recommendation to a list, select its shortcode below:`),
			);
		} catch (e) {return}

		// biome-ignore lint/complexity/noForEach: these can be exectued async
		banlistShortCodes.forEach(async shortcode => {

			//catch the reaction
			eventCatcher.catch(((event, roomID) => {
				
				//right reaction on right event
				if (event.content?.["m.relates_to"]?.key !== shortcode) return false;
				if (event.content?.["m.relates_to"]?.event_id !== msgID ) return false

				//TODO powerlevels check
			
			}), //TODO on reaction)

			//TODO reacting for options
		})
		
	} else if (
		event.content?.membership !== "ban" &&
		event.unsigned?.prev_content?.membership === "ban"
	) {
		//TODO on unban
	}
}
