class Unblacklist {
  async run({ client, roomId, event, blacklist }, { authorizedUsers, offset }) {
    //verify is sent by an admin
    if (authorizedUsers.some((u) => u === event.sender)) {
      //parce out the possible room id
      const leaveRoom = event.content.body.split(" ")[1 + offset];

      //if has the characters required for a room id or alias
      if (
        (leaveRoom.includes("#") || leaveRoom.includes("!")) &&
        leaveRoom.includes(":") &&
        leaveRoom.includes(".")
      ) {
        //evaluate if its a valid alias
        client
          .resolveRoom(leaveRoom)
          .then(async (leaveroomid) => {
            //remove room to blacklist
            blacklist.remove(leaveroomid).then(() => {
              client
                .sendEvent(roomId, "m.reaction", {
                  "m.relates_to": {
                    event_id: event.event_id,
                    key: "✅",
                    rel_type: "m.annotation",
                  },
                })
                .catch(() => {});
            });
          })
          .catch((err) => {
            //throw error about invalid alias
            client
              .sendHtmlNotice(
                roomId,
                `❌ | I ran into the following error while trying to resolve that room ID:<blockquote>${err.message}</blockquote>`,
              )
              .catch(() => {});
          });

        //if cant possibly be a room alias
      } else {
        client
          .sendEvent(roomId, "m.reaction", {
            "m.relates_to": {
              event_id: event.event_id,
              key: "❌",
              rel_type: "m.annotation",
            },
          })
          .catch(() => {});
      }
    } else {
      client
        .sendText(
          roomId,
          "Sorry, only my owner(s) can do that. If you are a moderator of the room please just kick me from the room, I will not join back unless someone tells me to (and I will disclose who told me to).",
        )
        .catch(() => {});
    }
  }
}

export { Unblacklist };
