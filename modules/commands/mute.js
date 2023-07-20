class Mute {

    constructor(){}

    async run ({client, roomId, event}, {config}){

        //im equivicating muting the bot to redacting its messages right after they are sent.
        if (!await client.userHasPowerLevelForAction(event["sender"], roomId, "redact")){  //"redact")){

            //error msg
            client.sendNotice(roomId, "🍃 | This command requires you have a powerlevel high enough to redact other users messages.")

            //dont run the cmd
            return

        }

        //confirm got message, idk if this actually works lmao
        client.sendReadReceipt(roomId, event["event_id"])

        //grab the opposite of what is in the db
        let mute = !Boolean(config.getConfig(roomId, "muted"))

        if (mute) {

            client.sendNotice(roomId, "Putting the bot into mute mode for this channel...")

        } else {

            client.sendNotice(roomId, "Taking the bot out of mute mode for this channel...")
            
        }

        //set the new config
        config.setConfig(roomId, "muted", mute, response => {

            //send confirmation
            client.sendNotice(roomId, response)

        })

    }

}

export { Mute }