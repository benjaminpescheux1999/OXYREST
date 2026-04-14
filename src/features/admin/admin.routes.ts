import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { requireAdminApiKey } from "../../middleware/admin-auth";
import { createLabeledToken, listTokens, resetTokenUiPasswordByLabel, revokeToken } from "../auth/token.service";

export const adminRouter = Router();
adminRouter.use(requireAdminApiKey);

const createSchema = z.object({
  folders: z.array(z.string().min(1)).min(1),
  scopes: z.array(z.string()).optional(),
  label: z.string().optional()
});

function normalizeFolders(raw: string[]): string[] {
  return (raw || [])
    .map((x) => String(x || "").trim().toUpperCase())
    .filter((x) => !!x)
    .filter((x, i, arr) => arr.findIndex((v) => v.toUpperCase() === x) === i);
}

adminRouter.post("/tokens", async (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  const folders = normalizeFolders(parsed.data.folders);
  const label = (parsed.data.label || folders.join(", ")).trim();
  try {
    const created = await createLabeledToken(label || "TOKEN_FOLDERS", parsed.data.scopes ?? ["sync", "proxy"], folders);
    res.status(201).json({
      ok: true,
      token: created.token,
      defaultUiPassword: created.meta.uiPassword,
      tokenMeta: {
        id: created.meta.id,
        label: created.meta.label,
        folders: created.meta.folders,
        tokenPrefix: created.meta.tokenPrefix,
        scopes: created.meta.scopes,
        createdAt: created.meta.createdAt
      }
    });
  } catch (err: any) {
    if (String(err?.message || "") === "token_label_already_exists") {
      res.status(409).json({ error: "token_label_already_exists" });
      return;
    }
    throw err;
  }
});

adminRouter.get("/tokens", async (_req, res) => {
  res.json({ ok: true, items: await listTokens() });
});

adminRouter.post("/tokens/:tokenId/revoke", async (req, res) => {
  const token = await revokeToken(req.params.tokenId);
  if (!token) {
    res.status(404).json({ error: "token_not_found" });
    return;
  }
  res.json({ ok: true, revokedAt: token.revokedAt });
});

const resetUiPasswordSchema = z.object({
  label: z.string().min(1),
  newPassword: z.string().min(1).optional()
});

adminRouter.post("/tokens/reset-ui-password", async (req, res) => {
  const parsed = resetUiPasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    return;
  }
  const label = parsed.data.label.trim();
  const newPassword = (parsed.data.newPassword || `oxy-${crypto.randomBytes(4).toString("hex")}`).trim();
  const updated = await resetTokenUiPasswordByLabel(label, newPassword);
  if (!updated) {
    res.status(404).json({ error: "token_not_found_for_label" });
    return;
  }
  res.json({
    ok: true,
    label: updated.label,
    uiPassword: updated.uiPassword
  });
});

