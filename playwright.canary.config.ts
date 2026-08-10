import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the messenger.com drift canary.
 *
 * Separate from `playwright.config.ts` on purpose. The main E2E suite loads the
 * extension into a headed persistent context and talks only to route-mocked
 * fixtures; the canary loads no extension, runs headless, and talks to the real
 * facebook.com. Sharing one config would drag one set of constraints onto the
 * other — and, more importantly, would let the per-push CI reach out to
 * Facebook, which it must never do.
 *
 * `storageState` comes from a file the workflow materialises from the
 * FB_CANARY_STORAGE_STATE secret. Absent it, every test fails on the signed-in
 * precondition rather than misreporting drift.
 */
const STORAGE_STATE = process.env.FB_CANARY_STORAGE_STATE_PATH;

export default defineConfig({
  testDir: "./tests/canary",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,

  // A canary that cries wolf gets muted. One retry absorbs a slow thread
  // hydration or a transient Facebook error page; a real drift fails twice.
  retries: 1,

  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    // Retain on the first failure, not just the retry: a drift that reproduces
    // is still worth a trace, and `retain-on-failure` keeps both attempts.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    storageState: STORAGE_STATE || undefined,
    // Facebook serves different markup to headless-looking clients; a normal
    // desktop viewport keeps the thread view (not the mobile fallback).
    viewport: { width: 1280, height: 900 },
  },
});
