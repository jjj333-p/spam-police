//sdk stuff idk
const sdk = require("matrix-bot-sdk");
const MatrixClient = sdk.MatrixClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;
const fs = require("fs");

//fetch keywords
let keywords = require("./keywords.json")

//fetch login details
const logintxt = fs.readFileSync("./db/login.txt", "utf-8") //this is a fetch, why couldnt i find this
const logindata = logintxt.split("\n")
const homeserverUrl = logindata[0]
const accessToken = logindata[1]

//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new SimpleFsStorageProvider("bot.json");

//login to client
const client = new MatrixClient(homeserverUrl, accessToken, storage);
AutojoinRoomsMixin.setupOnClient(client);

//start client
client.start().then(() => {

    console.log("Client started!")

    client.sendText(logindata[2], "Started.")
    
});

//map to put the handlers for each event type in
let eventhandlers = new Map()

//event handler for m.room.message
const {message} = require("./modules/message")
eventhandlers.set("m.room.message", new message(keywords, logindata))

//handler for redactions (will separate out later 😩)
eventhandlers.set("m.room.redaction",{"run" : (client, roomId, event) => {

    //fetch the bots response to the scam
    let response = eventhandlers.get("m.room.message").tgScamResponses.get(event["redacts"])

    //if there is a response to the redacted message then redact the response
    if (response) {client.redactEvent(response.roomId, response.responseID, "Investment scam that this message was replying to was deleted.")}

    // let modroom = "!xWGMKuBpJrtGDSfmaF:matrix.org"

    // client.sendHtmlText(modroom, "Deleted by " + event["sender"]+ " for the reason of { " + event["content"]["reason"] + " }\n<pre><code class=\"language-json\">" + JSON.stringify(msgCache.get(roomId).msgs.find(msg => msg["event_id"] == event["redacts"]), null, 2) + "</code></pre>")

    // client.getPublishedAlias()

}})

client.on("room.event", async (roomId, event) => {

    let handler = eventhandlers.get(event["type"])
    
    if (handler) handler.run(client, roomId, event)

})
