class BanlistReader {

    constructor() {

        this.rooms = new Map()

    }

    async syncRoom(roomId){

        let list = (await client.getRoomState(roomId)).filter(event => event.type == "m.policy.rule.user")

        //organize away that list for later
        this.rooms.set(roomId, list)

    }

    async run({client, roomId, event}) {

        //fetch room's list of banlist events
        let roomEvents = this.rooms.get(roomId);

        //if the room was never synced
        if (! Array.isArray(roomEvents)) { await this.syncRoom(roomId) }

        //means theres an updated event, im too lazy to figure out how to resolve that conflict
        else  if(roomEvents.includes(se => se["state_key"] == event["state_key"])){ await this.syncRoom(roomId) }

        //if its a brand new rule, we dont need to resync everything
        else{ roomEvents.push(event); }

        //confirm that the bot updated its list with the new event
        client.sendReadReceipt(roomId, event["event_id"])
        
    }

    async match(roomId, matchMXID) {

        //fetch room's list of banlist events
        let roomEvents = this.rooms.get(roomId);

        //if the room was never synced, sync it
        if (! Array.isArray(roomEvents)) { await this.syncRoom(roomId); roomEvents = this.rooms.get(roomId); }

        //look through all the state events
        let match = roomEvents.find(se => {

            //parce out the mxid from the key
            let potentialMXID = se["state_key"].substring(5)

            //if exact match, it is match
            if( potentialMXID == matchMXID) { return true }

            if( ! potentialMXID.includes("*") ) { return false}

            let p = potentialMXID.split("*")

            if( ! matchMXID.startsWith(p.shift()))

        })

        return match;

    }


}

export {BanlistReader}