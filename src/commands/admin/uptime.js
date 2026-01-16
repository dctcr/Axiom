const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  PermissionFlagsBits,
} = require("discord.js");

/**
 * Format milliseconds to readable time
 * @param {number} ms Milliseconds to format
 * @returns {string} Returns formatted time
 */
function formateDuration(ms) {
  if (typeof ms !== "number" || ms < 0)
    return console.log(
      "Invalid Input: formateDuration(ms) `ms` must be of type number and greater than 0"
    );

  // Calculate time components
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60));

  // Pad single digits with leading zero
  function pad(num) {
    return String(num).padStart(2, 0);
  }

  // Format Output: H, MM, SS || HH, MM, SS
  if (hours > 0) {
    return `${hours}h, ${pad(minutes)}m, ${pad(seconds)}s`;
  } else {
    return `${minutes}m, ${pad(seconds)}s`;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("uptime")
    .setDescription("Check client uptime!")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Guild Check
    if (!interaction.inGuild())
      return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
      });

    // Create Container - Send Response
    const uptime = formateDuration(interaction.client.uptime);
    const container = new ContainerBuilder()
      .addTextDisplayComponents((text) => text.setContent(`## Client Uptime`))
      .addSeparatorComponents((s) => s)
      .addTextDisplayComponents((text) =>
        text.setContent(
          `${interaction.client.user.username} has been online for: **${uptime}**`
        )
      );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
};
