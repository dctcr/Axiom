const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check client latency!")
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
    const latency = interaction.client.ws.ping;
    const container = new ContainerBuilder()
      .addTextDisplayComponents((text) => text.setContent(`## Client Latency`))
      .addSeparatorComponents((s) => s)
      .addTextDisplayComponents((text) =>
        text.setContent(`Current Ping: **${latency}ms**`)
      );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  },
};
