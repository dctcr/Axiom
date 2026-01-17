const {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

// TODO: create these in src/stores/lockdownStore.js
// const { loadState, saveState, clearState, getState } = require("../../stores/lockdownStore");

const LOCKDOWN_DENIES = {
  SendMessages: false,
  AddReactions: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
  SendMessagesInThreads: false,
};

function isLockableChannel(ch) {
  if (!ch) return false;
  return (
    ch.type === ChannelType.GuildText ||
    ch.type === ChannelType.GuildAnnouncement ||
    ch.type === ChannelType.GuildForum ||
    ch.type === ChannelType.GuildMedia
  );
}

function getTargetChannels(guild, scope, currentChannel) {
  if (scope === "channel") return [currentChannel].filter(isLockableChannel);

  if (scope === "category") {
    const parent = currentChannel.parent;
    if (!parent) return [];
    // All channels under that category
    return parent.children.cache.filter(isLockableChannel).toJSON();
  }

  // scope === "all"
  return guild.channels.cache.filter(isLockableChannel).toJSON();
}

// TODO: replace with real persistence
// State shape suggestion (per guild):
// {
//   active: true/false,
//   guildId,
//   enabledBy: userId,
//   enabledAt: timestamp,
//   reason: string|null,
//   scope: "channel"|"category"|"all",
//   channels: {
//     [channelId]: {
//        // previous overwrite values for @everyone for each perm:
//        // true = allow, false = deny, null = unset
//        before: { SendMessages: null, AddReactions: true, ... }
//     }
//   }
// }

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription(
      "Lock/unlock channels by denying @everyone send/reactions/threads."
    )
    .addSubcommand((sub) =>
      sub
        .setName("enable")
        .setDescription("Enable lockdown")
        .addStringOption((o) =>
          o
            .setName("scope")
            .setDescription("Where to apply lockdown")
            .setRequired(false)
            .addChoices(
              { name: "This channel", value: "channel" },
              { name: "This category", value: "category" },
              { name: "All channels", value: "all" }
            )
        )
        .addStringOption((o) =>
          o
            .setName("reason")
            .setDescription("Optional reason")
            .setRequired(false)
            .setMaxLength(200)
        )
    )
    .addSubcommand(
      (sub) =>
        sub
          .setName("disable")
          .setDescription(
            "Disable lockdown (restore previous @everyone overwrites)"
          )
          .addStringOption((o) =>
            o
              .setName("reason")
              .setDescription("Optional reason")
              .setRequired(false)
              .setMaxLength(200)
          )
      // Optional “force” if no stored state exists:
      // .addBooleanOption(o =>
      //   o.setName("force")
      //     .setDescription("Remove lockdown denies even if no stored state exists")
      //     .setRequired(false)
      // )
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Show current lockdown status for this server")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  /** @param {import("discord.js").ChatInputCommandInteraction} interaction */
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used in a guild!",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Extra safety: even though default perms are set, still enforce at runtime.
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
    ) {
      return interaction.reply({
        content: "You need **Manage Channels** to use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand(true);

    // ----------------
    // /lockdown status
    // ----------------
    if (sub === "status") {
      // TODO: const state = getState(interaction.guildId);
      // if (!state?.active) ...
      return interaction.reply({
        content: "Status not implemented yet (store not wired).",
        flags: MessageFlags.Ephemeral,
      });
    }

    // ---------------
    // /lockdown enable
    // ---------------
    if (sub === "enable") {
      const scope = interaction.options.getString("scope") ?? "channel";
      const reason = interaction.options.getString("reason") ?? null;

      const targets = getTargetChannels(
        interaction.guild,
        scope,
        interaction.channel
      );
      if (!targets.length) {
        return interaction.reply({
          content:
            scope === "category"
              ? "This channel has no category, so there’s nothing to lock."
              : "No lockable channels found for that scope.",
          flags: MessageFlags.Ephemeral,
        });
      }

      // TODO:
      // 1) load existing state; decide whether to allow re-enable
      // 2) build a state diff:
      //    - for each target channel, read existing @everyone overwrite
      //    - store "before" values for the perms you will touch
      // 3) apply overwrites (merge; only set those perms to false)
      // 4) save state

      return interaction.reply({
        content: `Lockdown enable skeleton OK.\nScope: **${scope}**\nTargets: **${
          targets.length
        }**\nReason: ${reason ?? "*none*"}`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // ----------------
    // /lockdown disable
    // ----------------
    if (sub === "disable") {
      const reason = interaction.options.getString("reason") ?? null;
      // const force = interaction.options.getBoolean("force") ?? false;

      // TODO:
      // 1) load state; if none:
      //    - if force: remove denies by setting perms to null (unset)
      //    - else: tell user no active lockdown by bot
      // 2) restore previous values for each channel/perms you touched
      // 3) clear state

      return interaction.reply({
        content: `Lockdown disable skeleton OK.\nReason: ${reason ?? "*none*"}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
