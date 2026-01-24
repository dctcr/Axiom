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
    invokerCanActOnTarget
};