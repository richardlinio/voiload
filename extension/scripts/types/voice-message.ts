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
  /** Original captured audio (opus/ogg), or a CDN URL from the webRequest path. */
  downloadUrl: string | null;
  lastModified?: string | null;
  blobType?: string | null;
  blobSize?: number | null;
  timestamp: number;
  isPending: boolean;
}

/**
 * Voice message data store interface
 *
 * `items` is the in-memory cache in front of chrome.storage.session and may be
 * stale before the first store call of a service-worker lifetime resolves.
 * Read through `getAllItems()` rather than iterating `items` directly.
 */
export interface VoiceMessageStore {
  items: Map<string, VoiceMessageItem>;
  registerDownloadUrl: (
    durationMs: number,
    downloadUrl: string,
    lastModified?: string | null,
    blobType?: string | null,
    blobSize?: number | null
  ) => Promise<string>;
  findItemByDuration: (durationMs: number) => Promise<VoiceMessageItem | null>;
  getAllItems: () => Promise<VoiceMessageItem[]>;
  updateItem: (
    id: string,
    patch: Partial<VoiceMessageItem>
  ) => Promise<VoiceMessageItem | null>;
}
