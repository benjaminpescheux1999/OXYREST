import { Router } from "express";
import { z } from "zod";
import { findTokenRecord } from "../auth/token.service";
import { bindClientToken, getUtilityByTokenId } from "../utility/utility.service";
import { pgRotateClientToken } from "../../infra/token-store";
import { resolveClientController } from "./controllers";
import { resolveClientUtility, type ClientUtilityRequest } from "./middlewares/resolve-client-utility.middleware";

export const clientRouter = Router();

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

