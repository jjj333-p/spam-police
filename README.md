# Spam Police

A [Matrix](https://matrix.org/) bot to monitor and respond to investment scam spamming across the Matrix platform, for example in rooms with a permanently offline admin.

> **Warning**
>
> This bot does not support encrypted rooms yet. This has been implemented in the sdk and likely could be added to the bot easy enough, however I don't currently have the proper access to the bot account required to set this up due to not being able to currently set up my desktop workstation.

## Discussion

- Matrix Space: [`#spam-police:matrix.org`](https://matrix.to/#/#spam-police:matrix.org)
- Support Room: [`#anti-scam-support:matrix.org`](https://matrix.to/#/#anti-scam-support:matrix.org)
- Update and Announcement Room: [`#spam-police-rss:matrix.org`](https://matrix.to/#/#spam-police-rss:matrix.org)
- General Moderation Automation Ideas Room: [`#mod-ideas:matrix.org`](https://matrix.to/#/#mod-ideas:matrix.org)

## Inviting the bot

You can use my instance: `@anti-spam:matrix.org`, or [self-host](https://github.com/jjj333-p/spam-police#self-hosting) your own!

To invite it, you can run the command below in [`#spam-police-bot-cmds:matrix.org`](https://matrix.to/#/#spam-police-bot-cmds:matrix.org).
```matrix
+join [Alias/ID to room]
```

> **Note**
>
> If you have problems inviting the bot, make sure the bot can join it. if the room is invite only, invite the bot account to the room first. If you still have problems, join our [support room](https://matrix.to/#/#anti-scam-support:matrix.org).

> **Note**
>
> My instance logs the scams it finds to [`#jjj-tg-scams:matrix.org`](https://matrix.to/#/#jjj-tg-scams:matrix.org)

## Commands/Usage

> **Command prefix:**
> 
> All commands below require the prefix before the command unless specified. The bot prefix can be customized on a per-room basis, in which the bot displayname will be set to `[prefix] | Spam Police`, with a default prefix of `+`.
>
> Example usage: `+uptime` to run the `uptime` command with the default prefix of `+`

### Basic commands

- `@anti-scam:matrix.org` (no prefix) - pinging the bot will bring up a short introduction as well as a link back here, no need to bookmark this page!
- `uptime` - displays the current bot uptime, doubles as a ping command

### Essential Usage Commands

- `join [room ID/alias/matrix.to]` - works only in [`#spam-police-bot-cmds:matrix.org`](https://matrix.to/#/#spam-police-bot-cmds:matrix.org). This command makes the bot join the referenced room. If the room is invite only (unsure why you'd use this bot in an invite only room) you'll need to invite the bot's account to the room and then run this command
- `mute` - toggles mute mode on and off. In mute mode the bot will only react to detected scam messages, and will not display the warning message.

### Moderation Related Commands

- `followbanlist [room ID/alias/matrix.to]` - subscribes the room to a mjolner banlist, and performs mass moderation actions as mjolner would. Use with caution, my dumbass has yet to add a way to unsubscribe
- `banlist [add/remove] [here / room ID/alias/matrix.to] [target user mxid] <reason>` - writes or removes a mjolner ban recomendation policy to a "banlist" room with a given reason

### Administration Commands for Selfhosters

- `restart` - runs `Process.exit()`, only restarts if you have it set to run upon exit such as through systemd (this is how I do it on the production system)
- `leave <room ID/alias/matrix.to>` - makes the bot leave the specified room, if no room is specified it leaves the current room. Also adds the room to a blacklist to prevent it from being re-added to the room (also gets added if a room mod kicks the bot).
- `unblacklist [room ID/alias/matrix.to]` - remove rooms from the administrator blacklist. 

## Self-hosting

### Requirements

- [NodeJS](https://nodejs.org/en/download/package-manager/)
	- [Install from package manager](https://nodejs.org/en/download/package-manager/)
	- [NodeJS Installer](https://nodejs.org/en/download/)
- [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
	- [Installation Documentation](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
- [git](https://git-scm.com/) *(optional)*
	- [Installing Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)

> **Note**
> 
> The bot is very light during run time and barely uses any resources, however it sees a large resource spike at startup due to initial sync. This can cause it to crash on lower powered systems (like the hetzner cpx11 vps) if you have an old sync token. What I do to fix this is I run the bot on a higher powered system like my dev machine (tbh anything with 4+ gb of real ram should work, 8+gb ram and quad core should be enough for the spike to be unnoticable), and then copy that sync token in bot.json into the bot.json on my vps. This issue is not faced on the Hetzner cpx21, which I now run. Please let me know or contribute if you know how to make the initial sync less resource intense.

### Instructions

1. Download the latest stable version located in the [branches](https://github.com/jjj333-p/spam-police/branches)
	- Stable branches are formatted as `stable-vX.X.X-(version-X,-update-x,-patch-X)`
	- Downloading as a ZIP and extracting it is recommended
		- Using git: `git clone -b <branch> --single-branch https://github.com/archeite/spam-police.git`

> **Note**
  >
> For a development version, you download from the `master` branch instead of the stable branch. The git command is shown below
> ```bash
> $ git clone -b master --single-branch https://github.com/archeite/spam-police.git
> ```

2. Go into the folder you cloned (`cd spam-police`), create a directory named `db` (`mkdir -p db`), and enter it (`cd db`)
```bash
cd spam-police && mkdir -p db && cd db
```

3. Copy the example configuration file from `examples/login.yaml` to `db` (`cp ../examples/login.yaml ./`)

4. Edit the configuration file to your liking

5. Go back to the root directory (`cd ..`) and create `bot.json` (`touch bot.json`)

> **Note**
> 
> You don't need to put anything in `bot.json`, leave it empty
> 
> This appears to be how the bot SDK saves the sync token and stuff.

6. To install dependencies, run `npm install`

7. Start the bot with `node index.js` or `node .`
