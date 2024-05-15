//misc imports
import { PowerLevelAction } from "matrix-bot-sdk";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import { Sendjson } from "./sendjson.js";

// commands
import { Uptime } from "./commands/uptime.js";
import { Join } from "./commands/join.js";
import { Leave } from "./commands/leave.js"; //does blacklisting
import { Unblacklist } from "./commands/unblacklist.js";
import { Restart } from "./commands/restart.js";
import { Mute } from "./commands/mute.js";
import { Banlist } from "./commands/banlist.js";
import { FollowBanList } from "./commands/followbanlist.js";
import { Rules } from "./commands/rules.js";
import { CC } from "./commands/create-community.js";

const sendjson = new Sendjson();

class message {
  constructor(logRoom, commandRoom, config, authorizedUsers) {
    //map to relate scams and their responses (for deletion)
    this.tgScamResponses = new Map();
    this.tgScamReactions = new Map();

    //config thingys
    this.logRoom = logRoom;
    this.commandRoom = commandRoom;
    this.config = config;
    this.authorizedUsers = authorizedUsers;

    //fetch keywords
    this.keywords = require("../keywords.json");

    //create collection of different commands to run
    this.commands = new Map();

    this.commands.set("uptime", new Uptime());
    this.commands.set("join", new Join());
    this.commands.set("leave", new Leave());
    this.commands.set("unblacklist", new Unblacklist());
    this.commands.set("restart", new Restart());
    this.commands.set("mute", new Mute());
    this.commands.set("banlist", new Banlist());
    this.commands.set("followbanlist", new FollowBanList());
    this.commands.set("rules", new Rules());
    this.commands.set("create-community", new CC());
  }

  // async run ({client, roomId, event, mxid, displayname, blacklist}){
  async run(datapoints) {
    //if no content in message
    if (!datapoints.event.content) return;

    // Don't handle non-text events
    if (datapoints.event.content.msgtype !== "m.text") return;

    //grab the content from the message, and put it to lowercase to prevent using caps to evade
    const scannableContent = datapoints.event.content.body.toLowerCase();

    // this.commands.run(datapoints, scannableContent)

    //scan for common scam words
    if (
      includesWord(scannableContent, [
        this.keywords.scams.currencies,
        this.keywords.scams.socials,
        this.keywords.scams.verbs,
      ])
    ) {
      //if the scam is posted in the room deticated to posting tg scams
      if (datapoints.roomId === this.logRoom) {
        //confirm it matches the keywords
        datapoints.client
          .sendEvent(datapoints.roomId, "m.reaction", {
            "m.relates_to": {
              event_id: datapoints.event.event_id,
              key: "Detected",
              rel_type: "m.annotation",
            },
          })
          // ???
          .catch(() => {});
      } else {
        //custom function to handle the fetching and sending of the json file async as to not impact responsiveness
        sendjson.send(
          datapoints,
          this.logRoom,
          datapoints.banListReader,
          this.tgScamReactions,
          this.tgScamResponses,
        );

        //React to the message with a little warning so its obvious what msg im referring to
        datapoints.client
          .sendEvent(datapoints.roomId, "m.reaction", {
            "m.relates_to": {
              event_id: datapoints.event.event_id,
              key: "🚨 scam! 🚨",
              rel_type: "m.annotation",
            },
          })

          //if reaction is sent, associate it with the original scam for later redaction
          .then((responseID) => {
            this.tgScamReactions.set(datapoints.event.event_id, {
              roomId: datapoints.roomId,
              responseID: responseID,
            });
          })

          //catch the error to prevent crashing, however if it cant send theres not much to do
          .catch(() => {})

          //dont care if it was successful, carry on with the code
          .finally(async () => {
            //if the room is in mute mode, dont respond
            if (this.config.getConfig(datapoints.roomId, "muted")) return;

            //send warning message
            datapoints.client
              .sendHtmlText(datapoints.roomId, this.keywords.scams.response)

              //if warning is sent, associate it with the original scam for later redaction
              .then((responseID) => {
                this.tgScamResponses.set(datapoints.event.event_id, {
                  roomId: datapoints.roomId,
                  responseID: responseID,
                });
              })

              //catch the error to prevent crashing, however if it cant send theres not much to do
              .catch(() => {})

              .finally(async () => {
                //if the message is replying
                const replyRelation = datapoints.event.content["m.relates_to"]; //["m.in_reply_to"].event_id
                if (replyRelation) {
                  //pull the id of the event its replying to
                  if (replyRelation["m.in_reply_to"]) {
                    const replyID = replyRelation["m.in_reply_to"].event_id;

                    //fetch the event from that id
                    const repliedEvent = await datapoints.client
                      .getEvent(datapoints.roomId, replyID)
                      .catch(() => {});

                    //make the content scanable
                    const scannableContent =
                      repliedEvent.content.body.toLowerCase();

                    //if the message is replying to a scam, it doesnt need to be acted upon
                    if (
                      includesWord(scannableContent, [
                        this.keywords.scams.currencies,
                        this.keywords.scams.socials,
                        this.keywords.scams.verbs,
                      ])
                    ) {
                      return;
                    }
                  }
                }

                const scamAction = this.config.getConfig(
                  datapoints.roomId,
                  "scamAction",
                );

                const reason = "Scam Likely";

                try {
                  if (!scamAction) {
                    datapoints.client
                      .kickUser(
                        datapoints.event.sender,
                        datapoints.roomId,
                        reason,
                      )
                      .catch(() => {});
                  } else if (scamAction === -1) {
                    datapoints.client
                      .redactEvent(
                        datapoints.roomId,
                        datapoints.event.event_id,
                        reason,
                      )
                      .catch(() => {});
                  } else if (scamAction === 1) {
                    //     userHasPowerLevelFor(userId: string, datapoints.roomId: string, eventType: string, isState: boolean): Promise<boolean>;
                    // setUserPowerLevel(userId: string, roomId: string, newLevel: number): Promise<any>;
                    // datapoints.client.setUserPowerLevel(user, roomId, newlevel)
                    // if ( await datapoints.client.userHasPowerLevelFor(mxid, roomId, "m.room.power_levels", true) ){
                    // }
                  }
                } catch (e) {
                  /*TODO*/
                }
              });
          });
      }

      //check if can respond
    } else if (
      !(await datapoints.client
        .userHasPowerLevelFor(
          datapoints.mxid,
          datapoints.roomId,
          "m.room.message",
          false,
        )
        .catch(() => {}))
    ) {
      return;
    } else {
      //greeting message
      const greeting =
        "Greetings! I am a bot by @jjj333:pain.agency (pls dm for questions). " +
        "My MO is I warn people about telegram and whatsapp investment scams whenever they are posted in the room. If I am unwanted please just kick me. " +
        "For more information please visit https://github.com/jjj333-p/spam-police";

      //split into words, and filter out the empty strings because js is an actual meme language
      const contentByWords = datapoints.event.content.body
        .split(" ")
        .filter((a) => a);
      const displaynameByWords = datapoints.displayname
        .split(" ")
        .filter((a) => a);

      //if the user is trying to mention the bot
      if (
        datapoints.event.content.body.includes(datapoints.mxid) ||
        datapoints.event.content.body.includes(datapoints.displayname)
      ) {
        //if someone starts the message with the mxid
        if (contentByWords[0].includes(datapoints.mxid)) {
          //help command
          if (!contentByWords[1] || contentByWords[1] === "help") {
            datapoints.client
              .sendText(datapoints.roomId, greeting)
              .catch(() => {});
            return;
          }

          //definitely not a command
          if (
            contentByWords[1].startsWith("+") ||
            contentByWords[1].startsWith("1")
          )
            return;

          //if that is a command, run the command
          const handler = this.commands.get(contentByWords[1]);

          //if no handler its not a valid command
          if (!handler) {
            await datapoints.client
              .sendEvent(datapoints.roomId, "m.reaction", {
                "m.relates_to": {
                  event_id: datapoints.event.event_id,
                  key: "❌ | invalid cmd",
                  rel_type: "m.annotation",
                },
              })
              .catch(() => {});

            return;
          }

          client
            .sendReadReceipt(datapoints.roomId, datapoints.event.event_id)
            .catch(() => {});

          //run the command
          handler.run(datapoints, {
            scannableContent: scannableContent,
            contentByWords: contentByWords,
            keywords: this.keywords,
            logRoom: this.logRoom,
            commandRoom: this.commandRoom,
            config: this.config,
            authorizedUsers: this.authorizedUsers,
            offset: displaynameByWords.length,
          });

          //if someone starts the message with the display name
        } else if (
          datapoints.event.content.body.startsWith(datapoints.displayname) &&
          contentByWords.length > displaynameByWords.length
        ) {
          //if that is a command, run the command
          const handler = this.commands.get(
            contentByWords[displaynameByWords.length],
          );

          //if no handler its not a valid command
          if (!handler) {
            await datapoints.client
              .sendEvent(datapoints.roomId, "m.reaction", {
                "m.relates_to": {
                  event_id: datapoints.event.event_id,
                  key: "❌ | invalid cmd",
                  rel_type: "m.annotation",
                },
              })
              .catch(() => {});

            return;
          }

          datapoints.client
            .sendReadReceipt(datapoints.roomId, datapoints.event.event_id)
            .catch(() => {});

          //run the command
          handler.run(datapoints, {
            scannableContent: scannableContent,
            contentByWords: contentByWords,
            keywords: this.keywords,
            logRoom: this.logRoom,
            commandRoom: this.commandRoom,
            config: this.config,
            authorizedUsers: this.authorizedUsers,
            offset: displaynameByWords.length,
          });
        } else {
          datapoints.client
            .sendText(datapoints.roomId, greeting)
            .catch(() => {});
        }
      } else {
        //fetch prefix for that room
        let prefix = this.config.getConfig(datapoints.roomId, "prefix");

        //default prefix if none set
        if (!prefix) prefix = "+";

        if (!scannableContent.startsWith(prefix)) return;

        //parce out command
        const command = contentByWords[0].substring(prefix.length);

        //not a command
        if (!command || command.startsWith("+") || command.startsWith("1"))
          return;

        //help
        if (command === "help") {
          datapoints.client
            .sendText(datapoints.roomId, greeting)
            .catch(() => {});
          return;
        }

        //if that is a command, run the command
        const handler = this.commands.get(command);

        //if no handler, than its not a valid command
        if (!handler) {
          await datapoints.client
            .sendEvent(datapoints.roomId, "m.reaction", {
              "m.relates_to": {
                event_id: datapoints.event.event_id,
                key: "❌ | invalid cmd",
                rel_type: "m.annotation",
              },
            })
            .catch(() => {});

          return;
        }

        //run the handler
        handler.run(datapoints, {
          scannableContent: scannableContent,
          contentByWords: contentByWords,
          keywords: this.keywords,
          logRoom: this.logRoom,
          commandRoom: this.commandRoom,
          config: this.config,
          authorizedUsers: this.authorizedUsers,
          offset: 0,
        });
      }
    }
  }
}

//function to scan if it matches the keywords
function includesWord(str, catgs) {
  //assume true if you dont have any missing
  let result = true;

  for (const cat of catgs) {
    if (!cat.some((word) => str.includes(word))) result = false;
  }

  return result;
}

export { message };
