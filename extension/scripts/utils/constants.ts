/**
 * constants.ts
 * 定義整個擴充功能共用的常數
 */

import type { LogLevel, ModuleName, AudioContentType, SuccessStatusCode, AudioFileType } from "../types/utils";

// ===========================================
// 模組名稱常數
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
// Blob 監控相關常數
// ===========================================
export const BLOB_MONITOR_CONSTANTS = {
  THROTTLE_INTERVAL: 10, // 最小處理間隔（毫秒）
  PERIODIC_CLEANUP_INTERVAL: 300000, // 每 5 分鐘清空已處理的 URL
  MIN_VALID_DURATION: 500, // 最小有效持續時間（毫秒）
  MAX_VALID_DURATION: 1200000, // 最大有效持續時間（毫秒）
  MIN_VALID_AUDIO_SIZE: 20 * 1024, // 音訊的最小合理大小 (20KB)
  MAX_VALID_AUDIO_SIZE: 200 * 1024 * 1024, // 音訊的最大合理大小 (200MB)
  POSSIBLE_AUDIO_TYPES: ["audio", "video/mp4", "mp4", "mp3", "mpeg"] as const, // 可能為音訊的檔案類型
} as const;

// ===========================================
// 音訊監控相關常數
// ===========================================
export const WEB_REQUEST_CONSTANTS = {
  // 平均音訊比特率（kbps）- 用於估計持續時間
  AVERAGE_AUDIO_BITRATE: 32, // 32kbps

  // 成功的 HTTP 狀態碼
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
// 支援的網站相關常數
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

// 語音訊息 URL 的匹配模式 - 合併 SUPPORTED_SITES 中的模式
export const VOICE_MESSAGE_URL_PATTERNS = [
  ...SUPPORTED_SITES.PATTERNS,
  ...SUPPORTED_SITES.CDN_PATTERNS,
] as const;

// ===========================================
// 訊息處理相關常數
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
  DOWNLOAD_BLOB: "downloadBlobContent",
  BLOB_DETECTED: "blobUrlDetected",
  UPDATE_ELEMENT: "updateVoiceMessageElement",
  GET_AUDIO_DURATION: "getAudioDuration",
} as const;

// ===========================================
// 時間相關常數
// ===========================================
export const TIME_CONSTANTS = {
  CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 分鐘
  AUDIO_LOAD_TIMEOUT: 3000, // 3 秒
  ELEMENT_DETECTION_INTERVAL: 1000, // 1 秒
  URL_CACHE_EXPIRATION: 10 * 60 * 1000, // 10分鐘
} as const;

export const MATCHING_TOLERANCE = 5; // 毫秒

// ===========================================
// UI 相關常數
// ===========================================
export const UI_CONSTANTS = {
  BADGE_TEXT: "ON",
  BADGE_COLOR: "#4CAF50",
  CONTEXT_MENU_ID: "downloadVoiceMessage",
  CONTEXT_MENU_TITLE: "Download Voice Message",
} as const;

// ===========================================
// DOM 相關常數
// ===========================================
export const DOM_CONSTANTS = {
  // 語音訊息滑桿的 aria-label
  VOICE_MESSAGE_SLIDER_ARIA_LABEL: [
    "音訊滑桿",
    "音频时间刷",
    "Barra de arrastre de audio",
    "Audio scrubber",
    "অডিও স্ক্রাবার",
    "ऑडियो स्क्रबर",
    "شريط تمرير المقطع الصوتي",
    "Barra seletora de áudio",
    "Barra de duração do áudio",
    "Ползунок аудио",
    "音声スライダー",
    "Schieberegler für Audio",
    "Curseur audio",
    "Scrubber Audio",
    "오디오 스크러버",
  ] as const,

  // 語言代碼到 aria-label 的映射表
  LANGUAGE_LABELS: {
    "zh-Hant": {
      // 繁體中文（台灣、香港）
      audioSlider: "音訊滑桿",
    },
    "zh-Hans": {
      // 簡體中文（中國）
      audioSlider: "音频时间刷",
    },
    es: {
      // 西班牙語
      audioSlider: "Barra de arrastre de audio",
    },
    en: {
      // 英語
      audioSlider: "Audio scrubber",
    },
    bn: {
      // 孟加拉語
      audioSlider: "অডিও স্ক্রাবার",
    },
    hi: {
      // 北印度語
      audioSlider: "ऑडियो स्क्रबर",
    },
    ar: {
      // 阿拉伯語
      audioSlider: "شريط تمرير المقطع الصوتي",
    },
    pt: {
      // 葡萄牙語（包含巴西和葡萄牙）
      audioSlider: ["Barra seletora de áudio", "Barra de duração do áudio"],
    },
    ru: {
      audioSlider: "Ползунок аудио",
    },
    ja: {
      // 日語
      audioSlider: "音声スライダー",
    },
    de: {
      // 德語
      audioSlider: "Schieberegler für Audio",
    },
    fr: {
      // 法語
      audioSlider: "Curseur audio",
    },
    jv: {
      // 爪哇語
      audioSlider: "Scrubber Audio",
    },
    ko: {
      // 韓語
      audioSlider: "오디오 스크러버",
    },
  } as const,
} as const;

// ===========================================
// 日誌相關常數
// ===========================================
export const LOG_LEVELS = {
  DEBUG: 0 as LogLevel,
  INFO: 1 as LogLevel,
  WARN: 2 as LogLevel,
  ERROR: 3 as LogLevel,
} as const;

// ===========================================
// 檔名相關常數
// ===========================================
export const FILENAME_CONSTANTS = {
  // 語音訊息檔名前綴
  VOICE_MESSAGE_FILENAME_PREFIX: "voice-message-",
} as const;

// ===========================================
// ID 相關常數
// ===========================================
export const ID_CONSTANTS = {
  // 語音訊息 ID 前綴
  VOICE_MESSAGE_ID_PREFIX: "voice-msg-",
} as const;

// ===========================================
// 下載相關常數
// ===========================================
export const DOWNLOAD_CONSTANTS = {
  SAVE_AS: true,
} as const;

// ===========================================
// 類型定義 - 已遷移到 types/utils.ts，保留相容性導出
// ===========================================
export type { LogLevel, ModuleName, AudioContentType, SuccessStatusCode, AudioFileType } from "../types/utils";

// 專屬於此模組的類型
export type MessageSource = typeof MESSAGE_SOURCES[keyof typeof MESSAGE_SOURCES];
export type MessageAction = typeof MESSAGE_ACTIONS[keyof typeof MESSAGE_ACTIONS];
export type SupportedDomain = typeof SUPPORTED_SITES.DOMAINS[number];