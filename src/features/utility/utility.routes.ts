import { Router } from "express";
import { z } from "zod";
import { resolveUtilityContract } from "../versioning/versioning.service";
import { findTokenRecord, touchToken } from "../auth/token.service";
import { getUtilityByTokenId, upsertUtility } from "./utility.service";
import { buildUtilityUpdatePayload } from "../system/utility-update.service";

export const utilityRouter = Router();

function normalizeSelectedFolders(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x || "").trim().toUpperCase())
    .filter((x) => !!x)
    .filter((x, i, arr) => arr.findIndex((v) => v.toUpperCase() === x) === i);
}

function normalizeExposureProvider(raw: unknown): string {
  const provider = String(raw || "").trim().toLowerCase();
  return provider || "cloudflare";
}

const negotiateSchema = z.object({
  utilityVersion: z.string().min(1),
  accessKey: z.string().min(1)
});

utilityRouter.post("/negotiate", (req, res) => {
  const parsed = negotiateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  const contract = resolveUtilityContract(parsed.data.utilityVersion, normalizeSelectedFolders(req.body?.selectedFolders));
  if (!contract.isSupported) {
    res.status(426).json({ supported: false, message: contract.message, requiredAction: "update_utility" });
    return;
  }
  res.json({
    supported: true,
    apiVersion: contract.apiVersion,
    message: contract.message,
    featureCatalog: contract.featureCatalog
  });
});

utilityRouter.post("/sync", async (req, res) => {
  const body = req.body ?? {};
  if (body.app !== "OXYDRIVER") return res.status(400).json({ error: "invalid_app" });
  const utilityVersion = String(body.utilityVersion || "").trim();
  const accessKey = String(body.accessKey || "").trim();
  if (!utilityVersion) return res.status(400).json({ error: "invalid_utility_version" });
  if (!accessKey) return res.status(400).json({ error: "invalid_access_key" });

  const selectedFolders = normalizeSelectedFolders(body.selectedFolders);
  const tokenRecord = await findTokenRecord(accessKey);
  if (!tokenRecord || tokenRecord.revokedAt) return res.status(401).json({ error: "invalid_or_revoked_access_key" });

  const contract = resolveUtilityContract(utilityVersion, selectedFolders);
  if (!contract.isSupported) return res.status(426).json({ error: "unsupported_utility_version", message: contract.message });
  const update = buildUtilityUpdatePayload(utilityVersion, accessKey);

  const utility = await upsertUtility({
    accessKey,
    tokenId: tokenRecord.id,
    utilityVersion,
    apiVersion: contract.apiVersion || "v1",
    tunnelUrl: body.tunnelUrl ? String(body.tunnelUrl) : null,
    exposureProvider: normalizeExposureProvider(body.exposureProvider),
    capabilities: typeof body.capabilities === "object" && body.capabilities ? body.capabilities : {},
    selectedFeatures: Array.isArray(body.selectedFeatures) ? body.selectedFeatures.map(String) : [],
    selectedFolders
  });
  await touchToken(tokenRecord.id);
  if (!utility) return res.status(500).json({ error: "utility_upsert_failed" });
  res.json({
    ok: true,
    utilityId: utility.id,
    apiVersion: utility.apiVersion,
    exposureProvider: utility.exposureProvider,
    token: utility.accessKey,
    capabilities: utility.capabilities,
    update: {
      hasUpdate: update.hasUpdate,
      latestVersion: update.latestVersion,
      targetVersion: update.targetVersion,
      downloadUrl: update.downloadUrl,
      releaseNotesUrl: update.releaseNotesUrl,
      encryptedSftp: update.encryptedSftp
    },
    featureCatalog: contract.featureCatalog,
    selectedFeatures: utility.selectedFeatures || [],
    selectedFolders: utility.selectedFolders || []
  });
});

utilityRouter.post("/identify", async (req, res) => {
  const accessKey = String(req.body?.accessKey || "").trim();
  if (!accessKey) return res.status(400).json({ error: "invalid_access_key" });
  const tokenRecord = await findTokenRecord(accessKey);
  if (!tokenRecord || tokenRecord.revokedAt) return res.status(401).json({ error: "invalid_or_revoked_access_key" });
  const utility = await getUtilityByTokenId(tokenRecord.id);
  if (!utility) return res.status(404).json({ error: "utility_not_found" });
  res.json({
    ok: true,
    utility: {
      id: utility.id,
      utilityVersion: utility.utilityVersion,
      apiVersion: utility.apiVersion,
      tunnelUrl: utility.tunnelUrl,
      lastSeenAt: utility.lastSeenAt
    }
  });
});

