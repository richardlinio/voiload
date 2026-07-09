/**
 * extension.ts
 * Playwright test fixtures for loading the built VoiLoad extension and serving
 * route-mocked Facebook fixtures.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  test as base,
  chromium,
  type BrowserContext,
  type Worker,
} from "@playwright/test";

import {
  FIXTURE_AUDIO_URL,
  FIXTURE_PAGE_URL,
  buildFixtureHtml,
  type FixtureOptions,
} from "./fixtures/voice-message-fixture";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const DIST_DIR = resolve(REPO_ROOT, "dist");
const AUDIO_FIXTURE = resolve(__dirname, "fixtures", "test-audio.wav");

export interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  /** Registers the page + audio routes and returns the fixture page URL. */
  serveFixture: (opts: FixtureOptions) => Promise<string>;
}

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    if (!existsSync(DIST_DIR)) {
      throw new Error(
        `dist/ not found at ${DIST_DIR}. Run \`pnpm build\` before the E2E suite.`
      );
    }

    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${DIST_DIR}`,
        `--load-extension=${DIST_DIR}`,
        "--no-sandbox",
      ],
    });

    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) {
      sw = await context.waitForEvent("serviceworker", { timeout: 15_000 });
    }
    await use(sw);
  },

  extensionId: async ({ serviceWorker }, use) => {
    // sw.url() looks like chrome-extension://<id>/scripts/background.js
    const id = new URL(serviceWorker.url()).host;
    await use(id);
  },

  serveFixture: async ({ context }, use) => {
    const audioBytes = readFileSync(AUDIO_FIXTURE);
    let audioContentType = "audio/wav";

    // Serve the fake fbcdn audio as a real, decodable WAV. The declared
    // Content-Type is chosen per-fixture (see FixtureOptions.audioContentType).
    await context.route(FIXTURE_AUDIO_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: audioContentType,
        body: audioBytes,
      });
    });

    const serve = async (opts: FixtureOptions): Promise<string> => {
      if (opts.audioContentType) {
        audioContentType = opts.audioContentType;
      }
      const html = buildFixtureHtml(opts);
      // Route the fixture page under www.facebook.com so content_scripts inject.
      await context.route(FIXTURE_PAGE_URL, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: html,
        });
      });
      return FIXTURE_PAGE_URL;
    };

    await use(serve);
  },
});

export const expect = test.expect;

/**
 * Instruments the background service worker so downloads become observable:
 * replaces `chrome.downloads.download` with a recorder that pushes call args
 * onto `self.__E2E_DOWNLOADS`. Returns nothing; read results with
 * `readRecordedDownloads`.
 */
export async function instrumentDownloads(sw: Worker): Promise<void> {
  await sw.evaluate(() => {
    // @ts-expect-error injected test global
    if (self.__E2E_DOWNLOADS_PATCHED) {
      return;
    }
    // @ts-expect-error injected test global
    self.__E2E_DOWNLOADS = [];
    const orig = chrome.downloads.download;
    chrome.downloads.download = ((options: any, cb?: any) => {
      // @ts-expect-error injected test global
      self.__E2E_DOWNLOADS.push(options);
      // Return a fake download id without actually writing a file.
      if (typeof cb === "function") {
        cb(Date.now() % 100000);
      }
      return Promise.resolve(Date.now() % 100000);
    }) as typeof chrome.downloads.download;
    // Keep a handle so we could restore if needed.
    // @ts-expect-error injected test global
    self.__E2E_DOWNLOADS_ORIG = orig;
    // @ts-expect-error injected test global
    self.__E2E_DOWNLOADS_PATCHED = true;
  });
}

/** Reads the recorded chrome.downloads.download call arguments from the SW. */
export async function readRecordedDownloads(
  sw: Worker
): Promise<Array<{ url: string; filename: string; saveAs?: boolean }>> {
  return sw.evaluate(() => {
    // @ts-expect-error injected test global
    return (self.__E2E_DOWNLOADS as any[]) || [];
  });
}

/**
 * Adds an extra chrome.runtime.onMessage listener in the SW that records every
 * inbound message. Used to observe whether the content script recognised a
 * voice message: a recognised right-click carries `durationMs`, an unrecognised
 * one (aria-label not in the dictionary) does not.
 */
export async function instrumentMessages(sw: Worker): Promise<void> {
  await sw.evaluate(() => {
    // @ts-expect-error injected test global
    if (self.__E2E_MESSAGES_PATCHED) {
      return;
    }
    // @ts-expect-error injected test global
    self.__E2E_MESSAGES = [];
    chrome.runtime.onMessage.addListener((message) => {
      // @ts-expect-error injected test global
      self.__E2E_MESSAGES.push(message);
      // Do not consume the message; let the extension's own listener respond.
      return false;
    });
    // @ts-expect-error injected test global
    self.__E2E_MESSAGES_PATCHED = true;
  });
}

/** Resets the recorded message log (call before each interaction to isolate). */
export async function resetRecordedMessages(sw: Worker): Promise<void> {
  await sw.evaluate(() => {
    // @ts-expect-error injected test global
    self.__E2E_MESSAGES = [];
  });
}

/** Reads all messages the SW has received since the last reset. */
export async function readRecordedMessages(
  sw: Worker
): Promise<Array<Record<string, unknown>>> {
  return sw.evaluate(() => {
    // @ts-expect-error injected test global
    return (self.__E2E_MESSAGES as any[]) || [];
  });
}
