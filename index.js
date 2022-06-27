//sdk stuff idk
const sdk = require("matrix-bot-sdk");
const MatrixClient = sdk.MatrixClient;
const SimpleFsStorageProvider = sdk.SimpleFsStorageProvider;
const AutojoinRoomsMixin = sdk.AutojoinRoomsMixin;
const fs = require("fs");

//map to relate scams and their responses (for deletion)
let tgScams = new Map()

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
client.start().then(() => console.log("Client started!"));

//when recieve a message
client.on("room.message", async (roomId, event) => {

    //if no content in message
    if (! event["content"]) return;

    // Don't handle non-text events
    if (event["content"]["msgtype"] !== "m.text") return;

    //filter out events sent by the bot itself.
    if (event["sender"] === await client.getUserId()) return;

    //grab the content from the message, and put it to lowercase to prevent using caps to evade
    let scannableContent = event["content"]["body"].toLowerCase()
    
    //keywords for the telegram investment scam (move to json later)
    const verbs = [
        "earn",
        "make",
    ]
    
    const currencies = [
        "$", "£", "€",
        "money",
        "dollars",
        "pounds",
        "euros",
        "bitcoin", "btc",
        "etherium", "eth"
    ]
    
    const socials = [
        "t.me/",
        "wa.me/",
        "telegram",
        "whatsapp",
        "wickr",
    ]
    
    let contains = (words) => {
        return scannableContent.split(" ").some(w => words.some(key => key == w))
    }
    
    if (contains(verbs) && contains(currencies) && contains(socials)) {
    
        if(roomId == logindata[2]){

            client.sendEvent(roomId, "m.reaction", ({
                "m.relates_to": {
                    "event_id":event["event_id"],
                    "key":"✅",
                    "rel_type": "m.annotation"
                }
            }))

        } else {

            //custom function to handle the fetching and sending of the json file async as to not impact responsiveness
            sendjson(roomId, event)

            //React to the message with a little warning so its obvious what msg im referring to
            await client.sendEvent(roomId, "m.reaction", ({
                "m.relates_to": {
                    "event_id":event["event_id"],
                    "key":"🚨 scam! 🚨",
                    "rel_type": "m.annotation"
                }
            })).finally(async () => {

                //send warning message
                let responseID = await client.sendText(roomId, 'That is likely a scam and what we call "too good to be true". For more information go to https://www.sec.gov/oiea/investor-alerts-and-bulletins/digital-asset-and-crypto-investment-scams-investor-alert and https://www.youtube.com/watch?v=gFWaA7mt9oM&list=LL&index=4')

                tgScams.set(event["event_id"], {"roomId":roomId, "responseID":responseID})
            
            })

        }

    //common drug ad
    }  else if (scannableContent.includes("!uptime")) {

        //let user know that the bot is online even if the matrix room is being laggy and the message event isnt comming across
        client.sendReadReceipt(roomId, event["event_id"])

        //maths
        let seconds = process.uptime()

        let minutes = Math.floor(seconds/60)

        let rSeconds = seconds - (minutes*60)

        let hours = Math.floor(minutes/60)

        let rMinutes = minutes - (hours*60)

        //send the uptime to the room
        client.sendText(roomId, ("> " + seconds + "\n" + hours + " hours, " + rMinutes + " minutes, and " + Math.floor(rSeconds) + " seconds."))

    //join cmd 
    } else if (scannableContent.startsWith("+join")) {

        let joinroom = event["content"]["body"].split(" ")[1]

        client.resolveRoom(joinroom).then(async joinroomid => {

            client.joinRoom(joinroomid).then(() => {

                let greeting = "Greetings! I am brought here by " + event["sender"] + ", bot by @jjj333_p_1325:matrix.org (pls dm for questions). My MO is I warn people about telegram and whatsapp investment scams whenever they are posted in the room."

                client.sendNotice(joinroomid, greeting).then(() => {

                    client.sendNotice(roomId, "✅ | successfully joined room!")

                }).catch(err => {

                    client.sendNotice(roomId, "🍃 | I was able to join the provided room however I am unable to send messages, and therefore will only be able to react to messages with my warning.")

                })

            }).catch(err => {

                client.sendHtmlNotice(roomId, "❌ | I ran into the following error while trying to join that room:<blockquote>"  + JSON.stringify(err.body, null, 2) + "</blockquote>")

            })

        }).catch(err => {

            client.sendHtmlNotice(roomId, "❌ | I ran into the following error while trying to resolve that room ID:<blockquote>" + err.message + "</blockquote>")

        })

    } else if (scannableContent.startsWith("+leave")){

        if (event["sender"] == "@jjj333_p_1325:matrix.org"){

            client.leaveRoom(roomId)

        } else {

            client.sendText(roomId, "Sorry, only my owner can do that. If you are a moderator of the room please just kick me from the room, I will not join back unless someone tells me to (and I will disclose who told me to).")

        }

    } else if (scannableContent.startsWith("+restart")) {

        if (event["sender"] == "@jjj333_p_1325:matrix.org"){

            process.exit(0)

        }
        
    }

});


async function sendjson (roomId, event){ 

    //check to make sure folders are there
    if(!fs.readdirSync("./db/").some(dir => dir == "tg-scams")){fs.mkdirSync("./db/tg-scams")}
    let currentDir = "./db/tg-scams/"

    //make folder for each account
    if(!fs.readdirSync(currentDir).some(dir => dir == event["sender"])){fs.mkdirSync(currentDir  + event["sender"] + "/")}
    currentDir = currentDir + event["sender"] + "/"
    
    //filename
    let file = (currentDir  +  roomId+ "@" + Date.now() + ".json")

    //save the json of the recieved message
    fs.writeFileSync(file, JSON.stringify(event, null, 2))

    //upload the file to homeserver
    let linktofile = await client.uploadContent(fs.readFileSync(file))

    await client.sendHtmlText(logindata[2],(event["sender"] +  " in "+ await client.getPublishedAlias(roomId) + "\n<blockquote>" + event["content"]["body"] + "</blockquote>\nhttps://matrix.to/#/" + roomId + "/" + event["event_id"]))

    //send the file that was uploaded
    await client.sendMessage(logindata[2], {
        "body":(roomId+ "@" + Date.now() + ".json"),
        "info": {
            "mimetype": "text/x-go",
            "size": 217
        },
        "msgtype":"m.file",
        "url":linktofile,
    })    
    
}

client.on("room.event", async (roomId, event) => {

    if(event["type"] == "m.room.redaction"){

        let response = tgScams.get(event["redacts"])

        if (response) {client.redactEvent(response.roomId, response.responseID, "Investment scam that this message was replying to was deleted.")}

        // let modroom = "!xWGMKuBpJrtGDSfmaF:matrix.org"

        // client.sendHtmlText(modroom, "Deleted by " + event["sender"]+ " for the reason of { " + event["content"]["reason"] + " }\n<pre><code class=\"language-json\">" + JSON.stringify(msgCache.get(roomId).msgs.find(msg => msg["event_id"] == event["redacts"]), null, 2) + "</code></pre>")

        // client.getPublishedAlias()

    }
})
