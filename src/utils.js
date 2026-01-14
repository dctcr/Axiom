/**
 * @param {string} input Input to normalize
 * @returns {string} Returns answer normalized
 */
function normalize(input) {
  return input
    .toLowerCase()
    .normalize("NFD") // split accents
    .replace(/\p{Diacritic}/gu, "") // remove accents
    .replace(/[’'`.]/g, "") // apostrophes/periods/etc.
    .trim()
    .replace(/\s+/g, " "); // collapse whitespace
}

/**
 * @param {import("discord.js").Guild} guild Guild to pull members
 * @param {string} input Context to search member
 * @returns {Promise<import("discord.js").GuildMember | null>} Returns member if found
 */
async function resolveMember(guild, input) {
  const raw = input.trim();
  if (!raw) return null;

  // Normalize
  const needle = normalize(raw);

  // Mention or raw snowflake ID
  const idMatch = raw.match(/^<@!?(\d{17,20})>$|^(\d{17,20})$/);
  const id = idMatch?.[1] ?? idMatch?.[2];
  if (id) return guild.members.fetch(id).catch(() => null);

  // Cache mentions
  const cached =
    guild.members.cache.find((m) => normalize(m.displayName) === needle) ??
    guild.members.cache.find((m) => normalize(m.user.username) === needle) ??
    guild.members.cache.find((m) => normalize(m.user.globalName) === needle);

  if (cached) return cached;

  // API-backed search (query matches username + nicknames)
  const results = await guild.members
    .fetch({ query: raw, limit: 10 })
    .catch(() => null);
  if (!results || results.size === 0) return null;

  // Best match from results
  return (
    results.find((m) => normalize(m.displayName) === needle) ??
    results.find((m) => normalize(m.user.username) === needle) ??
    results.find((m) => normalize(m.user.globalName) === needle) ??
    results.first() ??
    null
  );
}

/**
 * @param {import("discord.js").Guild} guild Guild to search roles
 * @param {string} input Context to search role
 * @returns {Promise<import("discord.js").Role | null>} Returns role if found
 */
async function resolveRole(guild, input) {
  const raw = input.trim();
  if (!raw) return null;

  // Normalize
  const needle = normalize(raw);

  // Mention or raw snowflake ID
  const idMatch = raw.match(/^<@!?(\d{17,20})>$|^(\d{17,20})$/);
  const id = idMatch?.[1] ?? idMatch?.[2];
  if (id) return guild.roles.fetch(id).catch(() => null);

  // Cache mentions
  const cached =
    guild.roles.cache.find((r) => normalize(r.name) === needle) ??
    guild.roles.cache.find((r) => normalize(r.hexColor) === needle);

  if (cached) return cached;

  // API-backed search
  const results = await guild.roles
    .fetch({ query: raw, limit: 10 })
    .catch(() => null);
  if (!results || results.size === 0) return null;

  // Best match from results
  return (
    results.find((r) => normalize(r.name) === needle) ??
    results.find((r) => normalize(r.hexColor) === needle) ??
    results.first() ??
    null
  );
}

/**
 * @param {Date} date Date to format
 * @returns {string} Returns formatted Date
 */
function formatDate(date) {
  const months = {
    0: "Jan",
    1: "Feb",
    2: "Mar",
    3: "Apr",
    4: "May",
    5: "Jun",
    6: "Jul",
    7: "Aug",
    8: "Sep",
    9: "Oct",
    10: "Nov",
    11: "Dec",
  };

  return `${months[date.getMonth()]}, ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * @param {import("discord.js").PermissionsBitField} permissions Permissions to format
 * @param {import("discord.js").GuildMember} member Members' permissions to format (optional)
 * @returns {string} Returns formatted permissions
 */
function cleanPerms(permissions, member) {
  if (member === undefined) {
    if (permissions.has("Administrator", true)) return "All Permissions";
    else if (permissions.has("ManageGuild")) return "Manage Guild";
    else if (permissions.has("BanMembers")) return "Ban Members";
    else if (permissions.has("KickMembers")) return "Kick Members";
    else if (permissions.has("ManageRoles")) return "Manage Roles";
    else if (permissions.has("ManageMessages")) return "Manage Messages";
    else return "Basic Permissions";
  } else {
    if (member.guild.ownerId === member.id) return "Guild Owner";
  }
}

/**
 * @param {import("discord.js").Guild} guild Guild to sort through
 * @param {import("discord.js").GuildMember} member Member whose position to find
 * @returns {number} Members join position in the guild
 */
async function getJoinPosition(guild, member) {
  const members = await guild.members.fetch();

  const sorted = [...members.values()].sort((a, b) => {
    const aj = a.joinedTimestamp ?? 0;
    const bj = b.joinedTimestamp ?? 0;
    return aj - bj || a.id.localeCompare(b.id);
  });

  return sorted.findIndex((m) => m.id === member.id) + 1;
}

module.exports = {
  normalize,
  resolveMember,
  resolveRole,
  formatDate,
  cleanPerms,
  getJoinPosition
};