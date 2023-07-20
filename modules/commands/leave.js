class Leave {

    constructor(){}

    async run ({client, roomId, event, blacklist}, {authorizedUsers}){

        //verify is sent by an admin
        if ( authorizedUsers.some(u => u == event["sender"]) ){

            //parce out the possible room id
            let leaveRoom = event["content"]["body"].split(" ")[1]

            //"+leave" as well as a space afterwards
            let substringStart = 7

            //if has the characters required for a room id or alias
            if ((leaveRoom.includes("#") || leaveRoom.includes("!")) && leaveRoom.includes(":") && leaveRoom.includes(".")){

                //evaluate if its a valid alias
                client.resolveRoom(leaveRoom).then(async leaveroomid => {

                    //add room id or alias to start the reason at the right part of the string
                    substringStart = substringStart + leaveRoom.length + 1

                    //parce out the reason
                    let reason = event["content"]["body"].substring(substringStart)

                    //make sure reason is in the banlist
                    if (!reason) { reason = "<No reason provided.>" }

                    //add room to blacklist
                    blacklist.add(leaveroomid, reason)

                    //let the room know why the bot is leaving
                    client.sendHtmlNotice(leaveroomid, "Leaving room for reason <code>" + reason + "</code>.")
                        .catch(() => {}) //doesnt matter if unable to send to the room
                        .finally(() => { 

                            //attempt to leave the room
                            client.leaveRoom(leaveroomid).then(() => {

                                //success message
                                client.sendHtmlNotice(roomId, "✅ | left room <code>" + leaveroomid + "</code> with reason <code>" + reason + "</code>.")

                            }).catch(err => {

                                //error message
                                client.sendHtmlNotice(roomId, "❌ | I ran into the following error leaving the room: <code>" + err + "</code>")

                            })

                        })

                }).catch(err => {

                    //throw error about invalid alias
                    client.sendHtmlNotice(roomId, "❌ | I ran into the following error while trying to resolve that room ID:<blockquote>" + err.message + "</blockquote>")
    
                })

            //if cant possibly be a room alias, leave *this* room
            } else {

                //parce out reason
                let reason = event["content"]["body"].substring(substringStart)

                //add to blacklist
                blacklist.add(roomId, reason)

                //leave room
                client.leaveRoom(roomId)

            }

        } else {

            client.sendText(roomId, "Sorry, only my owner(s) can do that. If you are a moderator of the room please just kick me from the room, I will not join back unless someone tells me to (and I will disclose who told me to).")

        }

    }
}

export { Leave }