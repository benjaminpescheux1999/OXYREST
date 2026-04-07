import { randomUUID } from "crypto";
import { readDb, writeDb } from "../../infra/db";

export function upsertUtility(input: {
  accessKey: string;
  tokenId: string;
  utilityVersion: string;
  apiVersion: string;
  tunnelUrl: string | null;
  capabilities: Record<string, unknown>;
  selectedFeatures: string[];
}) {
  const db = readDb();
  const now = new Date().toISOString();
  const existing = db.utilities.find((u) => u.tokenId === input.tokenId);
  if (existing) {
    existing.accessKey = input.accessKey;
    existing.tokenId = input.tokenId;
    existing.utilityVersion = input.utilityVersion;
    existing.apiVersion = input.apiVersion;
    existing.tunnelUrl = input.tunnelUrl;
    existing.capabilities = input.capabilities;
    existing.selectedFeatures = input.selectedFeatures;
    existing.lastSeenAt = now;
    writeDb(db);
    return existing;
  }
  const created = {
    id: randomUUID(),
    accessKey: input.accessKey,
    tokenId: input.tokenId,
    utilityVersion: input.utilityVersion,
    apiVersion: input.apiVersion,
    tunnelUrl: input.tunnelUrl,
    capabilities: input.capabilities,
    selectedFeatures: input.selectedFeatures,
    lastSeenAt: now,
    createdAt: now
  };
  db.utilities.push(created);
  writeDb(db);
  return created;
}

export function getUtilityByTokenId(tokenId: string) {
  const db = readDb();
  return db.utilities.find((u) => u.tokenId === tokenId) || null;
}

export function getUtilityById(utilityId: string) {
  const db = readDb();
  return db.utilities.find((u) => u.id === utilityId) || null;
}

export function bindClientToken(clientToken: string, utilityId: string) {
  const db = readDb();
  const now = new Date().toISOString();
  const existing = db.clients.find((c) => c.clientToken === clientToken);
  if (existing) {
    existing.utilityId = utilityId;
    existing.updatedAt = now;
    writeDb(db);
    return existing;
  }
  const created = { id: randomUUID(), clientToken, utilityId, createdAt: now, updatedAt: now };
  db.clients.push(created);
  writeDb(db);
  return created;
}

export function resolveUtilityFromClientToken(clientToken: string) {
  const db = readDb();
  const client = db.clients.find((c) => c.clientToken === clientToken);
  if (!client) return null;
  return db.utilities.find((u) => u.id === client.utilityId) || null;
}

