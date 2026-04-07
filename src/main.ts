import { createApp } from "./app";
import { config } from "./config";
import { ensureDb } from "./infra/db";

ensureDb();

const app = createApp();
app.listen(config.port, () => {
  console.log(`OxyRest (TypeScript) listening on http://localhost:${config.port}`);
});

