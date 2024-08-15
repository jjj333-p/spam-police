class BanHandler {
	constructor(clients, eventCatcher, banlist) {
		this.clients = clients;
		this.eventCatcher = eventCatcher;
		this.banlist = banlist;
	}

	async writeBan(
		roomID,
		moderator,
		shortcode,
		banlistID,
		bannedUser,
		userProvidedReason,
		anonWrite,
	) {
		//fetch pl of actual banlist to see if *we* can do it
		const powerLevels = this.clients.stateManager.getPowerLevels(banlistID);

		const acceptableServers = [];

		//if no pls to check, dont waste resource, next check will report
		if (powerLevels) {
			//optional chain similar to event auth
			const plToWrite =
				powerLevels?.events?.["m.policy.rule.user"] ??
				powerLevels?.state_default ??
				0;

			for (const bs of Array.from(this.clients.accounts.keys())) {
				//get pl of this account
				const pl =
					powerLevels?.users?.[
						await this.clients.accounts.get(bs).getUserId()
					] ??
					powerLevels?.users_default ??
					0;

				//too low pl to ban
				if (pl < plToWrite) continue;

				acceptableServers.push(bs);
			}
		}

		if (acceptableServers.length < 1) {
			this.clients.makeSDKrequest(
				{ roomID },
				false,
				async (c) =>
					await c.sendMessage(roomID, {
						body: `🍃 | I do not have the required PL to write to ${shortcode}.`,
						msgtype: "m.notice",
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
			reason = `${moderator} - "${reason}"`;
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
						msgtype: "m.notice",
						"m.mentions": { user_ids: [moderator] },
					}),
			);
			return;
		}

		const body = `➕ | Successfully wrote policy banning ${bannedUser} on behalf of ${moderator} with reason <code>${reason}</code>\n<a href="https://matrix.to/#/${banlistID}/${policyID}">Link to policy in ${shortcode}</a>`;
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
						msgtype: "m.notice",
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
			event.unsigned?.prev_content?.membership !== "ban" &&
			!event.content?.["agency.pain.anti-scam.policy"]
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
							msgtype: "m.notice",
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
								msgtype: "m.notice",
							}),
					);
					return;
				}

				const plToWrite =
					powerLevels.events?.["m.policy.rule.user"] ??
					powerLevels.state_default ??
					0;

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
						const userPL =
							powerLevels.users?.[reactionEvent.sender] ??
							powerLevels?.users_default ??
							0;
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
		} /* else if (
			event.content?.membership !== "ban" &&
			event.unsigned?.prev_content?.membership === "ban"
		) {
			//TODO on unban
		}*/
	}

	async banCommand(server, roomID, event, prefix, prefixOffset, commandWords) {
		//preferred server
		const s = event.sender.split(":")[1];

		//[0] is "ban"
		const entity = commandWords[1];

		if (!entity) {
			//deal empty
			this.clients.makeSDKrequest(
				{ roomID, preferredServers: [s] },
				false,
				async (c) =>
					await c.replyHtmlNotice(
						roomID,
						event,
						"🤔 | You didnt specify someone to ban.",
					),
			);
		} else if (entity.startsWith("@") && entity.includes(":")) {
			//req for mxid, even with wildcards
			this.banUserCommand(
				server,
				roomID,
				event,
				prefix,
				prefixOffset,
				commandWords,
			);
		} else if (!/[^a-zA-Z0-9.-]/.test(entity)) {
			//if doesnt contain chars illegal in a domain name, is banning server
			this.clients.makeSDKrequest(
				{ roomID, preferredServers: [s] },
				false,
				async (c) =>
					await c.replyNotice(
						roomID,
						event,
						"‼️ | I should be banning that as a server right now, but that code seems to be missing.",
					),
			);
		} else {
			//deal invalid
			this.clients.makeSDKrequest(
				{ roomID, preferredServers: [s] },
				false,
				async (c) =>
					await c.replyHtmlNotice(
						roomID,
						event,
						`🤔 | <code>${entity}</code> is not a valid user or server I can ban.`,
					),
			);
		}
	}

	async banUserCommand(
		server,
		roomID,
		event,
		prefix,
		prefixOffset,
		commandWords,
	) {
		//preferred server
		const s = event.sender.split(":")[1];

		//[0] is "ban"
		const entity = commandWords[1];
		let reasonOffset =
			prefixOffset + 4 /*"ban_" cmd*/ + entity.length + 1; /*_*/

		const parent = this.clients.stateManager.getParent(roomID);

		let banlists;
		if (parent)
			banlists = this.clients.stateManager.getConfig(parent)?.banlists;

		const shortcode = commandWords[2];

		// if its not a shortcode, treat it as an id
		let banlistID;

		//run a resolve for clarity
		banlistID = await this.clients.makeSDKrequest(
			{},
			false,
			async (c) => await c.resolveRoom(banlists?.[shortcode] ?? shortcode),
		);

		//add to offset
		if (banlistID) {
			reasonOffset += shortcode.length + 1; /*"_"*/

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
					{ roomID: parent, preferredServers: [s] },
					false,
					async (c) =>
						await c.sendMessage(roomID, {
							body: `${event.sender}: 🤔 | Unable to find powerlevels event for ${shortcode}. This may be a temporary resolution error.`,
							"m.mentions": { user_ids: [event.sender] },
							"m.relates_to": {
								"m.in_reply_to": {
									event_id: event.event_id,
								},
							},
							msgtype: "m.notice",
						}),
				);
				return;
			}

			const plToWrite =
				powerLevels.events?.["m.policy.rule.user"] ??
				powerLevels.state_default ??
				0;

			//check if user  pl is high enough
			const userPL =
				powerLevels.users?.[event.sender] ?? powerLevels?.users_default ?? 0;
			if (userPL < plToWrite) {
				this.clients.makeSDKrequest(
					{ roomID },
					false,
					async (c) =>
						await c.sendMessage(roomID, {
							body: `🍃 | ${event.sender} you do not have permission to write to ${shortcode}.`,
							"m.mentions": { user_ids: [event.sender] },
							"m.relates_to": {
								"m.in_reply_to": {
									event_id: event.event_id,
								},
							},
							msgtype: "m.notice",
						}),
				);
			}

			//write the ban
			this.writeBan(
				roomID,
				event.sender,
				shortcode,
				banlistID,
				entity,
				event.content.body.substring(reasonOffset),
				anonWrite,
			);
			/*


			*/
		} else {
			/* if no shortcode
			


			*/
			//anonymous writes from within its management room
			const anonWrite = roomID === parent;

			const powerLevels = this.clients.stateManager.getPowerLevels(parent);

			//technically possible, but only really happens on dendrite and means we cant do anything anyways
			//more likely means we havent loaded the room state yet which means we cant check config so nothing to do anyways
			if (
				typeof powerLevels !== "object" ||
				Object.keys(powerLevels).length < 1
			) {
				this.clients.makeSDKrequest(
					{ roomID, preferredServers: [s] },
					false,
					async (c) =>
						await c.sendMessage(roomID, {
							body: `${event.sender}: 🤔 | Unable to find powerlevels event. This may be a temporary resolution error.`,
							"m.mentions": { user_ids: [event.sender] },
							"m.relates_to": {
								"m.in_reply_to": {
									event_id: event.event_id,
								},
							},
							msgtype: "m.notice",
						}),
				);
				return;
			}

			const plToWrite = powerLevels.ban;

			//check if user  pl is high enough
			const modPL =
				powerLevels.users?.[event.sender] ?? powerLevels?.users_default ?? 0;
			if (modPL < plToWrite) {
				this.clients.makeSDKrequest(
					{ roomID },
					false,
					async (c) =>
						await c.sendMessage(roomID, {
							body: `🍃 | ${event.sender} you do not have permission to ban ${entity}.`,
							"m.mentions": { user_ids: [event.sender] },
							"m.relates_to": {
								"m.in_reply_to": {
									event_id: event.event_id,
								},
							},
							msgtype: "m.notice",
						}),
				);
				return;
			}

			let reason =
				event.content.body.substring(reasonOffset) || "<no reason provided>";
			if (!anonWrite) {
				reason = `${event.sender} - "reason"`;
			}

			const family = this.clients.stateManager.getFamily(roomID);

			for (const shortCode of family?.shortCodes ?? []) {
				const rID = family.map.get(shortCode);

				//get joined users matching that entity
				const banworthyUsers =
					this.clients.stateManager.getState(
						rID,
						(se) =>
							se.type === "m.room.member" &&
							//create mockup policy event to compare against
							this.banlist.ruleMatchesUser(se.state_key, {
								content: { entity, recommendation: "m.ban", reason },
							}),
					) ?? []; //default to empty array

				for (const { state_key: bu } of banworthyUsers) {
					const entityPL =
						powerLevels.users?.[bu] ?? powerLevels?.users_default ?? 0;

					//make sure have perm to ban user
					if (!(entityPL < modPL)) {
						this.clients.makeSDKrequest(
							{ roomID },
							false,
							async (c) =>
								await c.sendMessage(roomID, {
									body: `🍃 | ${event.sender} you do not have a high enough powerlevel to ban ${bu}.`,
									"m.mentions": { user_ids: [event.sender] },
									"m.relates_to": {
										"m.in_reply_to": {
											event_id: event.event_id,
										},
									},
									msgtype: "m.notice",
								}),
						);

						continue;
					}

					//fetch pl of actual banlist to see if *we* can do it
					const rpl = this.clients.stateManager.getPowerLevels(rID);

					const acceptableServers = [];

					//if no pls to check, dont waste resource, next check will report
					if (rpl) {
						//optional chain similar to event auth
						const plToWrite = rpl?.ban ?? rpl?.state_default ?? 0;

						for (const bs of Array.from(this.clients.accounts.keys())) {
							//get pl of this account
							const pl =
								rpl?.users?.[await this.clients.accounts.get(bs).getUserId()] ??
								rpl?.users_default ??
								0;

							//pl of user we want to ban
							const epl = rpl?.users?.[bu] ?? rpl?.users_default ?? 0;

							//too low pl to ban, or our pl isnt higher
							if (pl < plToWrite || !(pl > epl)) continue;

							acceptableServers.push(bs);
						}
					}

					if (acceptableServers.length < 1) {
						this.clients.makeSDKrequest(
							{ roomID },
							false,
							async (c) =>
								await c.sendMessage(roomID, {
									body: `🍃 | ${event.sender} I do not have a high enough powerlevel to ban ${bu}.`,
									"m.mentions": { user_ids: [event.sender] },
									"m.relates_to": {
										"m.in_reply_to": {
											event_id: event.event_id,
										},
									},
									msgtype: "m.notice",
								}),
						);

						return;
					}

					//try to ban
					try {
						await this.clients.makeSDKrequest(
							{ roomID, acceptableServers },
							true,
							async (c) =>
								await c.sendStateEvent(roomID, "m.room.member", bu, {
									membership: "ban",
									reason,
								}),
						);
					} catch (e) {
						this.clients.makeSDKrequest(
							{ roomID },
							false,
							async (c) =>
								await c.sendMessage(roomID, {
									body: `🍃 | ${event.sender} I ran into the following error trying to ban ${bu} in ${roomID}.\n${e}`,
									"m.mentions": { user_ids: [event.sender] },
									"m.relates_to": {
										"m.in_reply_to": {
											event_id: event.event_id,
										},
									},
									msgtype: "m.notice",
								}),
						);
					}
				}
			}

			this.clients.makeSDKrequest(
				{ roomID },
				false,
				async (c) =>
					await c.sendEvent(roomID, "m.reaction", {
						"m.relates_to": {
							event_id: event.event_id,
							key: "✅",
							rel_type: "m.annotation",
						},
					}),
			);
		}
	}
}

export { BanHandler };
