# Axiom

Axiom is a **general-purpose Discord bot** built with **Discord.js** and **Node.js**.  
It focuses on **quality-of-life utilities** and **moderation tools**, with an emphasis on flexibility and customization.

> ⚠️ **Early development** – features, commands, and structure are still evolving.

---

## ✨ Features

### Utility / Information
- `serverinfo` – View server statistics and metadata
- `userinfo` – Detailed user information
- `roleinfo` – Role details and permissions
- `poll` - Polls with multiple options (custom buttons)

### Moderation
- `kick` - Kick members
- `ban` - Ban members
- `mute`- Mute members
- `purge` - Bulk delete (purge) messages from a channel
- `lockdown` - Lock a channel to members (customizable permissions coming soon)
- `snipe` - Snipe the most recently deleted message (depth up to 5)
- `nickname` - Nickname self or others

### General
- `8ball` - Ask the Magic 8 Ball
- `avatar` - Get a member's avatar
- `coinflip` - Flip a coin (Heads/Tails)
- `color` - Show a color (RGB/Hex)
- `mock` - SpOnGeBoB sOmE TeXt
- `random` - Randomize some options OR Random number (eg., tacos, pizza, burgers OR eg., 1, 10)

### Admin
- `eval` - Evaluate code inside Discord (developer only, see **Notes** below)
- `ping` - Check client latency
- `uptime` - Check client uptime

### Other
- `rules` – Planned to be highly customizable per server
- More commands and configuration options planned

---

## 🛠️ Tech Stack

- **Node.js**
- **Discord.js**
- JavaScript (CommonJS)
- Slash commands

---

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/dctcr/Axiom.git
cd Axiom
```

2. Install Dependencies
```bash
npm install
```

3. Create a `.env` file

File should go in the project root:
```env
TOKEN=your_discord_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_test_guild_id
OWNERS=your_id,example_id_2
```
> `.env` is required and is intentionally not tracked by Git.

---

## 🚀 Running the Bot

1. Deploy Slash Commands
```bash
node src/deployCommand.js
```

2. Start the bot
```bash
node src/index.js
```

---

## 📁 Project Structure

```
src\
  commands\
  config\
  events\
  stores\
  deployCommand.js
  index.js
  utils.js
.env
```

## Notes
- For `eval` to work, you must have administrator permissions inside the guild, and have your ID set in `OWNERS` under `.env`. (See step 3 under **Installation**)

---

## 📄 License
This project is currently unlicensed.
