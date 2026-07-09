/**
 * language-matrix.spec.ts
 * Verifies the extension recognises the voice-message slider across every
 * supported locale, driven directly from the source-of-truth aria-label
 * dictionary so new locales are covered automatically.
 *
 * Recognition signal: the content script's contextmenu handler sends a
 * RIGHT_CLICK message carrying `durationMs` ONLY when findVoiceMessageElement
 * locates a slider whose aria-label is in DOM_CONSTANTS. An unrecognised label
 * yields a RIGHT_CLICK with no durationMs. We observe these messages via an
 * extra onMessage listener injected into the service worker.
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

/**
 * Loads a fixture with the given aria-label, right-clicks the slider, and
 * returns whether the resulting RIGHT_CLICK message carried a durationMs
 * (i.e. the element was recognised as a voice message).
 */
async function wasRecognised(
  context: import("@playwright/test").BrowserContext,
  serviceWorker: import("@playwright/test").Worker,
  serveFixture: (opts: {
    ariaLabel: string;
    durationSeconds: number;
    renderSlider?: boolean;
  }) => Promise<string>,
  opts: { ariaLabel: string; renderSlider?: boolean }
): Promise<boolean> {
  const renderSlider = opts.renderSlider ?? true;
  const url = await serveFixture({
    ariaLabel: opts.ariaLabel,
    durationSeconds: DURATION_SECONDS,
    renderSlider,
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

  test("does NOT recognise an aria-label outside the dictionary", async ({
    context,
    serviceWorker,
    serveFixture,
  }) => {
    const recognised = await wasRecognised(
      context,
      serviceWorker,
      serveFixture,
      { ariaLabel: "Definitely Not A Voice Slider 12345" }
    );
    expect(recognised).toBe(false);
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
});
