//sendjson class
import { PowerLevelAction } from "matrix-bot-sdk"
import { createRequire } from "module";
const require = createRequire(import.meta.url);

import { Sendjson } from "./sendjson.js"

import { Uptime } from "./commands/uptime.js"
import { Join } from "./commands/join.js"
import { Leave } from "./commands/leave.js"
import { Unblacklist } from "./commands/unblacklist.js";
import { Restart } from "./commands/restart.js";

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

        //create collection of different commands to run
        this.commands = new Map()

        this.commands.set("uptime", new Uptime())
        this.commands.set("join", new Join())
        this.commands.set("leave", new Leave())
        this.commands.set("unblacklist", new Unblacklist())
        this.commands.set("restart", new Restart())
        
    }

    // async run ({client, roomId, event, mxid, displayname, blacklist}){
    async run (datapoints){

        //if no content in message
        if (! datapoints.event["content"]) return;

        // Don't handle non-text events
        if (datapoints.event["content"]["msgtype"] !== "m.text") return;

        //filter out events sent by the bot itself.
        if (datapoints.event["sender"] === await datapoints.client.getUserId()) return;

        //grab the content from the message, and put it to lowercase to prevent using caps to evade
        let scannableContent = datapoints.event["content"]["body"].toLowerCase()

        // this.commands.run(datapoints, scannableContent)

        //scan for common scam words
        if (includesWord(scannableContent, [this.keywords.scams.currencies, this.keywords.scams.socials, this.keywords.scams.verbs])) {
        
            //if the scam is posted in the room deticated to posting tg scams
            if(datapoints.roomId == this.logRoom){

                //confirm it matches the keywords
                client.sendEvent(roomId, "m.reaction", ({
                    "m.relates_to": {
                        "event_id":datapoints.event["event_id"],
                        "key":"✅",
                        "rel_type": "m.annotation"
                    }
                }))

            } else {

                //custom function to handle the fetching and sending of the json file async as to not impact responsiveness
                sendjson.send(datapoints, this.logRoom,)

                //React to the message with a little warning so its obvious what msg im referring to
                await datapoints.client.sendEvent(datapoints.roomId, "m.reaction", ({

                    "m.relates_to": {
                        "event_id":datapoints.event["event_id"],
                        "key":"🚨 scam! 🚨",
                        "rel_type": "m.annotation"
                    }

                }))

                    //catch the error to prevent crashing, however if it cant send theres not much to do
                    .catch(() => {})
                    
                    //dont care if it was successful, carry on with the code
                    .finally(async () => {

                        //if the room is in mute mode, dont respond
                        if (Boolean(this.config.getConfig(datapoints.roomId, "muted"))) return

                        // //send warning message
                        // let responseID = await client.sendText(datapoints.roomId, this.keywords.scams.response)

                        // //relate the telegram scam to its response in order to delete the response automatially when the scam is removed.
                        // this.tgScamResponses.set(event["event_id"], {"roomId":datapoints.roomId, "responseID":responseID})

                        //send warning message
                        datapoints.client.sendHtmlText(datapoints.roomId, this.keywords.scams.response)
                        
                            //if warning is sent, associate it with the original scam for later redaction
                            .then(responseID => { this.tgScamResponses.set(datapoints.event["event_id"], {"roomId":datapoints.roomId, "responseID":responseID}) })

                            //catch error without crashing
                            .catch(() => {})

                            .finally(async () => {

                                //if the message is replying
                                let replyRelation = datapoints.event["content"]["m.relates_to"]//["m.in_reply_to"]["event_id"]
                                if (replyRelation){

                                    //pull the id of the event its replying to
                                    if (replyRelation["m.in_reply_to"]) { 
                                        let replyID = replyRelation["m.in_reply_to"]["event_id"]

                                        //fetch the event from that id
                                        let repliedEvent = await datapoints.client.getEvent(datapoints.roomId, replyID)
                                
                                        //make the content scanable
                                        let scannableContent = repliedEvent["content"]["body"].toLowerCase()
                                
                                        //if the message is replying to a scam, it doesnt need to be acted upon
                                        if (includesWord(scannableContent, [this.keywords.scams.currencies, this.keywords.scams.socials, this.keywords.scams.verbs])) {
                                            return
                                        }

                                    }

                                }

                                let scamAction = this.config.getConfig(datapoints.roomId, "scamAction")

                                let reason = "Scam Likely"

                                if (!scamAction) {

                                    if ( await datapoints.client.userHasPowerLevelForAction(datapoints.mxid, datapoints.roomId, "kick") ) {

                                        datapoints.client.kickUser(datapoints.event["sender"], datapoints.roomId, reason).catch(() => {})

                                    }

                                } else if (scamAction == -1) {

                                    if ( await datapoints.client.userHasPowerLevelForAction(datapoints.mxid, datapoints.roomId, "redact") ) {

                                        datapoints.client.redactEvent(datapoints.roomId, datapoints.event["event_id"], reason).catch(() => {})

                                    }

                                } else if (scamAction == 1 ) {

                                    //     userHasPowerLevelFor(userId: string, datapoints.roomId: string, eventType: string, isState: boolean): Promise<boolean>;
                                    // setUserPowerLevel(userId: string, roomId: string, newLevel: number): Promise<any>;
                                    // datapoints.client.setUserPowerLevel(user, roomId, newlevel)
                                    


                                    // if ( await datapoints.client.userHasPowerLevelFor(mxid, roomId, "m.room.power_levels", true) ){



                                    // }

                                }

                            })
                    
                    })

            }

        //check if can respond
        } else if (!(await datapoints.client.userHasPowerLevelFor(datapoints.mxid, datapoints.roomId, "m.room.message", false))) { 
            
            return 
        
        } else {

            // } else 

            let contentByWords = scannableContent.split(" ")

            //if the user is trying to mention the bot
            if (scannableContent.includes(datapoints.mxid) || scannableContent.includes(datapoints.displayname)) {

                //if that mention is the start of the message that can be used as the prefix
                if ((contentByWords[0].includes(datapoints.mxid) || contentByWords[0].includes(datapoints.displayname)) && (contentByWords.length > 1)){

                    //if that is a command, run the command
                    let handler = this.commands.get(contentByWords[1])
                    
                    if (!handler) {

                        await datapoints.client.sendEvent(datapoints.roomId, "m.reaction", ({

                            "m.relates_to": {
                                "event_id":datapoints.event["event_id"],
                                "key":"❌ | invalid cmd",
                                "rel_type": "m.annotation"
                            }
        
                        }))

                        return

                    }   

                    handler.run(datapoints, {
                        scannableContent:scannableContent,
                        contentByWords:contentByWords,
                        keywords:this.keywords,
                        logRoom:this.logRoom,
                        commandRoom:this.commandRoom,
                        config:this.config,
                        authorizedUsers:this.authorizedUsers,
                        offset:1
                    })

                }

            } else {
                
                //update to check config later 
                let prefix = "+"

                if ( ! scannableContent.startsWith(prefix) ) return 


                //if that is a command, run the command
                let handler = this.commands.get(contentByWords[0].substring(prefix.length))

                if (!handler) {

                    await datapoints.client.sendEvent(datapoints.roomId, "m.reaction", ({

                        "m.relates_to": {
                            "event_id":datapoints.event["event_id"],
                            "key":"❌ | invalid cmd",
                            "rel_type": "m.annotation"
                        }
    
                    }))

                    return

                }   

                handler.run(datapoints, {
                    scannableContent:scannableContent,
                    contentByWords:contentByWords,
                    keywords:this.keywords,
                    logRoom:this.logRoom,
                    commandRoom:this.commandRoom,
                    config:this.config,
                    authorizedUsers:this.authorizedUsers,
                    offset:0
                })

            }

        }

        /*
 
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
        */

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

export { message };
