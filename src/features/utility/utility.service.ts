import { randomUUID } from "crypto";
import {
  pgBindClientToken,
  pgGetUtilityById,
  pgGetUtilityByTokenId,
  pgResolveUtilityFromClientToken,
  pgUpsertUtility
} from "../../infra/token-store";

function mapUtilityRow(row: any) {
  if (!row) return null;
  return {
    id: String(row.id),
    accessKey: String(row.access_key),
    tokenId: String(row.token_id),
    utilityVersion: String(row.utility_version),
    apiVersion: String(row.api_version),
    tunnelUrl: row.tunnel_url ? String(row.tunnel_url) : null,
    capabilities: (() => {
      try { return JSON.parse(String(row.capabilities_json ?? "{}")); } catch { return {}; }
    })() as Record<string, unknown>,
    selectedFeatures: (() => {
      try { return JSON.parse(String(row.selected_features_json ?? "[]")); } catch { return []; }
    })() as string[],
    selectedFolders: (() => {
      try { return JSON.parse(String(row.selected_folders_json ?? "[]")); } catch { return []; }
    })() as string[],
    lastSeenAt: String(row.last_seen_at),
    createdAt: String(row.created_at)
  };
}

export async function upsertUtility(input: {
  accessKey: string;
  tokenId: string;
  utilityVersion: string;
  apiVersion: string;
  tunnelUrl: string | null;
  capabilities: Record<string, unknown>;
  selectedFeatures: string[];
  selectedFolders: string[];
}) {
  const now = new Date().toISOString();
  const id = randomUUID();
  await pgUpsertUtility({
    id,
    accessKey: input.accessKey,
    tokenId: input.tokenId,
    utilityVersion: input.utilityVersion,
    apiVersion: input.apiVersion,
    tunnelUrl: input.tunnelUrl,
    capabilities: input.capabilities,
    selectedFeatures: input.selectedFeatures,
    selectedFolders: input.selectedFolders,
    nowIso: now
  });
  const row = await pgGetUtilityByTokenId(input.tokenId);
  return mapUtilityRow(row);
}

export async function getUtilityByTokenId(tokenId: string) {
  const row = await pgGetUtilityByTokenId(tokenId);
  return mapUtilityRow(row);
}

export async function getUtilityById(utilityId: string) {
  const row = await pgGetUtilityById(utilityId);
  return mapUtilityRow(row);
}

export async function bindClientToken(clientToken: string, utilityId: string) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const row = await pgBindClientToken({ id, clientToken, utilityId, nowIso: now });
  if (!row) return null;
  return {
    id: String(row.id),
    clientToken: String(row.client_token),
    utilityId: String(row.utility_id),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

export async function resolveUtilityFromClientToken(clientToken: string) {
  const row = await pgResolveUtilityFromClientToken(clientToken);
  return mapUtilityRow(row);
}

