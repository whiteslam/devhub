import { apiErrorSchema, healthResponseSchema } from "@devhub/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig({ MAX_BODY_BYTES: "2048" });

describe("api conventions", () => {
  it("serves a schema-valid health response with a request id", async () => {
    const res = await createApp({ config }).request("/v1/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(healthResponseSchema.parse(await res.json()).service).toBe("devhub-api");
  });

  it("propagates well-formed request ids and replaces malformed ones", async () => {
    const app = createApp({ config });
    expect((await app.request("/v1/health", { headers: { "x-request-id": "req_abc12345" } })).headers.get("x-request-id")).toBe(
      "req_abc12345",
    );
    const injected = await app.request("/v1/health", { headers: { "x-request-id": "bad id <script>alert(1)</script>" } });
    expect(injected.headers.get("x-request-id")).not.toContain("bad");
  });

  it("returns the error envelope for unknown routes", async () => {
    const res = await createApp({ config }).request("/v1/nope");
    expect(res.status).toBe(404);
    const body = apiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("not_found");
    expect(body.error.requestId).toBe(res.headers.get("x-request-id"));
  });

  it("rejects oversized bodies", async () => {
    const res = await createApp({ config }).request("/v1/health", {
      method: "POST",
      body: "x".repeat(4096),
      headers: { "content-length": "4096" },
    });
    expect(res.status).toBe(413);
    expect(apiErrorSchema.parse(await res.json()).error.code).toBe("payload_too_large");
  });

  it("reports readiness honestly", async () => {
    const down = await createApp({ config, checkDatabase: async () => ({ ok: false, detail: "HTTP 503" }) }).request("/v1/ready");
    expect(down.status).toBe(503);
    const throws = await createApp({ config, checkDatabase: () => Promise.reject(new Error("boom")) }).request("/v1/ready");
    expect(throws.status).toBe(503);
    const skipped = await createApp({ config }).request("/v1/ready");
    expect(((await skipped.json()) as { checks: { database: { status: string } } }).checks.database.status).toBe("skipped");
  });

  it("does not leak internal error messages", async () => {
    const app = createApp({ config });
    app.get("/v1/explode", () => {
      throw new Error("secret connection string");
    });
    const res = await app.request("/v1/explode");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
