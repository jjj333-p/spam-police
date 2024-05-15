//see if the State Event `se` is intended to ban the mxid `matchMXID`
function matchBanlistEventToUser(se, mm) {
  let matchMXID = mm;

  //if the ban was erased
  if (!se.content) {
    return false;
  }

  //parce out the mxid from the key
  const potentialMXID = se.state_key.substring(5);

  //if mismatch, its invalid
  //mothet sidev
  if (
    se.content.entity !== potentialMXID ||
    se.content.recommendation !== "org.matrix.mjolnir.ban"
  ) {
    return false;
  }

  //if exact match, it is match
  if (potentialMXID === matchMXID) {
    return true;
  }

  //if theres no wildcards, and not an exact match, its not a match
  if (!potentialMXID.includes("*")) {
    return false;
  }

  //split around the wildcards
  const p = potentialMXID.split("*");

  //check before first wildcard
  const firstpart = p.shift();
  if (!matchMXID.startsWith(firstpart)) {
    return false;
  }

  //check after last wildcard
  const lastpart = p.pop();
  if (!matchMXID.endsWith(lastpart)) {
    return false;
  }

  //parce off the evaluated start and end
  matchMXID = matchMXID.substring(
    firstpart.length,
    matchMXID.length - lastpart.length,
  );

  //loop until a condition to return arises
  while (true) {
    //if there is no more parts to match and everything else around wildcards matched
    //it is match
    if (p.length < 1) {
      return true;
    }

    //if one of the bits between wildcards doesnt exist, it cant be a match
    if (!matchMXID.includes(p[0])) {
      return false;
    }

    //match the remaining parts in order starting with the first one left to match, then removing everything
    //before it, and going back through the process untill theres nothing left to match
    //have to use a substring of the original in case there was multiple matches of the next item to match
    const nexttomatch = p.shift();
    const r = matchMXID.split(nexttomatch);
    matchMXID = matchMXID.substring(nexttomatch.length + r[0]);
  }
}

class BanlistReader {
  constructor(client) {
    this.client = client;

    this.rooms = new Map();
  }

  //synchronize all the state events of the provided room
  async syncRoom(roomId) {
    let list = (await this.client.getRoomState(roomId)).filter(
      (event) => event.type === "m.policy.rule.user",
    );

    //allow .find to be run
    if (!list) list = [];

    //organize away that list for later
    this.rooms.set(roomId, list);
  }

  //event run loop
  async run({ roomId, event, config }) {
    //fetch room's list of banlist events
    const roomEvents = this.rooms.get(roomId);

    //see comment below
    await this.syncRoom(roomId);

    /*
        if the run pipeline was called without an event for whatever reason dont proceed

        the run method will only be directly triggered on a banlist recomendation event

        the run method may be triggered on redaction events without an event fed in *if* 
        the event it is redacting is a banlist recomendation 
        */
    if (!event) {
      return;
    }

    //confirm that the bot updated its list with the new event
    this.client.sendReadReceipt(roomId, event.event_id);

    //fetch the set alias of the room
    let mainRoomAlias = await this.client.getPublishedAlias(roomId);

    //if there is no alias of the room
    if (!mainRoomAlias) {
      //dig through the state, find room name, and use that in place of the main room alias
      mainRoomAlias = (await this.client.getRoomState(roomId)).find(
        (state) => state.type === "m.room.name",
      ).content.name;
    }

    //all rooms the bot is in
    const joinedrooms = await this.client.getJoinedRooms();

    //look through all these rooms for any that may be following the banlist this was
    //written to
    // biome-ignore lint/complexity/noForEach:
    joinedrooms.forEach(async (r) => {
      //fetch banlists for room
      let roomBanlists = config.getConfig(r, "banlists");

      //if there is no config, create a temporary one with just the room id
      if (!roomBanlists) {
        roomBanlists = [r];
      }

      //if there is a config, set the room up to check its own banlist
      else {
        roomBanlists.push(r);
      }

      //if the room isn't following the banlist that the recomendation was written to,
      //we shouldn't continue
      if (!roomBanlists.some((rm) => rm === roomId)) {
        return;
      }

      //find any joined users matching the ban rule
      const matched = (await this.client.getJoinedRoomMembers(r)).filter((m) =>
        matchBanlistEventToUser(event, m),
      );

      //ban found users
      // biome-ignore lint/complexity/noForEach: <explanation>
      matched.forEach(async (mm) =>
        this.client
          .banUser(mm, r, `${event.content.reason} (${mainRoomAlias})`)
          .catch(() => {}),
      );
    });
  }

  // get all "org.matrix.mjolnir.ban" type state events for a room
  async getRules(roomId) {
    //fetch room's list of banlist events
    //rooms is a map of just the "org.matrix.mjolnir.ban" events
    let roomEvents = this.rooms.get(roomId);

    //if the room was never synced, sync it
    if (!Array.isArray(roomEvents)) {
      await this.syncRoom(roomId);
      roomEvents = this.rooms.get(roomId);
    }

    return roomEvents;
  }

  //find if there is a rule recommending the ban of a provided mxid
  async match(roomId, matchMXID) {
    //look through all the state events
    const match = (await this.getRules(roomId)).find((se) =>
      matchBanlistEventToUser(se, matchMXID),
    );

    return match;
  }
}

export { BanlistReader };
