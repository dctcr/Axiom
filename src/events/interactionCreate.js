const { Events, MessageFlags } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);

      const payload = {
        content: "There was an error while executing this command!",
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.deferred) {
        await interaction.editReply(payload).catch(() => {});
      } else if (interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};