import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { findTokenRecord } from "../auth/token.service";
import { bindClientToken, getUtilityByTokenId } from "../utility/utility.service";
import {
  pgCreateEspaceClientSession,
  pgFindEspaceClientAccountById,
  pgFindEspaceClientAccountByUsername,
  pgFindEspaceClientSessionByRefreshHash,
  pgRevokeEspaceClientSession,
  pgRotateClientToken,
  pgRotateEspaceClientSessionRefreshToken,
  pgUpsertEspaceClientAccount
} from "../../infra/token-store";
import { resolveClientController } from "./controllers";
import { resolveClientUtility, type ClientUtilityRequest } from "./middlewares/resolve-client-utility.middleware";
import { config } from "../../config";

export const clientRouter = Router();
const REFRESH_COOKIE = "oxy_client_refresh";
const DEFAULT_CLIENT_PASSWORD = "123";
const refreshCookieMaxAgeMs = Math.max(config.espaceClientRefreshTtlSec, 60) * 1000;

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sanitizeUsername(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[^\w]/g, "")
    .toLowerCase()
    .slice(0, 40);
}

function deriveUsernameFromClient(clientCode: string, payload: unknown): string {
  const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const nested = data.data && typeof data.data === "object" ? (data.data as Record<string, unknown>) : data;
  const preno = String(nested.PRENO ?? nested.preno ?? "").trim();
  const nom = String(nested.NOM ?? nested.nom ?? "").trim();
  const combined = `${preno}${nom}`.trim();
  const normalized = sanitizeUsername(combined);
  if (normalized) return normalized;
  return `client${sanitizeUsername(clientCode) || clientCode.toLowerCase()}`;
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function verifyPassword(password: string, hashed: string): boolean {
  const [algo, saltHex, hashHex] = String(hashed).split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

function signAccessToken(payload: {
  accountId: string;
  utilityId: string;
  clientCode: string;
  username: string;
}) {
  return jwt.sign(payload, config.espaceClientJwtSecret, {
    algorithm: "HS256",
    expiresIn: Math.max(config.espaceClientAccessTtlSec, 60)
  });
}

function setRefreshCookie(res: any, refreshToken: string) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: refreshCookieMaxAgeMs,
    path: "/client/espace-client/auth"
  });
}

function clearRefreshCookie(res: any) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/client/espace-client/auth"
  });
}

function getRefreshToken(req: any): string {
  return String(req.cookies?.[REFRESH_COOKIE] || "").trim();
}

async function fetchClientIdentityForProvision(utility: { tunnelUrl: string | null; accessKey: string }, clientCode: string) {
  if (!utility.tunnelUrl) return null;
  const qs = new URLSearchParams({ clientId: clientCode }).toString();
  const url = `${utility.tunnelUrl}/espace-client/client-summary?${qs}`;
  const resp = await fetch(url, {
    method: "GET",
    headers: { "x-oxydriver-key": utility.accessKey }
  });
  const txt = await resp.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { raw: txt };
  }
}

const requireClientAuth = (req: any, res: any, next: any) => {
  const auth = String(req.headers.authorization || "");
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_access_token" });
  }
  const token = auth.slice(7).trim();
  try {
    const payload = jwt.verify(token, config.espaceClientJwtSecret) as any;
    req.clientAuth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "invalid_access_token" });
  }
};

const bindSchema = z.object({
  clientToken: z.string().min(8),
  accessKey: z.string().min(1)
});

clientRouter.post("/bind", async (req, res) => {
  const parsed = bindSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  const tokenRecord = await findTokenRecord(parsed.data.accessKey);
  if (!tokenRecord || tokenRecord.revokedAt) return res.status(401).json({ error: "invalid_or_revoked_access_key" });
  const utility = await getUtilityByTokenId(tokenRecord.id);
  if (!utility) return res.status(404).json({ error: "utility_not_found" });
  const client = await bindClientToken(parsed.data.clientToken, utility.id);
  if (!client) return res.status(500).json({ error: "client_bind_failed" });
  return res.json({ ok: true, clientId: client.id, utilityId: client.utilityId });
});

const rotateSchema = z.object({
  accessKey: z.string().min(1),
  newClientToken: z.string().min(8)
});

const provisionClientSchema = z.object({
  accessKey: z.string().min(1),
  clientCode: z.string().min(1),
  password: z.string().min(1).optional()
});

const clientLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const monitoringErrorSchema = z.object({
  level: z.enum(["error", "warn"]).default("error"),
  message: z.string().min(1),
  stack: z.string().optional(),
  page: z.string().optional(),
  userAgent: z.string().optional()
});

clientRouter.post("/rotate", async (req, res) => {
  const parsed = rotateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  const tokenRecord = await findTokenRecord(parsed.data.accessKey);
  if (!tokenRecord || tokenRecord.revokedAt) return res.status(401).json({ error: "invalid_or_revoked_access_key" });
  const utility = await getUtilityByTokenId(tokenRecord.id);
  if (!utility) return res.status(404).json({ error: "utility_not_found" });

  const now = new Date().toISOString();
  const rotated = await pgRotateClientToken({ utilityId: utility.id, newClientToken: parsed.data.newClientToken, nowIso: now });
  if (!rotated.bound) return res.status(500).json({ error: "client_rotate_failed" });
  return res.json({
    ok: true,
    deletedCount: rotated.deletedCount,
    clientToken: rotated.bound.client_token,
    clientId: rotated.bound.id,
    utilityId: rotated.bound.utility_id
  });
});

clientRouter.post("/espace-client/adminClient/create", async (req, res) => {
  const parsed = provisionClientSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  const tokenRecord = await findTokenRecord(parsed.data.accessKey);
  if (!tokenRecord || tokenRecord.revokedAt) return res.status(401).json({ error: "invalid_or_revoked_access_key" });
  const utility = await getUtilityByTokenId(tokenRecord.id);
  if (!utility) return res.status(404).json({ error: "utility_not_found" });

  const clientCode = parsed.data.clientCode.trim();
  const rawIdentity = await fetchClientIdentityForProvision(utility, clientCode);
  const username = deriveUsernameFromClient(clientCode, rawIdentity);
  const plainPassword = parsed.data.password?.trim() || DEFAULT_CLIENT_PASSWORD;
  const account = await pgUpsertEspaceClientAccount({
    utilityId: utility.id,
    clientCode,
    username,
    passwordHash: hashPassword(plainPassword),
    nowIso: new Date().toISOString()
  });

  res.json({
    ok: true,
    account: {
      id: account.id,
      utilityId: account.utility_id,
      clientCode: account.client_code,
      username: account.username
    },
    defaultPassword: plainPassword
  });
});

clientRouter.post("/espace-client/auth/login", resolveClientUtility, async (req: any, res) => {
  const parsed = clientLoginSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  const utility = req.clientUtility!;
  const username = sanitizeUsername(parsed.data.username);
  const account = await pgFindEspaceClientAccountByUsername({ utilityId: utility.id, username });
  if (!account || !verifyPassword(parsed.data.password, String(account.password_hash))) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const refreshToken = randomToken();
  const refreshTokenHash = sha256(refreshToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + refreshCookieMaxAgeMs).toISOString();
  const session = await pgCreateEspaceClientSession({
    accountId: String(account.id),
    refreshTokenHash,
    userAgent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
    ipAddress: String(req.ip || "").slice(0, 120) || null,
    expiresAt,
    nowIso: now.toISOString()
  });
  void session;
  setRefreshCookie(res, refreshToken);
  const accessToken = signAccessToken({
    accountId: String(account.id),
    utilityId: String(account.utility_id),
    clientCode: String(account.client_code),
    username: String(account.username)
  });
  return res.json({
    ok: true,
    accessToken,
    user: {
      id: String(account.id),
      username: String(account.username),
      clientCode: String(account.client_code)
    }
  });
});

clientRouter.post("/espace-client/auth/refresh", resolveClientUtility, async (req: any, res) => {
  const refreshToken = getRefreshToken(req);
  if (!refreshToken) return res.status(401).json({ error: "missing_refresh_token" });
  const refreshHash = sha256(refreshToken);
  const session = await pgFindEspaceClientSessionByRefreshHash(refreshHash);
  if (!session || session.revoked_at) return res.status(401).json({ error: "invalid_refresh_token" });
  if (new Date(String(session.expires_at)).getTime() <= Date.now()) {
    await pgRevokeEspaceClientSession(String(session.id), new Date().toISOString());
    return res.status(401).json({ error: "expired_refresh_token" });
  }
  const account = await pgFindEspaceClientAccountById(String(session.account_id));
  if (!account) return res.status(401).json({ error: "invalid_refresh_account" });
  const utilityId = String(req.clientUtility?.id || "");
  if (!utilityId || String(account.utility_id) !== utilityId) {
    return res.status(401).json({ error: "invalid_refresh_scope" });
  }

  const newRefreshToken = randomToken();
  await pgRotateEspaceClientSessionRefreshToken({
    sessionId: String(session.id),
    newRefreshTokenHash: sha256(newRefreshToken)
  });
  setRefreshCookie(res, newRefreshToken);
  const accessToken = signAccessToken({
    accountId: String(account.id),
    utilityId: String(account.utility_id),
    clientCode: String(account.client_code),
    username: String(account.username)
  });
  return res.json({ ok: true, accessToken });
});

clientRouter.post("/espace-client/auth/logout", async (req: any, res) => {
  const refreshToken = getRefreshToken(req);
  if (refreshToken) {
    const session = await pgFindEspaceClientSessionByRefreshHash(sha256(refreshToken));
    if (session) await pgRevokeEspaceClientSession(String(session.id), new Date().toISOString());
  }
  clearRefreshCookie(res);
  return res.json({ ok: true });
});

clientRouter.get("/espace-client/auth/me", requireClientAuth, async (req: any, res) => {
  const account = await pgFindEspaceClientAccountById(String(req.clientAuth.accountId || ""));
  if (!account) return res.status(401).json({ error: "invalid_session" });
  return res.json({
    ok: true,
    user: {
      id: String(account.id),
      username: String(account.username),
      clientCode: String(account.client_code)
    }
  });
});

clientRouter.post("/espace-client/monitoring/error", resolveClientUtility, async (req, res) => {
  const parsed = monitoringErrorSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });

  const hasSmtp = !!(config.smtpHost && config.smtpUser && config.smtpPass && config.alertEmailTo);
  if (!hasSmtp) return res.json({ ok: true, skipped: "smtp_not_configured" });

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass }
    });
    await transporter.sendMail({
      from: config.alertEmailFrom,
      to: config.alertEmailTo,
      subject: `[OXYDRIVER EspaceClient] ${parsed.data.level.toUpperCase()} ${new Date().toISOString()}`,
      text: [
        `Message: ${parsed.data.message}`,
        `Page: ${parsed.data.page ?? "-"}`,
        `User-Agent: ${parsed.data.userAgent ?? "-"}`,
        "",
        parsed.data.stack ?? ""
      ].join("\n")
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "monitoring_email_failed", message: err instanceof Error ? err.message : "unknown_error" });
  }
});

clientRouter.get("/espace-client/client/:clientId", resolveClientUtility, async (req: ClientUtilityRequest, res) => {
  const utility = req.clientUtility!;
  const controller = resolveClientController(utility.apiVersion);
  try {
    await controller.getClient({ req, res, utility });
  } catch (err) {
    res.status(502).json({ error: "proxy_failed", message: err instanceof Error ? err.message : "unknown_error" });
  }
});

clientRouter.get("/espace-client/facture/:factureId", resolveClientUtility, async (req: ClientUtilityRequest, res) => {
  const utility = req.clientUtility!;
  const controller = resolveClientController(utility.apiVersion);
  try {
    await controller.getFacture({ req, res, utility });
  } catch (err) {
    res.status(502).json({ error: "proxy_failed", message: err instanceof Error ? err.message : "unknown_error" });
  }
});

