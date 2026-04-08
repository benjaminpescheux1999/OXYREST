import type { NextFunction, Request, Response } from "express";
import { resolveUtilityFromClientToken } from "../../utility/utility.service";

export interface ClientUtilityRequest extends Request {
  clientUtility?: any;
}

export async function resolveClientUtility(req: ClientUtilityRequest, res: Response, next: NextFunction) {
  const token = String(req.headers["x-client-token"] || "");
  if (!token) return res.status(401).json({ error: "missing_client_token" });
  const utility = await resolveUtilityFromClientToken(token);
  if (!utility) return res.status(404).json({ error: "unknown_client_token" });
  if (!utility.tunnelUrl) return res.status(409).json({ error: "utility_not_exposed" });
  req.clientUtility = utility;
  next();
}
