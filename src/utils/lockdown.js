const { ChannelType, PermissionFlagsBits } = require("discord.js");

/**
 * @typedef {"channel"|"category"|"all"} LockdownScope
 */

/**
 * @typedef {"SendMessages"|"AddReactions"|"CreatePublicThreads"|"CreatePrivateThreads"|"SendMessageInThreads"} LockdownPermKey
 */

/**
 * @typedef {true|false|null} TriStatePerm
 */

/**
 * @typedef {Object} LockdownPermSpec
 * @property {LockdownPermKey} key
 * @property {bigint} bit
 */

/** @type {LockdownPermSpec[]} */
const LOCKDOWN_PERMS = [
  { key: "SendMessages", bit: PermissionFlagsBits.SendMessages },
  { key: "AddReactions", bit: PermissionFlagsBits.AddReactions },
  { key: "CreatePublicThreads", bit: PermissionFlagsBits.CreatePublicThreads },
  {
    key: "CreatePrivateThreads",
    bit: PermissionFlagsBits.CreatePrivateThreads,
  },
  {
    key: "SendMessagesInThreads",
    bit: PermissionFlagsBits.SendMessagesInThreads,
  },
];

/**
 * Decide whether a channel is a target for text lockdown
 * @param {import("discord.js").GuildBasedChannel} ch
 * @returns {boolean}
 */
function isLockableChannel(ch) {
  if (!ch) return false;
  return (
    ch.type === ChannelType.GuildText ||
    ch.type === ChannelType.GuildAnnouncement ||
    ch.type === ChannelType.GuildForum ||
    ch.type === ChannelType.GuildMedia
  );
}

/**
 * Get target channels based on scope
 * @param {import("discord.js").Guild} guild
 * @param {LockdownScope} scope
 * @param {import("discord.js").GuildBasedChannel} currentChannel
 * @returns {import("discord.js").GuildBasedChannel[]}
 */
function getTargetChannels(guild, scope, currentChannel) {
  if (scope === "channel") return [currentChannel].filter(isLockableChannel);

  if (scope === "category") {
    const parent = currentChannel.parent;
    if (!parent) return [];
    return parent.children.cache.filter(isLockableChannel).toJSON();
  }

  // scope === "all"
  return guild.channels.cache.filter(isLockableChannel).toJSON();
}

/**
 * Convert an existing overwrite into a tri-state value for a specific perm:
 * true=allow, false=deny, null=unset
 * @param {import("discord.js").PermissionOverwrites | undefined} ow
 * @param {bigint} permBit
 * @returns {TriStatePerm}
 */
function overwriteTriState(ow, permBit) {
  if (!ow) return null;
  if (ow.allow.has(permBit)) return true;
  if (ow.deny.has(permBit)) return false;
  return null;
}

/**
 * Build the "before" snapshot for @everyone on a channel (only for perms edited by client)
 * @param {import("discord.js").GuildBasedChannel} channel
 * @param {string} everyondId
 * @returns {Record<LockdownPermKey, TriStatePerm>}
 */
function getBeforeEveryone(channel, everyondId) {
  const ow = channel.permissionOverwrites?.cache.get(everyondId);

  /** @type {Record<LockdownPermKey, TriStatePerm>} */
  const before = /** @type {any} */ ({});

  for (const spec of LOCKDOWN_PERMS) {
    before[spec.key] = overwriteTriState(ow, spec.bit);
  }

  return before;
}

/**
 *
 * @param {import("discord.js").Guild} guild
 * @param {import("discord.js").GuildBasedChannel[]} channels
 * @param {string|null} reason
 * @param {string} actorTag
 * @returns {Promise<{ changed: Record<string, { channelId: string, channelName: string, before: Record<LockdownPermKey, TriStatePerm> }>, skipped: { channelId: string, channelName: string, reason: string }[] }>}
 */
async function applyLockdown(guild, channels, reason, actorTag) {
  const everyondId = guild.id;

  const me =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));

  /** @type {Record<string, { channelId: string, channelName: string, before: Record<LockdownPermKey, TriStatePerm> }>} */
  const changed = {};
  /** @type {{ channelId: string, channelName: string, reason: string }[]} */
  const skipped = [];

  // Build deny patch object (false = explicit deny)
  /** @type {Record<LockdownPermKey, false>} */
  const denyPatch = /** @type {any} */ ({});
  for (const spec of LOCKDOWN_PERMS) denyPatch[spec.key] = false;

  for (const ch of channels) {
    if (!isLockableChannel(ch)) continue;

    if (!me) {
      skipped.push({
        channelId: ch.id,
        channelName: ch.name ?? ch.id,
        reason: "Bot member not available",
      });
      continue;
    }

    const permsHere = ch.permissionsFor(me);
    if (!permsHere?.has(PermissionFlagsBits.ManageChannels)) {
      skipped.push({
        channelId: ch.id,
        channelName: ch.name ?? ch.id,
        reason: "Missing ManageChannels in channel",
      });
      continue;
    }

    const before = getBeforeEveryone(ch, everyondId);

    // Save snapshot first
    changed[ch.id] = {
      channelId: ch.id,
      channelName: ch.name ?? ch.id,
      before,
    };

    //Apply denies (merge; only these keys)
    await ch.permissionOverwrites
      .edit(everyondId, denyPatch, {
        reason: `AXIOM_LOCKDOWN enable by ${actorTag}${reason ? ` | ${reason}` : ""}`,
      })
      .catch((e) => {
        // If edit fails, remove from changed and mark skipped
        delete changed[ch.id];
        skipped.push({
          channelId: ch.id,
          channelName: ch.name ?? ch.id,
          reason: e?.message ?? "Failed to edit overwrites",
        });
      });
  }

  return { changed, skipped };
}

/**
 * Restore @everyone overwrites for channels using saved "before" values
 * @param {import("discord.js").Guild} guild
 * @param {{ channels: Record<string, { channelId: string, channelName: string, before: Record<LockdownPermKey, TriStatePerm> }> }} state
 * @param {string|null} reason
 * @param {string} actorTag
 * @returns {Promise<{ restored: string[], skipped: { channelId: string, channelName: string, reason: string }[] }>}
 */
async function restoreLockdown(guild, state, reason, actorTag) {
  const everyoneId = guild.id;
  const me =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));

  /** @type {string[]} */
  const restored = [];
  /** @type {{ channelId: string, channelName: string, reason: string }[]} */
  const skipped = [];

  for (const channelId of Object.keys(state.channels ?? {})) {
    const rec = state.channels[channelId];
    const ch = guild.channels.cache.get(channelId);

    if (!ch || !isLockableChannel(ch)) {
      skipped.push({
        channelId,
        channelName: rec?.channelName ?? channelId,
        reason: "Channel missing or not lockable",
      });
      continue;
    }

    if (!me) {
      skipped.push({
        channelId,
        channelName: ch.name ?? channelId,
        reason: "Bot member not available",
      });
      continue;
    }

    const permsHere = ch.permissionsFor(me);
    if (!permsHere?.has(PermissionFlagsBits.ManageChannels)) {
      skipped.push({
        channelId,
        channelName: ch.name ?? channelId,
        reason: "Missing ManageChannels in channel",
      });
      continue;
    }

    // Restore only the keys edited by client; values can be true/false/null
    /** @type {Record<LockdownPermKey, TriStatePerm>} */
    const restorePath = rec.before;

    await ch.permissionOverwrites
      .edit(everyoneId, restorePath, {
        reason: `AXIOM_LOCKDOWN disabled by ${actorTag}${reason ? ` | ${reason}` : ""}`,
      })
      .then(() => {
        restored.push(channelId);
      })
      .catch((e) => {
        skipped.push({
          channelId,
          channelName: ch.name ?? channelId,
          reason: e?.message ?? "Failed to restore overwrites",
        });
      });
  }

  return { restored, skipped };
}

module.exports = {
    LOCKDOWN_PERMS,
    isLockableChannel,
    getTargetChannels,
    applyLockdown,
    restoreLockdown
};
