import crypto, { randomUUID } from "crypto";
import { config } from "../../config";
import { readDb, writeDb } from "../../infra/db";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function tokenHash(plain: string): string {
  return sha256(`${config.tokenPepper}:${plain}`);
}

export function generateToken(): { token: string; recordId: string } {
  const db = readDb();
  const token = `ox_live_${crypto.randomBytes(24).toString("base64url")}`;
  const now = new Date().toISOString();
  const id = randomUUID();
  db.apiTokens.push({
    id,
    label: "client",
    tokenPrefix: token.slice(0, 18),
    tokenHash: tokenHash(token),
    scopes: ["sync", "proxy"],
    revokedAt: null,
    createdAt: now,
    lastUsedAt: null
  });
  writeDb(db);
  return { token, recordId: id };
}

export function createLabeledToken(label: string, scopes: string[]): { token: string; meta: any } {
  const db = readDb();
  const token = `ox_live_${crypto.randomBytes(24).toString("base64url")}`;
  const now = new Date().toISOString();
  const id = randomUUID();
  const rec = {
    id,
    label,
    tokenPrefix: token.slice(0, 18),
    tokenHash: tokenHash(token),
    scopes,
    revokedAt: null as string | null,
    createdAt: now,
    lastUsedAt: null as string | null
  };
  db.apiTokens.push(rec);
  writeDb(db);
  return { token, meta: rec };
}

export function findTokenRecord(plainToken: string) {
  const db = readDb();
  const hash = tokenHash(plainToken.trim());
  return db.apiTokens.find((x) => x.tokenHash === hash) || null;
}

export function touchToken(id: string): void {
  const db = readDb();
  const token = db.apiTokens.find((x) => x.id === id);
  if (!token) return;
  token.lastUsedAt = new Date().toISOString();
  writeDb(db);
}

export function listTokens() {
  const db = readDb();
  return db.apiTokens.map((t) => ({
    id: t.id,
    label: t.label,
    tokenPrefix: t.tokenPrefix,
    scopes: t.scopes,
    revokedAt: t.revokedAt,
    createdAt: t.createdAt,
    lastUsedAt: t.lastUsedAt
  }));
}

export function revokeToken(id: string) {
  const db = readDb();
  const token = db.apiTokens.find((t) => t.id === id);
  if (!token) return null;
  token.revokedAt = new Date().toISOString();
  writeDb(db);
  return token;
}

