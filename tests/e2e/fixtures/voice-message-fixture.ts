/**
 * voice-message-fixture.ts
 * Generates the minimal Facebook-voice-message DOM that the extension detects.
 *
 * The rendered page mimics a real FB voice message: a container holding a play
 * control, a `<div role="slider" aria-valuemin="0" aria-valuemax="{duration}">`
 * and an mm:ss duration label. That trio is what the extension's guard requires
 * to tell a voice message apart from a volume or video slider; the structure
 * mirrors a real messenger.com thread (see .session/w4-notes.md). On load the
 * page fetches a (route-mocked) fbcdn audio URL, wraps the bytes in a Blob, and
 * calls URL.createObjectURL — which the extension's page-context patch
 * intercepts to register the voice message.
 *
 * On the real product aria-valuemax is an integer second count while the blob
 * decodes to precise milliseconds, so the two never agree exactly. Fixtures
 * carry both numbers independently: `durationSeconds` drives the DOM, and the
 * audio file supplies whatever the browser decodes. Pairing an audio file whose
 * real length merely *rounds* to `durationSeconds` reproduces the production
 * mismatch that the nearest-neighbour matcher exists to absorb.
 */

/** The route-mocked URLs the extension's content_scripts / host permissions match. */
export const FIXTURE_PAGE_URL = "https://www.facebook.com/__e2e__/voice";
export const FIXTURE_AUDIO_URL = "https://cdn.fbcdn.net/__e2e__/audio.wav";

/**
 * Audio files the fixture can serve, keyed by the name tests pass as `audioFile`.
 *
 * `decodedMs` is what Chrome's `Audio.duration` reports, which is the number the
 * extension actually matches on — ffprobe disagrees by 1ms on some Opus files,
 * so measure with a browser before editing these. `ariaValuemax` is the integer
 * second count Facebook would render beside it. Every Opus entry sits far
 * outside EXACT_MATCHING_TOLERANCE (5ms) of its integer second and well inside
 * MATCHING_TOLERANCE (1000ms), so a regression to exact-match turns the
 * regression specs red rather than letting them pass by coincidence.
 */
export const AUDIO_FILES = {
  /** 2.000s WAV. Its duration lands exactly on the integer second. */
  "test-audio.wav": {
    contentType: "audio/wav",
    blobType: "audio/wav",
    decodedMs: 2000,
    ariaValuemax: 2,
    bytes: 64044,
  },
  /**
   * 3KB Opus, shaped like a real e2ee voice message (measured: 3,323 bytes for
   * 7s). Falls under the 20KB floor that used to discard short voice messages.
   */
  "voice-short.ogg": {
    contentType: "audio/ogg",
    blobType: "audio/ogg",
    decodedMs: 6757,
    ariaValuemax: 7,
    bytes: 3029,
  },
  /** 61s Opus, decoding 443ms away from its integer second. */
  "voice-long.ogg": {
    contentType: "audio/ogg",
    blobType: "audio/ogg",
    decodedMs: 60557,
    ariaValuemax: 61,
    bytes: 41147,
  },
  /** Rounds to 3s from 226ms away — the farther of the two colliding messages. */
  "voice-collide-a.ogg": {
    contentType: "audio/ogg",
    blobType: "audio/ogg",
    decodedMs: 2774,
    ariaValuemax: 3,
    bytes: 3136,
  },
  /** Rounds to 3s from 147ms away — the nearer one, so a 3s lookup must pick it. */
  "voice-collide-b.ogg": {
    contentType: "audio/ogg",
    blobType: "audio/ogg",
    decodedMs: 3147,
    ariaValuemax: 3,
    bytes: 3562,
  },
} as const;

export type AudioFileName = keyof typeof AUDIO_FILES;

const DEFAULT_AUDIO_FILE: AudioFileName = "test-audio.wav";

/** One voice message rendered into the fixture page. */
export interface VoiceMessageSpec {
  /** aria-label of the slider. Detection no longer depends on it. */
  ariaLabel: string;
  /** Drives aria-valuemax and the mm:ss label. Integer seconds, as on FB. */
  durationSeconds: number;
  /** Which AUDIO_FILES entry this message fetches and wraps in a Blob. */
  audioFile?: AudioFileName;
  /** MIME type assigned to the created Blob. Defaults to the audio file's. */
  blobType?: string;
  /** When false, the container has no role="slider" child (negative case). */
  renderSlider?: boolean;
  /**
   * aria-label of the play control. Localized on real pages, so the extension
   * matches the control on its role alone; override this to prove that.
   */
  playButtonLabel?: string;
  /** When false, omit the play control (negative case for the guard). */
  renderPlayButton?: boolean;
  /** When false, omit the mm:ss duration label (negative case for the guard). */
  renderDurationText?: boolean;
  /** When true, add a <video> to the container (marks it as a video player). */
  renderVideo?: boolean;
}

export interface FixtureOptions extends VoiceMessageSpec {
  /**
   * Content-Type header the mocked fbcdn audio response is served with.
   * Set to a value outside WEB_REQUEST_CONSTANTS.AUDIO_CONTENT_TYPES
   * (e.g. "audio/mpeg") to make the webRequest interceptor ignore the request,
   * isolating the blob (createObjectURL) registration path.
   */
  audioContentType?: string;
  /**
   * Render several voice messages on one page. When present the top-level
   * message fields are ignored, and each entry gets its own container and its
   * own audio URL. Used to put two messages on the same integer second.
   */
  messages?: VoiceMessageSpec[];
}

/** Resolve the message list a fixture renders, whether single or multi. */
export function messagesOf(opts: FixtureOptions): VoiceMessageSpec[] {
  return opts.messages ?? [opts];
}

/** Distinct audio URL per message, so each container fetches its own blob. */
export function audioUrlFor(index: number): string {
  return index === 0 ? FIXTURE_AUDIO_URL : `${FIXTURE_AUDIO_URL}?m=${index}`;
}

/** The audio file a message fetches, defaulted. */
export function audioFileOf(msg: VoiceMessageSpec): AudioFileName {
  return msg.audioFile ?? DEFAULT_AUDIO_FILE;
}

/**
 * Build the fixture HTML document.
 *
 * The page exposes globals for the E2E test to observe/drive:
 *  - `window.__E2E_BLOB_READY`    : Promise resolved once every blob was created.
 *  - `window.__E2E_LAST_BLOB_URL` : the most recently created blob: URL, or null.
 *  - `window.__E2E_BLOB_URLS`     : one blob: URL per message, in render order.
 */
export function buildFixtureHtml(opts: FixtureOptions): string {
  const messages = messagesOf(opts);

  const containers = messages
    .map((msg, index) => renderContainer(msg, index))
    .join("\n");

  const audioPlan = messages.map((msg, index) => ({
    url: audioUrlFor(index),
    blobType: msg.blobType ?? AUDIO_FILES[audioFileOf(msg)].blobType,
  }));

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>E2E Voice Message Fixture</title></head>
<body>
${containers}
  <script>
    (function () {
      window.__E2E_LAST_BLOB_URL = null;
      window.__E2E_BLOB_URLS = [];
      const plan = ${JSON.stringify(audioPlan)};

      async function createVoiceBlob(entry, index) {
        const res = await fetch(entry.url);
        const bytes = await res.arrayBuffer();
        const blob = new Blob([bytes], { type: entry.blobType });
        // This call is what the extension's page-context patch intercepts.
        const blobUrl = URL.createObjectURL(blob);
        window.__E2E_BLOB_URLS[index] = blobUrl;
        window.__E2E_LAST_BLOB_URL = blobUrl;
        const audioEl = document.querySelector(
          '[data-testid="voice-audio-' + index + '"]'
        );
        if (audioEl) { audioEl.src = blobUrl; }
        return blobUrl;
      }

      // Create the blobs one at a time: page-context decodes each blob to read
      // its duration, and a parallel burst would interleave those decodes.
      async function createAll() {
        for (let i = 0; i < plan.length; i++) {
          await createVoiceBlob(plan[i], i);
        }
        return window.__E2E_BLOB_URLS;
      }

      // page-context.js installs its URL.createObjectURL patch at document_idle.
      // Delay slightly so the patch is in place before we create the blob, then
      // expose a manual trigger the test can re-invoke to be robust to timing.
      window.__E2E_CREATE_BLOB = createAll;
      window.__E2E_BLOB_READY = new Promise((resolve) => {
        setTimeout(() => { createAll().then(resolve, resolve); }, 800);
      });
    })();
  </script>
</body>
</html>`;
}

/** Render one voice message container, mirroring the real FB DOM shape. */
function renderContainer(msg: VoiceMessageSpec, index: number): string {
  const {
    ariaLabel,
    durationSeconds,
    renderSlider = true,
    playButtonLabel = "Play",
    renderPlayButton = true,
    renderDurationText = true,
    renderVideo = false,
  } = msg;

  // Wrapped one level deep, as on the real page, so the guard has to walk up
  // from the slider to reach the container that holds the companion controls.
  const sliderHtml = renderSlider
    ? `<div><div
         role="slider"
         aria-label="${escapeHtml(ariaLabel)}"
         aria-valuemin="0"
         aria-valuemax="${durationSeconds}"
         aria-valuenow="0"
         tabindex="0"
         data-testid="voice-slider${suffix(index)}"
       ></div></div>`
    : `<div data-testid="not-a-slider${suffix(index)}">no slider here</div>`;

  const playButtonHtml = renderPlayButton
    ? `<div role="button" aria-label="${escapeHtml(playButtonLabel)}" tabindex="0" data-testid="voice-play${suffix(index)}">
         <svg aria-hidden="true" height="24px" viewBox="0 0 36 36" width="24px"></svg>
       </div>`
    : "";

  const durationTextHtml = renderDurationText
    ? `<span data-testid="voice-duration${suffix(index)}">${formatDuration(durationSeconds)}</span>`
    : "";

  const videoHtml = renderVideo
    ? `<video data-testid="voice-video${suffix(index)}"></video>`
    : "";

  return `  <div data-testid="voice-container${suffix(index)}" style="padding:40px;border:1px solid #ccc">
    ${playButtonHtml}
    ${sliderHtml}
    ${durationTextHtml}
    ${videoHtml}
    <audio data-testid="voice-audio-${index}" controls></audio>
  </div>`;
}

/**
 * The first message keeps unsuffixed test ids, so single-message specs go on
 * selecting `[data-testid="voice-slider"]` unchanged.
 */
function suffix(index: number): string {
  return index === 0 ? "" : `-${index}`;
}

/** Render a duration as the mm:ss label Facebook shows next to the slider. */
function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
