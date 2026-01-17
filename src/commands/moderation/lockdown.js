const {
  SlashCommandBuilder,
  MessageFlags,
  ContainerBuilder,
  PermissionFlagsBits,
  Message,
} = require("discord.js");

const {
  getGuildLockdownState,
  setGuildLockdownState,
  clearGuildLockdownState,
} = require("../../stores/lockdownStore");

const {
  getTargetChannels,
  applyLockdown,
  restoreLockdown,
} = require("../../utils/lockdown");

/**
 * @param {Array<{ channelId: string, channelName: string, reason: string }>} skipped
 * @param {number} max
 * @returns {string}
 */
function formatSkipped(skipped, max = 6) {
  if (!skipped?.length) return "None";
  const lines = skipped
    .slice(0, max)
    .map((s) => `\\- **${s.channelName ?? s.channelId}** \\- ${s.reason}`);
  const extra =
    skipped.length > max ? `\n...and **${skipped.length - max}** more.` : "";
  return lines.join("\n") + extra;
}

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @returns {string}
 */
function actorTag(interaction) {
  return (
    interaction.user?.tag ?? `${interaction.user?.username ?? "unknown"}#0000`
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription(
      "Lock/unlock channels by denying @everyone send/reactions/threads.",
    )
    .addSubcommand((sub) =>
      sub
        .setName("enable")
        .setDescription("Enable lockdown")
        .addStringOption((option) =>
          option
            .setName("scope")
            .setDescription("Where to apply lockdown")
            .setRequired(false)
            .addChoices(
              { name: "This channel", value: "channel" },
              { name: "This category", value: "category" },
              { name: "All channels", value: "all" },
            ),
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("Optional reason")
            .setRequired(false)
            .setMaxLength(200),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription(
          "Disable lockdown (restore previous @everyone overwrites)",
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("Optional reason")
            .setRequired(false)
            .setMaxLength(200),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Show current lockdown status for this server"),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    // Guild Check
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used in a guild!",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand(true);

    // ---------------
    // Lockdown Status
    // ---------------
    if (sub === "status") {
      const state = await getGuildLockdownState(interaction.guildId);
      const container = new ContainerBuilder()
        .addTextDisplayComponents((text) =>
          text.setContent("## Lockdown Status"),
        )
        .addSeparatorComponents((s) => s);

      if (state?.active) {
        container.addTextDisplayComponents((text) =>
          text.setContent("Lockdown is **not active** for this server."),
        );
        return interaction.reply({
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const enabledAt = Math.floor((state.enabledAt ?? Date.now()) / 1000);
      const count = Object.keys(state.channels ?? {}).length;

      // Container Response (Active)
      container.addTextDisplayComponents((text) =>
        text.setContent(
          [
            `Lockdown is **active**.`,
            `-# \\- Scope: **${state.scope}**`,
            `-# \\- Enabled: **${enabledAt}**`,
            `-# \\- Enabled by: **${state.enabledBy}**`,
            `-# \\- Channels locked: **${count}**`,
            `-# \\- Reason: **${state.reason ?? "none"}**`,
          ].join("\n"),
        ),
      );

      return interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    // Enable/Disable, defer (bulk channel edits > 3s)
    await interaction
      .deferReply({ flags: MessageFlags.Ephemeral })
      .catch(() => {});

    // ---------------
    // Lockdown Enable
    // ---------------
    if (sub === "enable") {
      const scope = interaction.options.getString("scope") ?? "channel";
      const reason = interaction.options.getString("reason") ?? null;

      const container = new ContainerBuilder()
        .addTextDisplayComponents((text) => text.setContent("## Lockdown"))
        .addSeparatorComponents((s) => s);

      const existing = await getGuildLockdownState(interaction.guildId);
      if (existing?.active) {
        const enabledAt = Math.floor((existing.enabledAt ?? Date.now()) / 1000);

        container.addTextDisplayComponents((text) =>
          text.setContent(
            [
              "Lockdown is already **active**",
              `Enabled <t:${enabledAt}R> by <@${existing.enabledBy}>.`,
              "-# Use \`/lockdown disable\` first.",
            ].join("\n"),
          ),
        );

        return interaction.editReply({
          components: [container],
          flags: Message.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const targets = getTargetChannels(
        interaction.guild,
        scope,
        interaction.channel,
      );
      if (!targets.length) {
        const content =
          scope === "category"
            ? "This channel has no category; nothing to lock."
            : "No lockable channels found for that scope";
        container.addTextDisplayComponents((text) => text.setContent(content));

        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const { changed, skipped } = await applyLockdown(
        interaction.guild,
        targets,
        reason,
        actorTag(interaction),
      );

      const changedCount = Object.keys(changed ?? {}).length;

      if (!changedCount) {
        container.addTextDisplayComponents((text) =>
          text.setContent(
            [
              "I couldn't lock any channels (likely missing **Manage Channels** in all targets)",
              `Skipped:\n${formatSkipped(skipped)}`,
            ].join("\n"),
          ),
        );

        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      /** @type {import("../../stores/lockdownStore").GuildLockdownState | any} */
      const state = {
        active: true,
        guildId: interaction.guildId,
        scope,
        enabledBy: interaction.user.id,
        enabledAt: Date.now(),
        reason,
        channels: changed,
      };

      await setGuildLockdownState(interaction.guildId, state);

      container.addTextDisplayComponents((text) =>
        text.setContent(
          [
            "Lockdown **enabled**",
            `\\- Scope: **${scope}**`,
            `\\- Channels Locked: **${changedCount}**`,
            `\\- Skipped: **${skipped.length}**`,
            `\\- Reason: ${reason ?? "*none*"}\n`,
            `-# Skipped Details:\n${formatSkipped(skipped)}`,
          ].join("\n"),
        ),
      );

      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    // ----------------
    // Lockdown Disable
    // ----------------
    if (sub === "disable") {
      const reason = interaction.options.getString("reason") ?? null;
      const container = new ContainerBuilder()
        .addTextDisplayComponents((text) =>
          text.setContent("## Lockdown Disable"),
        )
        .addSeparatorComponents((s) => s);

      const state = await getGuildLockdownState(interaction.guildId);
      if (!state?.active) {
        container.addTextDisplayComponents((text) =>
          text.setContent(
            "Lockdown is **not active** (no stored state for this server).",
          ),
        );
        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      const { restored, skipped } = await restoreLockdown(
        interaction.guildId,
        state,
        reason,
        actorTag(interaction),
      );

      const allIds = Object.keys(state.channels ?? {});
      const restoredSet = new Set(restored ?? []);
      const remaining = allIds.filter((id) => !restoredSet.has(id));

      // If failed to restore, keep state for remaining channels to retry later
      if (remaining.length) {
        const nextState = {
          ...state,
          active: true,
          channels: Object.fromEntries(
            remaining.map((id) => [id, state.channels[id]]),
          ),
        };

        await setGuildLockdownState(interaction.guildId, nextState);
        container.addTextDisplayComponents((text) =>
          text.setContent(
            [
              `Lockdown disable was **partial**`,
              `\\- Restored: **${restored.length}**`,
              `\\- Still locked (stored): **${remaining.length}**`,
              `\\- Skipped: **${skipped.length}**\n`,
              `You can run \`/lockdown disable\` again after fixing permissions / missing channels`,
              `-# Skipped Details:\n${formatSkipped(skipped)}`,
            ].join("\n"),
          ),
        );

        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
      }

      await clearGuildLockdownState(interaction.guildId);
      container.addTextDisplayComponents((text) =>
        text.setContent(
          [
            `Lockdown **disabled**`,
            `\\- Channels restored: **${restored.length}**`,
            `\\- Skipped: **${skipped.length}**`,
            `\\- Reason: ${reason ?? "*none*"}\n`,
            `-# Skipped Details:\n${formatSkipped(skipped)}`,
          ].join("\n"),
        ),
      );

      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
  },
};
