/**
 * utils.ts
 * 工具類型定義 - Logger 和 Constants 相關類型
 */

// ================================================
// Logger 相關類型
// ================================================

/**
 * 日誌級別類型
 */
export type LogLevel = 0 | 1 | 2 | 3; // DEBUG | INFO | WARN | ERROR

/**
 * 模組名稱類型 - 基於 constants.ts 中的 MODULE_NAMES
 */
export type ModuleName = 
  | "background"
  | "content-script" 
  | "page-context"
  | "menu-manager"
  | "message-handler"
  | "content-message-handler"
  | "download-manager"
  | "data-store"
  | "web-request-interceptor"
  | "audio-analyzer"
  | "dom-detector"
  | "context-menu-handler"
  | "blob-analyzer"
  | "blob-monitor"
  | "blob-handler"
  | "right-click-handler"
  | "element-registration-handler"
  | "audio-url-registration-handler"
  | string; // 允許自定義模組名稱

/**
 * Logger 配置介面
 */
export interface LoggerConfig {
  level: LogLevel;
  showTimestamp: boolean;
  showLevel: boolean;
  showModule: boolean;
  consoleOutput: boolean;
  moduleConfig: Record<string, LogLevel>;
}

/**
 * 模組 Logger 介面
 */
export interface ModuleLogger {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

// ================================================
// Constants 相關類型
// ================================================

/**
 * 音訊內容類型
 */
export type AudioContentType = 
  | "audio/wav"
  | "audio/x-wav" 
  | "audio/mp4"
  | "video/mp4"
  | "application/octet-stream";

/**
 * 支援的音訊檔案類型
 */
export type AudioFileType = "audio" | "video/mp4" | "mp4" | "mp3" | "mpeg";

/**
 * HTTP 成功狀態碼
 */
export type SuccessStatusCode = 200 | 206;