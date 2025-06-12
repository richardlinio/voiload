/**
 * download.ts
 * Download related type definitions
 */

// ================================================
// Download related interfaces
// ================================================

/**
 * Right click info interface
 */
export interface RightClickInfo {
  elementId: string | null;
  downloadUrl: string | null;
  lastModified: string | null;
  tabId: number | undefined;
  durationMs: number | undefined;
}

/**
 * Download message interface (Blob content download)
 */
export interface DownloadMessage {
  base64data: string;
  blobType: string;
  requestId?: string;
  timestamp?: string;
}
