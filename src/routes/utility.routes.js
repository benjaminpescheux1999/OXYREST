const express = require("express");
const { z } = require("zod");
const { resolveApiVersionForUtilityVersion } = require("../services/compatibility.service");
const { getUtilityByAccessKey, upsertUtility } = require("../services/utility.service");
const { findTokenRecordByPlainToken, touchTokenLastUsed } = require("../services/token.service");

const router = express.Router();

const negotiateSchema = z.object({
  utilityVersion: z.string().min(1),
  accessKey: z.string().min(1)
});

router.post("/negotiate", (req, res) => {
  const parsed = negotiateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const { utilityVersion } = parsed.data;
  const resolved = resolveApiVersionForUtilityVersion(utilityVersion);
  if (!resolved.isSupported) {
    return res.status(426).json({
      supported: false,
      message: resolved.message,
      requiredAction: "update_utility"
    });
  }

  return res.json({
    supported: true,
    apiVersion: resolved.apiVersion,
    message: resolved.message,
    featureCatalog: resolved.featureCatalog || []
  });
});

router.post("/sync", (req, res) => {
  const body = req.body || {};
  if (body.app !== "OXYDRIVER") {
    return res.status(400).json({ error: "invalid_app" });
  }
  if (typeof body.utilityVersion !== "string" || !body.utilityVersion.trim()) {
    return res.status(400).json({ error: "invalid_utility_version" });
  }
  if (typeof body.accessKey !== "string" || !body.accessKey.trim()) {
    return res.status(400).json({ error: "invalid_access_key" });
  }
  if (body.tunnelUrl && typeof body.tunnelUrl !== "string") {
    return res.status(400).json({ error: "invalid_tunnel_url" });
  }

  const utilityVersion = body.utilityVersion.trim();
  const accessKey = body.accessKey.trim();
  const tunnelUrl = body.tunnelUrl || null;
  const capabilities = typeof body.capabilities === "object" && body.capabilities !== null ? body.capabilities : {};
  const selectedFeatures = Array.isArray(body.selectedFeatures) ? body.selectedFeatures : [];
  const tokenRecord = findTokenRecordByPlainToken(accessKey);
  if (!tokenRecord || tokenRecord.revokedAt) {
    return res.status(401).json({ error: "invalid_or_revoked_access_key" });
  }
  const resolved = resolveApiVersionForUtilityVersion(utilityVersion);
  if (!resolved.isSupported) {
    return res.status(426).json({
      error: "unsupported_utility_version",
      message: resolved.message
    });
  }

  const utility = upsertUtility({
    accessKey,
    tokenId: tokenRecord.id,
    utilityVersion,
    apiVersion: resolved.apiVersion,
    tunnelUrl: tunnelUrl || null,
    capabilities: capabilities || {},
    selectedFeatures
  });
  touchTokenLastUsed(tokenRecord.id);

  return res.json({
    ok: true,
    utilityId: utility.id,
    apiVersion: utility.apiVersion,
    token: utility.accessKey,
    capabilities: utility.capabilities,
    featureCatalog: resolved.featureCatalog || [],
    selectedFeatures: utility.selectedFeatures || []
  });
});

router.post("/identify", (req, res) => {
  const accessKey = String(req.body?.accessKey || "").trim();
  if (!accessKey) {
    return res.status(400).json({ error: "invalid_access_key" });
  }

  const tokenRecord = findTokenRecordByPlainToken(accessKey);
  if (!tokenRecord || tokenRecord.revokedAt) {
    return res.status(401).json({ error: "invalid_or_revoked_access_key" });
  }

  const utility = getUtilityByAccessKey(tokenRecord.id);
  if (!utility) {
    return res.status(404).json({ error: "utility_not_found" });
  }

  return res.json({
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

module.exports = router;

