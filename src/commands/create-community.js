class CC {
  async run(
    { client, roomId, event, mxid, blacklist, server },
    { offset, commandRoom },
  ) {
    //create space
    const newSpaceId = await client
      .createRoom({
        creation_content: {
          type: "m.space",
        },
        initial_state: [
          {
            content: {
              join_rule: "public",
            },
            state_key: "",
            type: "m.room.join_rules",
          },
          {
            content: {
              history_visibility: "joined",
            },
            state_key: "",
            type: "m.room.history_visibility",
          },
        ],
        power_level_content_override: {
          ban: 50,
          events: {
            "m.room.avatar": 50,
            "m.room.canonical_alias": 50,
            "m.room.encryption": 100,
            "m.room.history_visibility": 100,
            "m.room.name": 50,
            "m.room.power_levels": 100,
            "m.room.server_acl": 100,
            "m.room.tombstone": 100,
          },
          events_default: 50,
          invite: 50,
          kick: 50,
          notifications: {
            room: 50,
          },
          redact: 50,
          state_default: 50,
          users: {
            [mxid]: 102,
            [event.sender]: 103,
          },
          users_default: 0,
        },
        invite: [event.sender],
        is_direct: false,
        name: "Community Management Room",
        room_version: "11",
      })
      .catch(() =>
        client
          .sendHtmlNotice(
            roomId,
            "❌ | I encountered an error attempting to create the space",
          )
          .catch(() => {}),
      );

    const newRoomId = await client
      .createRoom({
        initial_state: [
          {
            content: {
              join_rule: "invite",
            },
            state_key: "",
            type: "m.room.join_rules",
          },
          {
            content: {
              history_visibility: "joined",
            },
            state_key: "",
            type: "m.room.history_visibility",
          },
          {
            content: {
              canonical: true,
              via: [server],
            },
            state_key: newSpaceId,
            type: "m.space.parent",
          },
        ],
        power_level_content_override: {
          ban: 50,
          events: {
            "m.room.avatar": 50,
            "m.room.canonical_alias": 50,
            "m.room.encryption": 100,
            "m.room.history_visibility": 100,
            "m.room.name": 50,
            "m.room.power_levels": 100,
            "m.room.server_acl": 100,
            "m.room.tombstone": 100,
          },
          events_default: 0,
          invite: 50,
          kick: 50,
          notifications: {
            room: 50,
          },
          redact: 50,
          state_default: 50,
          users: {
            [mxid]: 102,
            [event.sender]: 103,
          },
          users_default: 0,
        },
        invite: [event.sender],
        is_direct: false,
        name: "Community Management Room",
        room_version: "11",
      })
      .catch(() =>
        client
          .sendHtmlNotice(
            roomId,
            "❌ | I encountered an error attempting to create the management room",
          )
          .catch(() => {}),
      );

    client
      .sendStateEvent(newSpaceId, "m.space.child", newRoomId, {
        suggested: false,
        via: [server],
      })
      .catch(() => {});
  }
}

export { CC };
