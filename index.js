//Import dependencies
import { AutojoinRoomsMixin, MatrixClient, SimpleFsStorageProvider } from "matrix-bot-sdk"; 
import { readFileSync } from "fs";
import { parse } from "yaml";

//Import modules
import { blacklist } from "./modules/blacklist.js";
import { redaction } from "./modules/redaction.js";
import { database } from "./modules/db.js";
import { message } from "./modules/message.js";
import { Reaction } from "./modules/reaction.js";
import { BanlistReader } from "./modules/banlistReader.js";

//Parse YAML configuration file
const loginFile       = readFileSync('./db/login.yaml', 'utf8');
const loginParsed     = parse(loginFile);
const homeserver      = loginParsed["homeserver-url"];
const accessToken     = loginParsed["login-token"];
const logRoom         = loginParsed["log-room"];
const commandRoom     = loginParsed["command-room"];
const authorizedUsers = loginParsed["authorized-users"];
const name            = loginParsed["name"]

//the bot sync something idk bro it was here in the example so i dont touch it ;-;
const storage = new SimpleFsStorageProvider("bot.json");

//login to client
const client = new MatrixClient(homeserver, accessToken, storage);

//currently testing without accepting invites
//AutojoinRoomsMixin.setupOnClient(client);

//map to put the handlers for each event type in (i guess this is fine here)
let eventhandlers = new Map()

const config = new database()   // Database for the config
const nogoList = new blacklist() // Blacklist object
eventhandlers.set("m.room.message", new message(logRoom, commandRoom, config, authorizedUsers)) // Event handler for m.room.message
eventhandlers.set("m.policy.rule.user", new BanlistReader(client))
eventhandlers.set("m.reaction", new Reaction(logRoom))
eventhandlers.set("m.room.redaction", new redaction(eventhandlers)) // Event handler for m.room.redaction

//preallocate variables so they have a global scope
let mxid; 

let scamBlEntries = new Map()

//Start Client
client.start().then( async () => {

    console.log("Client started!")

    //to remotely monitor how often the bot restarts, to spot issues
    client.sendText(logRoom, "Started.")

    //get mxid
    mxid = await client.getUserId()

    //fetch rooms the bot is in
    let rooms = await client.getJoinedRooms()

    //slowly loop through rooms to avoid ratelimit
    let i = setInterval(async () => {

        //if theres no rooms left to work through, stop the loop
        if(rooms.length < 1) {
            
            clearInterval(i)

            return

        }

        //work through the next room on the list
        let currentRoom = rooms.pop()

        //debug
        console.log("Setting displayname for room " + currentRoom)

        //fetch the room list of members with their profile data
        let mwp = (await client.getJoinedRoomMembersWithProfiles(currentRoom).catch(() => {console.log("error " + currentRoom)}))
        
        //variable to store the current display name of the bot
        let cdn = ""

        //if was able to fetch member profiles (sometimes fails for certain rooms) then fetch the current display name
        if (mwp) cdn = mwp[mxid]["display_name"]

        //fetch prefix for that room
        let prefix = config.getConfig(currentRoom, "prefix")

        //default prefix if none set
        if (!prefix)  prefix = "+"

        //establish desired display name based on the prefix
        let ddn = prefix + " | " + name

        //if the current display name isnt the desired one
        if (cdn != ddn) {

            //fetch avatar url so we dont overrite it
            let avatar_url = (await client.getUserProfile(mxid))["avatar_url"]
            
            //send member state with the new displayname
            client.sendStateEvent(currentRoom, "m.room.member", mxid, {
                "avatar_url":avatar_url,
                "displayname":ddn,
                "membership":"join"
            })
                .then(console.log("done " + currentRoom))

        }

    // 3 second delay to avoid ratelimit
    }, 3000)


    // displayname = (await client.getUserProfile(mxid))["displayname"]

});

//when the client recieves an event
client.on("room.event", async (roomId, event) => {

    //ignore events sent by self, unless its a banlist policy update
    if ((event["sender"] == mxid) && !(event["type"] == "m.policy.rule.user")) {return}

    //check banlists
    bancheck(roomId, event)

    //fetch the handler for that event type
    let handler = eventhandlers.get(event["type"])

    //if there is no handler for that event, exit.
    if (!handler) return;

    //fetch the room list of members with their profile data
    let mwp = (await client.getJoinedRoomMembersWithProfiles(roomId).catch(() => {console.log("error " + roomId)}))

    //variable to store the current display name of the bot
    let cdn = ""

    //if was able to fetch member profiles (sometimes fails for certain rooms) then fetch the current display name
    if (mwp) cdn = mwp[mxid]["display_name"]  
    else {

        //fetch prefix for that room
        let prefix = config.getConfig(roomId, "prefix")

        //default prefix if none set
        if (!prefix)  prefix = "+"

        //establish desired display name based on the prefix
        cdn = prefix + " | " + name

    }
    
    handler.run({
        client:client,
        roomId:roomId,
        event:event,
        mxid:mxid,
        displayname:cdn,
        blacklist:nogoList,
        scamBlEntries:scamBlEntries,
        banListReader:eventhandlers.get("m.policy.rule.user"),
        config:config
    })

})

client.on("room.leave", (roomId) => {

    nogoList.add(roomId, "kicked")

})

async function bancheck (roomId, event){

    //if the bot cant ban users in the room, theres no reason to waste resources and check if it should ban the user
    if( ! await client.userHasPowerLevelForAction(mxid, roomId, "ban") ) {return}

    //fetch banlists for room
    let roomBanlists = config.getConfig(roomId, "banlists")

    //if there is no config, create a temporary one with just the room id
    if( !roomBanlists ){ roomBanlists = [roomId] }

    //if there is a config, set the room up to check its own banlist
    else { roomBanlists.push(roomId) }

    //variable to store reason
    let reason = "";

    //look through all banlists
    for (let i = 0; i < roomBanlists.length; i++) {
        let rm = roomBanlists[i];

        //find recommendation
        let recomend = await eventhandlers.get("m.policy.rule.user").match(rm, (event["sender"]))[0];

        //if that room doesn't recommend a ban, go ahead and exit out
        if (!recomend) { continue; }

        //fetch the set alias of the room
        let mainRoomAlias = await client.getPublishedAlias(rm)

        //if there is no alias of the room
        if(!mainRoomAlias){

            //dig through the state, find room name, and use that in place of the main room alias
            mainRoomAlias = (await client.getRoomState(roomId)).find(state => state.type == "m.room.name")["content"]["name"]

        }
        
        //format together a reason
        reason = String(reason) + recomend["content"]["reason"] + " (" + mainRoomAlias + ")";
    }

    //if there is a reason to be had, then we can ban
    if (reason) {client.banUser(event["sender"], roomId, reason).catch(() => {})}

}
