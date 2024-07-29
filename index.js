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

	let childShortCode = "here";
	if (parent !== roomID) {
		childShortCode = Object.keys(
			clients.stateManager.getConfig(parent)?.children,
		);
	}

	const eventLink = `<a href="https://matrix.to/#/${roomID}/${event.event_id}?via=${server}">${childShortCode}</a>`;

	const banlistOBJ = clients.stateManager.getConfig(parent)?.banlists;
	const banlistShortCodes = Object.keys(banlistOBJ);

	if (
		event.content?.membership === "ban" &&
		event.unsigned?.prev_content?.membership !== "ban"
	) {
		//attempt to message in parent room before reacting
		let msgID;
		try {
			msgID = await clients.makeSDKrequest(
				{ roomID: parent },
				true,
				async (c) =>
					await c.sendHtmlText(
						parent,
						`${event.state_key} banned in ${childShortCode} for reason ${event.content?.reason} by ${event.sender}. If you would like to write this ban recommendation to a list, select its shortcode below:`,
					),
			);
		} catch (e) {
			return;
		}

		// biome-ignore lint/complexity/noForEach: these can be exectued async
		banlistShortCodes.forEach(async (shortcode) => {
			const banlistID = banlistOBJ[shortcode];

			let botReactionID;
			try {
				botReactionID = await clients.makeSDKrequest(
					{ roomID: parent },
					true,
					async (c) =>
						await c.sendMessage(parent, {
							"m.relates_to": {
								key: shortcode,
								event_id: msgID,
								rel_type: "m.annotation",
							},
						}),
				);
			} catch (e) {
				clients.makeSDKrequest(
					{ roomID: parent },
					false,
					async (c) =>
						await c.sendHtmlNotice(
							parent,
							`Experienced the following error trying to react with <code>${shortcode}</code>. You may react with this manually or run <code>ban <user> <shortcode | roomID> [reason]</code>.\n<code><pre>${e}</pre></code>`,
						),
				);
			}

			//catch the selection
			eventCatcher.catch(
				(reactionEvent, reactionRoomID) => {
					//dont use our own reaction event (the server should deduplicate if theres a race condition)
					if (reactionEvent.event_id === botReactionID) return false;

					//right reaction on right event
					if (reactionRoomID !== parent) return false;
					if (reactionEvent.content?.["m.relates_to"]?.key !== shortcode)
						return false;
					if (reactionEvent.content?.["m.relates_to"]?.event_id !== msgID)
						return false;

					//anonymous writes from within its management room
					const anonWrite =
						clients.stateManager.getParent(banlistID) === parent;

					//managed rooms check the pl of the management room
					let rtc = banlistID;
					if (anonWrite) rtc = parent;

					const powerLevels = clients.stateManager.getPowerLevels(rtc);

					//technically possible, but only really happens on dendrite and means we cant do anything anyways
					//more likely means we havent loaded the room state yet which means we cant check config so nothing to do anyways
					if (
						typeof powerLevels !== "object" ||
						Object.keys(powerLevels).length < 1
					) {
						clients.makeSDKrequest(
							{ roomID: parent },
							false,
							async (c) =>
								await c.sendMessage(reactionRoomID, {
									body: `${event.sender}: Unable to find powerlevels event for ${shortcode}. This may be a temporary resolution error.`,
									"m.mentions": { user_ids: [event.sender] },
								}),
						);
					}

					let plToWrite = powerLevels.state_default;

					if (powerLevels.events?.)

					//TODO powerlevels check

					//on caught reaction
				},
				(reactionEvent, reactionRoomID) => {},
			);

			//TODO reacting for options
		});
	} else if (
		event.content?.membership !== "ban" &&
		event.unsigned?.prev_content?.membership === "ban"
	) {
		//TODO on unban
	}
}
