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
  /** True when downloadUrl points at a WAV re-encoding rather than the original audio. */
  isWav?: boolean;
  /** MIME type of the original audio, used to name the file when it was not re-encoded. */
  blobType?: string | null;
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
