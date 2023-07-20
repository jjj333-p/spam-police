//Import dependencies
import { AutojoinRoomsMixin, MatrixClient, SimpleFsStorageProvider } from "matrix-bot-sdk"; 
import { readFileSync } from "fs";
import { parse } from "yaml";

//Import modules
import { blacklist } from "./modules/blacklist.js";
import { redaction } from "./modules/redaction.js";
import { database } from "./modules/db.js";
import { message } from "./modules/message.js";

//Parse YAML configuration file
const loginFile   = readFileSync('./db/login.yaml', 'utf8');
const loginParsed = parse(loginFile);
const homeserver      = loginParsed["homeserver-url"];
const accessToken     = loginParsed["login-token"];
const logRoom         = loginParsed["log-room"];
const commandRoom     = loginParsed["command-room"];
const authorizedUsers = loginParsed["authorized-users"];

//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new SimpleFsStorageProvider("bot.json");

//login to client
const client = new MatrixClient(homeserver, accessToken, storage);

//currently testing without accepting invites
//AutojoinRoomsMixin.setupOnClient(client);

//map to put the handlers for each event type in (i guess this is fine here)
let eventhandlers = new Map()

const config = new database()   // Database for the config
const banlist = new blacklist() // Blacklist object
eventhandlers.set("m.room.message", new message(logRoom, commandRoom, config, authorizedUsers)) // Event handler for m.room.message
eventhandlers.set("m.room.redaction", new redaction(eventhandlers))            // Event handler for m.room.redaction

//preallocate variables so they have a global scope
let mxid; let displayname;

//Start Client
client.start().then( async () => {

    console.log("Client started!")

    //to remotely monitor how often the bot restarts, to spot issues
    client.sendText(logRoom, "Started.")

    //get mxid
    mxid = await client.getUserId()
    displayname = (await client.getUserProfile(mxid))["displayname"]

});

//when the client recieves an event
client.on("room.event", async (roomId, event) => {

    //fetch the handler for that event type
    let handler = eventhandlers.get(event["type"])

    //if there is a handler for that event, run it.
    if (handler) handler.run({
        client:client,
        roomId:roomId,
        event:event,
        mxid:mxid,
        displayname:displayname,
        blacklist:banlist
    })

})

client.on("room.leave", (roomId) => {

    banlist.add(roomId, "kicked")

})
