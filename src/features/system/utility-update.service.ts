import crypto from "crypto";
import { config } from "../../config";
import { compareSemver } from "../../utils/semver";

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

export function buildUtilityUpdatePayload(currentVersionRaw: unknown, accessKeyRaw?: unknown) {
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
