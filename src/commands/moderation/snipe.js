const {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { getSnipe } = require("../../stores/snipeStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("Show the most recently deleted message in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Guild Check
    if (!interaction.inGuild())
      return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
      });

    const snipe = getSnipe(interaction.channelId);
    if (!snipe)
      return interaction.reply({
        content: `Nothing to snipe in this channel yet!`,
        flags: MessageFlags.Ephemeral,
      });

    // Expiry
    const ageMs = Date.now() - snipe.deletedAt;
    if (ageMs > 5 * 60 * 1000) {
      return interaction.reply({
        content: `Last deleted message is too old!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setColor("#131416")
      .setAuthor({ name: snipe.authorTag, iconURL: snipe.avatarURL })
      .setDescription(
        snipe.content || "No cached content (missing intent or not cached)"
      )
      .setFooter({ text: `Deleted ${Math.floor(ageMs) / 1000}s ago` })
      .setTimestamp(snipe.deletedAt);

    if (snipe.attachments?.length) {
      embed.setImage(snipe.attachments[0]);
      if (snipe.attachments.length > 1) {
        embed.addFields({
          name: "Attachments",
          value: snipe.attachments.join("\n"),
        });
      }
    }

    return interaction.reply({ embeds: [embed] });
  },
};