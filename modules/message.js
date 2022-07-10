//sendjson class
const {Sendjson} = require("./sendjson")
var sendjson = new Sendjson()


class message {

    constructor (){


        
    }

    async rmsg (client, roomId, event, logindata, keywords){

        //if no content in message
        if (! event["content"]) return;

        // Don't handle non-text events
        if (event["content"]["msgtype"] !== "m.text") return;

        //filter out events sent by the bot itself.
        if (event["sender"] === await client.getUserId()) return;

        //grab the content from the message, and put it to lowercase to prevent using caps to evade
        let scannableContent = event["content"]["body"].toLowerCase()

        //scan for common scam words (still not as clean as I would wish but better.)
        if (includesWord(scannableContent, keywords.scams.currencies) && includesWord(scannableContent, keywords.scams.socials) && includesWord(scannableContent, keywords.scams.verbs)) {
        
            //if the scam is posted in the room deticated to posting tg scams
            if(roomId == logindata[2]){

                //confirm it matches the keywords
                client.sendEvent(roomId, "m.reaction", ({
                    "m.relates_to": {
                        "event_id":event["event_id"],
                        "key":"✅",
                        "rel_type": "m.annotation"
                    }
                }))

            } else {

                //custom function to handle the fetching and sending of the json file async as to not impact responsiveness
                sendjson.send(client, roomId, logindata[2], event)

                //React to the message with a little warning so its obvious what msg im referring to
                await client.sendEvent(roomId, "m.reaction", ({
                    "m.relates_to": {
                        "event_id":event["event_id"],
                        "key":"🚨 scam! 🚨",
                        "rel_type": "m.annotation"
                    }
                })).finally(async () => {

                    //send warning message
                    let responseID = await client.sendText(roomId, keywords.scams.response)

                    //relate the telegram scam to its response in order to delete the response automatially when the scam is removed.
                    tgScamResponses.set(event["event_id"], {"roomId":roomId, "responseID":responseID})
                
                })

            }

        //check uptime
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
    }

}

function includesWord (str, words) {

    return words.some(w => str. includes(w))

}

module.exports = {rmsg}