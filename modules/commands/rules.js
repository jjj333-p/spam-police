import fs from "fs"

class Rules {

    constructor(){}

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

        //convert json into binary buffer
        let file = Buffer.from(JSON.stringify(rules, null, 2))

        //upload the file buffer to the matrix homeserver, and grab mxc:// url
        let linktofile = await client.uploadContent(file, "application/json", filename)

        //send file
        client.sendMessage(roomId, {
            "body":filename,
            "info": {
                "mimetype": "application/json",
                "size":file.byteLength
            },
            "msgtype":"m.file",
            "url":linktofile,
        })

    }

}

export {Rules}