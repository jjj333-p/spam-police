const fs = require("fs");

class database {

    constructor () {

        //check if the config part of the db is there
        let a = fs.readdirSync("./db")
        if(a.some(b => b == "config")){

            //if not, make the folder for it
            fs.mkdirSync("./db/config")

        }

        //fetch the stored config files
        let configfilelist = fs.readdirSync("./db/config")

            //set up cache for db so dont have to wait on disk every time
            this.cache = new Map()

        // go ahead and load configs so dont have to wait for disk.
        // size should be small enough to cache it all without
        // worrying about ram usage
        configfilelist.forEach(fileName => {

            //filename is derived from the room id (map key)
            let id = filename.substring(0, fileName.length - 5)

            //map to shove data into
            configMap = new Map()

            //read the config and parse it to add it to cache
            let rawconfig = JSON.parse(fs.readFileSync("./db/config/" + fileName))

            //pull the individual configs into a uniform map format
            Object.entries(rawconfig).forEach((key, value) => { configMap.set(key, value)})

            this.cache.set(id, configMap)

        })

    }

    getConfig (roomId, config) {

        //make sure there is a config for this room
        let cache = this.cache.get(roomId)

        //if we have a config file for the room, return the requested config
        if (cache) return cache.get(config)

        //if not return null (defaults to falsey value for config)
        return null

    }

}