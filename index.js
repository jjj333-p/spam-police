//sdk stuff idk
const sdk = require("matrix-bot-sdk");
const MatrixClient = sdk.MatrixClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;
const fs = require("fs");

//map to relate scams and their responses (for deletion)
let tgScamResponses = new Map()

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

let {rmsg} = require("./modules/message")

//when recieve a message
client.on("room.message", async (roomId, event) => rmsg(client, roomId, event, logindata, keywords));


client.on("room.event", async (roomId, event) => {

    if(event["type"] == "m.room.redaction"){

        let response = tgScamResponses.get(event["redacts"])

        if (response) {client.redactEvent(response.roomId, response.responseID, "Investment scam that this message was replying to was deleted.")}

        // let modroom = "!xWGMKuBpJrtGDSfmaF:matrix.org"

        // client.sendHtmlText(modroom, "Deleted by " + event["sender"]+ " for the reason of { " + event["content"]["reason"] + " }\n<pre><code class=\"language-json\">" + JSON.stringify(msgCache.get(roomId).msgs.find(msg => msg["event_id"] == event["redacts"]), null, 2) + "</code></pre>")

        // client.getPublishedAlias()

    }
})
