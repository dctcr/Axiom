const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const { normalize } = require("../../utils/utils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mock")
    .setDescription("Spongebob-ify!")
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("Text to mock")
        .setMinLength(3)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Check Guild
    if (!interaction.inGuild()) return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
    });

    // Gather String Option
    const toMock = normalize(interaction.options.getString("text"));

    // Spongebob Function
    /**
     * @param {string} str Text to spongebob-ify
     * @returns {string} Returns text spongebob-ified
     */
    function spongebobify(str) {
      return str
        .split("")
        .map((char, index) => {
          if (index % 2 === 0) return char.toUpperCase();
          else return char.toLowerCase();
        })
        .join("");
    }

    // Send Message
    const mocked = spongebobify(toMock);
    return interaction.reply(mocked);
  },
};
