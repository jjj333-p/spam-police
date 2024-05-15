class Uptime {
	async run({ client, roomId, event }) {
		//const user know that the bot is online even if the matrix room is being laggy and the message event isnt comming across
		client.sendReadReceipt(roomId, event.event_id);

		//maths
		const seconds = process.uptime();

		const minutes = Math.floor(seconds / 60);

		const rSeconds = seconds - minutes * 60;

		const hours = Math.floor(minutes / 60);

		const rMinutes = minutes - hours * 60;

		//send the uptime to the room
		client.sendHtmlText(
			roomId,
			`<blockquote>\n<p>${seconds}</p>\n</blockquote>\n<p>${hours} hours, ${rMinutes} minutes, and ${Math.floor(
				rSeconds,
			)} seconds.</p>`,
		);
	}
}

export { Uptime };
