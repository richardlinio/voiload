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
  DOWNLOAD_MANAGER: "download-manager",
  DATA_STORE: "data-store",
  WEB_REQUEST: "web-request-interceptor",
  AUDIO_ANALYZER: "audio-analyzer",
  DOM_DETECTOR: "dom-detector",
  CONTEXT_MENU: "context-menu-handler",
  BLOB_ANALYZER: "blob-analyzer",
  BLOB_MONITOR: "blob-monitor",
  BLOB_HANDLER: "blob-handler",
  RIGHT_CLICK_HANDLER: "right-click-handler",
  ELEMENT_REGISTRATION_HANDLER: "element-registration-handler",
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
  MIN_VALID_AUDIO_SIZE: 20 * 1024, // Minimum reasonable audio size (20KB)
  MAX_VALID_AUDIO_SIZE: 200 * 1024 * 1024, // Maximum reasonable audio size (200MB)
  POSSIBLE_AUDIO_TYPES: ["audio", "video/mp4", "mp4", "mp3", "mpeg"] as const, // Possible audio file types
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
  REGISTER_ELEMENT: "registerElement",
  REGISTER_AUDIO_URL: "registerAudioUrl",
  REGISTER_BLOB_URL: "registerBlobUrl",
  BLOB_DETECTED: "blobUrlDetected",
  UPDATE_ELEMENT: "updateVoiceMessageElement",
  GET_AUDIO_DURATION: "getAudioDuration",
} as const;

// ===========================================
// Time Related Constants
// ===========================================
export const TIME_CONSTANTS = {
  CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 minutes
  AUDIO_LOAD_TIMEOUT: 3000, // 3 seconds
  ELEMENT_DETECTION_INTERVAL: 1000, // 1 second
  URL_CACHE_EXPIRATION: 10 * 60 * 1000, // 10 minutes
} as const;

export const MATCHING_TOLERANCE = 5; // ms

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
  // aria-labels for voice message slider
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
