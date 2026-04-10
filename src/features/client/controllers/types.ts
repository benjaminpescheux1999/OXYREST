import type { Request, Response } from "express";

export interface ClientRouteContext {
  req: Request;
  res: Response;
  utility: any;
}

export interface ClientMethods {
  getClient: (ctx: ClientRouteContext) => Promise<void>;
  updateClient: (ctx: ClientRouteContext) => Promise<void>;
  getClientFactures: (ctx: ClientRouteContext) => Promise<void>;
  getFacture: (ctx: ClientRouteContext) => Promise<void>;
  getClientAppareils: (ctx: ClientRouteContext) => Promise<void>;
}
