const { Events } = require("discord.js");
const { setSnipe } = require("../stores/snipeStore");

module.exports = {
  name: Events.MessageDelete,

  /** @param {import("discord.js").Message} message */
  async execute(message) {
    if (!message.guild) return;
    if (!message.author) return;
    if (message.author.bot) return;

    const attachments = [...message.attachments.values()].map((a) => a.url);

    setSnipe(message.channelId, {
      content: message.content ?? "",
      authorTag: message.author.tag,
      authorId: message.author.id,
      avatarURL: message.author.displayAvatarURL(),
      createdAt: message.createdTimestamp,
      deletedAt: Date.now(),
      attachments,
    });
  },
};
