class Unblacklist {

    constructor(){}

    async run ({client, roomId, event, blacklist}, {scannableContent,offset}){
        //parce the room that the cmd is referring to
        let banlist = event["content"]["body"].split(" ")[1+offset]

        //use here so people dont have to type the room alias on an asinine client
        if (banlist.toLowerCase() == "here") banlist = roomId

        //resolve alias to an id for easier use
        client.resolveRoom(banlist).then(banlistid=> {

            //make banlist rule
            client.sendStateEvent(banlistid, "m.policy.rule.user", ("rule:" + scannableContent.split(" ")[2]), {
                "entity": scannableContent.split(" ")[2],
                "reason": "impersonation",
                "recommendation": "org.matrix.mjolnir.ban"
            },)

        }).catch(err => client.sendNotice(roomId, "🍃 | I unfortunately ran into the following error while trying to run that command\n" + err))
        
    }

}