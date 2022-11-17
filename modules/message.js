//sendjson class
const { PowerLevelAction } = require("matrix-bot-sdk/lib/models/PowerLevelAction")
const {Sendjson} = require("./sendjson")
var sendjson = new Sendjson()


class message {

    constructor (keywords, logindata, config){

        //map to relate scams and their responses (for deletion)
        this.tgScamResponses = new Map()

        this.keywords = keywords
        this.logindata = logindata
        this.config = config
        
    }

    async run (client, roomId, event, ){

        //if no content in message
        if (! event["content"]) return;

        // Don't handle non-text events
        if (event["content"]["msgtype"] !== "m.text") return;

        //filter out events sent by the bot itself.
        if (event["sender"] === await client.getUserId()) return;

        //grab the content from the message, and put it to lowercase to prevent using caps to evade
        let scannableContent = event["content"]["body"].toLowerCase()

        //scan for common scam words
        if (includesWord(scannableContent, [this.keywords.scams.currencies, this.keywords.scams.socials, this.keywords.scams.verbs])) {
        
            //if the scam is posted in the room deticated to posting tg scams
            if(roomId == this.logindata[2]){

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
                sendjson.send(client, roomId, this.logindata[2], event)

                //React to the message with a little warning so its obvious what msg im referring to
                await client.sendEvent(roomId, "m.reaction", ({
                    "m.relates_to": {
                        "event_id":event["event_id"],
                        "key":"🚨 scam! 🚨",
                        "rel_type": "m.annotation"
                    }
                })).finally(async () => {

                    //if the room is in mute mode, dont respond
                    if (Boolean(this.config.getConfig(roomId, "muted"))) return

                    //send warning message
                    let responseID = await client.sendText(roomId, this.keywords.scams.response)

                    //relate the telegram scam to its response in order to delete the response automatially when the scam is removed.
                    this.tgScamResponses.set(event["event_id"], {"roomId":roomId, "responseID":responseID})
                
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

            //grep out the room indicated by the user
            let joinroom = event["content"]["body"].split(" ")[1]

            //evaluate if its a valid alias
            client.resolveRoom(joinroom).then(async joinroomid => {

                //try to join
                client.joinRoom(joinroomid).then(() => {

                    //greeting message
                    let greeting = "Greetings! I am brought here by " + event["sender"] + ", bot by @jjj333:pain.agency (pls dm for questions). My MO is I warn people about telegram and whatsapp investment scams whenever they are posted in the room."

                    //try to send the greeting
                    client.sendNotice(joinroomid, greeting).then(() => {

                        //confirm joined and can send messages
                        client.sendNotice(roomId, "✅ | successfully joined room!")

                    }).catch(err => {

                        //confirm could join, but show error that couldn't send messages
                        client.sendNotice(roomId, "🍃 | I was able to join the provided room however I am unable to send messages, and therefore will only be able to react to messages with my warning.")

                    })

                }).catch(err => {

                    //throw error about joining room
                    client.sendHtmlNotice(roomId, "❌ | I ran into the following error while trying to join that room:<blockquote>"  + JSON.stringify(err.body, null, 2) + "</blockquote>")

                })

            }).catch(err => {

                //throw error about invalid alias
                client.sendHtmlNotice(roomId, "❌ | I ran into the following error while trying to resolve that room ID:<blockquote>" + err.message + "</blockquote>")

            })

        } else if (scannableContent.startsWith("+leave")){

            //this is only for me, and a temporary cmd to alter later
            if (event["sender"] == "@jjj333_p_1325:matrix.org"){

                client.leaveRoom(roomId)

            } else {

                client.sendText(roomId, "Sorry, only my owner can do that. If you are a moderator of the room please just kick me from the room, I will not join back unless someone tells me to (and I will disclose who told me to).")

            }

        } else if (scannableContent.startsWith("+restart")) {

            //this is only for me, and a temporary cmd to alter later
            if (event["sender"] == "@jjj333_p_1325:matrix.org"){

                process.exit(0)

            }
            
        //mute cmd
        } else if (scannableContent.startsWith("+mute")){
            
            //im equivicating muting the bot to redacting its messages right after they are sent.
            if (!await client.userHasPowerLevelForAction(event["sender"], roomId, "redact")){  //"redact")){

                //error msg
                client.sendNotice(roomId, "🍃 | This command requires you have a powerlevel high enough to redact other users messages.")

                //dont run the cmd
                return

            }

            //confirm got message, idk if this actually works lmao
            client.sendReadReceipt(roomId, event["event_id"])

            //grab the opposite of what is in the db
            let mute = !Boolean(this.config.getConfig(roomId, "muted"))

            if (mute) {

                client.sendNotice(roomId, "Putting the bot into mute mode for this channel...")

            } else {

                client.sendNotice(roomId, "Taking the bot out of mute mode for this channel...")
                
            }

            //set the new config
            this.config.setConfig(roomId, "muted", mute, response => {

                //send confirmation
                client.sendNotice(roomId, response)

            })

        }

        // client.sendNotice(roomId, String(await client.userHasPowerLevelForAction(event["sender"], roomId, "kick")))

    }

}

//function to scan if it matches the keywords
function includesWord (str, catgs) {

    //assume true if you dont have any missing
    let result = true

    catgs.forEach(cat => {

        if(!cat.some(word => str.includes(word))) result = false
        
    });

    return result

}

module.exports = {message}
