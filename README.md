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

### Moderation
- `kick`
- `ban`
- `mute`
- `purge`
- `nickname`

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
npm src/deployCommand.js
```

2. Start the bot
```bash
npm src/index.js
```

---

## 📁 Project Structure

```
src/
  commands/
  events/
  deployCommand.js
  index.js
  utils.js
.env
```

---

## 📄 License
This project is currently unlicensed.
