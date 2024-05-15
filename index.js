//Import dependencies
import {
	AutojoinRoomsMixin,
	MatrixClient,
	SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
// import mps from "@gnuxie/matrix-protection-suite";

//Import modules
// import { blacklist } from "./modules/blacklist.js";
// import { redaction } from "./modules/redaction.js";
// import { database } from "./modules/db.js";
// import { message } from "./modules/message.js";
// import { Reaction } from "./modules/reaction.js";
// import { BanlistReader } from "./modules/banlistReader.js";

//Parse YAML configuration file
const loginFile = readFileSync("./db/login.yaml", "utf8");
const loginParsed = parse(loginFile);
const homeserver = loginParsed["homeserver-url"];
const accessToken = loginParsed["login-token"];
const logRoom = loginParsed["log-room"];
const commandRoom = loginParsed["command-room"];
const authorizedUsers = loginParsed["authorized-users"];
const name = loginParsed.name;

//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new SimpleFsStorageProvider("bot.json");

//login to client
// const client = new MatrixClient(homeserver, accessToken, storage);
