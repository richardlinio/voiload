/**
 * voice-message-download.spec.ts
 * Happy-path E2E: load a Facebook-domain fixture with a voice message, let the
 * extension capture the audio blob, simulate a right-click + "Download Voice
 * Message" menu click, and assert chrome.downloads.download is invoked with the
 * expected URL and filename.
 *
 * Native OS context menus can't be driven by Playwright (known limitation), so
 * the menu click is simulated by dispatching chrome.contextMenus.onClicked from
 * the service worker after the real contextmenu event has populated the
 * background's lastRightClickedInfo through the normal message pipeline.
 */
import {
  test,
  expect,
  instrumentDownloads,
  readRecordedDownloads,
} from "./extension";

const DURATION_SECONDS = 2; // matches tests/e2e/fixtures/test-audio.wav

test("blob path: captured createObjectURL blob is downloaded on menu click", async ({
  context,
  serviceWorker,
  serveFixture,
}) => {
  // Serve the audio with a Content-Type outside the webRequest interceptor's
  // AUDIO_CONTENT_TYPES so ONLY the blob (createObjectURL) path registers the
  // download URL. This isolates the primary detection path under test.
  const url = await serveFixture({
    ariaLabel: "Audio scrubber",
    durationSeconds: DURATION_SECONDS,
    audioContentType: "audio/mpeg",
    blobType: "audio/mpeg",
  });

  await instrumentDownloads(serviceWorker);

  const page = await context.newPage();
  await page.goto(url);

  // Wait until the page has created the object URL from the fetched audio.
  await page.waitForFunction(
    () => (window as any).__E2E_LAST_BLOB_URL !== null,
    { timeout: 15_000 }
  );
  const pageBlobUrl: string = await page.evaluate(
    () => (window as any).__E2E_LAST_BLOB_URL
  );
  expect(pageBlobUrl).toMatch(/^blob:https:\/\/www\.facebook\.com\//);

  // Give the page->content->background registration pipeline time to land.
  await page.waitForTimeout(2000);

  // Right-click the slider: content script's contextmenu listener sends the
  // RIGHT_CLICK message (with duration), which background matches against the
  // registered blob and stores as lastRightClickedInfo.
  await page.dispatchEvent('[data-testid="voice-slider"]', "contextmenu");
  await page.waitForTimeout(1500);

  // Simulate clicking the native "Download Voice Message" menu item.
  await serviceWorker.evaluate(() => {
    // @ts-expect-error playwright exposes .dispatch on mocked events
    chrome.contextMenus.onClicked.dispatch(
      { menuItemId: "downloadVoiceMessage" },
      { id: 1 }
    );
  });
  await page.waitForTimeout(1000);

  const downloads = await readRecordedDownloads(serviceWorker);
  expect(downloads.length).toBeGreaterThanOrEqual(1);

  const dl = downloads[downloads.length - 1]!;
  // The blob path won: the download URL is exactly the page's blob: URL.
  expect(dl.url).toBe(pageBlobUrl);
  expect(dl.filename).toMatch(/^voice-message-.*\.mp4$/);
});

test("full pipeline: webRequest-detected audio is downloaded on menu click", async ({
  context,
  serviceWorker,
  serveFixture,
}) => {
  // Default audio Content-Type (audio/wav) is in AUDIO_CONTENT_TYPES, so the
  // webRequest interceptor also detects the fbcdn request. This exercises the
  // end-to-end pipeline the way a real Facebook page would.
  const url = await serveFixture({
    ariaLabel: "Audio scrubber",
    durationSeconds: DURATION_SECONDS,
  });

  await instrumentDownloads(serviceWorker);

  const page = await context.newPage();
  await page.goto(url);

  await page.waitForFunction(
    () => (window as any).__E2E_LAST_BLOB_URL !== null,
    { timeout: 15_000 }
  );
  await page.waitForTimeout(2000);

  await page.dispatchEvent('[data-testid="voice-slider"]', "contextmenu");
  await page.waitForTimeout(1500);

  await serviceWorker.evaluate(() => {
    // @ts-expect-error playwright exposes .dispatch on mocked events
    chrome.contextMenus.onClicked.dispatch(
      { menuItemId: "downloadVoiceMessage" },
      { id: 1 }
    );
  });
  await page.waitForTimeout(1000);

  const downloads = await readRecordedDownloads(serviceWorker);
  expect(downloads.length).toBeGreaterThanOrEqual(1);

  const dl = downloads[downloads.length - 1]!;
  // A valid audio URL is downloaded (blob: from createObjectURL or the fbcdn
  // URL from the webRequest path — both are correct end states).
  expect(dl.url).toMatch(
    /^(blob:https:\/\/www\.facebook\.com\/|https:\/\/cdn\.fbcdn\.net\/)/
  );
  expect(dl.filename).toMatch(/^voice-message-.*\.mp4$/);
});
