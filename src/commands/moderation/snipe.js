const {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { getSnipe } = require("../../stores/snipeStore");

function isImageAttachment(att) {
  if (att.contentType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp)$/.test(att.url);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("Show a recently deleted message in this channel.")
    .addIntegerOption((option) =>
      option
        .setName("depth")
        .setDescription("Which deleted message? 1 = most recent (max 5)")
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Guild Check
    if (!interaction.inGuild())
      return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
      });

    const depth = interaction.options.getInteger("depth") ?? 1;
    const snipe = getSnipe(interaction.channelId, depth);

    if (!snipe) {
      return interaction.reply({
        content: `Nothing to snipe at depth **${depth}** (expired or none stored).`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const ageSec = Math.max(0, Math.floor((Date.now() - snipe.deletedAt) / 1000));

    // No text BUT there are attachments
    const hasText = Boolean(snipe.content && snipe.content.trim().length);
    const hasAtt = Boolean(snipe.attachments?.length);

    const embed = new EmbedBuilder()
      .setColor("#131416")
      .setAuthor({ name: snipe.authorTag, iconURL: snipe.avatarURL })
      .setFooter({
        text: `Depth ${depth}/5 - Deleted ${ageSec}s ago`,
      })
      .setTimestamp(snipe.deletedAt);

    if (hasText) {
      embed.setDescription(snipe.content);
    } else if (hasAtt) {
      embed.setDescription("*[No text content - attachments only]*");
    } else {
      embed.setDescription(
        "*No cached content (message wasn't cached / missing intent)*"
      );
    }

    if (hasAtt) {
      const first = snipe.attachments[0];
      if (isImageAttachment(first)) embed.setImage(first.url);

      if (snipe.attachments.length > 1) {
        embed.addFields({
          name: "Attachments",
          value: snipe.attachments.map((a) => a.url).join("\n"),
        });
      }
    }

    return interaction.reply({ embeds: [embed] });
  },
};
