const crypto = require("crypto");

/**
 * Pending kick confirmation payload
 * @typedef {Object} PendingKick
 * @property {"KICK"} type
 * @property {string} token
 * @property {string} guildId
 * @property {string} channelId
 * @property {string} moderatorId
 * @property {string} targetId
 * @property {string|null} reason
 * @property {boolean} silent
 * @property {number} createdAt
 * @property {number} expiresAt
 */

const pending = new Map();

/**
 * Create a pending kick action
 * @param {Omit<PendingKick,"token"|"type"|"createdAt"> & Partial<Pick<PendingKick,"createdAt">>} data Pending data
 * @returns {PendingKick} Pending record (includes token)
 */
function createPendingKick(data) {
  const token = crypto.randomUUID();
  const now = data.createdAt ?? Date.now();

  /** @type {PendingKick} */
  const rec = {
    type: "KICK",
    token,
    guildId: data.guildId,
    channelId: data.channelId,
    moderatorId: data.moderatorId,
    targetId: data.targetId,
    reason: data.reason ?? null,
    silent: Boolean(data.silent),
    createdAt: now,
    expiresAt: data.expiresAt,
  };

  pending.set(token, rec);
  return rec;
}

/**
 * Get a pending action if it exists and is not expired
 * @param {string} token Pending token
 * @returns {PendingKick|null}
 */
function getPending(token) {
  const rec = pending.get(token) ?? null;
  if (!rec) return null;

  if (Date.now() > rec.expiresAt) {
    pending.delete(token);
    return null;
  }

  return rec;
}

/**
 * Remove and return a pending action
 * @param {string} token Pending token
 * @returns {PendingKick|null}
 */
function consumePending(token) {
  const rec = getPending(token);
  if (!rec) return null;
  pending.delete(token);
  return rec;
}

module.exports = {
  createPendingKick,
  getPending,
  consumePending,
};
