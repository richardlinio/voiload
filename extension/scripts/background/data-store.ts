/**
 * data-store.ts
 * Provides a unified data structure to manage the mapping between voice message elements and download URLs.
 * Uses the singleton pattern to ensure only one instance of voiceMessages exists throughout the extension.
 */

import { generateVoiceMessageId } from "../utils/id-generator";
import { secondsToMilliseconds } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import { MODULE_NAMES, MATCHING_TOLERANCE, TIME_CONSTANTS } from "../utils/constants";
import type {
  VoiceMessageItem,
  VoiceMessageStore,
  DownloadUrlResult,
} from "../types/voice-message";

// Re-export types for backward compatibility
export type { VoiceMessageItem, VoiceMessageStore, DownloadUrlResult };

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.DATA_STORE);

// Global singleton instance
let voiceMessagesInstance: VoiceMessageStore | null = null;

/**
 * Create the voice message data store (singleton pattern)
 * Provides a single data structure to manage the mapping between voice message elements and download URLs
 *
 * @returns Voice message data store
 */
export function createDataStore(): VoiceMessageStore {
  // If the instance already exists, return it directly
  if (voiceMessagesInstance) {
    logger.debug("Returning existing voiceMessages instance");
    return voiceMessagesInstance;
  }

  logger.info("Creating new voiceMessages instance");

  // Main data structure
  voiceMessagesInstance = {
    // Map with ID as key, storing complete voice message data
    items: new Map<string, VoiceMessageItem>(),

    // Helper functions
    isDurationMatch: (
      duration1Ms: number,
      duration2Ms: number,
      toleranceMs: number = MATCHING_TOLERANCE
    ) => isDurationMatch(duration1Ms, duration2Ms, toleranceMs),
    registerDownloadUrl: (
      durationMs: number,
      downloadUrl: string,
      lastModified?: string | null,
      blobType?: string | null,
      blobSize?: number | null
    ) =>
      registerDownloadUrl(
        voiceMessagesInstance!,
        durationMs,
        downloadUrl,
        lastModified,
        blobType,
        blobSize
      ),
    findPendingItemByDuration: (durationMs: number) =>
      findPendingItemByDuration(voiceMessagesInstance!, durationMs),
    findItemByDuration: (durationMs: number) =>
      findItemByDuration(voiceMessagesInstance!, durationMs),
    getDownloadUrlForElement: (element: Element) =>
      getDownloadUrlForElement(voiceMessagesInstance!, element),
  };

  return voiceMessagesInstance;
}

/**
 * Determines whether two durations match within a given tolerance
 *
 * @param duration1Ms - First duration (milliseconds)
 * @param duration2Ms - Second duration (milliseconds)
 * @param toleranceMs - Tolerance (milliseconds)
 * @returns True if the two durations match
 */
export function isDurationMatch(
  duration1Ms: number,
  duration2Ms: number,
  toleranceMs: number = MATCHING_TOLERANCE
): boolean {
  if (typeof duration1Ms !== "number" || typeof duration2Ms !== "number") {
    return false;
  }

  return Math.abs(duration1Ms - duration2Ms) <= toleranceMs;
}

/**
 * Register a download URL
 *
 * @param voiceMessages - Voice message data store
 * @param durationMs - Duration (milliseconds)
 * @param downloadUrl - Download URL
 * @param lastModified - Last-Modified header value
 * @param blobType - MIME type of the Blob
 * @param blobSize - Size of the Blob (bytes)
 * @returns Voice message ID
 */
export function registerDownloadUrl(
  voiceMessages: VoiceMessageStore,
  durationMs: number,
  downloadUrl: string,
  lastModified: string | null = null,
  blobType: string | null = null,
  blobSize: number | null = null
): string {
  const blobSizeKB = blobSize ? (blobSize / 1024).toFixed(2) : "N/A";

  logger.debug("Registering download URL", {
    durationMs,
    downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
    lastModified,
    blobType,
    blobSizeKB,
    mapSize: voiceMessages.items.size,
  });

  // Log detailed diagnostic info
  const registerData = {
    durationMs,
    blobType,
    blobSizeBytes: blobSize,
    blobSizeKB,
    downloadUrlHint: downloadUrl ? downloadUrl.substring(0, 30) + "..." : null,
    lastModified,
    timestamp: new Date().toISOString(),
  };

  logger.debug("DATASTORE-REGISTER", registerData);

  // Check if there is an element matching this duration
  for (const [id, item] of voiceMessages.items.entries()) {
    if (isDurationMatch(item.durationMs, durationMs)) {
      // If a matching element exists, update its properties
      logger.debug("Found matching item, updating info", {
        id,
        oldUrl: item.downloadUrl
          ? item.downloadUrl.substring(0, 30) + "..."
          : null,
        newUrl: downloadUrl ? downloadUrl.substring(0, 30) + "..." : null,
      });

      // Update properties
      item.downloadUrl = downloadUrl;

      // Update other properties if provided
      if (lastModified) {
        item.lastModified = lastModified;
      }
      if (blobType) {
        item.blobType = blobType;
      }
      if (blobSize) {
        item.blobSize = blobSize;
      }

      // Log update diagnostic info
      const updateData = {
        itemId: id,
        durationMs: item.durationMs,
        blobType: item.blobType,
        blobSize: item.blobSize,
        timestamp: new Date().toISOString(),
      };

      logger.debug("DATASTORE-UPDATE", updateData);

      return id;
    }
  }

  // If no matching element, create a pending item
  const id = generateVoiceMessageId();
  logger.debug("No matching item found, creating new item", {
    id,
    durationMs,
    isPending: true,
  });

  // Create new item in voiceMessages.items
  const newItem: VoiceMessageItem = {
    id,
    element: null,
    durationMs,
    downloadUrl,
    lastModified,
    blobType,
    blobSize,
    timestamp: Date.now(),
    isPending: true, // Use property to mark status
  };

  voiceMessages.items.set(id, newItem);

  logger.debug("New item added", { mapSize: voiceMessages.items.size });
  logger.debug("New item details", {
    id,
    durationMs,
    hasDownloadUrl: !!downloadUrl,
    blobType,
    blobSizeKB,
    hasElement: !!newItem.element,
    isPending: newItem.isPending,
  });

  // Log new item diagnostic info
  const newItemData = {
    itemId: id,
    durationMs,
    blobType,
    blobSizeBytes: blobSize,
    blobSizeKB,
    isPending: true,
    timestamp: new Date().toISOString(),
  };

  logger.debug("DATASTORE-NEW", newItemData);

  return id;
}

/**
 * Find a pending item by duration
 *
 * @param voiceMessages - Voice message data store
 * @param durationMs - Duration (milliseconds)
 * @returns Pending item, or null if not found
 */
export function findPendingItemByDuration(
  voiceMessages: VoiceMessageStore,
  durationMs: number
): VoiceMessageItem | null {
  for (const item of voiceMessages.items.values()) {
    if (item.isPending && isDurationMatch(item.durationMs, durationMs)) {
      return item;
    }
  }

  return null;
}

/**
 * Find the corresponding download URL by element
 *
 * @param voiceMessages - Voice message data store
 * @param element - Voice message element
 * @returns Object containing downloadUrl and lastModified, or null if not found
 */
export function getDownloadUrlForElement(
  voiceMessages: VoiceMessageStore,
  element: Element
): DownloadUrlResult | null {
  if (!element) {
    logger.debug("getDownloadUrlForElement: element is null");
    return null;
  }

  logger.debug("Looking up download URL for element");
  logger.debug("voiceMessages Map size", { size: voiceMessages.items.size });

  // Check if the element has a data-voice-message-id attribute
  const id = element.getAttribute("data-voice-message-id");
  logger.debug("Element ID", { id });

  if (id && voiceMessages.items.has(id)) {
    // If ID exists and is in items, return directly
    const item = voiceMessages.items.get(id);
    if (!item) {
      logger.debug("No item found for specified ID", { id });
      return null;
    }

    logger.debug("Found matching item", {
      id,
      hasDownloadUrl: !!item.downloadUrl,
      hasElement: !!item.element,
      isPending: !!item.isPending,
    });

    return {
      downloadUrl: item.downloadUrl,
      lastModified: item.lastModified || null,
    };
  }

  // If no ID or ID does not exist, try to find by duration
  if (element.hasAttribute("aria-valuemax")) {
    const ariaValuemax = element.getAttribute("aria-valuemax");
    if (!ariaValuemax) {
      return null;
    }
    const durationSec = parseFloat(ariaValuemax);
    if (!isNaN(durationSec)) {
      const durationMs = secondsToMilliseconds(durationSec);
      logger.debug("Trying to find by duration", { durationMs });

      // Output all items' durations for debugging
      logger.debug("All items' durations");

      // Collect all items' durations into an array
      const itemsInfo = Array.from(voiceMessages.items.entries()).map(
        ([itemId, item]) => ({
          id: itemId,
          durationMs: item.durationMs,
          hasUrl: !!item.downloadUrl,
        })
      );

      logger.debug("Item duration details", { items: itemsInfo });

      const item = findItemByDuration(voiceMessages, durationMs);
      if (item && item.downloadUrl) {
        logger.debug("Found matching item by duration", {
          id: item.id,
          durationMs: item.durationMs,
          hasDownloadUrl: !!item.downloadUrl,
        });

        return {
          downloadUrl: item.downloadUrl,
          lastModified: item.lastModified || null,
        };
      }
    }
  }

  // If no ID or ID does not exist, return null
  logger.debug("No matching download URL found");
  return null;
}

/**
 * Find an item by duration (including both processed and pending items)
 *
 * @param voiceMessages - Voice message data store
 * @param durationMs - Duration (milliseconds)
 * @returns Found item, or null if not found
 */
export function findItemByDuration(
  voiceMessages: VoiceMessageStore,
  durationMs: number
): VoiceMessageItem | null {
  for (const item of voiceMessages.items.values()) {
    if (isDurationMatch(item.durationMs, durationMs)) {
      return item;
    }
  }

  return null;
}

/**
 * Clean up expired voice message items
 *
 * @param voiceMessages - Voice message data store
 * @param maxAgeMs - Maximum lifetime (milliseconds), default is 7 days
 */
export function cleanupOldItems(
  voiceMessages: VoiceMessageStore,
  maxAgeMs: number = TIME_CONSTANTS.DATA_RETENTION_PERIOD
): void {
  const now = Date.now();

  for (const [id, item] of voiceMessages.items.entries()) {
    // Check if the item is expired
    if (now - item.timestamp > maxAgeMs) {
      voiceMessages.items.delete(id);
    }
  }
}
