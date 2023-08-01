class Banlist {

    constructor(){}

    async run ({client, roomId, event, blacklist}, {scannableContent,offset, contentByWords}){
        //parce the room that the cmd is referring to
        let banlist = contentByWords[1+offset]

        //use here so people dont have to type the room alias on an asinine client
        if (banlist.toLowerCase() == "here") banlist = roomId

        //resolve alias to an id for easier use
        client.resolveRoom(banlist).then(banlistid=> {

            //account for all the chars when spit by spaces
            let reasonStart = offset+2+1

            //for every word before the reason starts, count the length of that word
            //and add it to the offset
            for(let i=0; i < (offset+2+1); i++){

                reasonStart += contentByWords[i].length

            }

            //parce the reason using the offset
            let reason = event["content"]["body"].substring(reasonStart)

            //parce out banned user
            let bannedUser = contentByWords[2+offset]

            //make banlist rule
            client.sendStateEvent(banlistid, "m.policy.rule.user", ("rule:" + bannedUser), {
                "entity": bannedUser,
                "reason": reason,
                "recommendation": "org.matrix.mjolnir.ban"
            },)
                .catch(err => client.sendHtmlNotice(roomId, "<p>🍃 | I unfortunately ran into the following error while trying to add that to the banlist:\n</p><code>" + err+ "</code>"))


        }).catch(err => client.sendHtmlNotice(roomId, "<p>🍃 | I unfortunately ran into the following error while trying to resolve that room:\n</p><code>" + err+ "</code>"))
        
    }

}

export {Banlist}