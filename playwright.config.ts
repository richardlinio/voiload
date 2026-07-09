import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the VoiLoad extension E2E suite.
 *
 * The extension must be loaded into a *persistent* Chromium context with a
 * head (headless mode does not load MV3 extensions the same way), so tests
 * launch their own context via the `extension` fixture rather than relying on
 * a shared `browser`. Run headed locally; CI wraps this in `xvfb-run`.
 *
 * `pnpm build` must run before this config (webServer/globalSetup would race
 * the persistent-context launch, so building is left to the `test:e2e` script).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    trace: "retain-on-failure",
  },
});
