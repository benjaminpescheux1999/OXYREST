import type { ClientMethods, ClientRouteContext } from "./types";

async function proxyToUtility(ctx: ClientRouteContext, localPath: string, query: Record<string, string>) {
  const queryString = new URLSearchParams(query).toString();
  const url = `${ctx.utility.tunnelUrl}${localPath}${queryString ? `?${queryString}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "x-oxydriver-key": ctx.utility.accessKey }
  });
  const text = await response.text();
  let parsed: unknown = { raw: text };
  try { parsed = JSON.parse(text); } catch { /* ignore non-json */ }
  ctx.res.status(response.status).json({ proxiedToUtilityId: ctx.utility.id, data: parsed });
}

export const baseV100Controller: ClientMethods = {
  async getClient(ctx) {
    const clientId = String(ctx.req.params.clientId || "").trim();
    await proxyToUtility(ctx, "/espace-client/client-summary", { clientId });
  },
  async updateClient(ctx) {
    const clientId = String(ctx.req.params.clientId || "").trim();
    const url = `${ctx.utility.tunnelUrl}/espace-client/client-update`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-oxydriver-key": ctx.utility.accessKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        clientId,
        email: ctx.req.body?.email,
        telephoneDomicile: ctx.req.body?.telephoneDomicile,
        telephonePortable: ctx.req.body?.telephonePortable,
        telephoneTravail: ctx.req.body?.telephoneTravail
      })
    });
    const text = await response.text();
    let parsed: unknown = { raw: text };
    try { parsed = JSON.parse(text); } catch { /* ignore non-json */ }
    ctx.res.status(response.status).json({ proxiedToUtilityId: ctx.utility.id, data: parsed });
  },
  async getClientFactures(ctx) {
    const clientId = String(ctx.req.params.clientId || "").trim();
    const requestedType = String(ctx.req.query.type || "").trim().toUpperCase();
    const type = requestedType === "F" || requestedType === "D" || requestedType === "I" ? requestedType : "";
    await proxyToUtility(ctx, "/espace-client/factures", type ? { clientId, type } : { clientId });
  },
  async getFacture(ctx) {
    const factureId = String(ctx.req.params.factureId || "").trim();
    await proxyToUtility(ctx, "/espace-client/facture-summary", { factureId });
  },
  async getClientAppareils(ctx) {
    const clientId = String(ctx.req.params.clientId || "").trim();
    await proxyToUtility(ctx, "/espace-client/appareils", { clientId });
  },
  async getClientReglements(ctx) {
    const clientId = String(ctx.req.params.clientId || "").trim();
    await proxyToUtility(ctx, "/espace-client/reglements", { clientId });
  }
};
