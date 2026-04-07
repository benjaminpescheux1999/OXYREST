const express = require("express");
const { z } = require("zod");
const {
  bindClientToUtility,
  resolveUtilityFromClientToken
} = require("../services/utility.service");
const { findTokenRecordByPlainToken } = require("../services/token.service");

const router = express.Router();

const bindSchema = z.object({
  clientToken: z.string().min(8),
  accessKey: z.string().min(1)
});

router.post("/bind", (req, res) => {
  const parsed = bindSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }

  const { clientToken, accessKey } = parsed.data;
  const tokenRecord = findTokenRecordByPlainToken(accessKey);
  if (!tokenRecord || tokenRecord.revokedAt) {
    return res.status(401).json({ error: "invalid_or_revoked_access_key" });
  }

  const linked = bindClientToUtility(clientToken, tokenRecord.id);
  if (!linked) {
    return res.status(404).json({ error: "utility_not_found" });
  }

  return res.json({
    ok: true,
    clientId: linked.client.id,
    utilityId: linked.utility.id
  });
});

router.post("/proxy", async (req, res) => {
  const token = String(req.headers["x-client-token"] || "");
  if (!token) {
    return res.status(401).json({ error: "missing_client_token" });
  }

  const utility = resolveUtilityFromClientToken(token);
  if (!utility) {
    return res.status(404).json({ error: "unknown_client_token" });
  }
  if (!utility.tunnelUrl) {
    return res.status(409).json({ error: "utility_not_exposed" });
  }

  const targetPath = String(req.body?.targetPath || "/health");
  const method = String(req.body?.method || "GET").toUpperCase();
  const body = req.body?.payload;

  try {
    const response = await fetch(`${utility.tunnelUrl}${targetPath}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-oxydriver-key": utility.accessKey
      },
      body: method === "GET" ? undefined : JSON.stringify(body || {})
    });

    const text = await response.text();
    return res.status(response.status).json({
      proxiedToUtilityId: utility.id,
      utilityTunnelUrl: utility.tunnelUrl,
      targetPath,
      responseText: text
    });
  } catch (err) {
    return res.status(502).json({
      error: "proxy_failed",
      message: err instanceof Error ? err.message : "unknown_error"
    });
  }
});

router.get("/espace-client/client/:clientId", async (req, res) => {
  const token = String(req.headers["x-client-token"] || "");
  if (!token) {
    return res.status(401).json({ error: "missing_client_token" });
  }

  const utility = resolveUtilityFromClientToken(token);
  if (!utility) {
    return res.status(404).json({ error: "unknown_client_token" });
  }
  if (!utility.tunnelUrl) {
    return res.status(409).json({ error: "utility_not_exposed" });
  }

  const clientId = String(req.params.clientId || "").trim();
  if (!clientId) {
    return res.status(400).json({ error: "missing_client_id" });
  }

  try {
    const url = `${utility.tunnelUrl}/espace-client/client-summary?clientId=${encodeURIComponent(clientId)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-oxydriver-key": utility.accessKey
      }
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
    return res.status(response.status).json({
      proxiedToUtilityId: utility.id,
      data: parsed
    });
  } catch (err) {
    return res.status(502).json({
      error: "proxy_failed",
      message: err instanceof Error ? err.message : "unknown_error"
    });
  }
});

module.exports = router;

