/**
 * download.ts
 * 下載相關類型定義
 */

// ================================================
// 下載相關介面
// ================================================

/**
 * 右鍵點擊資訊介面
 */
export interface RightClickInfo {
  elementId: string | null;
  downloadUrl: string | null;
  lastModified: string | null;
  tabId: number | undefined;
  durationMs: number | undefined;
}

/**
 * 下載訊息介面 (Blob 內容下載)
 */
export interface DownloadMessage {
  base64data: string;
  blobType: string;
  requestId?: string;
  timestamp?: string;
}
