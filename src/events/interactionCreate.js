const {
  Events,
  MessageFlags,
  ContainerBuilder,
  PermissionFlagsBits,
} = require("discord.js");

const { consumePending, getPending } = require("../stores/pendingModActions");
const { createCase, updateCase } = require("../stores/modStore");
const pollCommand = require("../commands/utility/poll");

/**
 * Build a quick result container
 * @param {string} title
 * @param {string[]} lines
 * @param {number} color
 * @returns {ContainerBuilder}
 */
function resultContainer(title, lines, color) {
  return new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents((text) =>
      text.setContent(`## ${title}\n${lines.join("\n")}`),
    );
}

module.exports = {
  name: Events.InteractionCreate,

  /** @param {import("discord.js").Interaction} interaction */
  async execute(interaction) {
    if (interaction.isButton()) {
      const id = interaction.customId ?? "";

      // -----
      // Button Interactions (Polls)
      // -----
      if (id.startsWith("poll:")) {
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

          const prev = poll.votes.get(interaction.user.id);
          if (prev === idx) poll.votes.delete(interaction.user.id);
          else poll.votes.set(interaction.user.id, idx);

          const counts = pollCommand.computeCounts(
            poll.options.length,
            poll.votes,
          );
          const container = pollCommand.buildPollContainer(
            poll.question,
            poll.options,
            counts,
          );
          const buttonRows = pollCommand.buildPollButtons(
            messageId,
            poll.options,
          );

          return interaction.update({
            components: [container, ...buttonRows],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (err) {
          console.error(err);

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

      // --------------------------------
      // Button Interactions (Moderation)
      // --------------------------------
      if (id.startsWith("mod:kick:")) {
        const parts = id.split(":");
        const action = parts[2];
        const token = parts[3];

        if (!token) return;

        const pending = getPending(token);
        if (!pending) {
          return interaction.reply({
            content: "That confirmation has expired or is no longer valid!",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.user.id !== pending.moderatorId) {
          return interaction.reply({
            content:
              "Only the moderator who ran the command can use these buttons.",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (action === "cancel") {
          consumePending(token);
          return interaction.update({
            components: [
              resultContainer("Cancelled", ["Kick cancelled!"], 0x99aab5),
            ],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
          });
        }

        if (action === "confirm") {
          const job = consumePending(token);
          if (!job) {
            return interaction.reply({
              content: "That confirmation has expired or is no longer valid!",
              flags: MessageFlags.Ephemeral,
            });
          }

          const guild = interaction.guild;
          if (!guild || guild.id !== job.guildId) {
            return interaction.update({
              components: [
                resultContainer(
                  "Failed",
                  ["Guild no longer available!"],
                  0xed4245,
                ),
              ],
              flags: MessageFlags.IsComponentsV2,
              allowedMentions: { parse: [] },
            });
          }

          const me =
            guild.members.me ??
            (await guild.members.fetchMe().catch(() => null));
          if (!me?.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.update({
              components: [
                resultContainer(
                  "Failed",
                  ["I am missing **Kick Members**."],
                  0xed4245,
                ),
              ],
              flags: MessageFlags.IsComponentsV2,
              allowedMentions: { parse: [] },
            });
          }

          const moderatorMember = await guild.members
            .fetch(job.moderatorId)
            .catch(() => null);

          if (
            !moderatorMember?.permissions.has(PermissionFlagsBits.KickMembers)
          ) {
            return interaction.update({
              components: [
                resultContainer(
                  "Failed",
                  ["You no longer have **Kick Members**."],
                  0xed4245,
                ),
              ],
              flags: MessageFlags.IsComponentsV2,
              allowedMentions: { parse: [] },
            });
          }

          const targetMember = await guild.members
            .fetch(job.targetId)
            .catch(() => null);
          if (!targetMember) {
            return interaction.update({
              components: [
                resultContainer(
                  "Failed",
                  ["Target is no longer in the server!"],
                  0xed4245,
                ),
              ],
              flags: MessageFlags.IsComponentsV2,
              allowedMentions: { parse: [] },
            });
          }

          if (
            guild.ownerId !== moderatorMember.id &&
            moderatorMember.roles.highest.comparePositionTo(
              targetMember.roles.highest,
            ) <= 0
          ) {
            return interaction.update({
              components: [
                resultContainer(
                  "Failed",
                  ["You can't kick that member!"],
                  0xed4245,
                ),
              ],
              flags: MessageFlags.IsComponentsV2,
              allowedMentions: { parse: [] },
            });
          }

          if (!targetMember.kickable) {
            return interaction.update({
              components: [
                resultContainer(
                  "Failed",
                  ["I can't kick that member!"],
                  0xed4245,
                ),
              ],
              flags: MessageFlags.IsComponentsV2,
              allowedMentions: { parse: [] },
            });
          }

          const caseEntry = await createCase(guild.id, {
            action: "KICK",
            targetId: targetMember.id,
            moderatorId: moderatorMember.id,
            reason: job.reason ?? null,
            success: null,
            error: null,
            meta: { channelId: job.channelId, context: "SlashCommand /kick" },
          });

          if (!job.silent) {
            const dmText = [
              `You were kicked from **${guild.name}**.`,
              caseEntry.reason
                ? `Reason: ${caseEntry.reason}`
                : "Reason: *(none)*",
              `Case: #${caseEntry.caseId}`,
            ].join("\n");

            await targetMember.user.send({ content: dmText }).catch(() => {});
          }

          const auditReason = `Case #${caseEntry.caseId} | By ${interaction.user.tag}${
            caseEntry.reason ? ` | ${caseEntry.reason}` : ""
          }`;

          const kicked = await targetMember
            .kick(auditReason)
            .then(() => true)
            .catch((e) => e);

          if (kicked === true) {
            await updateCase(guild.id, caseEntry.caseId, {
              success: true,
              error: null,
            });

            return interaction.update({
              components: [
                resultContainer(
                  "Kicked",
                  [
                    `**Target:** ${targetMember.user.tag} (${targetMember.id})`,
                    `**Case:** #${caseEntry.caseId}`,
                    `**DM:** ${job.silent ? "No (silent)" : "Yes"}`,
                    `**Reason:** ${caseEntry.reason ?? "*(none)*"}`,
                  ],
                  0x57f287,
                ),
              ],
              flags: MessageFlags.IsComponentsV2,
              allowedMentions: { parse: [] },
            });
          }

          const errMsg = kicked?.message ?? "Kick failed.";
          await updateCase(guild.id, caseEntry.caseId, {
            success: false,
            error: errMsg,
          });

          return interaction.update({
            components: [
              resultContainer(
                "Failed",
                [
                  `Kick failed.`,
                  `**Case:** #${caseEntry.caseId}`,
                  `**Error:** ${errMsg}`,
                ],
                0xed4245,
              ),
            ],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
          });
        }

        // Unknown action segment (defensive)
        return interaction.reply({
          content: "Unknown moderation action.",
          flags: MessageFlags.Ephemeral,
        });
      }

      return;
    }

    // --------------------------
    // Slash Command Interactions
    // --------------------------
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
