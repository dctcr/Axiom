const snipes = new Map();

function setSnipe(channelId, data) {
  snipes.set(channelId, data);
}

function getSnipe(channelId) {
  return snipes.get(channelId) ?? null;
}

module.exports = { setSnipe, getSnipe };
