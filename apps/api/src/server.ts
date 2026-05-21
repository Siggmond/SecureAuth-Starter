import "dotenv/config";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { createProductionDeps } from "./container";

const env = loadEnv(process.env);
const app = createApp(createProductionDeps(env));

app.listen(env.PORT, () => {
  console.log(`SecureAuth API listening on http://localhost:${env.PORT}`);
});
