class Uptime {

    constructor () {}

    async run ({client, roomId, event}) {


        //let user know that the bot is online even if the matrix room is being laggy and the message event isnt comming across
        client.sendReadReceipt(roomId, event["event_id"])

        //maths
        let seconds = process.uptime()

        let minutes = Math.floor(seconds/60)

        let rSeconds = seconds - (minutes*60)

        let hours = Math.floor(minutes/60)

        let rMinutes = minutes - (hours*60)

        //send the uptime to the room
        client.sendHtmlText(roomId, ("<blockquote>\n<p>" + seconds + "</p>\n</blockquote>\n<p>" + hours + " hours, " + rMinutes + " minutes, and " + Math.floor(rSeconds) + " seconds.</p>"))


    }

}

export { Uptime }