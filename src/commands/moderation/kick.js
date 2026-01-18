const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ContainerBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { createPendingKick } = require("../../stores/pendingModActions");

const CONFIRM_TTL_MS = 60_000;

/**
 * Build a confirmation UI for kick
 * @param {{ targetLabel: string, reason: string|null, silent: boolean, expiresAt: number }} info
 * @param {string} token
 * @returns {{ container: ContainerBuilder, row: ActionRowBuilder<ButtonBuilder> }}
 */
function buildKickConfirmUI(info, token) {
  const seconds = Math.max(1, Math.ceil((info.expiresAt - Date.now()) / 1000));

  const container = new ContainerBuilder()
    .setAccentColor(0xbf4941)
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          "## Confirm Kick",
          `**Target:** ${info.targetLabel}`,
          `**Reason:** ${info.reason ?? "*none*"}`,
          `**DM before kick:** ${info.silent ? "No (silent)" : "Yes"}`,
          `-# Expires in ~${seconds}s`,
        ].join("\n"),
      ),
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mod:kick:confirm:${token}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`mod:kick:cancel:${token}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary),
  );

  return { container, row };
}

/**
 * Check role hierarchy: invoker must be strictly higher than target
 * @param {import("discord.js").Guild} guild
 * @param {import("discord.js").GuildMember} invoker
 * @param {import("discord.js").GuildMember} target
 * @returns {boolean}
 */
function invokerCanActOnTarget(guild, invoker, target) {
  if (guild.ownerId === invoker.id) return true; // owner bypass
  return invoker.roles.highest.comparePositionTo(target.roles.highest) > 0;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member (with confirmation).")
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription("Member to kick")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the kick")
        .setRequired(false)
        .setMaxLength(300),
    )
    .addBooleanOption((option) =>
      option
        .setName("silent")
        .setDescription("Skip DMing the user before kicking")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used in a guild!",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({
        content: "You need **Kick Members** to use this command!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const guild = interaction.guild;

    // Ensure we have a real GuildMember for role comparisons
    const invoker = await guild.members
      .fetch(interaction.user.id)
      .catch(() => null);
    if (!invoker) {
      return interaction.reply({
        content: "Couldn't resolve your member record in this server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetUser = interaction.options.getUser("member", true);
    const reason = interaction.options.getString("reason") ?? null;
    const silent = interaction.options.getBoolean("silent") ?? false;

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: "You can’t kick yourself.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (targetUser.id === guild.ownerId) {
      return interaction.reply({
        content: "You can’t kick the server owner!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetMember = await guild.members
      .fetch(targetUser.id)
      .catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        content: "I couldn’t find that member in this server!",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!targetMember.kickable) {
      return interaction.reply({
        content:
          "I can’t kick that member (role hierarchy / missing permissions).",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!invokerCanActOnTarget(guild, invoker, targetMember)) {
      return interaction.reply({
        content:
          "You can’t kick that member (their top role is equal or higher than yours).",
        flags: MessageFlags.Ephemeral,
      });
    }

    const expiresAt = Date.now() + CONFIRM_TTL_MS;

    const pending = createPendingKick({
      guildId: guild.id,
      channelId: interaction.channelId,
      moderatorId: interaction.user.id,
      targetId: targetMember.id,
      reason,
      silent,
      expiresAt,
    });

    const { container, row } = buildKickConfirmUI(
      {
        targetLabel: `${targetMember} (${targetMember.user.tag})`,
        reason,
        silent,
        expiresAt,
      },
      pending.token,
    );

    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
