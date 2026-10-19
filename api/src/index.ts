import { createApp } from "./app.js";
import { config } from "./config.js";
import { bootstrapSuperAdmin } from "./lib/bootstrapSuperAdmin.js";

async function main() {
  await bootstrapSuperAdmin();
  createApp().listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
