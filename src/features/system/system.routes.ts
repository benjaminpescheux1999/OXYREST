import { Router } from "express";
import crypto from "crypto";
import { config } from "../../config";
import { compareSemver } from "../../utils/semver";
import { resolveDatabaseFilePath } from "../../infra/token-store";

export const systemRouter = Router();

function resolveSftpRemotePath(downloadUrl: string, fallbackBasePath: string, version: string): string {
  if (downloadUrl.startsWith("sftp://")) {
    try {
      const parsed = new URL(downloadUrl);
      if (parsed.pathname && parsed.pathname !== "/") {
        return decodeURIComponent(parsed.pathname);
      }
    } catch {
      // ignore and fallback
    }
  }
  return `${fallbackBasePath.replace(/\/+$/, "")}/${version}`;
}

function encryptForUtility(accessKey: string, payload: object) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(accessKey, salt, config.updateCryptoIterations, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(json, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "aes-256-gcm",
    kdf: "pbkdf2-sha256",
    iterations: config.updateCryptoIterations,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: encrypted.toString("base64")
  };
}

function buildUtilityUpdatePayload(currentVersionRaw: unknown, accessKeyRaw?: unknown) {
  const currentVersion = String(currentVersionRaw || "").trim();
  const accessKey = String(accessKeyRaw || "").trim();
  const catalog = [...config.utilityDownloads].sort((a, b) => compareSemver(a.version, b.version));
  const fallback = config.utilityDownloadUrl
    ? {
        version: config.utilityLatestVersion,
        url: config.utilityDownloadUrl,
        releaseNotesUrl: config.utilityReleaseNotesUrl || undefined
      }
    : null;
  const mergedCatalog = (fallback ? [...catalog, fallback] : catalog).sort((a, b) => compareSemver(a.version, b.version));
  const latest = mergedCatalog.length > 0 ? mergedCatalog[mergedCatalog.length - 1] : null;
  const target = currentVersion
    ? (latest && compareSemver(latest.version, currentVersion) > 0 ? latest : null)
    : latest;
  const targetDownloadUrl = target?.url?.trim() || "";
  const fallbackDownloadUrl = (config.utilityDownloadUrl || "").trim();
  const apiFallbackUrl = "/system/utility-update/download";
  const resolvedDownloadUrl = targetDownloadUrl || fallbackDownloadUrl || apiFallbackUrl;
  const hasUpdate = !!target;
  if (hasUpdate && !targetDownloadUrl && !fallbackDownloadUrl) {
    console.warn(`[update] missing target download url for version ${target?.version ?? "unknown"}`);
  }
  const hasSftpConfig = !!(config.sftpHost && config.sftpUsername && config.sftpPassword);
  const encryptedSftp = !!accessKey && hasSftpConfig && target
    ? encryptForUtility(accessKey, {
        host: config.sftpHost,
        port: config.sftpPort,
        username: config.sftpUsername,
        password: config.sftpPassword,
        remotePath: resolveSftpRemotePath(resolvedDownloadUrl, config.sftpRemoteBasePath, target.version)
      })
    : null;
  return {
    hasUpdate,
    currentVersion,
    latestVersion: latest?.version ?? config.utilityLatestVersion,
    targetVersion: target?.version ?? null,
    downloadUrl: resolvedDownloadUrl,
    releaseNotesUrl: target?.releaseNotesUrl ?? config.utilityReleaseNotesUrl,
    downloads: mergedCatalog,
    encryptedSftp
  };
}

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

