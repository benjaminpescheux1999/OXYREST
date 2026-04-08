import type { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./openapi";

export function registerSwagger(app: Express) {
  app.get("/docs.json", (_req: Request, res: Response) => {
    res.json(openApiDocument);
  });

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: "OxyRest API Docs"
  }));
}

