/**
 * constants.ts
 * Defines shared constants for the entire extension
 */

import type { LogLevel } from "../types/utils";

// ===========================================
// Module Name Constants
// ===========================================
export const MODULE_NAMES = {
  BACKGROUND: "background",
  CONTENT_SCRIPT: "content-script",
  PAGE_CONTEXT: "page-context",
  MENU_MANAGER: "menu-manager",
  MESSAGE_HANDLER: "message-handler",
  CONTENT_MESSAGE_HANDLER: "content-message-handler",
  CONTENT_WAV_REQUEST: "content-wav-request",
  DOWNLOAD_MANAGER: "download-manager",
  DATA_STORE: "data-store",
  WEB_REQUEST: "web-request-interceptor",
  AUDIO_ANALYZER: "audio-analyzer",
  DOM_DETECTOR: "dom-detector",
  CONTEXT_MENU: "context-menu-handler",
  BLOB_ANALYZER: "blob-analyzer",
  BLOB_MONITOR: "blob-monitor",
  BLOB_HANDLER: "blob-handler",
  WAV_ENCODER: "wav-encoder",
  RIGHT_CLICK_HANDLER: "right-click-handler",
  AUDIO_URL_REGISTRATION_HANDLER: "audio-url-registration-handler",
} as const;

// ===========================================
// Blob Monitor Related Constants
// ===========================================
export const BLOB_MONITOR_CONSTANTS = {
  THROTTLE_INTERVAL: 10, // Minimum processing interval (ms)
  PERIODIC_CLEANUP_INTERVAL: 300000, // Clear processed URLs every 5 minutes
  MIN_VALID_DURATION: 500, // Minimum valid duration (ms)
  MAX_VALID_DURATION: 1200000, // Maximum valid duration (ms)
  MIN_VALID_AUDIO_SIZE: 2 * 1024, // Minimum reasonable audio size (2KB; real e2ee audio/ogg voice messages measured as small as 3,323 bytes for 7s)
  MAX_VALID_AUDIO_SIZE: 200 * 1024 * 1024, // Maximum reasonable audio size (200MB)
  POSSIBLE_AUDIO_TYPES: ["audio", "video/mp4", "mp4", "mp3", "mpeg"] as const, // Possible audio file types
} as const;

// ===========================================
// WAV Re-encoding Related Constants
// ===========================================
// Facebook serves voice messages as opus/ogg, which desktop players either
// refuse to open or time incorrectly (they estimate duration from the bitrate).
// Captured audio is decoded and re-packaged as PCM WAV before download.
//
// Conversion happens when the download is requested, not on capture: PCM is ~30x
// the size of the opus it came from, so converting every scrolled-past message
// pinned hundreds of MB per tab. Only one WAV is held at a time -- the previous
// one is revoked.
export const WAV_CONSTANTS = {
  MIME_TYPE: "audio/wav",
  // A canonical PCM WAV header: RIFF descriptor + fmt chunk + data chunk header.
  HEADER_SIZE: 44,
  BITS_PER_SAMPLE: 16,
  FORMAT_PCM: 1,
} as const;

// ===========================================
// Source Blob Retention (page context)
// ===========================================
// The captured opus Blob is retained so a later download can re-encode it.
// Facebook owns the blob URL it handed us and revokes it when the message row
// unmounts, so holding only the URL string loses the audio for older messages.
// Opus is small (7s ~= 3KB, 60s ~= 40KB), so retaining the bytes costs little.
export const SOURCE_BLOB_CONSTANTS = {
  // Oldest entries are dropped past this. 200 messages of retained opus is on the
  // order of a few MB, versus hundreds of MB had they been retained as WAV.
  MAX_RETAINED: 200,
} as const;

// ===========================================
// WAV Request (content -> page) Constants
// ===========================================
export const WAV_REQUEST_CONSTANTS = {
  // Measured encode cost is 5-46ms for a 7s-60s message, so a page that has not
  // answered by now is gone (navigated, torn down) rather than merely slow. The
  // download falls back to the original audio instead of waiting.
  TIMEOUT_MS: 2000,
} as const;

// ===========================================
// Audio Monitoring Related Constants
// ===========================================
export const WEB_REQUEST_CONSTANTS = {
  // Average audio bitrate (kbps) - used to estimate duration
  AVERAGE_AUDIO_BITRATE: 32, // 32kbps

  // Successful HTTP status codes
  SUCCESS_STATUS_CODES: [200, 206] as const, // OK, Partial Content

  AUDIO_CONTENT_TYPES: [
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "video/mp4",
    "application/octet-stream",
  ] as const,
} as const;

// ===========================================
// Supported Sites Related Constants
// ===========================================
export const SUPPORTED_SITES = {
  PATTERNS: ["*://*.facebook.com/*", "*://*.messenger.com/*"] as const,
  DOMAINS: ["facebook.com", "messenger.com"] as const,
  CDN_PATTERNS: [
    "*://*.fbcdn.net/*",
    "*://*.cdninstagram.com/*",
    "*://*.fbsbx.com/*",
  ] as const,
} as const;

// Voice message URL matching patterns - combines patterns from SUPPORTED_SITES
export const VOICE_MESSAGE_URL_PATTERNS = [
  ...SUPPORTED_SITES.PATTERNS,
  ...SUPPORTED_SITES.CDN_PATTERNS,
] as const;

// ===========================================
// Message Handling Related Constants
// ===========================================
export const MESSAGE_SOURCES = {
  CONTENT_SCRIPT: "CONTENT_SCRIPT",
  BACKGROUND_SCRIPT: "BACKGROUND_SCRIPT",
  PAGE_CONTEXT: "PAGE_CONTEXT",
} as const;

export const MESSAGE_ACTIONS = {
  RIGHT_CLICK: "rightClickOnVoiceMessage",
  REGISTER_AUDIO_URL: "registerAudioUrl",
  REGISTER_BLOB_URL: "registerBlobUrl",
  BLOB_DETECTED: "blobUrlDetected",
  GET_AUDIO_DURATION: "getAudioDuration",
  DOWNLOAD_ALL_VOICE_MESSAGES: "downloadAllVoiceMessages",
  // Content asks the page to re-encode one captured blob; the page answers with
  // PREPARE_WAV_RESULT. Conversion runs when the download is requested rather
  // than on capture, so only audio the user asked for is ever decoded.
  PREPARE_WAV: "prepareWav",
  PREPARE_WAV_RESULT: "prepareWavResult",
  // Background asks the content script to obtain one WAV, for a single download
  // or for one item of a batch. Only the content script can reach the page.
  REQUEST_WAV: "requestWav",
} as const;

// ===========================================
// Time Related Constants
// ===========================================
export const TIME_CONSTANTS = {
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  DATA_RETENTION_PERIOD: 7 * 24 * 60 * 60 * 1000, // 7 days
  AUDIO_LOAD_TIMEOUT: 3000, // 3 seconds
  ELEMENT_DETECTION_INTERVAL: 1000, // 1 second
  URL_CACHE_EXPIRATION: 10 * 60 * 1000, // 10 minutes
} as const;

// aria-valuemax on current Facebook UI is integer seconds, while decoded blob
// durations are precise milliseconds — the gap can approach 1s (FB may round or
// ceil the displayed seconds), so matching uses a nearest-neighbour search
// within this band instead of an equality check.
export const MATCHING_TOLERANCE = 1000; // ms
// Durations closer than this are considered the same audio (e.g. the same
// message re-registered after a page re-render).
export const EXACT_MATCHING_TOLERANCE = 5; // ms

// ===========================================
// Storage Keys
// ===========================================
export const STORAGE_KEYS = {
  // chrome.storage.session key holding the voice message items, so the store
  // survives MV3 service-worker eviction.
  VOICE_MESSAGES: "voiceMessages",
} as const;

// ===========================================
// UI Related Constants
// ===========================================
export const UI_CONSTANTS = {
  BADGE_TEXT: "ON",
  BADGE_COLOR: "#4CAF50",
  CONTEXT_MENU_ID: "downloadVoiceMessage",
  CONTEXT_MENU_TITLE: "Download Voice Message",
} as const;

// ===========================================
// DOM Related Constants
// ===========================================
export const DOM_CONSTANTS = {
  // Primary, language-independent voice message signal.
  // Verified against a real logged-in messenger.com thread: aria-valuemax appears
  // on exactly the voice sliders and nowhere else in the app shell.
  VOICE_MESSAGE_SLIDER_SELECTOR:
    '[role="slider"][aria-valuemin="0"][aria-valuemax]',

  // How far up from a slider the voice message container may sit. Measured at 2
  // hops on the real page (hop 1 is a bare wrapper); the extra room absorbs
  // wrapper churn between FB builds.
  VOICE_MESSAGE_CONTAINER_MAX_DEPTH: 4,

  // Guard against non-voice sliders (volume, video scrubbers). A voice message
  // container pairs the slider with a play control and an mm:ss duration label.
  // The play control is matched on role alone -- its aria-label is localized
  // ("Play" in English), so matching the label would just swap one language
  // dictionary for another.
  PLAY_BUTTON_SELECTOR: '[role="button"], button',
  DURATION_TEXT_PATTERN: /\b\d{1,2}:\d{2}\b/,

  // Elements whose presence in the container means this is not a voice message.
  NON_VOICE_MEDIA_SELECTOR: "video",

  // Auxiliary signal only: used to raise confidence and to let the canary
  // monitor (w6) detect dictionary drift. Detection never depends on it, so an
  // unlisted language no longer fails silently.
  VOICE_MESSAGE_SLIDER_ARIA_LABEL: [
    "音訊滑桿", // Traditional Chinese
    "音频时间刷", // Simplified Chinese
    "Barra de arrastre de audio", // Spanish
    "Audio scrubber", // English
    "অডিও স্ক্রাবার", // Bengali
    "ऑडियो स्क्रबर", // Hindi
    "شريط تمرير المقطع الصوتي", // Arabic
    "Barra seletora de áudio", // Portuguese (Brazil/Portugal)
    "Barra de duração do áudio", // Portuguese (Brazil/Portugal)
    "Ползунок аудио", // Russian
    "音声スライダー", // Japanese
    "Schieberegler für Audio", // German
    "Curseur audio", // French
    "Scrubber Audio", // Javanese
    "오디오 스크러버", // Korean
    "Suwak audio", // Polish
    "Ses Göstergesi", // Turkish
    "Thanh kéo âm thanh", // Vietnamese
  ] as const,

  // Mapping from language code to aria-label
  LANGUAGE_LABELS: {
    "zh-Hant": {
      // Traditional Chinese (Taiwan, Hong Kong)
      audioSlider: "音訊滑桿",
    },
    "zh-Hans": {
      // Simplified Chinese (China)
      audioSlider: "音频时间刷",
    },
    es: {
      // Spanish
      audioSlider: "Barra de arrastre de audio",
    },
    en: {
      // English
      audioSlider: "Audio scrubber",
    },
    bn: {
      // Bengali
      audioSlider: "অডিও স্ক্রাবার",
    },
    hi: {
      // Hindi
      audioSlider: "ऑडियो स्क्रबर",
    },
    ar: {
      // Arabic
      audioSlider: "شريط تمرير المقطع الصوتي",
    },
    pt: {
      // Portuguese (including Brazil and Portugal)
      audioSlider: ["Barra seletora de áudio", "Barra de duração do áudio"],
    },
    ru: {
      // Russian
      audioSlider: "Ползунок аудио",
    },
    ja: {
      // Japanese
      audioSlider: "音声スライダー",
    },
    de: {
      // German
      audioSlider: "Schieberegler für Audio",
    },
    fr: {
      // French
      audioSlider: "Curseur audio",
    },
    jv: {
      // Javanese
      audioSlider: "Scrubber Audio",
    },
    ko: {
      // Korean
      audioSlider: "오디오 스크러버",
    },
  } as const,
} as const;

// ===========================================
// Logging Related Constants
// ===========================================
export const LOG_LEVELS = {
  DEBUG: 0 as LogLevel,
  INFO: 1 as LogLevel,
  WARN: 2 as LogLevel,
  ERROR: 3 as LogLevel,
} as const;

// ===========================================
// Filename Related Constants
// ===========================================
export const FILENAME_CONSTANTS = {
  // Voice message filename prefix
  VOICE_MESSAGE_FILENAME_PREFIX: "voice-message-",
} as const;

// ===========================================
// ID Related Constants
// ===========================================
export const ID_CONSTANTS = {
  // Voice message ID prefix
  VOICE_MESSAGE_ID_PREFIX: "voice-msg-",
} as const;

// ===========================================
// Download Related Constants
// ===========================================
export const DOWNLOAD_CONSTANTS = {
  SAVE_AS: true,
  // Captured audio is re-encoded to WAV, so downloads normally carry .wav. When
  // the conversion fails, the original is downloaded under its own container's
  // extension -- claiming .wav for audio that was never re-encoded produces a
  // file no player can open.
  WAV_EXTENSION: ".wav",
  OGG_EXTENSION: ".ogg",
  // Used when the container is unknown: the webRequest path registers a CDN URL
  // without reading the body, and Facebook serves that media as MP4.
  UNKNOWN_EXTENSION: ".mp4",
} as const;

// ===========================================
// Type Definitions - migrated to types/utils.ts, keep for compatibility export
// ===========================================
export type { LogLevel, ModuleName } from "../types/utils";

// Types exclusive to this module
export type MessageSource =
  (typeof MESSAGE_SOURCES)[keyof typeof MESSAGE_SOURCES];
export type MessageAction =
  (typeof MESSAGE_ACTIONS)[keyof typeof MESSAGE_ACTIONS];
export type SupportedDomain = (typeof SUPPORTED_SITES.DOMAINS)[number];
