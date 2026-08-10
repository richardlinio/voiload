/**
 * language-matrix.spec.ts
 * Verifies the extension recognises the voice-message slider across every
 * supported locale, and — the point of the language-independent detection —
 * across locales that are absent from the aria-label dictionary too.
 *
 * Detection keys off `[role="slider"][aria-valuemin="0"][aria-valuemax]`, guarded
 * by companion controls in the container (a play control, matched on role alone,
 * plus an mm:ss label). The dictionary is only an auxiliary signal, so a locale
 * nobody has translated yet must still work.
 *
 * Recognition signal: the content script's contextmenu handler sends a
 * RIGHT_CLICK message carrying a positive `durationMs` only when
 * findVoiceMessageElement locates a slider. An unrecognised element yields a
 * RIGHT_CLICK with no durationMs. We observe these messages via an extra
 * onMessage listener injected into the service worker.
 */
import {
  MESSAGE_ACTIONS,
  DOM_CONSTANTS,
} from "../../extension/scripts/utils/constants";

import {
  test,
  expect,
  instrumentMessages,
  resetRecordedMessages,
  readRecordedMessages,
} from "./extension";

const DURATION_SECONDS = 2; // matches tests/e2e/fixtures/test-audio.wav
const ARIA_LABELS = DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL;

interface RecogniseOptions {
  ariaLabel: string;
  renderSlider?: boolean;
  playButtonLabel?: string;
  renderPlayButton?: boolean;
  renderDurationText?: boolean;
  renderVideo?: boolean;
}

/**
 * Loads a fixture with the given options, right-clicks the slider, and
 * returns whether the resulting RIGHT_CLICK message carried a durationMs
 * (i.e. the element was recognised as a voice message).
 */
async function wasRecognised(
  context: import("@playwright/test").BrowserContext,
  serviceWorker: import("@playwright/test").Worker,
  serveFixture: (opts: RecogniseOptions & {
    durationSeconds: number;
  }) => Promise<string>,
  opts: RecogniseOptions
): Promise<boolean> {
  const renderSlider = opts.renderSlider ?? true;
  const url = await serveFixture({
    ...opts,
    renderSlider,
    durationSeconds: DURATION_SECONDS,
  });

  const page = await context.newPage();
  try {
    await page.goto(url);
    // Let content + page-context initialise (content inits message handler at
    // +300ms and page-context creates the blob at +800ms).
    await page.waitForTimeout(1500);

    await resetRecordedMessages(serviceWorker);

    const selector = renderSlider
      ? '[data-testid="voice-slider"]'
      : '[data-testid="not-a-slider"]';
    await page.dispatchEvent(selector, "contextmenu");
    await page.waitForTimeout(800);

    const messages = await readRecordedMessages(serviceWorker);
    const rightClicks = messages.filter(
      (m) => m.action === MESSAGE_ACTIONS.RIGHT_CLICK
    );
    // Recognised iff at least one RIGHT_CLICK carried a numeric durationMs.
    return rightClicks.some(
      (m) => typeof m.durationMs === "number" && (m.durationMs as number) > 0
    );
  } finally {
    await page.close();
  }
}

test.describe("voice message language matrix", () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await instrumentMessages(serviceWorker);
  });

  for (const label of ARIA_LABELS) {
    test(`recognises slider with aria-label "${label}"`, async ({
      context,
      serviceWorker,
      serveFixture,
    }) => {
      const recognised = await wasRecognised(
        context,
        serviceWorker,
        serveFixture,
        { ariaLabel: label }
      );
      expect(recognised).toBe(true);
    });
  }

  test("recognises a slider whose aria-label is outside the dictionary", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    // The whole point of language-independent detection: an untranslated locale
    // (here Indonesian) must not fail silently.
    const recognised = await wasRecognised(
      context,
      serviceWorker,
      serveFixture,
      { ariaLabel: "Penggeser audio" }
    );
    expect(recognised).toBe(true);
  });

  test("recognises a slider whose play control is localized", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    // The play control is matched on role alone; its label is localized too.
    const recognised = await wasRecognised(
      context,
      serviceWorker,
      serveFixture,
      { ariaLabel: "Ползунок аудио", playButtonLabel: "Воспроизвести" }
    );
    expect(recognised).toBe(true);
  });

  test("does NOT recognise a container without any slider", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    const recognised = await wasRecognised(
      context,
      serviceWorker,
      serveFixture,
      { ariaLabel: "unused", renderSlider: false }
    );
    expect(recognised).toBe(false);
  });

  test("does NOT recognise a slider with no play control", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    // e.g. a standalone volume slider.
    const recognised = await wasRecognised(
      context,
      serviceWorker,
      serveFixture,
      { ariaLabel: "Audio scrubber", renderPlayButton: false }
    );
    expect(recognised).toBe(false);
  });

  test("does NOT recognise a slider with no mm:ss duration label", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    const recognised = await wasRecognised(
      context,
      serviceWorker,
      serveFixture,
      { ariaLabel: "Audio scrubber", renderDurationText: false }
    );
    expect(recognised).toBe(false);
  });

  test("does NOT recognise a video player scrubber", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    // A video scrubber carries a play control and a time label, but its
    // container also holds a <video>.
    const recognised = await wasRecognised(
      context,
      serviceWorker,
      serveFixture,
      { ariaLabel: "Video scrubber", renderVideo: true }
    );
    expect(recognised).toBe(false);
  });
});
