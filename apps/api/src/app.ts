import { apiError, type HealthResponse } from "@devhub/contracts";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import type { ApiConfig } from "./config";

type Env = { Variables: { requestId: string } };

const REQUEST_ID = /^[A-Za-z0-9._-]{8,100}$/;

export interface AppDeps {
  config: ApiConfig;
  /** Readiness probe for the database; injected so tests run without Supabase. */
  checkDatabase?: () => Promise<{ ok: boolean; detail?: string }>;
}

/**
 * Versioned DevHub API. Phase 1 exposes health and readiness; the ingestion
 * gateway (/v1/events, /v1/metrics) is added in Phase 2 on these same
 * conventions: request ids, a single error envelope, bounded bodies and
 * request timeouts.
 */
export function createApp({ config, checkDatabase }: AppDeps) {
  const app = new Hono<Env>();

  app.use("*", async (c, next) => {
    const incoming = c.req.header("x-request-id");
    const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    await next();
  });
  app.use("*", secureHeaders());
  app.use("*", timeout(config.REQUEST_TIMEOUT_MS));
  app.use(
    "/v1/*",
    bodyLimit({
      maxSize: config.MAX_BODY_BYTES,
      onError: (c) =>
        c.json(apiError("payload_too_large", `Request body exceeds ${config.MAX_BODY_BYTES} bytes.`, c.get("requestId")), 413),
    }),
  );

  app.get("/v1/health", (c) => {
    const body: HealthResponse = {
      status: "ok",
      service: "devhub-api",
      version: config.DEVHUB_VERSION,
      time: new Date().toISOString(),
      checks: {},
    };
    return c.json(body, 200, { "cache-control": "no-store" });
  });

  app.get("/v1/ready", async (c) => {
    let database: HealthResponse["checks"][string] = { status: "skipped", detail: "No database probe configured" };
    if (checkDatabase) {
      try {
        const result = await checkDatabase();
        database = result.ok ? { status: "ok" } : { status: "down", ...(result.detail ? { detail: result.detail } : {}) };
      } catch {
        database = { status: "down", detail: "Probe failed" };
      }
    }
    const status = database.status === "down" ? "down" : "ok";
    const body: HealthResponse = {
      status,
      service: "devhub-api",
      version: config.DEVHUB_VERSION,
      time: new Date().toISOString(),
      checks: { database },
    };
    return c.json(body, status === "ok" ? 200 : 503, { "cache-control": "no-store" });
  });

  app.notFound((c) => c.json(apiError("not_found", "No such endpoint.", c.get("requestId")), 404));

  app.onError((error, c) => {
    const requestId = c.get("requestId") ?? "unknown";
    if (error instanceof HTTPException) {
      const code = error.status === 504 ? "unavailable" : error.status === 413 ? "payload_too_large" : "bad_request";
      return c.json(apiError(code, error.message || "Request failed.", requestId), error.status);
    }
    console.error(JSON.stringify({ level: "error", requestId, message: error.message }));
    return c.json(apiError("internal", "Internal error.", requestId), 500);
  });

  return app;
}
