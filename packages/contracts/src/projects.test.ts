import { describe, expect, it } from "vitest";
import { createProjectInputSchema, SLUG_PATTERN, slugify } from "./projects";

const base = {
  organizationId: "6f1c2a8e-5b1d-4c3e-9f2a-1b2c3d4e5f60",
  name: "Storefront",
  slug: "storefront",
  framework: "nextjs",
  appType: "web_app",
  hostingProvider: "vercel",
  releaseStrategy: "git_sha",
};

describe("slugs", () => {
  it.each(["ab", "my-app", "app2", "a1-b2-c3"])("accepts %s", (slug) => {
    expect(SLUG_PATTERN.test(slug)).toBe(true);
  });
  it.each(["a", "-app", "app-", "my--app", "My-App", "app_1", "a".repeat(49)])("rejects %s", (slug) => {
    expect(SLUG_PATTERN.test(slug)).toBe(false);
  });
  it("slugifies names", () => {
    expect(slugify("  Café Storefront — v2!  ")).toBe("cafe-storefront-v2");
    expect(SLUG_PATTERN.test(slugify("Hello World"))).toBe(true);
  });
});

describe("createProjectInputSchema", () => {
  it("applies default environments and monitoring", () => {
    const parsed = createProjectInputSchema.parse(base);
    expect(parsed.environments.map((e) => e.slug)).toEqual(["production", "staging", "development"]);
    expect(parsed.monitoring.staleAfterMinutes).toBe(60);
    expect(parsed.baseUrl).toBeUndefined();
  });

  it("normalizes empty URLs to null and rejects non-http URLs", () => {
    expect(createProjectInputSchema.parse({ ...base, baseUrl: "" }).baseUrl).toBeNull();
    expect(createProjectInputSchema.safeParse({ ...base, baseUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(createProjectInputSchema.safeParse({ ...base, baseUrl: "https://shop.example.com" }).success).toBe(true);
  });

  it("requires a production environment and unique environment slugs", () => {
    const noProd = createProjectInputSchema.safeParse({
      ...base,
      environments: [{ name: "Staging", slug: "staging", kind: "staging" }],
    });
    expect(noProd.success).toBe(false);

    const dup = createProjectInputSchema.safeParse({
      ...base,
      environments: [
        { name: "Prod", slug: "prod", kind: "production" },
        { name: "Prod 2", slug: "prod", kind: "production" },
      ],
    });
    expect(dup.success).toBe(false);
  });

  it("rejects unknown frameworks", () => {
    expect(createProjectInputSchema.safeParse({ ...base, framework: "cobol" }).success).toBe(false);
  });
});
