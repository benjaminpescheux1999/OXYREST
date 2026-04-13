import crypto, { randomUUID } from "crypto";
import { config } from "../../config";
import {
  ensureTokenStore,
  pgCreateToken,
  pgFindByHash,
  pgListTokens,
  pgRevokeToken,
  pgTouchToken
} from "../../infra/token-store";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function tokenHash(plain: string): string {
  return sha256(`${config.tokenPepper}:${plain}`);
}

export function generateToken(): { token: string; recordId: string } {
  const token = `ox_live_${crypto.randomBytes(24).toString("base64url")}`;
  const now = new Date().toISOString();
  const id = randomUUID();
  void now;
  // Legacy helper kept for completeness; Postgres-only mode uses createLabeledToken().
  return { token, recordId: id };
}

export async function createLabeledToken(label: string, scopes: string[], folders: string[] = []): Promise<{ token: string; meta: any }> {
  const token = `ox_live_${crypto.randomBytes(24).toString("base64url")}`;
  const now = new Date().toISOString();
  const id = randomUUID();
  const rec = {
    id,
    label,
    folders,
    tokenPrefix: token.slice(0, 18),
    tokenHash: tokenHash(token),
    scopes,
    revokedAt: null as string | null,
    createdAt: now,
    lastUsedAt: null as string | null
  };
  await ensureTokenStore();
  await pgCreateToken(rec);
  return { token, meta: rec };
}

export async function findTokenRecord(plainToken: string) {
  const hash = tokenHash(plainToken.trim());
  await ensureTokenStore();
  const row = await pgFindByHash(hash);
  if (!row) return null;
  return {
    id: String(row.id),
    label: String(row.label),
    folders: Array.isArray(row.folders) ? row.folders.map(String) : [],
    tokenPrefix: String(row.token_prefix),
    tokenHash: String(row.token_hash),
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null
  };
}

export async function touchToken(id: string): Promise<void> {
  await ensureTokenStore();
  await pgTouchToken(id);
}

export async function listTokens() {
  await ensureTokenStore();
  const rows = await pgListTokens();
  return rows.map((t) => ({
    id: String(t.id),
    label: String(t.label),
    folders: Array.isArray(t.folders) ? t.folders.map(String) : [],
    tokenPrefix: String(t.token_prefix),
    scopes: Array.isArray(t.scopes) ? t.scopes.map(String) : [],
    revokedAt: t.revoked_at ? new Date(t.revoked_at).toISOString() : null,
    createdAt: new Date(t.created_at).toISOString(),
    lastUsedAt: t.last_used_at ? new Date(t.last_used_at).toISOString() : null
  }));
}

export async function revokeToken(id: string) {
  await ensureTokenStore();
  const row = await pgRevokeToken(id);
  if (!row) return null;
  return {
    id: String(row.id),
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null
  };
}

