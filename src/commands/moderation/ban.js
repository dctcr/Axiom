const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require("discord.js");

const { createPendingBan } = require("../../stores/pendingModActions");
const { invokerCanActOnTarget } = require("../../utils/moderation");
const { parseDuration } = require("../../utils/utils");

const CONFIRM_TTL_MS = 60_000;

/**
 * Build a confirmation UI for ban
 * @param {{ targetLabel: string, reason: string|null, silent: boolean, durationLabel: string, deleteDays: number, expiresAt: number }} info
 * @param {string} token
 * @returns {ContainerBuilder}
 */
function buildBanConfirmUI(info, token) {
  const seconds = Math.max(1, Math.ceil((info.expiresAt - Date.now()) / 1000));

  return new ContainerBuilder()
    .setAccentColor(0xbf4941)
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          "## Confirm Ban",
          `**Target:** ${info.targetLabel}`,
          `**Reason:** ${info.reason ?? "*none*"}`,
          `**Duration:** ${info.durationLabel}`,
          `**Delete History:** ${info.deleteDays} day(s)`,
          `**DM before ban:** ${info.silent ? "No (silent)" : "Yes"}`,
          `-# Expires in ~${seconds}s`,
        ].join("\n"),
      ),
    )
    .addActionRowComponents((row) =>
      row.setComponents(
        (btn) =>
          btn
            .setCustomId(`mod:ban:confirm:${token}`)
            .setLabel("Confirm")
            .setStyle(ButtonStyle.Danger),
        (btn) =>
          btn
            .setCustomId(`mod:ban:cancel:${token}`)
            .setLabel("Cancel")
            .setStyle(ButtonStyle.Secondary),
      ),
    );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member (with confirmation).")
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription("Member to ban")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("duration")
        .setDescription(
          "Temp-ban duration like 10m, 2h, 7d (omit for permanent)",
        )
        .setRequired(false)
        .setMaxLength(16),
    )
    .addIntegerOption((option) =>
      option
        .setName("delete_days")
        .setDescription("Delete message history (0-7 days)")
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7),
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the ban")
        .setRequired(false)
        .setMaxLength(300),
    )
    .addBooleanOption((option) =>
      option
        .setName("silent")
        .setDescription("Skip DMing the user before banning")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Guild Check
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `This command can only be used in a guild!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Permissions Check
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: ``,
        flags: MessageFlags.Ephemeral,
      });
    }

    const guild = interaction.guild;
    const invoker = interaction.member;

    const targetUser = interaction.options.getUser("member", true);
    const durationRaw = interaction.options.getString("duration");
    const deleteDays = interaction.options.getString("delete_days") ?? 0;
    const reason = interaction.options.getString("reason") ?? null;
    const silent = interaction.options.getBoolean("silent") ?? false;

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: `You can't ban yourself..`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (targetUser.id === guild.ownerId) {
      return interaction.reply({
        content: `You can't ban the server owner!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const parsedDur = parseDuration(durationRaw, { maxMs: 90 * 86_400_000 });
    if (!parsedDur.ok) {
      return interaction.reply({
        content: parsedDur.error,
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetMember = await guild.members
      .fetch(targetUser.id)
      .catch(() => null);
    if (!targetMember) {
      return interaction.reply({
        content: `I couldn't find that member!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!targetMember.bannable) {
      return interaction.reply({
        content: `I can't ban that member! (role hierarchy / missing permissions)`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!invokerCanActOnTarget(guild, invoker, targetMember)) {
      return interaction.reply({
        content: `You can't ban that member!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const expiresAt = Date.now() + CONFIRM_TTL_MS;

    const pending = createPendingBan({
      guildId: guild.id,
      channelId: interaction.channelId,
      moderatorId: interaction.user.id,
      targetId: targetMember.id,
      reason,
      silent,
      deleteDays,
      durationMs: parsedDur.ms,
      expiresAt,
    });

    const container = buildBanConfirmUI(
      {
        targetLabel: `${targetMember} (${targetMember.user.tag})`,
        reason,
        silent,
        durationLabel: parsedDur.ms ? parsedDur.label : "Permanent",
        deleteDays,
        expiresAt,
      },
      pending.token,
    );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
