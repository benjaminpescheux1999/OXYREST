import path from "path";

export type UtilityDownloadEntry = {
  version: string;
  url: string;
  releaseNotesUrl?: string;
};

function isInstallerUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  return normalized.endsWith(".exe") || normalized.endsWith(".msi");
}

function parseUtilityDownloads(raw: string | undefined): UtilityDownloadEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: UtilityDownloadEntry[] = [];
    for (const x of parsed) {
      const item = x as Record<string, unknown>;
      const version = String(item.version || "").trim();
      const url = String(item.url || "").trim();
      const releaseNotesUrl = String(item.releaseNotesUrl || "").trim();
      if (!version || !url) continue;
      out.push({
        version,
        url,
        releaseNotesUrl: releaseNotesUrl || undefined
      });
    }
    return out;
  } catch {
    return [];
  }
}

function mergeUtilityDownloads(primary: UtilityDownloadEntry[], secondary: UtilityDownloadEntry[]): UtilityDownloadEntry[] {
  const byVersion = new Map<string, UtilityDownloadEntry>();
  for (const x of secondary) {
    if (!isInstallerUrl(x.url)) continue;
    byVersion.set(x.version, x);
  }
  for (const x of primary) {
    if (!isInstallerUrl(x.url)) continue;
    byVersion.set(x.version, x);
  }
  return [...byVersion.values()];
}

function parseOriginList(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      // fallback to comma/newline parsing
    }
  }
  return trimmed
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const defaultUtilityDownloadsJson = JSON.stringify([
  { version: "0.1.0.0", url: "sftp://ftp.cluster026.hosting.ovh.net/BENJAMIN/OXYDRIVER-Setup-0.1.0.0.exe" },
  { version: "0.1.0.1", url: "sftp://ftp.cluster026.hosting.ovh.net/BENJAMIN/OXYDRIVER-Setup-0.1.0.1.exe" },
  { version: "0.1.0.2", url: "sftp://ftp.cluster026.hosting.ovh.net/BENJAMIN/OXYDRIVER-Setup-0.1.0.2.exe" }
]);
const defaultUtilityDownloads = parseUtilityDownloads(defaultUtilityDownloadsJson);
const envUtilityDownloads = parseUtilityDownloads(process.env.UTILITY_DOWNLOADS_JSON);
const utilityDownloads = mergeUtilityDownloads(envUtilityDownloads, defaultUtilityDownloads);
const frontendOrigins = [
  ...parseOriginList(process.env.FRONTEND_ORIGINS),
  ...parseOriginList(process.env.FRONTEND_ORIGIN)
];

export const config = {
  port: Number(process.env.PORT || 8080),
  dataDir: process.env.DATA_DIR || path.join(process.cwd(), "data"),
  apiVersions: ["v1"] as const,
  minSupportedUtilityVersion: "0.1.0.0",
  adminApiKey: process.env.ADMIN_API_KEY || "dev-admin-key-change-me",
  tokenPepper: process.env.TOKEN_PEPPER || "dev-pepper-change-me",
  databasePath: process.env.DATABASE_PATH || "",
  utilityLatestVersion: process.env.UTILITY_LATEST_VERSION || "0.1.0.1",
  utilityDownloadUrl: process.env.UTILITY_DOWNLOAD_URL || "",
  utilityReleaseNotesUrl: process.env.UTILITY_RELEASE_NOTES_URL || "",
  utilityDownloads,
  sftpHost: process.env.SFTP_HOST || "",
  sftpPort: Number(process.env.SFTP_PORT || 22),
  sftpUsername: process.env.SFTP_USERNAME || "",
  sftpPassword: process.env.SFTP_PASSWORD || "",
  sftpRemoteBasePath: process.env.SFTP_REMOTE_BASE_PATH || "",
  updateCryptoIterations: Number(process.env.UPDATE_CRYPTO_ITERATIONS || 120000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "",
  frontendOrigins: [...new Set(frontendOrigins)],
  espaceClientJwtSecret: process.env.ESPACE_CLIENT_JWT_SECRET || "dev-espace-client-secret",
  espaceClientAccessTtlSec: Number(process.env.ESPACE_CLIENT_ACCESS_TTL_SEC || 900),
  espaceClientRefreshTtlSec: Number(process.env.ESPACE_CLIENT_REFRESH_TTL_SEC || 2592000),
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  alertEmailTo: process.env.ALERT_EMAIL_TO || "benjamin@info-tec.fr",
  alertEmailFrom: process.env.ALERT_EMAIL_FROM || "oxyrest@localhost",
  espaceClientPublicUrl: process.env.ESPACE_CLIENT_PUBLIC_URL || "https://oxy-portailclient.onrender.com/"
};

