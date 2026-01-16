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

/**
 * @param {string} input
 * @param {{min?: number, max?: number}} [cfg={}]
 * @returns {{ok: true, values: string[]} | {ok: false, error: string}}
 */
function parseCommaList(input, cfg = {}) {
  const min = cfg.min ?? 2;
  const max = cfg.max ?? 25;

  const values = input
    .split(", ")
    .map((s) => s.trim())
    .filter(Boolean);

  if (values.length < min) {
    return {
      ok: false,
      error: `Provide at least ${min}, or more options separated by commas.`,
    };
  }

  if (values.length > max) {
    return { ok: false, error: `Too many options: Maximum is ${max}` };
  }

  return { ok: true, values };
}

/**
 * @param {string} input
 * @param {{ minSpan?: number, maxSpan?: number }} [cfg]
 * @returns {{ ok: true, min: number, max: number } | { ok: false, error: string }}
 */
function parseNumberRange(input, cfg = {}) {
  const maxSpan = cfg.maxSpan ?? 1_000_000;

  const parts = input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length !== 2) {
    return { ok: false, error: `Use the format: \`1, 10\`` };
  }

  const a = Number(parts[0]);
  const b = Number(parts[1]);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return {
      ok: false,
      error: `Both values must be numbers. Example: \`1, 10\``,
    };
  }

  // integers only (change to Math.floor if you want to accept floats)
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return { ok: false, error: `Please use whole numbers. Example: \`1, 10\`` };
  }

  const min = Math.min(a, b);
  const max = Math.max(a, b);

  if (max - min > maxSpan) {
    return {
      ok: false,
      error: `Range is too large. Max span is ${maxSpan.toLocaleString()}.`,
    };
  }

  return { ok: true, min, max };
}

/**
 * @param {number} min
 * @param {number} max
 * @returns Returns random number from min-max range
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * @param {Array} arr
 * @returns Returns random element from array
 */
function pickOne(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * @param {string} value 
 * @returns {{ ok: true, hex: string, r: number, g: number, b: number, int: number } | { ok: false, error: string }}
 */
function parseHex(value) {
  let hex = String(value ?? "").trim().toLowerCase();
  if (hex.startsWith("0x")) hex = hex.slice(2);
  if (hex.startsWith("#")) hex = hex.slice(1);

  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/.test(hex)) {
    return { ok: false, error: "Hex must be like `#ff00ff` or `#f0f`." };
  }

  if (hex.length === 3) hex = hex.split("").map(ch => ch + ch).join("");

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  const outHex = `#${hex}`.toUpperCase();
  const int = (r << 16) + (g << 8) + b;

  return { ok: true, hex: outHex, r, g, b, int };
}

/**
 * @param {string} value 
 * @returns {{ ok: true, hex: string, r: number, g: number, b: number, int: number } | { ok: false, error: string }}
 */
function parseRgb(value) {
  const raw = String(value ?? "").trim();

  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length !== 3) {
    return { ok: false, error: "RGB must be `r,g,b` (example: `255, 0, 255`)." };
  }

  const nums = parts.map(n => Number(n));
  if (nums.some(n => !Number.isFinite(n))) {
    return { ok: false, error: "RGB values must be numbers (0-255)." };
  }
  if (nums.some(n => !Number.isInteger(n))) {
    return { ok: false, error: "RGB values must be whole numbers (0-255)." };
  }

  let [r, g, b] = nums;
  if ([r, g, b].some(n => n < 0 || n > 255)) {
    return { ok: false, error: "RGB values must be between 0 and 255." };
  }

  const hex = `#${[r, g, b].map(n => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  const int = (r << 16) + (g << 8) + b;

  return { ok: true, hex, r, g, b, int };
}

module.exports = {
  normalize,
  resolveMember,
  resolveRole,
  formatDate,
  cleanPerms,
  getJoinPosition,
  parseCommaList,
  parseNumberRange,
  randInt,
  pickOne,
  parseHex,
  parseRgb
};
