import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();

const supabaseUrl = config.SUPABASE_URL;
const app = createApp({
  config,
  // Reachability of Supabase's REST gateway; does not need credentials.
  checkDatabase: supabaseUrl
    ? async () => {
        const res = await fetch(new URL("/rest/v1/", supabaseUrl), { signal: AbortSignal.timeout(3000) });
        return { ok: res.status < 500, detail: `HTTP ${res.status}` };
      }
    : undefined,
});

const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(JSON.stringify({ level: "info", message: "devhub-api listening", port: info.port }));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
