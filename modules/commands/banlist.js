class Banlist {

    constructor(){}

    async run ({client, roomId, event}, {offset, contentByWords}){

        try{

            //parce the room that the cmd is referring to
            let banlist = contentByWords[2+offset]

            if (!banlist){

                client.sendNotice(roomId, "❌ | invalid usage.")

                return

            }

            //use here so people dont have to type the room alias on an asinine client
            if (banlist.toLowerCase() == "here") banlist = roomId

            //fetch spam police config
            let stateconfigevent = (await client.getRoomState(roomId)).filter(event => event.type == "agency.pain.anti-scam.config")[0]
            if (stateconfigevent) 
                var stateconfig = stateconfigevent["content"]
            
            //get room's children
            if(stateconfig)
                var children = stateconfig.children
            
            if (children && children[banlist])
                banlist = children[banlist]


            //resolve alias to an id for easier use
            client.resolveRoom(banlist).then(async banlistid=> {


                //fetch spam police config
                let blconfigevent = (await client.getRoomState(banlistid)).filter(event => event.type == "agency.pain.anti-scam.config")[0]
                if (blconfigevent) 
                    var blconfig = blconfigevent["content"]
                
                //get bl's parent
                if(blconfig && blconfig )
                    var blParent = blconfig.parent
            

                //make sure the user trying to write to the banlist can write to the banlist
                //if true nothing happens, if it gets to the end of the chain it 

                if (Object.values(children).some(c => c == banlist)
                    &&
                    blParent == roomId
                ) {
                    var anonymous = true
                }
                //check pl
                else if ( await client.userHasPowerLevelForAction(event["sender"], banlistid, "ban") 
                    ||
                    await client.userHasPowerLevelFor(event["sender"], banlistid, "m.policy.rule.user", true)
                ){
                } else {
                    
                    client.sendNotice(roomId, "❌ | You don't have sufficent permission in the banlist room.")
                    
                    return
                
                }

                //account for all the chars when spit by spaces
                let reasonStart = offset+3+1

                //for every word before the reason starts, count the length of that word
                //and add it to the offset
                for(let i=0; i < (offset+3+1); i++){

                    reasonStart += contentByWords[i].length

                }

                //parce the reason using the offset
                let reason = event["content"]["body"].substring(reasonStart)

                //parce out banned user
                let bannedUser = contentByWords[3+offset]

                let action = contentByWords[1+offset].toLowerCase()

                if (action == "add"){

                    //make banlist rule
                    client.sendStateEvent(banlistid, "m.policy.rule.user", ("rule:" + bannedUser), {
                        "entity": bannedUser,
                        "reason": reason,
                        "recommendation": "org.matrix.mjolnir.ban"
                    },)
                        .then(() => client.sendNotice(roomId, "✅ | Successfully set ban recommendation."))
                        .catch(err => client.sendHtmlNotice(roomId, "<p>🍃 | I unfortunately ran into the following error while trying to add that to the banlist:\n</p><code>" + err+ "</code>"))

                } else if (action == "remove" || action == "delete"){

                    //make banlist rule
                    client.sendStateEvent(banlistid, "m.policy.rule.user", ("rule:" + bannedUser), {
                        "reason": reason,
                    },)
                        .then(() => client.sendNotice(roomId, "✅ | Successfully removed ban recommendation."))
                        .catch(err => client.sendHtmlNotice(roomId, "<p>🍃 | I unfortunately ran into the following error while trying to remove that banlist rule:\n</p><code>" + err+ "</code>"))

                } else {

                    client.sendHtmlNotice(roomId, "<p>❌ | Invalid action, <code>" + action + "</code> != <code>add</code> or <code>remove</code>/<code>delete</code>.</p>")

                }

            }).catch(err => client.sendHtmlNotice(roomId, "<p>🍃 | I unfortunately ran into the following error while trying to resolve that room:\n</p><code>" + err+ "</code>"))
            
        //this might fail, just catch it and move on
        } catch(e) { console.log(e) }

    }

}

export {Banlist}