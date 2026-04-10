import { Router } from "express";
import { resolveClientController } from "./controllers";
import { resolveClientUtility, type ClientUtilityRequest } from "./middlewares/resolve-client-utility.middleware";
import { bindClientTokenHandler, rotateClientTokenHandler } from "./controllers/client-token.controller";
import {
  adminCreateClientAccountHandler,
  currentClientSessionHandler,
  loginClientAccountHandler,
  logoutClientSessionHandler,
  monitoringErrorHandler,
  refreshClientSessionHandler,
  requireClientAuth
} from "./controllers/espace-client-auth.controller";

export const clientRouter = Router();
clientRouter.post("/bind", bindClientTokenHandler);
clientRouter.post("/rotate", rotateClientTokenHandler);
clientRouter.post("/espace-client/adminClient/create", adminCreateClientAccountHandler);
clientRouter.post("/espace-client/auth/login", resolveClientUtility, loginClientAccountHandler);
clientRouter.post("/espace-client/auth/refresh", resolveClientUtility, refreshClientSessionHandler);
clientRouter.post("/espace-client/auth/logout", logoutClientSessionHandler);
clientRouter.get("/espace-client/auth/me", requireClientAuth, currentClientSessionHandler);
clientRouter.post("/espace-client/monitoring/error", resolveClientUtility, monitoringErrorHandler);

clientRouter.get("/espace-client/client/:clientId", resolveClientUtility, async (req: ClientUtilityRequest, res) => {
  const utility = req.clientUtility!;
  const controller = resolveClientController(utility.apiVersion);
  try {
    await controller.getClient({ req, res, utility });
  } catch (err) {
    res.status(502).json({ error: "proxy_failed", message: err instanceof Error ? err.message : "unknown_error" });
  }
});

clientRouter.put("/espace-client/client/:clientId", resolveClientUtility, requireClientAuth, async (req: ClientUtilityRequest, res) => {
  const utility = req.clientUtility!;
  const authClientCode = String((req as any).clientAuth?.clientCode || "").trim();
  const targetClientId = String(req.params.clientId || "").trim();
  if (!authClientCode || authClientCode !== targetClientId) {
    return res.status(403).json({ error: "forbidden_client_scope" });
  }
  const controller = resolveClientController(utility.apiVersion);
  try {
    await controller.updateClient({ req, res, utility });
  } catch (err) {
    res.status(502).json({ error: "proxy_failed", message: err instanceof Error ? err.message : "unknown_error" });
  }
});

clientRouter.get("/espace-client/client/:clientId/factures", resolveClientUtility, async (req: ClientUtilityRequest, res) => {
  const utility = req.clientUtility!;
  const controller = resolveClientController(utility.apiVersion);
  try {
    await controller.getClientFactures({ req, res, utility });
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

clientRouter.get("/espace-client/client/:clientId/appareils", resolveClientUtility, async (req: ClientUtilityRequest, res) => {
  const utility = req.clientUtility!;
  const controller = resolveClientController(utility.apiVersion);
  try {
    await controller.getClientAppareils({ req, res, utility });
  } catch (err) {
    res.status(502).json({ error: "proxy_failed", message: err instanceof Error ? err.message : "unknown_error" });
  }
});

