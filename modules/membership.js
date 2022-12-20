class membership {

    //dont need to do anything on construction
    constructor(){}

    run(client, roomid, event, mxid, displayname, blacklist){

        if(event["content"]["membership"] == "leave"){

            if(event["key"] == mxid){

                console.log("left")

            }

        }

    }

}

module.exports = {membership}