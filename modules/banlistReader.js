class BanlistReader {

    constructor(client) {

        this.client = client

        this.rooms = new Map()

    }

    async syncRoom(roomId){

        let list = (await this.client.getRoomState(roomId)).filter(event => event.type == "m.policy.rule.user")

        //organize away that list for later
        this.rooms.set(roomId, list)

    }

    async run({roomId, event}) {

        //fetch room's list of banlist events
        let roomEvents = this.rooms.get(roomId);

        //see comment below
        await this.syncRoom(roomId)

        /* not currently working, not sure it needs to work like this

        //if the room was never synced
        if (! Array.isArray(roomEvents)) { await this.syncRoom(roomId) }

        //means theres an updated event, im too lazy to figure out how to resolve that conflict
        else  if(roomEvents.includes(se => se["state_key"] == event["state_key"])){ await this.syncRoom(roomId) }

        //if its a brand new rule, we dont need to resync everything
        else{ roomEvents.push(event); }

        */

        //confirm that the bot updated its list with the new event
        this.client.sendReadReceipt(roomId, event["event_id"])
        
    }

    async match(roomId, matchMXID) {

        //fetch room's list of banlist events
        let roomEvents = this.rooms.get(roomId);

        //if the room was never synced, sync it
        if (! Array.isArray(roomEvents)) { await this.syncRoom(roomId); roomEvents = this.rooms.get(roomId); }

        //look through all the state events
        let match = roomEvents.find(se => {

            //if the ban was erased
            if (!se["content"] ) {return false}

            //parce out the mxid from the key
            let potentialMXID = se["state_key"].substring(5)

            //if mismatch, its invalid
            //mothet sidev
            if ( (se["content"]["entity"] != potentialMXID) || ( se["content"]["recommendation"] != "org.matrix.mjolnir.ban"))
            {return false}

            //if exact match, it is match
            if( potentialMXID == matchMXID) { return true }

            //if theres no wildcards, and not an exact match, its not a match
            if( ! potentialMXID.includes("*") ) { return false}

            //split around the wildcards
            let p = potentialMXID.split("*")

            //check before first wildcard
            let firstpart = p.shift()
            if( ! matchMXID.startsWith( firstpart ) ) {return false}

            //check after last wildcard
            let lastpart = p.pop()
            if( ! matchMXID.endsWith( lastpart ) ) {return false}

            //parce off the evaluated start and end
            matchMXID = matchMXID.substring(firstpart.length, (matchMXID.length - lastpart.length) )

            //loop until a condition to return arises 
            while (true) {

                //if there is no more parts to match and everything else around wildcards matched
                //it is match
                if( p.length < 1 ) { return true }

                //if one of the bits between wildcards doesnt exist, it cant be a match
                if ( !  ( matchMXID.includes(p[0]) ) ) { return false }
            
                //match the remaining parts in order starting with the first one left to match, then removing everything
                //before it, and going back through the process untill theres nothing left to match
                //have to use a substring of the original in case there was multiple matches of the next item to match
                let nexttomatch = p.shift()
                let r = matchMXID.split( nexttomatch )
                matchMXID = matchMXID.substring(nexttomatch.length + r[0])

            }

        })

        return match;

    }


}

export {BanlistReader}