import type { Request, Response } from "express";
import type { UtilityRecord } from "../../../infra/db";

export interface ClientRouteContext {
  req: Request;
  res: Response;
  utility: UtilityRecord;
}

export interface ClientMethods {
  getClient: (ctx: ClientRouteContext) => Promise<void>;
  getFacture: (ctx: ClientRouteContext) => Promise<void>;
}
