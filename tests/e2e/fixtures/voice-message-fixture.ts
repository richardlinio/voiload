/**
 * voice-message-fixture.ts
 * Generates the minimal Facebook-voice-message DOM that the extension detects.
 *
 * The rendered page mimics a real FB voice message: a container holding a
 * `<div role="slider" aria-label="{label}" aria-valuemax="{duration}">`. On load
 * the page fetches a (route-mocked) fbcdn audio URL, wraps the bytes in a Blob,
 * and calls URL.createObjectURL — which the extension's page-context patch
 * intercepts to register the voice message.
 */

/** The route-mocked URLs the extension's content_scripts / host permissions match. */
export const FIXTURE_PAGE_URL = "https://www.facebook.com/__e2e__/voice";
export const FIXTURE_AUDIO_URL = "https://cdn.fbcdn.net/__e2e__/audio.wav";

export interface FixtureOptions {
  /** aria-label of the slider (from DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL). */
  ariaLabel: string;
  /** Duration in seconds -> aria-valuemax. Must match the fixture audio length. */
  durationSeconds: number;
  /** MIME type assigned to the created Blob. Defaults to a detected audio type. */
  blobType?: string;
  /** When false, the container has no role="slider" child (negative case). */
  renderSlider?: boolean;
  /**
   * Content-Type header the mocked fbcdn audio response is served with.
   * Set to a value outside WEB_REQUEST_CONSTANTS.AUDIO_CONTENT_TYPES
   * (e.g. "audio/mpeg") to make the webRequest interceptor ignore the request,
   * isolating the blob (createObjectURL) registration path.
   */
  audioContentType?: string;
}

/**
 * Build the fixture HTML document.
 *
 * The page exposes two globals for the E2E test to observe/drive:
 *  - `window.__E2E_BLOB_READY` : Promise that resolves once createObjectURL ran.
 *  - `window.__E2E_LAST_BLOB_URL` : the created blob: URL (or null).
 */
export function buildFixtureHtml(opts: FixtureOptions): string {
  const {
    ariaLabel,
    durationSeconds,
    blobType = "audio/wav",
    renderSlider = true,
  } = opts;

  const sliderHtml = renderSlider
    ? `<div
         role="slider"
         aria-label="${escapeHtml(ariaLabel)}"
         aria-valuemin="0"
         aria-valuemax="${durationSeconds}"
         aria-valuenow="0"
         tabindex="0"
         data-testid="voice-slider"
       ></div>`
    : `<div data-testid="not-a-slider">no slider here</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>E2E Voice Message Fixture</title></head>
<body>
  <div data-testid="voice-container" style="padding:40px;border:1px solid #ccc">
    <div>Voice message</div>
    ${sliderHtml}
    <audio data-testid="voice-audio" controls></audio>
  </div>
  <script>
    (function () {
      window.__E2E_LAST_BLOB_URL = null;
      const audioUrl = ${JSON.stringify(FIXTURE_AUDIO_URL)};
      const blobType = ${JSON.stringify(blobType)};

      async function createVoiceBlob() {
        const res = await fetch(audioUrl);
        const bytes = await res.arrayBuffer();
        const blob = new Blob([bytes], { type: blobType });
        // This call is what the extension's page-context patch intercepts.
        const blobUrl = URL.createObjectURL(blob);
        window.__E2E_LAST_BLOB_URL = blobUrl;
        const audioEl = document.querySelector('[data-testid="voice-audio"]');
        if (audioEl) { audioEl.src = blobUrl; }
        return blobUrl;
      }

      // page-context.js installs its URL.createObjectURL patch at document_idle.
      // Delay slightly so the patch is in place before we create the blob, then
      // expose a manual trigger the test can re-invoke to be robust to timing.
      window.__E2E_CREATE_BLOB = createVoiceBlob;
      window.__E2E_BLOB_READY = new Promise((resolve) => {
        setTimeout(() => { createVoiceBlob().then(resolve, resolve); }, 800);
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
