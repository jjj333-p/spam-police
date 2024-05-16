import {
	AutojoinRoomsMixin,
	MatrixClient,
	SimpleFsStorageProvider,
} from "matrix-bot-sdk";

class Clients {
	constructor(login) {
		this.consoleRoom = login["console-room"];

		this.filter = {
			//in the case presence shows up its irrelevant to this bot
			presence: { senders: [] },
			room: {
				//ephemeral events are never used in this bot, are mostly inconsequentail and irrelevant
				ephemeral: { senders: [] },
				//we fetch state manually later, hopefully with better load balancing
				state: {
					senders: [],
					not_types: [
						"im.vector.modular.widgets",
						"im.ponies.room_emotes",
						"m.room.pinned_events",
					],
					lazy_load_members: true,
				},
				//we will manually fetch events anyways, this is just limiting how much backfill bot gets as to not
				//respond to events far out of view
				timeline: {
					limit: 20,
				},
			},
		};

		//something iteratable array to convert from config to working memory
		const serverID = Array.from(login.accounts.keys);

		//store the client objects
		this.accounts = new Map();

		//keep track of what messages have been recieved
		this.messageCache = new Map();

		// biome-ignore lint/complexity/noForEach: <easier to do async function>
		serverID.forEach(async (server) => {
			//convenience
			const thisLogin = login.accounts[server];

			try {
				//store the sync token and filter
				const storage = new SimpleFsStorageProvider(`./db/sync_${server}.json`);

				//initialize client
				const client = new MatrixClient(
					thisLogin.url,
					thisLogin.token,
					storage,
				);

				//pass any emited events into the internal handler to deal with later
				client.on("room.event", async (roomID, event) => {
					this.internalOnEvent(server, roomID, event);
				});

				await client.start(this.filter);

				this.accounts.set(server, client);
			} catch (e) {
				//warn
				console.warn(`Error connecting client for server ${server}:\n${e}`);

				//delete instance to keep running regardless
				this.accounts.delete(server);

				//exit loop for this `server`, others will still initialize
				return;
			}

			this.accounts
				.get(server)
				.sendText(
					this.consoleRoom,
					`Successfully logged in to <code>${server}</code> instance.`,
				);
		});
	}

	async internalOnEvent(server, roomID, event) {
		const ts = Date.now();

		//if its already recieved, only compare latency, dont run OnEvent
		if (this.messageCache.has(event.event_id)) {
			this.messageCache.get(event.event_id).rank.set(server, ts);
			console.log(`Recieved ${event.event_id}, on ${server}, at ${ts}`);
			return;
		}

		//set timestamp cache
		const m = new Map();
		m.set(server, ts);
		this.messageCache.set(server, {
			rank: m,
			first: {
				time: ts,
				server: server,
			},
			event: event,
		});

		this.accounts
			.get(server)
			.sendText(roomID, `recieved <code>${event.event_id}</code> first.`);
	}

	/*
    performs `request` with whichever of `acceptableServers` (array) is available first.
    If acceptableServers is empty, the request will be be performed on any server not in rejectedServers
    */
	async makeSDKrequest(acceptableServers, rejectedServers, request) {
		//will write load balancing later,
		//basically here it will decide which client is not currently doing something and returns that,
		//if all clients are busy it will await here until one is free
		//the details to how i do this are not important to mps

		//TODO
		const client = null;

		try {
			await request(client);
		} catch (e) {
			console.warn("UNCAUGHT ERROR WHEN MAKING SDK REQUEST");
		}
	}
}
