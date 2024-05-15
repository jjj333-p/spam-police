class redaction {
  constructor(eventhandlers) {
    this.eventhandlers = eventhandlers;
  }

  async run({ client, roomId, event, config }) {
    let redactedEvent;
    try {
      redactedEvent = await client.getEvent(roomId, event.redacts);
    } catch (e) {
      console.log(
        `Attempted to fetch redacted event ${event.redacts}, but it does not exist?`,
        e,
      );
      return; //if there was no event redacted, that means theres inherently nothing to do
    }

    //deleting a chat message
    if (redactedEvent.type === "m.room.message") {
      //fetch the bots response to the scam
      const response = this.eventhandlers
        .get("m.room.message")
        .tgScamResponses.get(event.redacts);
      const reaction = this.eventhandlers
        .get("m.room.message")
        .tgScamReactions.get(event.redacts);

      //if there is a response to the redacted message then redact the response
      if (response) {
        client
          .redactEvent(
            response.roomId,
            response.responseID,
            "The message that this message was replying to was deleted.",
          )
          .catch(() => {});
      }
      if (reaction) {
        client
          .redactEvent(reaction.roomId, reaction.responseID)
          .catch(() => {});
      }

      //if deleting a banlist event just reprocess banlist
    } else if (redactedEvent.type === "m.policy.rule.user") {
      this.eventhandlers
        .get("m.policy.rule.user")
        .run({ roomId: roomId, config: config });
    }
  }
}

export { redaction };
