const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin!"),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    const results = ["Heads!", "Tails!"];
    const result = results[Math.floor(Math.random() * results.length)];

    return interaction.reply(result);
  },
};
