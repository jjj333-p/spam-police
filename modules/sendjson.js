import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

class Sendjson {

    constructor (logindata) {

        //create array to store scams to help limit duplicates (when spammed)  
        this.tgScams = []


        //fetch keywords
        this.keywords = require("../keywords.json")

    }

    async send ({client, roomId, event, mxid}, logchannel){ 

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
        
                //if the message is replying to a scam, it doesnt need to be logged
                if (includesWord(scannableContent, [this.keywords.scams.currencies, this.keywords.scams.socials, this.keywords.scams.verbs])) {
                    return
                }

            }
    
        }
    
        //limit duplicates
        if (this.tgScams.some(scam => (scam["content"]["body"] == event["content"]["body"]) && (scam["room_id"] == event["room_id"]) && (scam["sender"] == event["sender"]))) { return } else {
    
            this.tgScams.push(event)
    
        }
    
        //check to make sure folders are there
        if(!readdirSync("./db/").some(dir => dir == "tg-scams")){mkdirSync("./db/tg-scams")}
        let currentDir = "./db/tg-scams/"
    
        //make folder for each account
        if(!readdirSync(currentDir).some(dir => dir == event["sender"])){mkdirSync(currentDir  + event["sender"] + "/")}
        currentDir = currentDir + event["sender"] + "/"
        
        //filename
        let file = (currentDir  +  roomId+ "@" + Date.now() + ".json")
    
        //save the json of the recieved message
        writeFileSync(file, JSON.stringify(event, null, 2))
    
        //upload the file to homeserver (outputs mxc:// or whatever)
        let linktofile = await client.uploadContent(readFileSync(file))

        //fetch the set alias of the room
        let mainRoomAlias = await client.getPublishedAlias(roomId)

        //if there is no alias of the room
        if(!mainRoomAlias){

            //dig through the state, find room name, and use that in place of the main room alias
            mainRoomAlias = (await client.getRoomState(roomId)).find(state => state.type == "m.room.name")["content"]["name"]

            //should still be able to go to the link using the https://matrix.to/#/ link
        }

        //if the bot is in the room, that mean it's homeserver can be used for a via
        let via = mxid.split(":")[1]
    
        //send log message
        await client.sendHtmlText(logchannel,(event["sender"] +  " in "+ mainRoomAlias + "\n<blockquote>" + event["content"]["body"] 
        + "</blockquote>\nhttps://matrix.to/#/" + roomId + "/" + event["event_id"] + "?via=" + via))
    
        //send the file that was uploaded
        await client.sendMessage(logchannel, {
            "body":(roomId+ "@" + Date.now() + ".json"),
            "info": {
                "mimetype": "text/x-go",
                "size": 217
            },
            "msgtype":"m.file",
            "url":linktofile,
        })    
        
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

export { Sendjson };
