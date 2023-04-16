import { openSync, readdirSync, readFileSync, writeFile } from "fs";

class blacklist {

    constructor(){

        this.filepath = "./db/blacklist.txt"

        //make sure file exists
        if(!readdirSync("./db/").some(d => d == "blacklist.txt")){

            closeSync(openSync(this.filepath, 'w'))

        }

        //read file
        this.blacklistTXT = readFileSync(this.filepath, "utf-8")

        //split into entry lines
        this.blacklistARRAY = this.blacklistTXT.split("\n")

    }

    //fetches file from disk again, perhaps in case of updated file
    reload() {

        //read file
        this.blacklistTXT = readFileSync(this.filepath, "utf-8")

        //split into entry lines
        this.blacklistARRAY = this.blacklistTXT.split("\n")

    }

    //returns the reason for blacklisting if roomId is in blacklist, otherwise returns null
    match (roomId) {

        //check if match
        let match = this.blacklistARRAY.find(entry => entry.split(" ")[0].includes(roomId) )

        if(match) {

            //return the reason part of the entry
            return (match.substring(match.split(" ")[0].length + 1) + " ")

        //if no entry, return empty
        } else { return (null) }

    }

    //add roomId to the blacklist with reason
    async add (roomId, reason) {

        //check if the room is already in the blacklist
        if ( this.blacklistARRAY.some( entry => entry.split(" ")[0].includes(roomId) ) ){

            //return that as msg
            return("Already added.")

        }


        //add roomId and reason together to make entry line
        let entry = roomId + " " + reason

        //add entry to array
        this.blacklistARRAY.push(entry)

        //add entry to txt file
        this.blacklistTXT = this.blacklistTXT + "\n" + entry

        //var to store error
        let er

        //write blacklist text file
        await writeFile(this.filepath, this.blacklistTXT, null ,err => {

            er = err

        })

        //return whatever error message was found
        return (er)

    }

    async remove (roomId) {
        
        let er;

        //filter to only include entries without that room id
        this.blacklistARRAY = this.blacklistARRAY.filter(( entry => !entry.split(" ")[0].includes(roomId) ))

        //join array into text file
        this.blacklistTXT = this.blacklistARRAY.join("\n")

        await writeFile(this.filepath, this.blacklistTXT, null ,err => {

            er = err

        })

        //return whatever error message was found
        return (er)

    }
}

module.exports = {blacklist}
