const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk delete messages from this channel!")
    .addNumberOption((option) =>
      option
        .setName("amount")
        .setDescription("Amount of messages to delete")
        .setMaxValue(50)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(0x0000000000002000),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    const channel = interaction.channel;
    const amount = interaction.options.getNumber("amount");
    
    if (amount === 0) return interaction.reply({
        content: "Amount must be 1 or more.",
        flags: MessageFlags.Ephemeral
    });

    return channel.bulkDelete(amount, false).then(async m => await interaction.reply({
        content: `Deleted ${amount} message${2 >= amount ? "" : "s"}.`,
        flags: MessageFlags.Ephemeral
    })).catch(console.error());
  },
};
