const { Events } = require("discord.js");
const { pushSnipe } = require("../stores/snipeStore");

module.exports = {
  name: Events.MessageDelete,

  /** @param {import("discord.js").Message} message */
  async execute(message) {
    if (!message.guild) return;
    if (!message.channelId) return;
    if (!message.author) return;
    if (message.author.bot) return;

    const attachments = [...message.attachments.values()].map((a) => ({
      url: a.url,
      name: a.name,
      contentType: a.contentType ?? undefined
    }));

    pushSnipe(message.channelId, {
      channelId: message.channelId,
      authorTag: message.author.tag,
      authorId: message.author.id,
      avatarURL: message.author.displayAvatarURL(),
      content: message.content ?? "",
      createdAt: message.createdTimestamp ?? Date.now(),
      deletedAt: Date.now(),
      attachments,
    });
  },
};
