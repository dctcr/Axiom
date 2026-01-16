const MAX_DEPTH = 5;

// Depth-based TTLs: newest gets longest
const TTL_MS = [
  5 * 60 * 1000, // 1st: 5 min
  2.5 * 60 * 1000, // 2nd: 2.5 min
  1 * 60 * 1000, // 3rd: 1 min
  30 * 1000, // 4th: 30 sec
  15 * 1000, // 5th: 15 sec
];

/**
 * @typedef {Object} SnipeEntry
 * @property {string} channelId
 * @property {string} authorId
 * @property {string} authorTag
 * @property {string} avatarURL
 * @property {string} content
 * @property {number} createdAt
 * @property {number} deletedAt
 * @property {number} expiresAt
 * @property {{ url: string, name?: string, contentType?: string}} attachments
 */
const snipes = new Map();

function cleanup(channelId) {
  const arr = snipes.get(channelId);
  if (!arr?.length) return [];

  const now = Date.now();
  const kept = arr.filter((e) => now <= e.expiresAt);

  if (kept.length) snipes.set(channelId, kept);
  else snipes.delete(channelId);

  return kept;
}

/**
 * Insert a new deleted message. Keeps only MAX_DEPTH and assigns expiresAt by depth index.
 * @param {string} channelId
 * @param {Omit<SnipeEntry, "expiresAt">} entry
 */
function pushSnipe(channelId, entry) {
  const arr = cleanup(channelId);
  arr.unshift({ ...entry, expiresAt: 0 });

  // Trim
  arr.splice(MAX_DEPTH);

  // Recompute expiresAt based on CURRENT index
  for (let i = 0; i < arr.length; i++) {
    arr[i].expiresAt = arr[i].deletedAt + TTL_MS[i];
  }

  snipes.set(channelId, arr);
}

/**
 * Get a snipe by depth (1..5). Returns null if missing/expired.
 * @param {string} channelId
 * @param {number} depth
 * @returns {SnipeEntry | null}
 */
function getSnipe(channelId, depth = 1) {
  const arr = cleanup(channelId);
  const idx = Math.max(1, Math.min(MAX_DEPTH, depth)) - 1;
  return arr[idx] ?? null;
}

module.exports = {
  pushSnipe,
  getSnipe,
  _snipes: snipes,
};
