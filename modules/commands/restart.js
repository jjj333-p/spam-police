class Restart {

    constructor(){}

    async run ({client, event, roomId}, {authorizedUsers}){

        //only for authorized users
        if ( authorizedUsers.some(u => u == event["sender"]) ){

            client.sendEvent(roomId, "m.reaction", ({

                "m.relates_to": {
                    "event_id":event["event_id"],
                    "key":"✅♻️",
                    "rel_type": "m.annotation"
                }

            }))

                //catch the error to prevent crashing, however if it cant send theres not much to do
                .catch(() => {})            

                //just exit, setup on vps is for systemd to restart the service on exit
                .finally(() => {process.exit(0)})

        } else {

            client.sendEvent(roomId, "m.reaction", ({

                "m.relates_to": {
                    "event_id":event["event_id"],
                    "key":"❌ | unauthorized",
                    "rel_type": "m.annotation"
                }

            }))

                //catch the error to prevent crashing, however if it cant send theres not much to do
                .catch(() => {})

        }

    }

}

export { Restart }