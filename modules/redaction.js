class redaction {

    constructor (eventhandlers) {

        this.eventhandlers = eventhandlers

    }

    async run ({client, event}){

        //fetch the bots response to the scam
        let response = this.eventhandlers.get("m.room.message").tgScamResponses.get(event["redacts"])
        let reaction = this.eventhandlers.get("m.room.message").tgScamReactions.get(event["redacts"])

        //if there is a response to the redacted message then redact the response
        if (response) {client.redactEvent(response.roomId, response.responseID, "Investment scam that this message was replying to was deleted.")}
        if (reaction) {client.redactEvent(reaction.roomId, reaction.responseID, "Investment scam that this message was replying to was deleted.")}

    }

}

export { redaction };
