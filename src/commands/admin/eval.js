const { SlashCommandBuilder, ContainerBuilder, MessageFlags } = require("discord.js");
const { inspect } = require("util");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("eval")
    .setDescription("Evaluate some code!")
    .addStringOption((o) =>
      o.setName("code")
        .setDescription("Code to evaluate")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(0x0000000000000008),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    if (interaction.user.id !== "882437978918633513") {
      return interaction.reply({
        content: "Nope.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const ctx = {
      client: interaction.client,
      guild: interaction.guild,
      channel: interaction.channel,
      user: interaction.user,
      member: interaction.member,

      reply: (options) => interaction.followUp(options),
      edit: (options) => interaction.editReply(options),
      followUp: (options) => interaction.followUp(options),
    };

    const code = interaction.options.getString("code", true);

    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction("ctx", `"use strict";\n${code}`);
      const result = await fn(ctx);

      const evaluated = inspect(result, { depth: 0 });
      const out = evaluated.length > 1900 ? evaluated.slice(0, 1900) + "…" : evaluated;

      return interaction.editReply(`\`\`\`js\n${out}\n\`\`\``);
    } catch (e) {
      const onError = new ContainerBuilder()
        .setAccentColor(0xbf4941)
        .addTextDisplayComponents((textDisplay => textDisplay.setContent("## Error Occurred")))
        .addSeparatorComponents((s) => s)
        .addTextDisplayComponents((textDisplay) => textDisplay.setContent(`\`\`\`js\n${e.name}\n\n${e.message}\n\`\`\``));

      return interaction.editReply({ components: [onError], flags: MessageFlags.IsComponentsV2 });
    }
  },
};
