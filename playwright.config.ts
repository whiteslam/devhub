import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the production build (`next start`) twice:
 *  - port 3100 without Supabase configured (setup mode),
 *  - port 3101 configured with an unreachable Supabase URL, which exercises
 *    the auth guard for signed-out visitors without any real credentials.
 * Authenticated flows need a real Supabase project; see docs/testing.md.
 */
const start = "pnpm --filter @devhub/web exec next start";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `${start} --port 3100`,
      url: "http://127.0.0.1:3100/api/health",
      reuseExistingServer: !process.env.CI,
      env: { SUPABASE_URL: "", SUPABASE_PUBLISHABLE_KEY: "", DEVHUB_APP_URL: "http://127.0.0.1:3100" },
    },
    {
      command: `${start} --port 3101`,
      url: "http://127.0.0.1:3101/api/health",
      reuseExistingServer: !process.env.CI,
      env: {
        SUPABASE_URL: "http://127.0.0.1:9",
        SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_placeholder_key_000000",
        DEVHUB_APP_URL: "http://127.0.0.1:3101",
      },
    },
  ],
});
