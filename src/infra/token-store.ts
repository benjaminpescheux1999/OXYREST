import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { config } from "../config";

let db: Database.Database | null = null;

export function resolveDatabaseFilePath(): string {
  const explicit = (config.databasePath || "").trim();
  if (explicit) return explicit;
  return path.join(config.dataDir, "oxyrest.db");
}

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getDb(): Database.Database {
  if (db) return db;
  const dbPath = resolveDatabaseFilePath();
  ensureDirForFile(dbPath);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function jsonParseArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export async function ensureTokenStore(): Promise<void> {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      token_prefix TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      scopes_json TEXT NOT NULL,
      revoked_at TEXT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens (token_hash);
  `);
}

export async function ensureUtilityClientStore(): Promise<void> {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS utilities (
      id TEXT PRIMARY KEY,
      access_key TEXT NOT NULL,
      token_id TEXT NOT NULL UNIQUE,
      utility_version TEXT NOT NULL,
      api_version TEXT NOT NULL,
      tunnel_url TEXT NULL,
      capabilities_json TEXT NOT NULL,
      selected_features_json TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      client_token TEXT NOT NULL UNIQUE,
      utility_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (utility_id) REFERENCES utilities(id) ON DELETE CASCADE
    );
  `);
}

export async function pgCreateToken(input: {
  id: string;
  label: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  createdAt: string;
}): Promise<void> {
  await ensureTokenStore();
  const d = getDb();
  d.prepare(
    `INSERT INTO api_tokens (id, label, token_prefix, token_hash, scopes_json, revoked_at, created_at, last_used_at)
     VALUES (@id, @label, @tokenPrefix, @tokenHash, @scopesJson, NULL, @createdAt, NULL)`
  ).run({
    id: input.id,
    label: input.label,
    tokenPrefix: input.tokenPrefix,
    tokenHash: input.tokenHash,
    scopesJson: JSON.stringify(input.scopes ?? []),
    createdAt: input.createdAt
  });
}

export async function pgFindByHash(tokenHash: string) {
  await ensureTokenStore();
  const d = getDb();
  const row = d.prepare(
    `SELECT id, label, token_prefix, token_hash, scopes_json, revoked_at, created_at, last_used_at
     FROM api_tokens WHERE token_hash = ? LIMIT 1`
  ).get(tokenHash) as any;
  if (!row) return null;
  return {
    id: row.id,
    label: row.label,
    token_prefix: row.token_prefix,
    token_hash: row.token_hash,
    scopes: jsonParseArray(row.scopes_json),
    revoked_at: row.revoked_at,
    created_at: row.created_at,
    last_used_at: row.last_used_at
  };
}

export async function pgTouchToken(id: string): Promise<void> {
  await ensureTokenStore();
  const d = getDb();
  d.prepare(`UPDATE api_tokens SET last_used_at = ? WHERE id = ?`).run(new Date().toISOString(), id);
}

export async function pgListTokens() {
  await ensureTokenStore();
  const d = getDb();
  const rows = d.prepare(
    `SELECT id, label, token_prefix, scopes_json, revoked_at, created_at, last_used_at
     FROM api_tokens ORDER BY created_at DESC`
  ).all() as any[];
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    token_prefix: r.token_prefix,
    scopes: jsonParseArray(r.scopes_json),
    revoked_at: r.revoked_at,
    created_at: r.created_at,
    last_used_at: r.last_used_at
  }));
}

export async function pgRevokeToken(id: string) {
  await ensureTokenStore();
  const d = getDb();
  const now = new Date().toISOString();
  const info = d.prepare(
    `UPDATE api_tokens SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?`
  ).run(now, id);
  if (info.changes === 0) return null;
  const row = d.prepare(`SELECT id, revoked_at FROM api_tokens WHERE id = ?`).get(id) as any;
  return row ? { id: row.id, revoked_at: row.revoked_at } : null;
}

export async function pgUpsertUtility(input: {
  id: string;
  accessKey: string;
  tokenId: string;
  utilityVersion: string;
  apiVersion: string;
  tunnelUrl: string | null;
  capabilities: Record<string, unknown>;
  selectedFeatures: string[];
  nowIso: string;
}): Promise<void> {
  await ensureUtilityClientStore();
  const d = getDb();
  d.prepare(
    `INSERT INTO utilities (
       id, access_key, token_id, utility_version, api_version, tunnel_url,
       capabilities_json, selected_features_json, last_seen_at, created_at
     ) VALUES (
       @id, @accessKey, @tokenId, @utilityVersion, @apiVersion, @tunnelUrl,
       @capabilitiesJson, @selectedFeaturesJson, @nowIso, @nowIso
     )
     ON CONFLICT(token_id) DO UPDATE SET
       access_key = excluded.access_key,
       utility_version = excluded.utility_version,
       api_version = excluded.api_version,
       tunnel_url = excluded.tunnel_url,
       capabilities_json = excluded.capabilities_json,
       selected_features_json = excluded.selected_features_json,
       last_seen_at = excluded.last_seen_at`
  ).run({
    id: input.id,
    accessKey: input.accessKey,
    tokenId: input.tokenId,
    utilityVersion: input.utilityVersion,
    apiVersion: input.apiVersion,
    tunnelUrl: input.tunnelUrl ?? null,
    capabilitiesJson: JSON.stringify(input.capabilities ?? {}),
    selectedFeaturesJson: JSON.stringify(input.selectedFeatures ?? []),
    nowIso: input.nowIso
  });
}

export async function pgGetUtilityByTokenId(tokenId: string) {
  await ensureUtilityClientStore();
  const d = getDb();
  return d.prepare(
    `SELECT id, access_key, token_id, utility_version, api_version, tunnel_url,
            capabilities_json, selected_features_json, last_seen_at, created_at
     FROM utilities WHERE token_id = ? LIMIT 1`
  ).get(tokenId) as any;
}

export async function pgGetUtilityById(utilityId: string) {
  await ensureUtilityClientStore();
  const d = getDb();
  return d.prepare(
    `SELECT id, access_key, token_id, utility_version, api_version, tunnel_url,
            capabilities_json, selected_features_json, last_seen_at, created_at
     FROM utilities WHERE id = ? LIMIT 1`
  ).get(utilityId) as any;
}

export async function pgBindClientToken(input: {
  id: string;
  clientToken: string;
  utilityId: string;
  nowIso: string;
}) {
  await ensureUtilityClientStore();
  const d = getDb();
  d.prepare(
    `INSERT INTO clients (id, client_token, utility_id, created_at, updated_at)
     VALUES (@id, @clientToken, @utilityId, @nowIso, @nowIso)
     ON CONFLICT(client_token) DO UPDATE SET
       utility_id = excluded.utility_id,
       updated_at = excluded.updated_at`
  ).run({
    id: input.id,
    clientToken: input.clientToken,
    utilityId: input.utilityId,
    nowIso: input.nowIso
  });
  return d.prepare(
    `SELECT id, client_token, utility_id, created_at, updated_at
     FROM clients WHERE client_token = ? LIMIT 1`
  ).get(input.clientToken) as any;
}

export async function pgResolveUtilityFromClientToken(clientToken: string) {
  await ensureUtilityClientStore();
  const d = getDb();
  return d.prepare(
    `SELECT u.id, u.access_key, u.token_id, u.utility_version, u.api_version, u.tunnel_url,
            u.capabilities_json, u.selected_features_json, u.last_seen_at, u.created_at
     FROM clients c
     JOIN utilities u ON u.id = c.utility_id
     WHERE c.client_token = ?
     LIMIT 1`
  ).get(clientToken) as any;
}
