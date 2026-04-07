const crypto = require("crypto");
const { randomUUID } = require("crypto");
const { tokenPepper } = require("../config");
const { readDb, writeDb } = require("../storage/db");

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function buildTokenHash(plainToken) {
  return sha256(`${tokenPepper}:${plainToken}`);
}

function makeTokenPrefix(plainToken) {
  return plainToken.slice(0, 18);
}

function generatePlainToken() {
  const raw = crypto.randomBytes(24).toString("base64url");
  return `ox_live_${raw}`;
}

function createApiToken(input = {}) {
  const db = readDb();
  const plainToken = generatePlainToken();
  const now = new Date().toISOString();

  const record = {
    id: randomUUID(),
    label: String(input.label || "client").trim(),
    tokenPrefix: makeTokenPrefix(plainToken),
    tokenHash: buildTokenHash(plainToken),
    scopes: Array.isArray(input.scopes) ? input.scopes : ["sync", "proxy"],
    revokedAt: null,
    createdAt: now,
    lastUsedAt: null
  };

  db.apiTokens.push(record);
  writeDb(db);

  return {
    token: plainToken,
    record
  };
}

function findTokenRecordByPlainToken(plainToken) {
  const db = readDb();
  const hash = buildTokenHash(String(plainToken || "").trim());
  return db.apiTokens.find((t) => t.tokenHash === hash) || null;
}

function touchTokenLastUsed(tokenId) {
  const db = readDb();
  const token = db.apiTokens.find((t) => t.id === tokenId);
  if (!token) return;
  token.lastUsedAt = new Date().toISOString();
  writeDb(db);
}

function revokeToken(tokenId) {
  const db = readDb();
  const token = db.apiTokens.find((t) => t.id === tokenId);
  if (!token) return null;
  token.revokedAt = new Date().toISOString();
  writeDb(db);
  return token;
}

function listTokens() {
  const db = readDb();
  return db.apiTokens.map((t) => ({
    id: t.id,
    label: t.label,
    tokenPrefix: t.tokenPrefix,
    scopes: t.scopes || [],
    revokedAt: t.revokedAt,
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt
  }));
}

module.exports = {
  createApiToken,
  findTokenRecordByPlainToken,
  touchTokenLastUsed,
  revokeToken,
  listTokens
};

