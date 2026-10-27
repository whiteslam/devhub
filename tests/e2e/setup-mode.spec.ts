import { expect, test } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";

test.describe("without Supabase configured", () => {
  test("every dashboard route leads to the setup guide, never to sample data", async ({ page }) => {
    for (const path of ["/", "/projects", "/audit", "/projects/anything/settings"]) {
      await page.goto(`${BASE}${path}`);
      await expect(page).toHaveURL(`${BASE}/setup`);
    }
    await expect(page.getByRole("heading", { name: "Connect DevHub to Supabase" })).toBeVisible();
    await expect(page.getByText("never displays sample data")).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(4);
  });

  test("health endpoint reports the missing configuration honestly", async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: "ok", service: "devhub-web", checks: { supabaseConfig: { status: "degraded" } } });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });
});
