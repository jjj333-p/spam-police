class BanHandler {
	constructor(clients, eventCatcher) {
		this.clients = clients;
		this.eventCatcher = eventCatcher;
	}

	async writeBan(
		roomID,
		powerLevels,
		moderator,
		shortcode,
		banlistID,
		bannedUser,
		userProvidedReason,
		anonWrite,
	) {
		let plToWrite = powerLevels.state_default;

		if (powerLevels.events?.["m.policy.rule.user"] !== undefined)
			plToWrite = powerLevels.events?.["m.policy.rule.user"];

		const acceptableServers = [];

		for (const bs of Array.from(this.clients.accounts.keys())) {
			//get pl of this account
			const pl =
				powerLevels.users?.[await this.clients.accounts.get(bs).getUserId()] ||
				powerLevels.users_default ||
				0;

			//too low pl to ban
			if (pl < plToWrite) continue;

			acceptableServers.push(bs);
		}

		if (acceptableServers.length < 1) {
			this.clients.makeSDKrequest(
				{ roomID },
				false,
				async (c) =>
					await c.sendMessage(roomID, {
						body: `🍃 | I do not have the required PL to write to ${shortcode}.`,
						msgtype: "m.text",
						"m.mentions": { user_ids: [moderator] },
					}),
			);

			return;
		}

		//what if you wanted to use a mxid as a state key but god said "Error: M_FORBIDDEN: You are not allowed to set others state"
		const newStateKey = `_${bannedUser?.substring(1)}`;

		//just element things
		let reason = userProvidedReason || "<No reason provided>";

		//allow writing from any room at the expense of anonimity
		if (!anonWrite) {
			reason = `${moderator} - ${reason}`;
		}

		let policyID;
		try {
			policyID = await this.clients.makeSDKrequest(
				{ roomID: banlistID, acceptableServers },
				true,
				async (c) =>
					await c.sendStateEvent(banlistID, "m.policy.rule.user", newStateKey, {
						entity: bannedUser,
						reason,
						recommendation: "m.ban",
					}),
			);
		} catch (e) {
			this.clients.makeSDKrequest(
				{ roomID },
				false,
				async (c) =>
					await c.sendMessage(parent, {
						body: `‼️ | Experienced the following error trying to write ban for ${bannedUser} in ${shortcode}\n${e}`,
						msgtype: "m.text",
						"m.mentions": { user_ids: [moderator] },
					}),
			);
			return;
		}

		const body = `➕ | Successfully wrote policy banning ${bannedUser} on behalf of ${moderator} with reason <code>${reason}</code>\n<a href="https://matrix.to/#/${banlistID}/${policyID}">Link to policy in ${shortcode}/a>`;
		const p = this.clients.stateManager.getParent(banlistID);

		//post success in both the room you ran the command, and the banlist parent, unless they are the same
		for (const r of [roomID, ...(p === roomID ? [] : [p])])
			this.clients.makeSDKrequest(
				{ roomID },
				false,
				async (c) =>
					await c.sendMessage(r, {
						body,
						format: "org.matrix.custom.html",
						formatted_body: body,
						msgtype: "m.text",
						"m.mentions": { user_ids: [moderator] },
					}),
			);
	}

	async membershipChange(server, roomID, event) {
		//ban sync is disabled
		// if(!clients.stateManager.getConfig(roomID)?.sync_bans) return;

		const parent = this.clients.stateManager.getParent(roomID);

		let childShortCode = "here";
		if (parent !== roomID) {
			childShortCode = Object.keys(
				this.clients.stateManager.getConfig(parent)?.children,
			);
		}

		const eventLink = `<a href="https://matrix.to/#/${roomID}/${event.event_id}?via=${server}">${childShortCode}</a>`;

		//get banlists
		const banlistOBJ = this.clients.stateManager.getConfig(parent)?.banlists;

		//cant do anything if none fetched
		if (!banlistOBJ) return;

		//convert to keys
		const banlistShortCodes = Object.keys(banlistOBJ);

		//nothing to write to
		if (banlistShortCodes.length < 1) return;

		if (
			event.content?.membership === "ban" &&
			event.unsigned?.prev_content?.membership !== "ban"
		) {
			const body = `${event.state_key} banned in ${eventLink} for <code>${event.content?.reason || "<No reason provided>"}</code> by ${event.sender}. If you would like to write this ban recommendation to a list, select its shortcode below:`;

			//attempt to message in parent room before reacting
			let msgID;
			try {
				msgID = await this.clients.makeSDKrequest(
					{ roomID: parent },
					true,
					async (c) =>
						await c.sendMessage(parent, {
							body,
							format: "org.matrix.custom.html",
							formatted_body: body,
							msgtype: "m.text",
							"m.mentions": { user_ids: [event.sender] },
						}),
				);
			} catch (e) {
				return;
			}

			// biome-ignore lint/complexity/noForEach: these can be exectued async
			banlistShortCodes.forEach(async (shortcode) => {
				const banlistID = banlistOBJ[shortcode];

				//anonymous writes from within its management room
				const anonWrite =
					this.clients.stateManager.getParent(banlistID) === parent;

				//managed rooms check the pl of the management room
				let rtc = banlistID;
				if (anonWrite) rtc = parent;

				const powerLevels = this.clients.stateManager.getPowerLevels(rtc);

				//technically possible, but only really happens on dendrite and means we cant do anything anyways
				//more likely means we havent loaded the room state yet which means we cant check config so nothing to do anyways
				if (
					typeof powerLevels !== "object" ||
					Object.keys(powerLevels).length < 1
				) {
					this.clients.makeSDKrequest(
						{ roomID: parent },
						false,
						async (c) =>
							await c.sendMessage(reactionRoomID, {
								body: `${event.sender}: 🤔 | Unable to find powerlevels event for ${shortcode}. This may be a temporary resolution error.`,
								"m.mentions": { user_ids: [event.sender] },
							}),
					);
					return;
				}

				let plToWrite = powerLevels.state_default;

				if (powerLevels.events?.["m.policy.rule.user"] !== undefined)
					plToWrite = powerLevels.events?.["m.policy.rule.user"];

				let botReactionID;
				try {
					botReactionID = await this.clients.makeSDKrequest(
						{ roomID: parent },
						true,
						async (c) =>
							await c.sendEvent(parent, "m.reaction", {
								"m.relates_to": {
									key: shortcode,
									event_id: msgID,
									rel_type: "m.annotation",
								},
							}),
					);
				} catch (e) {
					this.clients.makeSDKrequest(
						{ roomID: parent },
						false,
						async (c) =>
							await c.sendHtmlNotice(
								parent,
								`🍃 | Experienced the following error trying to react with <code>${shortcode}</code>. You may react with this manually or run <code>ban <user> <shortcode | roomID> [reason]</code>.\n<code><pre>${e}</pre></code>`,
							),
					);
				}

				//catch the selection
				this.eventCatcher.catch(
					(reactionEvent, reactionRoomID) => {
						//dont use our own reaction event (the server should deduplicate if theres a race condition)
						if (reactionEvent.event_id === botReactionID) return false;

						//right reaction on right event
						if (reactionRoomID !== parent) return false;
						if (reactionEvent.content?.["m.relates_to"]?.key !== shortcode)
							return false;
						if (reactionEvent.content?.["m.relates_to"]?.event_id !== msgID)
							return false;

						//check if user  pl is high enough
						const userPL = powerLevels.users?.[event.sender];
						if (userPL < plToWrite) {
							this.clients.makeSDKrequest(
								{ roomID: parent },
								false,
								async (c) =>
									await c.sendNotice(
										parent,
										`🍃 | ${reactionEvent.sender} you do not have permission to write to ${shortcode}.`,
									),
							);

							return false;
						}

						//passes all checks
						return true;
					},
					//on caught reaction
					async (reactionEvent, reactionRoomID) => {
						this.writeBan(
							parent,
							powerLevels,
							reactionEvent.sender,
							shortcode,
							banlistID,
							event.state_key,
							event.content?.reason,
							anonWrite,
						);
					},
				);
			});
		} else if (
			event.content?.membership !== "ban" &&
			event.unsigned?.prev_content?.membership === "ban"
		) {
			//TODO on unban
		}
	}
}

export { BanHandler };
