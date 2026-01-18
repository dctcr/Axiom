const fs = require("fs/promises");
const path = require("path");

const STORE_PATH = path.join(__dirname, "modState.json");

/**
 * Moderation action types (expand freely later)
 * @typedef {"KICK"|"BAN"|"UNBAN"|"MUTE"|"UNMUTE"|"WARN"|"UNWARN"} ModActionType
 */

/**
 * Success state for an action
 * @typedef {true|false|null} ModActionSuccess
 * true = succeeded
 * false = failed
 * null = pending/unknown (useful during confirmation)
 */

/**
 * Optional action metadata (use what you need)
 * @typedef {Object} ModActionMeta
 * @property {string=} channelId    Channel where the command was run
 * @property {string=} messageId    Message ID related
 * @property {string=} context      Free-form context (e.g., "SlashCommand /kick")
 * @property {number=} durationMs   Duration (for temp mute/ban)
 * @property {number=} expiresAt    Timestamp when temp action expires
 * @property {number=} revokedAt    Timestamp when action was revoked
 * @property {string=} revokedBy    User ID who revoked it
 */

/**
 * Moderation case record
 * @typedef {Object} ModCase
 * @property {number} caseId
 * @property {string} guildId
 * @property {ModActionType} action
 * @property {string} targetId
 * @property {string} moderatorId
 * @property {string|null} reason
 * @property {number} createdAt
 * @property {ModActionSuccess} success
 * @property {string|null} error
 * @property {ModActionMeta} meta
 */

/**
 * Per-guild store segment
 * @typedef {Object} GuildModState
 * @property {number} nextCaseId
 * @property {ModCase[]} cases
 */

/**
 * File shape on disk
 * @typedef {Record<string, GuildModState>} ModStoreFile
 */

const MAX_CASES_PER_GUILD = 5000;

// Serialize read-modify-write operations
let writeQueue = Promise.resolve();

/**
 * Read the moderation store from disk.
 * Recovers safely if the file is empty/corrupt (returns {}).
 * @returns {Promise<ModStoreFile>}
 */
async function readStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");

    // If file exists but is empty/whitespace, treat as empty store.
    if (!raw || !raw.trim()) return {};

    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (parseErr) {
      // Corrupt or truncated JSON — recover by backing it up.
      const badPath = `${STORE_PATH}.bad-${Date.now()}`;
      await fs.writeFile(badPath, raw, "utf-8").catch(() => {});
      // Start fresh (prevents crashing).
      return {};
    }
  } catch (err) {
    if (err && err.code === "ENOENT") return {};
    throw err;
  }
}

/**
 * Write the moderation store to disk (atomic-ish)
 * @param {ModStoreFile} store Store object to write
 * @returns {Promise<void>}
 */
async function writeStore(store) {
  const tmp = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
  await fs.rename(tmp, STORE_PATH);
}

/**
 * Get or initialize a guild segment
 * @param {ModStoreFile} store
 * @param {string} guildId
 * @returns {GuildModState}
 */
function ensureGuild(store, guildId) {
  if (!store[guildId]) store[guildId] = { nextCaseId: 1, cases: [] };
  return store[guildId];
}

/**
 * Run a store update in a serialized queue
 * @template T
 * @param {(store: ModStoreFile) => Promise<T>} fn Async update function
 * @returns {Promise<T>}
 */
function withStoreLock(fn) {
  writeQueue = writeQueue.then(async () => {
    const store = await readStore();
    const result = await fn(store);
    await writeStore(store);
    return result;
  });
  return writeQueue;
}

/**
 * Create a new moderation case for a guild
 * @param {string} guildId Guild ID
 * @param {Omit<ModCase, "caseId"|"guildId"|"createdAt"> & Partial<Pick<ModCase, "createdAt">>} data Case data
 * @returns {Promise<ModCase>} The created case with assigned caseId
 */
async function createCase(guildId, data) {
  return withStoreLock(async (store) => {
    const g = ensureGuild(store, guildId);

    /** @type {ModCase} */
    const entry = {
      caseId: g.nextCaseId++,
      guildId,
      action: data.action,
      targetId: data.targetId,
      moderatorId: data.moderatorId,
      reason: data.reason ?? null,
      createdAt: data.createdAt ?? Date.now(),
      success: data.success ?? null,
      error: data.error ?? null,
      meta: data.meta ?? {},
    };

    g.cases.push(entry);

    if (g.cases.length > MAX_CASES_PER_GUILD) {
      g.cases = g.cases.slice(-MAX_CASES_PER_GUILD);
    }

    return entry;
  });
}

/**
 * Update an existing moderation case
 * @param {string} guildId Guild ID
 * @param {number} caseId  Case ID to update
 * @param {Partial<Pick<ModCase, "reason"|"success"|"error"|"meta">>} patch Patch fields
 * @returns {Promise<ModCase|null>} Updated case, or null if missing
 */
async function updateCase(guildId, caseId, patch) {
  return withStoreLock(async (store) => {
    const g = store[guildId];
    if (!g) return null;

    const idx = g.cases.findIndex((c) => c.caseId === caseId);
    if (idx === -1) return null;

    const cur = g.cases[idx];
    const next = {
      ...cur,
      ...patch,
      meta: { ...(cur.meta ?? {}), ...(patch.meta ?? {}) },
    };

    g.cases[idx] = next;
    return next;
  });
}

/**
 * Get a single case by ID
 * @param {string} guildId Guild ID
 * @param {number} caseId Case ID
 * @returns {Promise<ModCase|null>} Case or null
 */
async function getCase(guildId, caseId) {
  const store = await readStore();
  const g = store[guildId];
  if (!g) return null;
  return g.cases.find((c) => c.caseId === caseId) ?? null;
}

/**
 * List recent cases
 * @param {string} guildId Guild ID
 * @param {{ limit?: number, targetId?: string, action?: ModActionType }} opts List options
 * @returns {Promise<ModCase[]>} Matching cases newest-first
 */
async function listCases(guildId, opts = {}) {
  const { limit = 10, targetId, action } = opts;
  const store = await readStore();
  const g = store[guildId];
  if (!g) return [];

  let arr = g.cases;
  if (targetId) arr = arr.filter((c) => c.targetId === targetId);
  if (action) arr = arr.filter((c) => c.action === action);

  return arr
    .slice()
    .sort((a, b) => b.caseId - a.caseId)
    .slice(0, limit);
}

module.exports = {
  createCase,
  updateCase,
  getCase,
  listCases,
};
