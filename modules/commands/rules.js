import fs from "fs"

class Rules {

    constructor(){

        //working directory to write tmp files to
        this.workingTmpDir = "./db/tmp"

        //make sure there is an appropriate area to write file to
        if(!fs.existsSync(this.workingTmpDir)) fs.mkdirSync(this.workingTmpDir, { recursive: true })

    }

    async run ({client, roomId, event, config, banListReader}, {offset, contentByWords}){

        //fetch banlists for room
        let roomBanlists = config.getConfig(roomId, "banlists")

        //if there is no config, create a temporary one with just the room id
        if( !roomBanlists ){ roomBanlists = [roomId,] }

        //if there is a config, set the room up to check its own banlist
        else { 
            if (!roomBanlists.includes(roomId)) {
                roomBanlists = [roomId, ...roomBanlists];
            }
        }

        //object to write rules to
        let rules = {}

        //look through all banlists
        for (let i = 0; i < roomBanlists.length; i++) {

            let rm = roomBanlists[i];

            //find recommendation
            let rulesForRoom = await banListReader.getRules(rm)

            rules[rm] = rulesForRoom

        }

        //generate filename to write to
        let filename = "UserBanRecommendations_" + roomId + "_" + (new Date()).toISOString() + ".json"

        //upload the file buffer to the matrix homeserver, and grab mxc:// url
        let linktofile = await client.uploadContent(Buffer.from(JSON.stringify(rules, null, 2)), "application/json", filename)

        //send file
        client.sendMessage(roomId, {
            "body":filename,
            "info": {
                "mimetype": "application/json"
            },
            "msgtype":"m.file",
            "url":linktofile,
        })

    }

}

export {Rules}