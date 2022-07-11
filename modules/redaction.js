class redaction {

    constructor (eventhandlers) {

        this.eventhandlers = eventhandlers

    }

    async run (client, roomId, event){

        //fetch the bots response to the scam
        let response = this.eventhandlers.get("m.room.message").tgScamResponses.get(event["redacts"])

        //if there is a response to the redacted message then redact the response
        if (response) {client.redactEvent(response.roomId, response.responseID, "Investment scam that this message was replying to was deleted.")}

        // let modroom = "!xWGMKuBpJrtGDSfmaF:matrix.org"

        // client.sendHtmlText(modroom, "Deleted by " + event["sender"]+ " for the reason of { " + event["content"]["reason"] + " }\n<pre><code class=\"language-json\">" + JSON.stringify(msgCache.get(roomId).msgs.find(msg => msg["event_id"] == event["redacts"]), null, 2) + "</code></pre>")

        // client.getPublishedAlias()

    }

}

module.exports = {redaction}