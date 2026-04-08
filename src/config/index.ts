import path from "path";

export type UtilityDownloadEntry = {
  version: string;
  url: string;
  releaseNotesUrl?: string;
};

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
  for (const x of secondary) byVersion.set(x.version, x);
  for (const x of primary) byVersion.set(x.version, x);
  return [...byVersion.values()];
}

const defaultUtilityDownloadsJson = JSON.stringify([
  { version: "0.1.0.0", url: "sftp://ftp.cluster026.hosting.ovh.net/BENJAMIN/OXYDRIVER-0.1.0.0-win-x64.zip" },
  { version: "0.1.0.1", url: "sftp://ftp.cluster026.hosting.ovh.net/BENJAMIN/OXYDRIVER-0.1.0.1-win-x64.zip" },
  { version: "0.1.0.2", url: "sftp://ftp.cluster026.hosting.ovh.net/BENJAMIN/OXYDRIVER-0.1.0.2-win-x64.zip" }
]);
const defaultUtilityDownloads = parseUtilityDownloads(defaultUtilityDownloadsJson);
const envUtilityDownloads = parseUtilityDownloads(process.env.UTILITY_DOWNLOADS_JSON);
const utilityDownloads = mergeUtilityDownloads(envUtilityDownloads, defaultUtilityDownloads);

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
  updateCryptoIterations: Number(process.env.UPDATE_CRYPTO_ITERATIONS || 120000)
};

