import { expect, test } from "@playwright/test";

const BASE = "http://127.0.0.1:3101";

test.describe("signed-out visitor", () => {
  test("is sent to sign-in with a safe return path", async ({ page }) => {
    await page.goto(`${BASE}/projects/storefront/settings`);
    await expect(page).toHaveURL(`${BASE}/login?next=%2Fprojects%2Fstorefront%2Fsettings`);
    await expect(page.getByRole("heading", { name: "Sign in to DevHub" })).toBeVisible();
  });

  test("root redirects to sign-in without a next parameter", async ({ page }) => {
    await page.goto(`${BASE}/`);
    await expect(page).toHaveURL(`${BASE}/login`);
  });

  test("sign-in form is keyboard accessible and offers no public sign-up by default", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    const tabs = page.getByRole("tab");
    await expect(tabs).toHaveText(["Password", "Email link"]);
    await expect(page.getByLabel("Email")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
    await tabs.nth(1).click();
    await expect(page.getByRole("button", { name: "Send sign-in link" })).toBeVisible();
  });

  test("an expired link shows an error", async ({ page }) => {
    await page.goto(`${BASE}/auth/callback?code=bogus`);
    await expect(page).toHaveURL(`${BASE}/login?error=link`);
    await expect(page.getByRole("alert").filter({ hasText: "invalid or has expired" })).toBeVisible();
  });

  test("open-redirect attempts in the callback are neutralized", async ({ page }) => {
    await page.goto(`${BASE}/auth/callback?next=//evil.example`);
    await expect(page).toHaveURL(`${BASE}/login?error=link`);
  });

  test("MFA page requires a session", async ({ page }) => {
    await page.goto(`${BASE}/login/mfa`);
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test("a forwarded host cannot redirect the auth callback elsewhere", async ({ request }) => {
    const res = await request.get(`${BASE}/auth/callback?code=x`, {
      headers: { "x-forwarded-host": "evil.example", host: "evil.example" },
      maxRedirects: 0,
    });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toBe(`${BASE}/login?error=link`);
  });

  test("malformed request ids are replaced", async ({ request }) => {
    const res = await request.get(`${BASE}/login`, { headers: { "x-request-id": "<script>x</script>" } });
    expect(res.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("responses carry security headers and a request id", async ({ request }) => {
    const res = await request.get(`${BASE}/login`);
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("connect-src 'self'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["x-powered-by"]).toBeUndefined();
    expect(h["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("the bundle does not contain Supabase configuration", async ({ page }) => {
    const scripts: string[] = [];
    page.on("response", async (res) => {
      if (res.url().endsWith(".js")) scripts.push(await res.text());
    });
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState("networkidle");
    expect(scripts.length).toBeGreaterThan(0);
    for (const s of scripts) expect(s).not.toContain("sb_publishable_e2e_placeholder");
  });
});
