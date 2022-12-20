# Spam Police

A [Matrix](https://matrix.org/) bot to monitor and respond to investment scam spamming across the Matrix platform, for example in rooms with a permanently offline admin.

> **Warning**
>
> This bot does not support encrypted rooms yet

## Discussion

- Matrix Space: [`#spam-police:matrix.org`](https://matrix.to/#/#spam-police:matrix.org)
- Support Room: [`#anti-scam-support:matrix.org`](https://matrix.to/#/#anti-scam-support:matrix.org)
- Update and Announcement Room: [`#spam-police-rss:matrix.org`](https://matrix.to/#/#spam-police-rss:matrix.org)
- General Moderation Automation Ideas Room: [`#mod-ideas:matrix.org`](https://matrix.to/#/#mod-ideas:matrix.org)

## Inviting the bot

You can use my instance: [`@anti-spam:matrix.org`](https://matrix.to/#/@anti-spam:matrix.org), or [self-host](https://github.com/jjj333-p/spam-police#inviting-the-bot) your own!

To invite it, you can run the command below in a room that the bot is also in.
```matrix
+invite [Alias/ID to room]
```

> **Note**
>
> If you have problems inviting the bot, make sure the bot can join it. If you still have problems, join our [support room](https://matrix.to/#/#anti-scam-support:matrix.org).

> **Note**
>
> If you need a room to run the command, feel free to join [`#anti-scam-cmds:matrix.org`](https://matrix.to#anti-scam-cmds:matrix.org).
>
> My instance logs the scams it finds to [`#jjj-tg-scams:matrix.org`](https://matrix.to#anti-scam-cmds:matrix.org)

## Self-hosting

### Requirements

- [NodeJS](https://nodejs.org/en/download/package-manager/)
	- [Install from package manager](https://nodejs.org/en/download/package-manager/)
	- [NodeJS Installer](https://nodejs.org/en/download/)
- [NPM](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
	- [Installation Documentation](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

### Instructions

1. Download the latest stable version located in the [branches](https://github.com/jjj333-p/spam-police/branches)
	- Stable branches are formatted as `stable-vX.X.X-(version-X,-minor-release-X)`
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

3. Create a file named `login.txt` (`touch login.txt`)

4. In `login.txt` put the login information in the following format:
```txt
Homeserver
Login Token
Log Room for discovered Telegram scams
Command Room
```

> **Note**
> 
> Some homeservers have `matrix.` prepended onto the homeserver domain.

> **Example** of an account on matrix.org
> ```txt
> https://matrix.org
> [redacted]
> !xWGMKuBpJrtGDSfmaF:matrix.org
> !dSGCuhsxXDDJxhJxJH:matrix.org
> ```
 
5. Go back to the root directory (`cd ..`) and create `bot.json` (`touch bot.json`)

> **Note**
> 
> You don't need to put anything in `bot.json`, leave it empty
> 
> This appears to be how the bot SDK saves the sync token and stuff, however it seems to work just fine if I delete this so maybe the code could be changed around to not require it?

6. To install dependencies, run `npm install`

7. Start the bot with `node index.js` or `node .`
