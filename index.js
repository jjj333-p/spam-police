//Import dependencies
import { AutojoinRoomsMixin, MatrixClient, SimpleFsStorageProvider } from "matrix-bot-sdk"; 
import { readFileSync } from "fs";
import { parse } from "yaml";

//Import modules
import { blacklist } from "./modules/blacklist.js";
import { redaction } from "./modules/redaction.js";
import { database } from "./modules/db.js";
import { message } from "./modules/message.js";

//Parse YAML configuration file
const loginFile   = readFileSync('./db/login.yaml', 'utf8');
const loginParsed = parse(loginFile);
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
const banlist = new blacklist() // Blacklist object
eventhandlers.set("m.room.message", new message(logRoom, commandRoom, config, authorizedUsers)) // Event handler for m.room.message
eventhandlers.set("m.room.redaction", new redaction(eventhandlers))            // Event handler for m.room.redaction

//preallocate variables so they have a global scope
let mxid; 

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

    //fetch the handler for that event type
    let handler = eventhandlers.get(event["type"])

    //if there is a handler for that event, run it.
    if (handler) {

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
            blacklist:banlist
        })

    }

})

client.on("room.leave", (roomId) => {

    banlist.add(roomId, "kicked")

})
