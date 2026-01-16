const {
  SlashCommandBuilder,
  ButtonStyle,
  MessageFlags,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Create Rules embed.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    const channel = interaction.channel;

    const linkOne = "https://discord.com/terms";
    const linkTwo = "https://discord.com/guidelines";

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("TOS")
        .setStyle(ButtonStyle.Link)
        .setURL(linkOne),

      new ButtonBuilder()
        .setLabel("Guidelines")
        .setStyle(ButtonStyle.Link)
        .setURL(linkTwo)
    );

    const onRules = new ContainerBuilder()
      .setAccentColor(0x131416)
      .addTextDisplayComponents((textDisplay) =>
        textDisplay.setContent("## Server Rules")
      )
      .addSeparatorComponents((separator) => separator)
      .addTextDisplayComponents((textDisplay) =>
        textDisplay.setContent(
          "**1.** No Spam.\n**2.** No NSFW.\n**3.** No Bullying.\n**4.** Follow Discord TOS."
        )
      )
      .addSeparatorComponents((separator) => separator)
      .addActionRowComponents(row);

    await channel.send({
      components: [onRules],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
