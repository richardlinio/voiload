/**
 * voice-message.ts
 * Voice message related data structures - Core data model
 */

// ================================================
// Core data structure for voice messages
// ================================================

/**
 * Voice message item interface
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
 * Voice message data store interface
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
 * Download URL lookup result interface
 */
export interface DownloadUrlResult {
  downloadUrl: string | null;
  lastModified?: string | null;
}
