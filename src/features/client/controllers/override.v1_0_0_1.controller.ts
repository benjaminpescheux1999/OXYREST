import type { ClientMethods } from "./types";
import { baseV100Controller } from "./base.v1_0_0_0.controller";

// API 1.0.0.1 replaces getClient behavior while keeping all other base methods.
export const overrideV101Controller: Partial<ClientMethods> = {
  async getClient(ctx) {
    const clientId = String(ctx.req.params.clientId || "").trim();
    const url = `${ctx.utility.tunnelUrl}/espace-client/client-summary?clientId=${encodeURIComponent(clientId)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "x-oxydriver-key": ctx.utility.accessKey }
    });
    const text = await response.text();
    let parsed: unknown = { raw: text };
    try { parsed = JSON.parse(text); } catch { /* ignore non-json */ }
    ctx.res.status(response.status).json({
      proxiedToUtilityId: ctx.utility.id,
      apiVersion: "1.0.0.1",
      data: parsed
    });
  }
};

export const controllerV101: ClientMethods = {
  ...baseV100Controller,
  ...overrideV101Controller
};
