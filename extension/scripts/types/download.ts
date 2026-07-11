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
  /** Original captured audio. The WAV is produced when the download is clicked. */
  downloadUrl: string | null;
  lastModified: string | null;
  tabId: number | undefined;
  /** Identifies which retained blob the page should re-encode on download. */
  durationMs: number | undefined;
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
