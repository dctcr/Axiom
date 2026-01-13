const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nickname")
    .setDescription("Set yours/or a members nickname!")
    .addUserOption((option) => 
        option
          .setName("member")
          .setDescription("Member whose nickname to set")
          .setRequired(false)
    )
    .addStringOption((option) => 
        option
          .setName("search")
          .setDescription("Member whose nickname to set")
          .setRequired(false)
    )
    .setDefaultMemberPermissions(0x0000000008000000),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    
    // Find Member

    // Check Hierarchy

    // Change Nickname
  }
};
