import type { HealthResponse } from "@devhub/contracts";
import { appVersion, readSupabaseEnv } from "@/env";

export const dynamic = "force-dynamic";

/** Liveness of the dashboard process. Deliberately does not touch the database. */
export function GET() {
  const body: HealthResponse = {
    status: "ok",
    service: "devhub-web",
    version: appVersion(),
    time: new Date().toISOString(),
    checks: {
      supabaseConfig: readSupabaseEnv() ? { status: "ok" } : { status: "degraded", detail: "Supabase env not set" },
      appUrl:
        process.env.DEVHUB_APP_URL || process.env.NODE_ENV !== "production"
          ? { status: "ok" }
          : { status: "degraded", detail: "DEVHUB_APP_URL not set; sign-in links are disabled" },
    },
  };
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
