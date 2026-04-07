import type { Request, Response, NextFunction } from "express";
import { config } from "../config";

export function requireAdminApiKey(req: Request, res: Response, next: NextFunction): void {
  const incoming = String(req.headers["x-admin-key"] || "");
  if (!incoming || incoming !== config.adminApiKey) {
    res.status(401).json({ error: "unauthorized_admin" });
    return;
  }
  next();
}

