import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { config } from "../config";
import { randomUUID } from "crypto";

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

function hasColumn(table: string, column: string): boolean {
  const d = getDb();
  const rows = d.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => String(r.name || "").toLowerCase() === column.toLowerCase());
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
      exposure_provider TEXT NOT NULL DEFAULT 'cloudflare',
      capabilities_json TEXT NOT NULL,
      selected_features_json TEXT NOT NULL,
      selected_folders_json TEXT NOT NULL DEFAULT '[]',
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
  if (!hasColumn("utilities", "selected_folders_json")) {
    d.exec(`ALTER TABLE utilities ADD COLUMN selected_folders_json TEXT NOT NULL DEFAULT '[]';`);
  }
  if (!hasColumn("utilities", "exposure_provider")) {
    d.exec(`ALTER TABLE utilities ADD COLUMN exposure_provider TEXT NOT NULL DEFAULT 'cloudflare';`);
  }
}

export async function ensureEspaceClientAuthStore(): Promise<void> {
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS espace_client_accounts (
      id TEXT PRIMARY KEY,
      utility_id TEXT NOT NULL,
      client_code TEXT NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(utility_id, client_code),
      UNIQUE(utility_id, username),
      FOREIGN KEY (utility_id) REFERENCES utilities(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_espace_client_accounts_utility ON espace_client_accounts (utility_id);

    CREATE TABLE IF NOT EXISTS espace_client_sessions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      refresh_token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT NULL,
      ip_address TEXT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES espace_client_accounts(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_espace_client_sessions_account ON espace_client_sessions (account_id);
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
  exposureProvider: string;
  capabilities: Record<string, unknown>;
  selectedFeatures: string[];
  selectedFolders: string[];
  nowIso: string;
}): Promise<void> {
  await ensureUtilityClientStore();
  const d = getDb();
  d.prepare(
    `INSERT INTO utilities (
       id, access_key, token_id, utility_version, api_version, tunnel_url,
       exposure_provider,
       capabilities_json, selected_features_json, selected_folders_json, last_seen_at, created_at
     ) VALUES (
       @id, @accessKey, @tokenId, @utilityVersion, @apiVersion, @tunnelUrl,
       @exposureProvider,
       @capabilitiesJson, @selectedFeaturesJson, @selectedFoldersJson, @nowIso, @nowIso
     )
     ON CONFLICT(token_id) DO UPDATE SET
       access_key = excluded.access_key,
       utility_version = excluded.utility_version,
       api_version = excluded.api_version,
       tunnel_url = excluded.tunnel_url,
       exposure_provider = excluded.exposure_provider,
       capabilities_json = excluded.capabilities_json,
       selected_features_json = excluded.selected_features_json,
       selected_folders_json = excluded.selected_folders_json,
       last_seen_at = excluded.last_seen_at`
  ).run({
    id: input.id,
    accessKey: input.accessKey,
    tokenId: input.tokenId,
    utilityVersion: input.utilityVersion,
    apiVersion: input.apiVersion,
    tunnelUrl: input.tunnelUrl ?? null,
    exposureProvider: input.exposureProvider || "cloudflare",
    capabilitiesJson: JSON.stringify(input.capabilities ?? {}),
    selectedFeaturesJson: JSON.stringify(input.selectedFeatures ?? []),
    selectedFoldersJson: JSON.stringify(input.selectedFolders ?? []),
    nowIso: input.nowIso
  });
}

export async function pgGetUtilityByTokenId(tokenId: string) {
  await ensureUtilityClientStore();
  const d = getDb();
  return d.prepare(
    `SELECT id, access_key, token_id, utility_version, api_version, tunnel_url, exposure_provider,
            capabilities_json, selected_features_json, selected_folders_json, last_seen_at, created_at
     FROM utilities WHERE token_id = ? LIMIT 1`
  ).get(tokenId) as any;
}

export async function pgGetUtilityById(utilityId: string) {
  await ensureUtilityClientStore();
  const d = getDb();
  return d.prepare(
    `SELECT id, access_key, token_id, utility_version, api_version, tunnel_url, exposure_provider,
            capabilities_json, selected_features_json, selected_folders_json, last_seen_at, created_at
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

export async function pgDeleteClientTokensForUtility(utilityId: string): Promise<number> {
  await ensureUtilityClientStore();
  const d = getDb();
  const info = d.prepare(`DELETE FROM clients WHERE utility_id = ?`).run(utilityId);
  return Number(info.changes || 0);
}

export async function pgRotateClientToken(input: {
  utilityId: string;
  newClientToken: string;
  nowIso: string;
}): Promise<{ deletedCount: number; bound: any }> {
  await ensureUtilityClientStore();
  const d = getDb();
  const tx = d.transaction(() => {
    const del = d.prepare(`DELETE FROM clients WHERE utility_id = ?`).run(input.utilityId);
    const created = d.prepare(
      `INSERT INTO clients (id, client_token, utility_id, created_at, updated_at)
       VALUES (@id, @clientToken, @utilityId, @nowIso, @nowIso)
       ON CONFLICT(client_token) DO UPDATE SET
         utility_id = excluded.utility_id,
         updated_at = excluded.updated_at`
    ).run({
      id: randomUUID(),
      clientToken: input.newClientToken,
      utilityId: input.utilityId,
      nowIso: input.nowIso
    });
    void created;
    const row = d.prepare(
      `SELECT id, client_token, utility_id, created_at, updated_at
       FROM clients WHERE client_token = ? LIMIT 1`
    ).get(input.newClientToken) as any;
    return { deletedCount: Number(del.changes || 0), bound: row };
  });
  return tx();
}

export async function pgResolveUtilityFromClientToken(clientToken: string) {
  await ensureUtilityClientStore();
  const d = getDb();
  return d.prepare(
    `SELECT u.id, u.access_key, u.token_id, u.utility_version, u.api_version, u.tunnel_url, u.exposure_provider,
            u.capabilities_json, u.selected_features_json, u.selected_folders_json, u.last_seen_at, u.created_at
     FROM clients c
     JOIN utilities u ON u.id = c.utility_id
     WHERE c.client_token = ?
     LIMIT 1`
  ).get(clientToken) as any;
}

export async function pgUpsertEspaceClientAccount(input: {
  utilityId: string;
  clientCode: string;
  username: string;
  passwordHash: string;
  nowIso: string;
}) {
  await ensureEspaceClientAuthStore();
  const d = getDb();
  d.prepare(
    `INSERT INTO espace_client_accounts (id, utility_id, client_code, username, password_hash, created_at, updated_at)
     VALUES (@id, @utilityId, @clientCode, @username, @passwordHash, @nowIso, @nowIso)
     ON CONFLICT(utility_id, client_code) DO UPDATE SET
       username = excluded.username,
       password_hash = excluded.password_hash,
       updated_at = excluded.updated_at`
  ).run({
    id: randomUUID(),
    utilityId: input.utilityId,
    clientCode: input.clientCode,
    username: input.username,
    passwordHash: input.passwordHash,
    nowIso: input.nowIso
  });
  return d.prepare(
    `SELECT id, utility_id, client_code, username, password_hash, created_at, updated_at
     FROM espace_client_accounts
     WHERE utility_id = ? AND client_code = ? LIMIT 1`
  ).get(input.utilityId, input.clientCode) as any;
}

export async function pgFindEspaceClientAccountByUsername(input: { utilityId: string; username: string }) {
  await ensureEspaceClientAuthStore();
  const d = getDb();
  return d.prepare(
    `SELECT id, utility_id, client_code, username, password_hash, created_at, updated_at
     FROM espace_client_accounts
     WHERE utility_id = ? AND username = ? LIMIT 1`
  ).get(input.utilityId, input.username) as any;
}

export async function pgFindEspaceClientAccountById(id: string) {
  await ensureEspaceClientAuthStore();
  const d = getDb();
  return d.prepare(
    `SELECT id, utility_id, client_code, username, password_hash, created_at, updated_at
     FROM espace_client_accounts
     WHERE id = ? LIMIT 1`
  ).get(id) as any;
}

export async function pgCreateEspaceClientSession(input: {
  accountId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  nowIso: string;
}) {
  await ensureEspaceClientAuthStore();
  const d = getDb();
  const id = randomUUID();
  d.prepare(
    `INSERT INTO espace_client_sessions (
      id, account_id, refresh_token_hash, user_agent, ip_address, expires_at, revoked_at, created_at
    ) VALUES (
      @id, @accountId, @refreshTokenHash, @userAgent, @ipAddress, @expiresAt, NULL, @nowIso
    )`
  ).run({
    id,
    accountId: input.accountId,
    refreshTokenHash: input.refreshTokenHash,
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
    expiresAt: input.expiresAt,
    nowIso: input.nowIso
  });
  return d.prepare(
    `SELECT id, account_id, refresh_token_hash, user_agent, ip_address, expires_at, revoked_at, created_at
     FROM espace_client_sessions WHERE id = ? LIMIT 1`
  ).get(id) as any;
}

export async function pgFindEspaceClientSessionByRefreshHash(refreshTokenHash: string) {
  await ensureEspaceClientAuthStore();
  const d = getDb();
  return d.prepare(
    `SELECT id, account_id, refresh_token_hash, user_agent, ip_address, expires_at, revoked_at, created_at
     FROM espace_client_sessions
     WHERE refresh_token_hash = ? LIMIT 1`
  ).get(refreshTokenHash) as any;
}

export async function pgRevokeEspaceClientSession(id: string, nowIso: string): Promise<void> {
  await ensureEspaceClientAuthStore();
  const d = getDb();
  d.prepare(`UPDATE espace_client_sessions SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?`).run(nowIso, id);
}

export async function pgRotateEspaceClientSessionRefreshToken(input: { sessionId: string; newRefreshTokenHash: string }): Promise<void> {
  await ensureEspaceClientAuthStore();
  const d = getDb();
  d.prepare(`UPDATE espace_client_sessions SET refresh_token_hash = ? WHERE id = ?`).run(input.newRefreshTokenHash, input.sessionId);
}
