import { Router } from "express";
import { z } from "zod";
import { findTokenRecord } from "../auth/token.service";
import { bindClientToken, getUtilityByTokenId } from "../utility/utility.service";
import { resolveClientController } from "./controllers";
import { resolveClientUtility, type ClientUtilityRequest } from "./middlewares/resolve-client-utility.middleware";

export const clientRouter = Router();

const bindSchema = z.object({
  clientToken: z.string().min(8),
  accessKey: z.string().min(1)
});

clientRouter.post("/bind", (req, res) => {
  const parsed = bindSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  const tokenRecord = findTokenRecord(parsed.data.accessKey);
  if (!tokenRecord || tokenRecord.revokedAt) return res.status(401).json({ error: "invalid_or_revoked_access_key" });
  const utility = getUtilityByTokenId(tokenRecord.id);
  if (!utility) return res.status(404).json({ error: "utility_not_found" });
  const client = bindClientToken(parsed.data.clientToken, utility.id);
  return res.json({ ok: true, clientId: client.id, utilityId: client.utilityId });
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

