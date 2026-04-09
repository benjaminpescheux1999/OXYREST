import type { ClientMethods } from "./types";
import { baseV100Controller } from "./base.v1_0_0_0.controller";

function pickString(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return "";
}

function pickBoolean(raw: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toUpperCase() === "O" || value.toLowerCase() === "true";
    if (typeof value === "number") return value !== 0;
  }
  return false;
}

function normalizeClientResponse(parsed: unknown) {
  const envelope = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const data = envelope.data && typeof envelope.data === "object" ? (envelope.data as Record<string, unknown>) : {};
  return {
    ok: envelope.ok === true,
    data: {
      clientId: pickString(data, ["clientId", "CLIEN"]),
      nom: pickString(data, ["nom", "NOM"]),
      prenom: pickString(data, ["prenom", "PRENO"]),
      telephoneDomicile: pickString(data, ["telephoneDomicile", "TELDO"]),
      telephonePortable: pickString(data, ["telephonePortable", "TELPO"]),
      telephoneTravail: pickString(data, ["telephoneTravail", "TELTR"]),
      email: pickString(data, ["email", "EMAIL"]),
      sousContrat: pickBoolean(data, ["sousContrat", "CONTR"]),
      numeroRue: pickString(data, ["numeroRue", "NUMRU"]),
      qualiteAdresse: pickString(data, ["qualiteAdresse", "QUARU"]),
      rue: pickString(data, ["rue", "RUE1"]),
      ville: pickString(data, ["ville", "VILLE"]),
      codePostal: pickString(data, ["codePostal", "CODPO"]),
      renouvellement: pickString(data, ["renouvellement", "RENOU"])
    }
  };
}

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
      data: normalizeClientResponse(parsed)
    });
  }
};

export const controllerV101: ClientMethods = {
  ...baseV100Controller,
  ...overrideV101Controller
};
