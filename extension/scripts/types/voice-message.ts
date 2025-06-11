/**
 * voice-message.ts
 * 語音訊息相關資料結構 - 核心資料模型
 */

// ================================================
// 語音訊息核心資料結構
// ================================================

/**
 * 語音訊息項目介面
 */
export interface VoiceMessageItem {
  id: string;
  element: Element | null;
  durationMs: number;
  downloadUrl: string | null;
  lastModified?: string | null;
  blobType?: string | null;
  blobSize?: number | null;
  timestamp: number;
  isPending: boolean;
}

/**
 * 語音訊息資料存儲介面
 */
export interface VoiceMessageStore {
  items: Map<string, VoiceMessageItem>;
  isDurationMatch: (
    duration1Ms: number,
    duration2Ms: number,
    toleranceMs?: number
  ) => boolean;
  registerDownloadUrl: (
    durationMs: number,
    downloadUrl: string,
    lastModified?: string | null,
    blobType?: string | null,
    blobSize?: number | null
  ) => string;
  findPendingItemByDuration: (durationMs: number) => VoiceMessageItem | null;
  findItemByDuration: (durationMs: number) => VoiceMessageItem | null;
  getDownloadUrlForElement: (element: Element) => DownloadUrlResult | null;
}

/**
 * 下載 URL 查找結果介面
 */
export interface DownloadUrlResult {
  downloadUrl: string | null;
  lastModified?: string | null;
}
