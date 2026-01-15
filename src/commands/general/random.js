const { SlashCommandBuilder, MessageFlags, ContainerBuilder } = require("discord.js");
const { parseCommaList, parseNumberRange, randInt, pickOne } = require("../../utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("random")
    .setDescription("Randomize Options OR Random Number!")
    .addSubcommand((sub) =>
      sub
        .setName("number")
        .setDescription("Get a random number")
        .addStringOption((option) =>
          option
            .setName("range")
            .setDescription("Set the number range, (e.g., 1, 10)")
            .setRequired(true)
            .setMinLength(3)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("options")
        .setDescription("Randomize a set of options")
        .addStringOption((option) =>
          option
            .setName("set")
            .setDescription("Supply the options, (e.g., pizza, tacos, burgers)")
            .setRequired(true)
            .setMinLength(2)
        )
    ),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    
    // Guild Check
    if (!interaction.inGuild()) return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral
    });

    // Gather Options
    const sub = interaction.options.getSubcommand(true);

    // Select Random Number
    if (sub === "number") {
      const rangeRaw = interaction.options.getString("range", true);
      const parsed = parseNumberRange(rangeRaw, { maxSpan: 1_000_000});

      if (!parsed.ok) {
        return interaction.reply({
          content: `${parsed.error}\nExample: \`/random number range:1, 10\``,
          flags: MessageFlags.Ephemeral
        });
      }

      const n = randInt(parsed.min, parsed.max);
      const chosen = new ContainerBuilder()
        .setAccentColor(0x131416)
        .addTextDisplayComponents((text) => text.setContent(`### Random Number`))
        .addSeparatorComponents((s) => s)
        .addTextDisplayComponents((text) => text.setContent(`-# Range: ${parsed.min} - ${parsed.max}\nI pick: **${n}**`));

      return interaction.reply({
        components: [chosen],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Randomize Options
    if (sub === "options") {
      const setRaw = interaction.options.getString("set", true);
      const parsed = parseCommaList(setRaw, {min: 2, max: 25});

      if (!parsed.ok) {
        return interaction.reply({
          content: `${parsed.error}\nExample: \`/random options set: pizza, tacos, burgers\``,
          flags: MessageFlags.Ephemeral
        });
      }

      const choice = pickOne(parsed.values);
      const chosen = new ContainerBuilder()
        .setAccentColor(0x131416)
        .addTextDisplayComponents((text) => text.setContent("### Randomize Options"))
        .addSeparatorComponents((s) => s)
        .addTextDisplayComponents((text) => text.setContent(`I pick: **${choice}**`));

      return interaction.reply({
        components: [chosen],
        flags: MessageFlags.IsComponentsV2
      });
    }
  },
};
