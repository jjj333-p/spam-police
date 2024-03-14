class Banlist {
	async run({ client, roomId, event }, { offset, contentByWords }) {
		try {
			//parce the room that the cmd is referring to
			let banlist = contentByWords[2 + offset];

			if (!banlist) {
				client.sendNotice(roomId, "❌ | invalid usage.");

				return;
			}

			//use here so people dont have to type the room alias on an asinine client
			if (banlist.toLowerCase() === "here") banlist = roomId;

			//fetch spam police config
			const stateconfigevent = (await client.getRoomState(roomId)).filter(
				(event) => event.type === "agency.pain.anti-scam.config",
			)[0];

			if (stateconfigevent?.content?.children?.[banlist])
				banlist = stateconfigevent.content.children[banlist];

			//resolve alias to an id for easier use
			client
				.resolveRoom(banlist)
				.then(async (banlistid) => {
					let blconfigevent;
					let anonymous;
					try {
						//fetch spam police config
						blconfigevent = (await client.getRoomState(banlistid)).filter(
							(event) => event.type === "agency.pain.anti-scam.config",
						)[0];

						anonymous =
							(blconfigevent?.content?.parent &&
								blconfigevent.content.parent === roomId) ||
							roomId === banlistid;

						//check pl
						if (
							!(
								(await client.userHasPowerLevelForAction(
									event.sender,
									banlistid,
									"ban",
								)) ||
								(await client.userHasPowerLevelFor(
									event.sender,
									banlistid,
									"m.policy.rule.user",
									true,
								))
							)
						) {
							client.sendNotice(
								roomId,
								"❌ | You don't have sufficent permission in the banlist room.",
							);

							return;
						}
					} catch (e) {
						client.sendNotice(roomId, JSON.stringify(e));
						return;
					}

					//account for all the chars when spit by spaces
					let reasonStart = offset + 3 + 1;

					//for every word before the reason starts, count the length of that word
					//and add it to the offset
					for (let i = 0; i < offset + 3 + 1; i++) {
						reasonStart += contentByWords[i].length;
					}

					//parce the reason using the offset
					let reason = event.content.body.substring(reasonStart);

					if (!anonymous) reason += `(by ${event.sender})`;

					//parce out banned user
					const bannedUser = contentByWords[3 + offset];

					const action = contentByWords[1 + offset].toLowerCase();

					if (action === "add") {
						//make banlist rule
						client
							.sendStateEvent(
								banlistid,
								"m.policy.rule.user",
								`rule:${bannedUser}`,
								{
									entity: bannedUser,
									reason: reason,
									recommendation: "org.matrix.mjolnir.ban",
								},
							)
							.then(() =>
								client
									.sendNotice(
										roomId,
										"✅ | Successfully set ban recommendation.",
									)
									.catch(() => {}),
							)
							.catch((err) =>
								client
									.sendHtmlNotice(
										roomId,
										`<p>🍃 | I unfortunately ran into the following error while trying to add that to the banlist:\n</p><code>${err}</code>`,
									)
									.catch(() => {}),
							);
					} else if (action === "remove" || action === "delete") {
						//make banlist rule
						client
							.sendStateEvent(
								banlistid,
								"m.policy.rule.user",
								`rule:${bannedUser}`,
								{
									reason: reason,
								},
							)
							.then(() =>
								client
									.sendNotice(
										roomId,
										"✅ | Successfully removed ban recommendation.",
									)
									.catch(() => {}),
							)
							.catch((err) =>
								client
									.sendHtmlNotice(
										roomId,
										`<p>🍃 | I unfortunately ran into the following error while trying to remove that banlist rule:\n</p><code>${err}</code>`,
									)
									.catch(() => {}),
							);
					} else {
						client
							.sendHtmlNotice(
								roomId,
								`<p>❌ | Invalid action, <code>${action}</code> != <code>add</code> or <code>remove</code>/<code>delete</code>.</p>`,
							)
							.catch(() => {});
					}
				})
				.catch((err) =>
					client
						.sendHtmlNotice(
							roomId,
							`<p>🍃 | I unfortunately ran into the following error while trying to resolve that room:\n</p><code>${err}</code>`,
						)
						.catch(() => {}),
				);

			//this might fail, just catch it and move on
		} catch (e) {
			console.log(e);
		}
	}
}

export { Banlist };
