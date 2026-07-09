/**
 * messenger-drift.spec.ts
 * Synthetic monitor: runs against the *real* messenger.com on a daily cron and
 * fails when Facebook ships a change that would break voice-message detection.
 *
 * This is not an E2E test of the extension. The extension is never loaded — the
 * canary only asserts that the DOM signals detection keys off still exist on a
 * live thread. It lives outside `tests/e2e/` (the main suite's testDir) so the
 * per-push CI never reaches out to facebook.com.
 *
 * Two failures look alike from the outside and must not be confused:
 *
 *   session-expired — the storageState secret went stale; nothing is wrong with
 *                     the extension. Richard re-runs codegen and updates the
 *                     secret. Detected *before* any DOM assertion, by the
 *                     absence of a `c_user` cookie (Facebook's user-id cookie),
 *                     confirmed by the login form on the page.
 *
 *   dom-drift       — we are logged in and the thread rendered, but a signal
 *                     detection depends on is gone. This is the real alarm.
 *
 * Ordering matters: an expired session serves the logged-out marketing page,
 * which has no sliders at all. Asserting on the DOM first would report that as
 * drift and send Richard hunting a Facebook redesign that never happened.
 */
import { test, expect, type Page } from "@playwright/test";

import { DOM_CONSTANTS } from "../../extension/scripts/utils/constants";

/**
 * The thread the canary opens. A thread with at least one voice message is
 * required — without one there is no slider to assert on, and the canary would
 * report drift on an empty conversation.
 */
const THREAD_URL = process.env.FB_CANARY_THREAD_URL;

/** Facebook's user-id cookie. Present iff the storageState carries a session. */
const SESSION_COOKIE = "c_user";

const SLIDER_SELECTOR = DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_SELECTOR;
const KNOWN_LABELS: readonly string[] =
  DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL;

/**
 * Fails with a `session-expired` verdict rather than a DOM assertion when the
 * context carries no Facebook session. Checked against the cookie jar rather
 * than the page markup: the logged-out marketing page is itself a Facebook
 * surface that can be redesigned, whereas `c_user` is load-bearing for FB and
 * will not quietly change meaning.
 */
async function assertSignedIn(page: Page): Promise<void> {
  const cookies = await page.context().cookies();
  const hasSession = cookies.some(
    (c) => c.name === SESSION_COOKIE && c.value !== ""
  );

  const loginFormVisible = await page
    .locator('input[name="email"], input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false);

  if (!hasSession || loginFormVisible) {
    throw new Error(
      [
        "VERDICT: session-expired",
        "",
        `The canary is not signed in to messenger.com (c_user cookie present: ${hasSession}, login form visible: ${loginFormVisible}).`,
        "This is NOT a Facebook redesign — the FB_CANARY_STORAGE_STATE secret has gone stale.",
        "",
        "Fix: re-run Playwright codegen against messenger.com while signed in,",
        "then update the FB_CANARY_STORAGE_STATE repository secret with the new storageState JSON.",
      ].join("\n")
    );
  }
}

test.describe("messenger.com drift canary", () => {
  test.beforeEach(async ({ page }) => {
    // Deliberately a failure, not a skip. A skipped canary reports green every
    // morning while watching nothing — the one failure mode a monitor must not
    // have. Missing configuration is a broken alarm, and it should say so.
    if (!THREAD_URL) {
      throw new Error(
        [
          "VERDICT: misconfigured",
          "",
          "FB_CANARY_THREAD_URL is not set, so the canary has no thread to open",
          "and is watching nothing.",
          "",
          "Fix: set the FB_CANARY_THREAD_URL repository variable to a messenger.com",
          "thread URL containing at least one voice message, e.g.",
          "  gh variable set FB_CANARY_THREAD_URL --body 'https://www.messenger.com/t/<thread-id>'",
        ].join("\n")
      );
    }

    await page.goto(THREAD_URL, { waitUntil: "domcontentloaded" });
    await assertSignedIn(page);
  });

  test("the voice-message slider selector still matches a live thread", async ({
    page,
  }) => {
    const slider = page.locator(SLIDER_SELECTOR).first();

    // Messenger hydrates the thread client-side; the slider is not in the
    // initial HTML. A plain expect() would race it.
    await expect(
      slider,
      [
        "VERDICT: dom-drift",
        `We are signed in, but no element matched ${SLIDER_SELECTOR}.`,
        "Either the thread has no voice message, or Facebook changed how the",
        "voice-message scrubber is marked up. Detection keys off this selector,",
        "so downloads are broken until it is updated.",
      ].join("\n")
    ).toBeVisible({ timeout: 30_000 });
  });

  test("the slider still carries the companion controls detection guards on", async ({
    page,
  }) => {
    const slider = page.locator(SLIDER_SELECTOR).first();
    await expect(slider).toBeVisible({ timeout: 30_000 });

    // Mirrors `hasVoiceMessageControls` in content/dom-utils.ts: walk up at most
    // MAX_DEPTH ancestors looking for one that pairs the slider with a play
    // control and an mm:ss label, and holds no <video>.
    const guards = await slider.evaluate(
      (el, constants) => {
        const {
          maxDepth,
          playButtonSelector,
          nonVoiceMediaSelector,
          durationTextSource,
        } = constants;
        const durationPattern = new RegExp(durationTextSource);

        let node: Element | null = el.parentElement;
        for (let depth = 0; node && depth < maxDepth; depth += 1) {
          const hasPlayControl = !!node.querySelector(playButtonSelector);
          const hasVideo = !!node.querySelector(nonVoiceMediaSelector);
          const hasDurationText = durationPattern.test(node.textContent ?? "");

          if (hasPlayControl && hasDurationText && !hasVideo) {
            return { found: true, depth, hasPlayControl, hasDurationText };
          }
          node = node.parentElement;
        }
        return { found: false, depth: maxDepth };
      },
      {
        maxDepth: DOM_CONSTANTS.VOICE_MESSAGE_CONTAINER_MAX_DEPTH,
        playButtonSelector: DOM_CONSTANTS.PLAY_BUTTON_SELECTOR,
        nonVoiceMediaSelector: DOM_CONSTANTS.NON_VOICE_MEDIA_SELECTOR,
        durationTextSource: DOM_CONSTANTS.DURATION_TEXT_PATTERN.source,
      }
    );

    expect(
      guards.found,
      [
        "VERDICT: dom-drift",
        `Found the slider, but no ancestor within ${DOM_CONSTANTS.VOICE_MESSAGE_CONTAINER_MAX_DEPTH} hops`,
        "pairs it with a play control and an mm:ss label. The container guard in",
        "content/dom-utils.ts rejects the slider, so the voice message is not",
        "recognised. Facebook likely restructured the message container.",
        `Observed: ${JSON.stringify(guards)}`,
      ].join("\n")
    ).toBe(true);
  });

  test("the aria-label dictionary has not drifted", async ({ page }) => {
    const slider = page.locator(SLIDER_SELECTOR).first();
    await expect(slider).toBeVisible({ timeout: 30_000 });

    const label = await slider.getAttribute("aria-label");

    // The dictionary is an auxiliary signal — detection works without it (w4).
    // A miss here means Facebook renamed the label in this locale, which is
    // worth knowing (it invalidates the dictionary as a confidence signal) but
    // does not break downloads. Reported as its own verdict so the issue body
    // does not overstate the damage.
    expect(
      label,
      "VERDICT: dom-drift — the slider has no aria-label at all."
    ).not.toBeNull();

    expect(
      KNOWN_LABELS.includes(label as string),
      [
        "VERDICT: dictionary-drift",
        `The live slider's aria-label is ${JSON.stringify(label)}, which is not in`,
        "DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL.",
        "",
        "Downloads still work — detection is language-independent since w4 and",
        "never consults this dictionary. But the dictionary has gone stale as a",
        "confidence signal. Add the label, or drop the entry it replaced.",
      ].join("\n")
    ).toBe(true);
  });
});
