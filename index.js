//Import dependencies
const sdk  = require("matrix-bot-sdk");
const fs   = require("fs");
const YAML = require('yaml');

//Some SDK stuff
const MatrixClient = sdk.MatrixClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;

//Parse YAML file
//(not handled in the db because its good practice to keep this as far from the userspace as possible)
const loginFile   = fs.readFileSync('./examples/login.yaml', 'utf8');
const loginParsed = YAML.parse(loginFile);

//Define them into variables
const homeserver  = loginParsed["homeserver-url"];
const accessToken = loginParsed["login-token"];


//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new SimpleFsStorageProvider("bot.json");

//login to client
const client = new MatrixClient(homeserver, accessToken, storage);

//currently testing without accepting invites
//AutojoinRoomsMixin.setupOnClient(client);

//map to put the handlers for each event type in (i guess this is fine here)
let eventhandlers = new Map()

//database for the config
const {database} = require("./modules/db")
const config = new database()

//blacklist object
const {blacklist} = require("./modules/blacklist")
const banlist = new blacklist()

//event handler for m.room.message
const {message} = require("./modules/message")
eventhandlers.set("m.room.message", new message(loginParsed, config))

//event handler for m.room.redaction
const {redaction} = require("./modules/redaction");
eventhandlers.set("m.room.redaction", new redaction(eventhandlers))

let mxid; let displayname;

//start client
client.start().then( async () => {

    console.log("Client started!")

    //to remotely monitor how often the bot restarts, to spot issues
    client.sendText(accessToken, "Started.")

    //get mxid
    mxid = await client.getUserId()
    displayname = (await client.getUserProfile(mxid))["displayname"]

});

//when the client recieves an event
client.on("room.event", async (roomId, event) => {

    console.log("ran event")

    //fetch the handler for that event type
    let handler = eventhandlers.get(event["type"])
    
    //if there is a handler for that event, run it.
    if (handler) handler.run(client, roomId, event, mxid, displayname, banlist)

})

client.on("room.leave", (roomId) => {

    banlist.add(roomId, "kicked")

})
