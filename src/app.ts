import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { systemRouter } from "./features/system/system.routes";
import { utilityRouter } from "./features/utility/utility.routes";
import { clientRouter } from "./features/client/client.routes";
import { adminRouter } from "./features/admin/admin.routes";
import { config } from "./config";

export function createApp() {
  const app = express();
  const allowedOrigins = config.frontendOrigins;
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));

  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });

  app.use("/system", systemRouter);
  app.use("/utility", utilityRouter);
  app.use("/client", clientRouter);
  app.use("/admin", adminRouter);

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(`[${new Date().toISOString()}] ERROR ${req.method} ${req.originalUrl}`, err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}

