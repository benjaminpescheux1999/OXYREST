import "dotenv/config";
import { createApp } from "./app";
import { config } from "./config";
import { ensureTokenStore, ensureUtilityClientStore, resolveDatabaseFilePath } from "./infra/token-store";

async function bootstrap() {
  await ensureTokenStore();
  await ensureUtilityClientStore();
  console.log(`SQLite storage enabled at ${resolveDatabaseFilePath()}.`);
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`OxyRest (TypeScript) listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});

