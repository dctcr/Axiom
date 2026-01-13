const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roleinfo")
    .setDescription("Gather information on a role!")
    .addRoleOption((option) => 
        option
          .setName("role")
          .setDescription("Role to gather information on")
          .setRequired(false)
    )
    .addStringOption((option) => 
        option
          .setName("search")
          .setDescription("Role to gather information on")
          .setRequired(false)
    )
    .setDefaultMemberPermissions(0x0000000010000000),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    await interaction.reply("Pong!");
  }
};
