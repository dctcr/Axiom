const { Events, MessageFlags } = require("discord.js");
const pollCommand = require("../commands/utility/poll");

module.exports = {
  name: Events.InteractionCreate,

  /** @param {import("discord.js").Interaction} interaction */
  async execute(interaction) {
    // Button Interactions (Polls)
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (!id.startsWith("poll:")) return;

      try {
        const [, messageId, idxStr] = id.split(":");
        const idx = Number(idxStr);

        if (!Number.isInteger(idx)) {
          return interaction.reply({
            content: "Invalid poll option.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const poll = pollCommand.POLLS?.get(messageId);
        if (!poll) {
          return interaction.reply({
            content: "That poll is no longer active.",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (idx < 0 || idx >= poll.options.length) {
          return interaction.reply({
            content: "That poll option no longer exists.",
            flags: MessageFlags.Ephemeral,
          });
        }

        // Toggle vote
        const prev = poll.votes.get(interaction.user.id);
        if (prev === idx) poll.votes.delete(interaction.user.id);
        else poll.votes.set(interaction.user.id, idx);

        const counts = pollCommand.computeCounts(
          poll.options.length,
          poll.votes
        );
        const container = pollCommand.buildPollContainer(
          poll.question,
          poll.options,
          counts
        );
        const buttonRows = pollCommand.buildPollButtons(
          messageId,
          poll.options
        );

        // Update the poll message current
        return interaction.update({
          components: [container, ...buttonRows],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (err) {
        console.error(err);

        // If update fails, try to tell the user ephemerally
        if (!interaction.deferred && !interaction.replied) {
          return interaction
            .reply({
              content: "There was an error while handling that poll vote.",
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => {});
        }

        return;
      }
    }

    // Slash Command Interactions
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
