class Reaction {

    constructor (logRoom){

        this.logRoom = logRoom

    }

    async run ({client, roomId, event, mxid, scamBlEntries}) {

        //should never happen but aparently it does
        //https://matrix.pain.agency/_matrix/media/v3/download/pain.agency/51cc6283f64310640f67daa84f284ae8e7a08a969bd2f7f57920a4d30aa83c00
        if(!event["content"]["m.relates_to"])             return;
        if(!event["content"]["m.relates_to"]["event_id"]) return;

        if(roomId == this.logRoom){

            //make sure the reaction was to a scam entry
            if( ! scamBlEntries.get(event["content"]["m.relates_to"]["event_id"])) {return}

            let senderpl = (await client.getRoomStateEvent(this.logRoom, "m.room.power_levels", null))["users"][event["sender"]]

            if((senderpl === undefined) || (senderpl < 10 )) {return}

            //if its a checkmark, run the confirm scam 
            if(event["content"]["m.relates_to"]["key"].includes("✅")){ scamBlEntries.get(event["content"]["m.relates_to"]["event_id"]).confirmScam(event["event_id"]) }
            
            //if its an x, delete relevant stuff
            else if (event["content"]["m.relates_to"]["key"].includes("❌")){ scamBlEntries.get(event["content"]["m.relates_to"]["event_id"]).denyScam(event["event_id"]) }

        }

    }

}

export { Reaction }