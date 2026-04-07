import fs from "fs";
import path from "path";
import { config } from "../config";

export interface UtilityRecord {
  id: string;
  accessKey: string;
  tokenId?: string;
  utilityVersion: string;
  apiVersion: string;
  tunnelUrl: string | null;
  capabilities: Record<string, unknown>;
  selectedFeatures?: string[];
  lastSeenAt: string;
  createdAt: string;
}

export interface ClientRecord {
  id: string;
  clientToken: string;
  utilityId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiTokenRecord {
  id: string;
  label: string;
  tokenPrefix: string;
  tokenHash: string;
  scopes: string[];
  revokedAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface DbSchema {
  utilities: UtilityRecord[];
  clients: ClientRecord[];
  apiCompatibility: Array<{ utilityVersionRange: string; apiVersion: string; enabledFeatures: string[] }>;
  apiTokens: ApiTokenRecord[];
}

const dbPath = path.join(config.dataDir, "db.json");

export function ensureDb(): void {
  if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    const seed: DbSchema = {
      utilities: [],
      clients: [],
      apiCompatibility: [{ utilityVersionRange: ">=0.1.0.0", apiVersion: "1.0.0.0", enabledFeatures: ["sync", "proxy"] }],
      apiTokens: []
    };
    fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2), "utf8");
  }
}

export function readDb(): DbSchema {
  ensureDb();
  const raw = fs.readFileSync(dbPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<DbSchema>;
  return {
    utilities: parsed.utilities || [],
    clients: parsed.clients || [],
    apiCompatibility: parsed.apiCompatibility || [],
    apiTokens: parsed.apiTokens || []
  };
}

export function writeDb(next: DbSchema): void {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(next, null, 2), "utf8");
}

