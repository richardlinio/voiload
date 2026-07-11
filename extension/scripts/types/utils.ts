/**
 * utils.ts
 * Utility type definitions - Logger and Constants related types
 */

// ================================================
// Logger related types
// ================================================

/**
 * Log level type
 */
export type LogLevel = 0 | 1 | 2 | 3; // DEBUG | INFO | WARN | ERROR

/**
 * Module name type - based on MODULE_NAMES in constants.ts
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
  | "audio-url-registration-handler"
  | string; // allow custom module names

/**
 * Logger configuration interface
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
 * Module Logger interface
 */
export interface ModuleLogger {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

// ================================================
// Constants related types
// ================================================

/**
 * Audio content type
 */
export type AudioContentType =
  | "audio/wav"
  | "audio/x-wav"
  | "audio/mp4"
  | "video/mp4"
  | "application/octet-stream";

/**
 * Supported audio file types
 */
export type AudioFileType = "audio" | "video/mp4" | "mp4" | "mp3" | "mpeg";

/**
 * HTTP success status codes
 */
export type SuccessStatusCode = 200 | 206;
