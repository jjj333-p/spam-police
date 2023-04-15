//sendjson class
const { PowerLevelAction } = require("matrix-bot-sdk/lib/models/PowerLevelAction")
const {Sendjson} = require("./sendjson")
var sendjson = new Sendjson()


class message {

    constructor (logRoom, commandRoom, config, authorizedUsers){

        //map to relate scams and their responses (for deletion)
        this.tgScamResponses = new Map()

        //config thingys
        this.logRoom         = logRoom
        this.commandRoom     = commandRoom
        this.config          = config
        this.authorizedUsers = authorizedUsers

        //fetch keywords
        this.keywords = require("../keywords.json")
        
    }

    async run (client, roomId, event, mxid, displayname, blacklist){

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
            if(roomId == this.logRoom){

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
                sendjson.send(client, roomId, this.logRoom, event, mxid)

                //React to the message with a little warning so its obvious what msg im referring to
                await client.sendEvent(roomId, "m.reaction", ({

                    "m.relates_to": {
                        "event_id":event["event_id"],
                        "key":"🚨 scam! 🚨",
                        "rel_type": "m.annotation"
                    }

                }))

                    //catch the error to prevent crashing, however if it cant send theres not much to do
                    .catch(() => {})
                    
                    //dont care if it was successful, carry on with the code
                    .finally(async () => {

                        //if the room is in mute mode, dont respond
                        if (Boolean(this.config.getConfig(roomId, "muted"))) return

                        // //send warning message
                        // let responseID = await client.sendText(roomId, this.keywords.scams.response)

                        // //relate the telegram scam to its response in order to delete the response automatially when the scam is removed.
                        // this.tgScamResponses.set(event["event_id"], {"roomId":roomId, "responseID":responseID})

                        //send warning message
                        client.sendHtmlText(roomId, this.keywords.scams.response)
                        
                            //if warning is sent, associate it with the original scam for later redaction
                            .then(responseID => { this.tgScamResponses.set(event["event_id"], {"roomId":roomId, "responseID":responseID}) })

                            //catch error without crashing
                            .catch(() => {})

                            .finally(async () => {

                                //if the message is replying
                                let replyRelation = event["content"]["m.relates_to"]//["m.in_reply_to"]["event_id"]
                                if (replyRelation){

                                    //pull the id of the event its replying to
                                    if (replyRelation["m.in_reply_to"]) { 
                                        let replyID = replyRelation["m.in_reply_to"]["event_id"]

                                        //fetch the event from that id
                                        let repliedEvent = await client.getEvent(roomId, replyID)
                                
                                        //make the content scanable
                                        let scannableContent = repliedEvent["content"]["body"].toLowerCase()
                                
                                        //if the message is replying to a scam, it doesnt need to be acted upon
                                        if (includesWord(scannableContent, [this.keywords.scams.currencies, this.keywords.scams.socials, this.keywords.scams.verbs])) {
                                            return
                                        }

                                    }

                                }

                                let scamAction = this.config.getConfig(roomId, "scamAction")

                                let reason = "Scam Likely"

                                if (!scamAction) {

                                    if ( await client.userHasPowerLevelForAction(mxid, roomId, "kick") ) {

                                        client.kickUser(event["sender"], roomId, reason).catch(() => {})

                                    }

                                } else if (scamAction == -1) {

                                    if ( await client.userHasPowerLevelForAction(mxid, roomId, "redact") ) {

                                        client.redactEvent(roomId, event["event_id"], reason).catch(() => {})

                                    }

                                } else if (scamAction == 1 ) {

                                    //     userHasPowerLevelFor(userId: string, roomId: string, eventType: string, isState: boolean): Promise<boolean>;
                                    // setUserPowerLevel(userId: string, roomId: string, newLevel: number): Promise<any>;
                                    // client.setUserPowerLevel(user, roomId, newlevel)
                                    


                                    // if ( await client.userHasPowerLevelFor(mxid, roomId, "m.room.power_levels", true) ){



                                    // }

                                }

                            })
                    
                    })

            }

        //check uptime
        }  else if (!(await client.userHasPowerLevelFor(mxid, roomId, "m.room.message", false))) { 
            
            return 
        
        } else if (scannableContent.includes("+uptime")) {

            //let user know that the bot is online even if the matrix room is being laggy and the message event isnt comming across
            client.sendReadReceipt(roomId, event["event_id"])

            //maths
            let seconds = process.uptime()

            let minutes = Math.floor(seconds/60)

            let rSeconds = seconds - (minutes*60)

            let hours = Math.floor(minutes/60)

            let rMinutes = minutes - (hours*60)

            //send the uptime to the room
            client.sendHtmlText(roomId, ("<blockquote>\n<p>" + seconds + "</p>\n</blockquote>\n<p>" + hours + " hours, " + rMinutes + " minutes, and " + Math.floor(rSeconds) + " seconds.</p>"))

        //join cmd 
        } else if (scannableContent.startsWith("+join")) {

            if(roomId != this.commandRoom){

                client.sendNotice(roomId, "❌ | you must run +join commands in https://matrix.to/#/" + this.commandRoom + "?via=" + mxid.split(":")[1])

                return

            }

            //grep out the room indicated by the user
            let joinroom = event["content"]["body"].split(" ")[1]

            //evaluate if its a valid alias
            client.resolveRoom(joinroom).then(async joinroomid => {

                //check blacklist for a blacklisted reason
                let blReason = blacklist.match(joinroomid)

                //if there is a reason that means the room was blacklisted
                if(blReason) {

                    //send error
                    client.sendHtmlNotice(roomId, "❌ | This room is blacklisted for reason <code>" + blReason + "</code>.")

                    //dont continue trying to join
                    return

                }

                //try to join
                client.joinRoom(joinroomid).then(() => {

                    //greeting message
                    let greeting = "Greetings! I am brought here by " + event["sender"] + ", bot by @jjj333:pain.agency (pls dm for questions). " + 
                    "My MO is I warn people about telegram and whatsapp investment scams whenever they are posted in the room. If I am unwanted please just kick me. " + 
                    "For more information please visit https://github.com/jjj333-p/spam-police"

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

            //verify is sent by an admin
            if ( this.authorizedUsers.some(u => u == event["sender"]) ){

                //parce out the possible room id
                let leaveRoom = event["content"]["body"].split(" ")[1]

                //"+leave" as well as a space afterwards
                let substringStart = 7

                //if has the characters required for a room id or alias
                if ((leaveRoom.includes("#") || leaveRoom.includes("!")) && leaveRoom.includes(":") && leaveRoom.includes(".")){

                    //evaluate if its a valid alias
                    client.resolveRoom(leaveRoom).then(async leaveroomid => {

                        //add room id or alias to start the reason at the right part of the string
                        substringStart = substringStart + leaveRoom.length + 1

                        //parce out the reason
                        let reason = event["content"]["body"].substring(substringStart)

                        //make sure reason is in the banlist
                        if (!reason) { reason = "<No reason provided.>" }

                        //add room to blacklist
                        blacklist.add(leaveroomid, reason)

                        //let the room know why the bot is leaving
                        client.sendHtmlNotice(leaveroomid, "Leaving room for reason <code>" + reason + "</code>.")
                            .catch(() => {}) //doesnt matter if unable to send to the room
                            .finally(() => { 

                                //attempt to leave the room
                                client.leaveRoom(leaveroomid).then(() => {

                                    //success message
                                    client.sendHtmlNotice(roomId, "✅ | left room <code>" + leaveroomid + "</code> with reason <code>" + reason + "</code>.")

                                }).catch(err => {

                                    //error message
                                    client.sendHtmlNotice(roomId, "❌ | I ran into the following error leaving the room: <code>" + err + "</code>")

                                })

                            })

                    }).catch(err => {

                        //throw error about invalid alias
                        client.sendHtmlNotice(roomId, "❌ | I ran into the following error while trying to resolve that room ID:<blockquote>" + err.message + "</blockquote>")
        
                    })

                //if cant possibly be a room alias, leave *this* room
                } else {

                    //parce out reason
                    let reason = event["content"]["body"].substring(substringStart)

                    //add to blacklist
                    blacklist.add(roomId, reason)

                    //leave room
                    client.leaveRoom(roomId)

                }

            } else {

                client.sendText(roomId, "Sorry, only my owner(s) can do that. If you are a moderator of the room please just kick me from the room, I will not join back unless someone tells me to (and I will disclose who told me to).")

            }

        } else if (scannableContent.startsWith("+unblacklist")){

            //verify is sent by an admin
            if ( this.authorizedUsers.some(u => u == event["sender"]) ){

                //parce out the possible room id
                let leaveRoom = event["content"]["body"].split(" ")[1]

                //"+leave" as well as a space afterwards
                // let substringStart = 7

                //if has the characters required for a room id or alias
                if ((leaveRoom.includes("#") || leaveRoom.includes("!")) && leaveRoom.includes(":") && leaveRoom.includes(".")){

                    //evaluate if its a valid alias
                    client.resolveRoom(leaveRoom).then(async leaveroomid => {

                        //add room id or alias to start the reason at the right part of the string
                        // substringStart = substringStart + leaveRoom.length + 1

                        //parce out the reason
                        // let reason = event["content"]["body"].substring(substringStart)

                        //make sure reason is in the banlist
                        // if (!reason) { reason = "<No reason provided.>" }

                        //remove room to blacklist
                        blacklist.remove(leaveroomid)
                            .then(() => {
                                
                                client.sendEvent(roomId, "m.reaction", ({
                                    "m.relates_to": {
                                        "event_id":event["event_id"],
                                        "key":"✅",
                                        "rel_type": "m.annotation"
                                    }
                                }))

                            })

                        

                    }).catch(err => {

                        //throw error about invalid alias
                        client.sendHtmlNotice(roomId, "❌ | I ran into the following error while trying to resolve that room ID:<blockquote>" + err.message + "</blockquote>")
        
                    })

                //if cant possibly be a room alias, leave *this* room
                } else {

                    client.sendEvent(roomId, "m.reaction", ({
                        "m.relates_to": {
                            "event_id":event["event_id"],
                            "key":"❌",
                            "rel_type": "m.annotation"
                        }
                    }))

                }

            } else {

                client.sendText(roomId, "Sorry, only my owner(s) can do that. If you are a moderator of the room please just kick me from the room, I will not join back unless someone tells me to (and I will disclose who told me to).")

            }

        } else if (scannableContent.startsWith("+restart")) {

            //this is only for me, and a temporary cmd to alter later
            if ( this.authorizedUsers.some(u => u == event["sender"]) ){

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

        } else if (scannableContent.startsWith("+banlist")){

            //parce the room that the cmd is referring to
            let banlist = event["content"]["body"].split(" ")[1]

            //use here so people dont have to type the room alias on an asinine client
            if (banlist.toLowerCase() == "here") banlist = roomId

            //resolve alias to an id for easier use
            client.resolveRoom(banlist).then(banlistid=> {

                //make banlist rule
                client.sendStateEvent(banlistid, "m.policy.rule.user", ("rule:" + scannableContent.split(" ")[2]), {
                    "entity": scannableContent.split(" ")[2],
                    "reason": "impersonation",
                    "recommendation": "org.matrix.mjolnir.ban"
                },)

            }).catch(err => client.sendNotice(roomId, "🍃 | I unfortunately ran into the following error while trying to run that command\n" + err))

        } else if (scannableContent.includes(mxid) || scannableContent.includes(displayname)) {

            //greeting message
            let greeting = "Greetings! I am a bot by @jjj333:pain.agency (pls dm for questions). " + 
            "My MO is I warn people about telegram and whatsapp investment scams whenever they are posted in the room. If I am unwanted please just kick me. " + 
            "For more information please visit https://github.com/jjj333-p/spam-police"

            client.sendText(roomId, greeting)
            
        }

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
