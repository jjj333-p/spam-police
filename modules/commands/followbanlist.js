class FollowBanList {

    constructor(){}

    async run ({client, roomId, event, mxid}, {offset, contentByWords}){

        //make sure the user has ban permissions before adding banlist
        if ( ! await client.userHasPowerLevelForAction(event["sender"], roomId, "ban") ) {

            client.sendNotice(roomId, "❌ | You don't have sufficent permission. (need ban permission)")
            
            return
        
        }

        //make sure the bot has ban permissions before adding banlist
        if ( ! await client.userHasPowerLevelForAction(mxid, roomId, "ban") ) {

            client.sendNotice(roomId, "❌ | I don't have sufficent permission. (need ban permission)")
            
            return
        
        }

        if (contentByWords[offset+1].toLowerCase() == "list") {

            client.sendNotice(roomId, "banlist list here")

            return

        }

    }

}

export { FollowBanList }