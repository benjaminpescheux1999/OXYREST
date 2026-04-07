import { Router } from "express";
import { z } from "zod";
import { requireAdminApiKey } from "../../middleware/admin-auth";
import { createLabeledToken, listTokens, revokeToken } from "../auth/token.service";

export const adminRouter = Router();
adminRouter.use(requireAdminApiKey);

const createSchema = z.object({
  label: z.string().min(1),
  scopes: z.array(z.string()).optional()
});

adminRouter.post("/tokens", (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  const created = createLabeledToken(parsed.data.label, parsed.data.scopes ?? ["sync", "proxy"]);
  res.status(201).json({
    ok: true,
    token: created.token,
    tokenMeta: {
      id: created.meta.id,
      label: created.meta.label,
      tokenPrefix: created.meta.tokenPrefix,
      scopes: created.meta.scopes,
      createdAt: created.meta.createdAt
    }
  });
});

adminRouter.get("/tokens", (_req, res) => {
  res.json({ ok: true, items: listTokens() });
});

adminRouter.post("/tokens/:tokenId/revoke", (req, res) => {
  const token = revokeToken(req.params.tokenId);
  if (!token) {
    res.status(404).json({ error: "token_not_found" });
    return;
  }
  res.json({ ok: true, revokedAt: token.revokedAt });
});

