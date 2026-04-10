import { Router } from "express";
import { compareSemver } from "../../utils/semver";
import { resolveDatabaseFilePath } from "../../infra/token-store";
import { config } from "../../config";
import { buildUtilityUpdatePayload } from "./utility-update.service";

export const systemRouter = Router();

systemRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "OxyRest", time: new Date().toISOString() });
});

systemRouter.get("/versions", (_req, res) => {
  res.json({ apiVersions: config.apiVersions, minSupportedUtilityVersion: config.minSupportedUtilityVersion });
});

systemRouter.get("/storage", (_req, res) => {
  res.json({
    ok: true,
    engine: "sqlite",
    databaseFilePath: resolveDatabaseFilePath()
  });
});

systemRouter.get("/utility-update", (req, res) => {
  res.json(buildUtilityUpdatePayload(req.query.currentVersion, req.query.accessKey));
});

// Backward-compatible endpoint for older utility builds.
systemRouter.get("/utility-update/info", (req, res) => {
  const currentVersion = req.query.currentVersion ?? req.query.version;
  res.json(buildUtilityUpdatePayload(currentVersion, req.query.accessKey));
});

systemRouter.get("/utility-update/download", (req, res) => {
  const version = String(req.query.version || "").trim();
  const byVersion = version
    ? [...config.utilityDownloads].find((x) => x.version === version)?.url || ""
    : "";
  const fallback = config.utilityDownloadUrl || "";
  const redirectUrl = (byVersion || fallback).trim();
  if (!redirectUrl) {
    res.status(404).json({
      error: "download_not_configured",
      message: "No download URL configured for requested version."
    });
    return;
  }
  res.redirect(redirectUrl);
});

systemRouter.get("/utility-update/catalog", (_req, res) => {
  const catalog = [...config.utilityDownloads].sort((a, b) => compareSemver(a.version, b.version));
  res.json({
    latestVersion: catalog.length > 0 ? catalog[catalog.length - 1].version : config.utilityLatestVersion,
    downloads: catalog
  });
});

