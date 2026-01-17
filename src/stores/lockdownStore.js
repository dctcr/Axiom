const { read } = require("fs");
const fs = require("fs/promises");
const path = require("path");

const STORE_PATH = path.join(__dirname, "lockdownState.json");

/**
 * @typedef {"channel"|"category"|"all"} LockdownScope
 */

/**
 * @typedef {"SendMessages"|"AddReactions"|"CreatePublicThreads"|"CreatePrivateThreads"|"SendMessageInThreads"} LockdownPermKey
 */

/**
 * @typedef {true|false|null} TriStatePerm
 * true = explicit allow
 * false = explicit deny
 * null = unset (inherit)
 */

/**
 * @typedef {Object} LockdownChannelRecord
 * @property {string} channelId
 * @property {string} channelName
 * @property {Record<LockdownPermKey, TriStatePerm>} before
 */

/**
 * @typedef {Object} GuildLockdownState
 * @property {boolean} active
 * @property {string} guildId
 * @property {LockdownScope} scope
 * @property {string} enabledBy
 * @property {number} enabledAt
 * @property {string|null} reason
 * @property {Record<string, LockdownChannelRecord>} channels
 */

/**
 * @typedef {Record<string, GuildLockdownState>} LockdownStoreFile
 */

/**
 * Read the whole store from disk
 * @returns {Promise<LockdownStoreFile>}
 */
async function readStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
    return {};
  } catch (err) {
    if (err && err.code === "ENOENT") return {};
    throw err;
  }
}

/**
 * Write the whole store to disk (atomic-ish)
 * @param {LockdownStoreFile} store
 */
async function writeStore(store) {
  const tmp = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf-8");
  await fs.rename(tmp, STORE_PATH);
}

/**
 * Get the lockdown state for a guild
 * @param {string} guildId
 * @returns {Promise<GuildLockdownState|null>}
 */
async function getGuildLockdownState(guildId) {
  const store = await readStore();
  return store[guildId] ?? null;
}

/**
 * Set/replace the lockdown state for a guild
 * @param {string} guildId
 * @param {GuildLockdownState} state
 * @returns {Promise<void>}
 */
async function setGuildLockdownState(guildId, state) {
  const store = await readStore();
  store[guildId] = state;
  await writeStore(store);
}

/**
 * Clear the lockdown state for a guild
 * @param {string} guildId
 * @param {GuildLockdownState} state
 */
async function clearGuildLockdownState(guildId, state) {
  const store = await readStore();
  if (store[guildId]) {
    delete store[guildId];
    await writeStore(store);
  }
}

module.exports = {
  getGuildLockdownState,
  setGuildLockdownState,
  clearGuildLockdownState,
};
