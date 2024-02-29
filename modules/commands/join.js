class Join {
	async run(
		{ client, roomId, event, mxid, blacklist },
		{ offset, commandRoom },
	) {
		//if not run in the command room
		if (roomId !== commandRoom) {
			client.sendNotice(
				roomId,
				`❌ | you must run +join commands in https://matrix.to/#/${commandRoom}?via=${
					mxid.split(":")[1]
				}`,
			);

			return;
		}

		//grep out the room indicated by the user
		const joinroom = event.event_id.body.split(" ")[1 + offset];

		//evaluate if its a valid alias
		client
			.resolveRoom(joinroom)
			.then(async (joinroomid) => {
				//check blacklist for a blacklisted reason
				const blReason = blacklist.match(joinroomid);

				//if there is a reason that means the room was blacklisted
				if (blReason) {
					//send error
					client.sendHtmlNotice(
						roomId,
						`❌ | The bot was blacklisted from this room for reason <code>${blReason}</code>.`,
					);

					//dont continue trying to join
					return;
				}

				//deduce possible servers with the required information to join into the room
				const aliasServer = joinroom.split(":")[1];
				const senderServer = event.sender.split(":")[1];
				const botServer = mxid.split(":")[1];

				//try to join
				client
					.joinRoom(joinroomid, [
						aliasServer,
						senderServer,
						botServer,
						"matrix.org",
					])
					.then(() => {
						//greeting message
						const greeting = `Greetings! I am brought here by ${event.sender}, bot by @jjj333:pain.agency (pls dm for questions). 
                        My MO is I warn people about telegram and whatsapp investment scams whenever they are posted in the room. If I am unwanted please just kick me.
                        For more information please visit https://github.com/jjj333-p/spam-police`;

						//try to send the greeting
						client
							.sendNotice(joinroomid, greeting)
							.then(() => {
								//confirm joined and can send messages
								client.sendNotice(roomId, "✅ | successfully joined room!");
							})
							.catch((err) => {
								//confirm could join, but show error that couldn't send messages
								client.sendNotice(
									roomId,
									"🍃 | I was able to join the provided room however I am unable to send messages, and therefore will only be able to react to messages with my warning.",
								);
							});
					})
					.catch((err) => {
						//throw error about joining room
						client.sendHtmlNotice(
							roomId,
							`❌ | I ran into the following error while trying to join that room:<blockquote>${JSON.stringify(
								err.body,
								null,
								2,
							)}</blockquote>`,
						);
					});
			})
			.catch((err) => {
				//throw error about invalid alias
				client.sendHtmlNotice(
					roomId,
					`❌ | I ran into the following error while trying to resolve that room ID:<blockquote>${err.message}</blockquote>`,
				);
			});
	}
}

export { Join };
