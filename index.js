//sdk stuff idk
const sdk = require("matrix-bot-sdk");
const MatrixClient = sdk.MatrixClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;
const fs = require("fs");

//fetch keywords
let keywords = require("./keywords.json")

//fetch login details (not handled in the db because its good practice to keep this as far from the userspace as possible)
const logintxt = fs.readFileSync("./db/login.txt", "utf-8") //this is a fetch, why couldnt i find this
const logindata = logintxt.split("\n")
const homeserverUrl = logindata[0]
const accessToken = logindata[1]

//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new SimpleFsStorageProvider("bot.json");

//login to client
const client = new MatrixClient(homeserverUrl, accessToken, storage);
AutojoinRoomsMixin.setupOnClient(client);

//map to put the handlers for each event type in (i guess this is fine here)
let eventhandlers = new Map()

//database for the config
const {database} = require("./modules/db")
const config = new database()

//event handler for m.room.message
const {message} = require("./modules/message")
eventhandlers.set("m.room.message", new message(keywords, logindata, config))

//event handler for m.room.redaction
const {redaction} = require("./modules/redaction");
eventhandlers.set("m.room.redaction", new redaction(eventhandlers))

//when the client recieves an event
client.on("room.event", async (roomId, event) => {

    //fetch the handler for that event type
    let handler = eventhandlers.get(event["type"])
    
    //if there is a handler for that event, run it.
    if (handler) handler.run(client, roomId, event)

})

//start client
client.start().then(() => {

    console.log("Client started!")

    //to remotely monitor how often the bot restarts, to spot issues
    client.sendText(logindata[2], "Started.")
    
});
