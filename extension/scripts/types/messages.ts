/**
 * messages.ts
 * 所有訊息相關介面定義 - 統一的訊息類型系統
 */

import type { RequestMetadata } from "./audio";

// ================================================
// 基礎訊息介面
// ================================================

/**
 * 基礎訊息介面 - 所有訊息的共同結構
 */
export interface BaseMessage {
  action?: string;
  timestamp?: number | string;
}

// ================================================
// 右鍵點擊相關訊息
// ================================================

/**
 * 右鍵點擊訊息介面 - 統一版本
 */
export interface RightClickMessage extends BaseMessage {
  elementId: string | null;
  downloadUrl: string | null;
  lastModified?: string | null;
  durationMs?: number;
}

// ================================================
// 元素註冊相關訊息
// ================================================

/**
 * 元素註冊訊息介面
 */
export interface ElementRegistrationMessage extends BaseMessage {
  elementId: string;
  durationMs: number;
}

/**
 * 音訊 URL 註冊訊息介面 - 統一版本
 */
export interface AudioUrlRegistrationMessage extends BaseMessage {
  audioUrl: string;
  durationMs: number;
}

// ================================================
// Blob 相關訊息
// ================================================

/**
 * Blob URL 註冊訊息介面
 */
export interface BlobUrlMessage extends BaseMessage {
  blobUrl: string;
  blobType?: string;
  blobSize?: number;
  durationMs: number;
}

/**
 * Blob 內容訊息介面
 */
export interface BlobContentMessage extends BaseMessage {
  blobUrl: string;
  blobType: string;
  base64data: string;
  requestId?: string;
}

/**
 * Blob 偵測訊息介面
 */
export interface BlobDetectionMessage extends BaseMessage {
  url: string;
  type: string;
  size?: number;
  blobUrl?: string;
  blobType?: string;
  blobSize?: number;
  error?: string;
}

/**
 * Blob 下載請求訊息介面
 */
export interface BlobDownloadMessage extends BaseMessage {
  blobUrl: string;
  blobType?: string;
  requestId?: string;
}

// ================================================
// 音訊相關訊息
// ================================================

/**
 * 音訊持續時間請求訊息介面 - 統一版本
 */
export interface AudioDurationMessage extends BaseMessage {
  url: string;
  metadata?: RequestMetadata;
}

// Chrome Extension 事件訊息已移至 chrome-extension.ts

// ================================================
// 頁面上下文特定訊息
// ================================================

/**
 * Blob 佇列項目介面
 */
export interface BlobQueueItem {
  blob: Blob;
  blobUrl: string;
}

/**
 * 提取 Blob 請求訊息介面
 */
export interface ExtractBlobRequestMessage extends BaseMessage {
  blobUrl: string;
  blobType?: string;
  requestId?: string;
}

/**
 * 發送到內容腳本的訊息介面
 */
export interface SendToContentMessage extends BaseMessage {
  blobUrl: string;
  blobType: string;
  blobSize: number;
  durationMs: number;
}
