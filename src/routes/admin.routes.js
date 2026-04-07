const express = require("express");
const { z } = require("zod");
const { requireAdminApiKey } = require("../middleware/admin-auth");
const { createApiToken, listTokens, revokeToken } = require("../services/token.service");

const router = express.Router();
router.use(requireAdminApiKey);

const createSchema = z.object({
  label: z.string().min(1),
  scopes: z.array(z.string()).optional()
});

router.post("/tokens", (req, res) => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const created = createApiToken(parsed.data);
  return res.status(201).json({
    ok: true,
    token: created.token,
    tokenMeta: {
      id: created.record.id,
      label: created.record.label,
      tokenPrefix: created.record.tokenPrefix,
      scopes: created.record.scopes,
      createdAt: created.record.createdAt
    }
  });
});

router.get("/tokens", (_req, res) => {
  return res.json({ ok: true, items: listTokens() });
});

router.post("/tokens/:tokenId/revoke", (req, res) => {
  const token = revokeToken(req.params.tokenId);
  if (!token) return res.status(404).json({ error: "token_not_found" });
  return res.json({ ok: true, revokedAt: token.revokedAt });
});

module.exports = router;

