/**
 * audio.ts
 * 音訊分析相關類型定義
 */

// ================================================
// 音訊分析相關介面
// ================================================

/**
 * 請求元數據介面
 */
export interface RequestMetadata {
  contentType?: string;
  contentLength?: string;
  lastModified?: string;
}
