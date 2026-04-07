const { randomUUID } = require("crypto");
const { readDb, writeDb } = require("../storage/db");

function sanitizeAccessKey(accessKey) {
  return String(accessKey || "").trim();
}

function getUtilityByAccessKey(accessKey) {
  const db = readDb();
  const key = sanitizeAccessKey(accessKey);
  return db.utilities.find((u) => u.tokenId === key || u.accessKey === key) || null;
}

function upsertUtility(input) {
  const db = readDb();
  const key = sanitizeAccessKey(input.accessKey);
  const now = new Date().toISOString();
  const existing = db.utilities.find((u) => u.tokenId === input.tokenId);

  if (existing) {
    existing.utilityVersion = input.utilityVersion;
    existing.apiVersion = input.apiVersion;
    existing.accessKey = key;
    existing.tokenId = input.tokenId;
    existing.tunnelUrl = input.tunnelUrl || existing.tunnelUrl || null;
    existing.lastSeenAt = now;
    existing.capabilities = input.capabilities || existing.capabilities || {};
    existing.selectedFeatures = Array.isArray(input.selectedFeatures) ? input.selectedFeatures : existing.selectedFeatures || [];
    writeDb(db);
    return existing;
  }

  const created = {
    id: randomUUID(),
    accessKey: key,
    tokenId: input.tokenId,
    utilityVersion: input.utilityVersion,
    apiVersion: input.apiVersion,
    tunnelUrl: input.tunnelUrl || null,
    capabilities: input.capabilities || {},
    selectedFeatures: Array.isArray(input.selectedFeatures) ? input.selectedFeatures : [],
    lastSeenAt: now,
    createdAt: now
  };
  db.utilities.push(created);
  writeDb(db);
  return created;
}

function bindClientToUtility(clientToken, accessKey) {
  const db = readDb();
  const key = sanitizeAccessKey(accessKey);
  const utility = db.utilities.find((u) => u.accessKey === key || u.tokenId === key);
  if (!utility) return null;

  const now = new Date().toISOString();
  const existing = db.clients.find((c) => c.clientToken === clientToken);
  if (existing) {
    existing.utilityId = utility.id;
    existing.updatedAt = now;
    writeDb(db);
    return { client: existing, utility };
  }

  const client = {
    id: randomUUID(),
    clientToken,
    utilityId: utility.id,
    createdAt: now,
    updatedAt: now
  };
  db.clients.push(client);
  writeDb(db);
  return { client, utility };
}

function resolveUtilityFromClientToken(clientToken) {
  const db = readDb();
  const client = db.clients.find((c) => c.clientToken === clientToken);
  if (!client) return null;
  const utility = db.utilities.find((u) => u.id === client.utilityId);
  return utility || null;
}

module.exports = {
  getUtilityByAccessKey,
  upsertUtility,
  bindClientToUtility,
  resolveUtilityFromClientToken
};

