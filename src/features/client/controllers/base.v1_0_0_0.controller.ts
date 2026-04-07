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
  async getFacture(ctx) {
    const factureId = String(ctx.req.params.factureId || "").trim();
    await proxyToUtility(ctx, "/espace-client/facture-summary", { factureId });
  }
};
