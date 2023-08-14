class Reaction {

    constructor (logRoom){

        this.logRoom = logRoom

    }

    async run ({client, roomId, event, mxid, scamBlEntries}) {

        if(roomId == this.logRoom){

            //make sure the reaction was to a scam entry
            if( ! scamBlEntries.get(event["content"]["m.relates_to"]["event_id"])) {return}

            let senderpl = (await client.getRoomStateEvent(this.logRoom, "m.room.power_levels", null))["users"][event["sender"]]

            // console.log(event["m.relates_to"])
            if( senderpl < 10 && senderpl) {return}

            //if its a checkmark, run the confirm scam 
            if(event["content"]["m.relates_to"]["key"].includes("✅")){ scamBlEntries.get(event["content"]["m.relates_to"]["event_id"]).confirmScam(event["event_id"]) }
            
            //if its an x, delete relevant stuff
            else if (event["content"]["m.relates_to"]["key"].includes("❌")){ scamBlEntries.get(event["content"]["m.relates_to"]["event_id"]).denyScam(event["event_id"]) }

        }

    }

}

export { Reaction }