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
import type { Page, Worker } from "@playwright/test";

import {
  test,
  expect,
  instrumentDownloads,
  readRecordedDownloads,
} from "./extension";
import { AUDIO_FILES } from "./fixtures/voice-message-fixture";

const DURATION_SECONDS = 2; // matches tests/e2e/fixtures/test-audio.wav

/**
 * Right-click a slider and dispatch the "Download Voice Message" menu click,
 * then return every recorded chrome.downloads.download call.
 *
 * The contextmenu event drives the content script's normal message pipeline,
 * which populates the background's lastRightClickedInfo; the menu click is
 * dispatched from the service worker because Playwright cannot reach a native
 * OS context menu.
 */
async function downloadViaRightClick(
  page: Page,
  serviceWorker: Worker,
  sliderTestId = "voice-slider"
): Promise<Array<{ url: string; filename: string }>> {
  await page.dispatchEvent(`[data-testid="${sliderTestId}"]`, "contextmenu");
  await page.waitForTimeout(1500);

  await serviceWorker.evaluate(() => {
    // @ts-expect-error playwright exposes .dispatch on mocked events
    chrome.contextMenus.onClicked.dispatch(
      { menuItemId: "downloadVoiceMessage" },
      { id: 1 }
    );
  });
  await page.waitForTimeout(1000);

  return readRecordedDownloads(serviceWorker);
}

/** Wait until the page has created a blob URL for every rendered message. */
async function waitForBlobs(page: Page, count: number): Promise<string[]> {
  await page.waitForFunction(
    (n) => {
      const urls = (window as any).__E2E_BLOB_URLS;
      return Array.isArray(urls) && urls.filter(Boolean).length >= n;
    },
    count,
    { timeout: 20_000 }
  );
  // Let the page -> content -> background registration pipeline land.
  await page.waitForTimeout(2000);
  return page.evaluate(() => (window as any).__E2E_BLOB_URLS as string[]);
}

/**
 * Assert a download came from the duration match rather than the batch fallback.
 *
 * When matching fails, background responds DOWNLOAD_ALL_VOICE_MESSAGES and
 * downloadAllVoiceMessages() re-downloads every stored item — which, on a page
 * holding a single voice message, downloads exactly the blob the test expected.
 * The two paths are told apart by the filename: the batch path appends the item
 * id as a uniqueIdentifier, the matched path does not.
 */
function expectMatchedDownload(
  downloads: Array<{ url: string; filename: string }>,
  expectedUrl: string | undefined
): void {
  expect(downloads).toHaveLength(1);
  const dl = downloads[0]!;
  expect(dl.url).toBe(expectedUrl);
  expect(dl.filename).toMatch(/^voice-message-[\d-]+\.mp4$/);
  // The batch fallback would have produced `voice-message-<date>-voice-msg-<id>.mp4`.
  expect(dl.filename).not.toContain("voice-msg-");
}

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

/**
 * Regressions for the three symptoms users reported as "clicking download does
 * nothing". Each pairs an audio file with the integer-second aria-valuemax
 * Facebook would show beside it, so the DOM duration and the decoded blob
 * duration disagree exactly as they do in production.
 */
test.describe("regressions: reported download failures", () => {
  test("a 3KB short voice message is downloadable", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    // Real e2ee voice messages are tiny: a 7s clip measured 3,323 bytes. The
    // blob analyzer used to discard anything under 20KB, so the message never
    // reached the store and the right-click found nothing to download.
    const audio = AUDIO_FILES["voice-short.ogg"];
    expect(audio.bytes).toBeLessThan(20 * 1024);

    const url = await serveFixture({
      ariaLabel: "Audio scrubber",
      durationSeconds: audio.ariaValuemax,
      audioFile: "voice-short.ogg",
      // Keep the webRequest path out of it: the blob path is what regressed.
      audioContentType: "audio/mpeg",
    });

    await instrumentDownloads(serviceWorker);
    const page = await context.newPage();
    await page.goto(url);

    const [blobUrl] = await waitForBlobs(page, 1);
    const downloads = await downloadViaRightClick(page, serviceWorker);

    expectMatchedDownload(downloads, blobUrl);
  });

  test("a 61 second voice message is downloadable", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    // The slider reports 61s; the blob decodes to 60,557ms. Matching used to
    // require the two to agree within 5ms, so a 443ms gap missed every time.
    const audio = AUDIO_FILES["voice-long.ogg"];
    const gapMs = Math.abs(audio.decodedMs - audio.ariaValuemax * 1000);
    expect(gapMs).toBeGreaterThan(5);

    const url = await serveFixture({
      ariaLabel: "Audio scrubber",
      durationSeconds: audio.ariaValuemax,
      audioFile: "voice-long.ogg",
      audioContentType: "audio/mpeg",
    });

    await instrumentDownloads(serviceWorker);
    const page = await context.newPage();
    await page.goto(url);

    const [blobUrl] = await waitForBlobs(page, 1);
    const downloads = await downloadViaRightClick(page, serviceWorker);

    expectMatchedDownload(downloads, blobUrl);
  });

  test("two messages on the same integer second resolve to the nearest blob", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    // Both sliders read 3s, but the blobs decode to 2,774ms and 3,147ms, so a
    // 3,000ms lookup has two candidates inside the tolerance band. The matcher
    // takes the nearest — message 2, 147ms out, against message 1's 226ms — and
    // downloads a real blob instead of falling back to "download everything".
    //
    // Note what this does NOT establish: both sliders send the same 3,000ms, so
    // the store cannot tell them apart and right-clicking message 1 resolves to
    // message 2's blob as well. Distinguishing them needs an element->blob
    // binding, which duration matching cannot provide (see w2 out_of_scope).
    const near = AUDIO_FILES["voice-collide-b.ogg"];
    const far = AUDIO_FILES["voice-collide-a.ogg"];
    const target = near.ariaValuemax * 1000;
    expect(Math.abs(near.decodedMs - target)).toBeLessThan(
      Math.abs(far.decodedMs - target)
    );

    const url = await serveFixture({
      ariaLabel: "unused",
      durationSeconds: far.ariaValuemax,
      audioContentType: "audio/mpeg",
      messages: [
        {
          ariaLabel: "Audio scrubber",
          durationSeconds: far.ariaValuemax,
          audioFile: "voice-collide-a.ogg",
        },
        {
          ariaLabel: "Audio scrubber",
          durationSeconds: near.ariaValuemax,
          audioFile: "voice-collide-b.ogg",
        },
      ],
    });

    await instrumentDownloads(serviceWorker);
    const page = await context.newPage();
    await page.goto(url);

    const blobUrls = await waitForBlobs(page, 2);
    expect(blobUrls[0]).not.toBe(blobUrls[1]);

    const downloads = await downloadViaRightClick(
      page,
      serviceWorker,
      "voice-slider-1"
    );

    // One download, and from the match rather than the two-file batch fallback.
    expectMatchedDownload(downloads, blobUrls[1]);
  });
});
