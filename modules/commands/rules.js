class Rules {

    constructor(){}

    async run ({client, roomId, event, config, banListReader}, {offset, contentByWords}){

        //fetch banlists for room
        let roomBanlists = config.getConfig(roomId, "banlists")

        //if there is no config, create a temporary one with just the room id
        if( !roomBanlists ){ roomBanlists = [roomId] }

        //if there is a config, set the room up to check its own banlist
        else { roomBanlists = [roomId] + roomBanlists }

        let rules = {}

        //look through all banlists
        for (let i = 0; i < roomBanlists.length; i++) {

            let rm = roomBanlists[i];

            //find recommendation
            let rulesForRoom = await banListReader.getRules(roomId)

            rules[roomId] = rulesForRoom

        }

        //TODO: WRITE TO FILE AND SEND TO USER

    }

}

export {Rules}