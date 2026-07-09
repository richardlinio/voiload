/**
 * data-store.ts
 * Provides a unified data structure to manage the mapping between voice message elements and download URLs.
 * Uses the singleton pattern to ensure only one instance of voiceMessages exists throughout the extension.
 *
 * The in-memory Map is a cache in front of chrome.storage.session: an MV3 service
 * worker is evicted after ~30s idle, so anything kept only in module scope is gone
 * by the time the user right-clicks. Every mutation is written through to session
 * storage, and every read hydrates the cache first.
 */

import { generateVoiceMessageId } from "../utils/id-generator";
import { domDurationToMilliseconds } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import {
  MODULE_NAMES,
  MATCHING_TOLERANCE,
  EXACT_MATCHING_TOLERANCE,
  TIME_CONSTANTS,
  STORAGE_KEYS,
} from "../utils/constants";
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

// Resolves once the in-memory cache has been filled from session storage.
// Kept per service-worker lifetime: a fresh worker starts with a null promise
// and hydrates on the first store access.
let hydrationPromise: Promise<void> | null = null;

/**
 * Read the persisted items into the in-memory cache.
 * Runs at most once per service-worker lifetime; concurrent callers share the
 * same promise so the storage read is not duplicated.
 *
 * @param voiceMessages - Voice message data store
 */
export function hydrate(voiceMessages: VoiceMessageStore): Promise<void> {
  if (hydrationPromise) {
    return hydrationPromise;
  }

  hydrationPromise = (async () => {
    try {
      const stored = await chrome.storage.session.get(STORAGE_KEYS.VOICE_MESSAGES);
      const persisted = stored?.[STORAGE_KEYS.VOICE_MESSAGES];

      if (!Array.isArray(persisted)) {
        logger.debug("No persisted voice messages found");
        return;
      }

      for (const item of persisted) {
        if (item && typeof item.id === "string") {
          voiceMessages.items.set(item.id, item as VoiceMessageItem);
        }
      }

      logger.info("Hydrated voice messages from session storage", {
        itemCount: voiceMessages.items.size,
      });
    } catch (error: any) {
      // A failed hydrate degrades to an empty cache rather than breaking the
      // worker: the user loses history, not the ability to download.
      logger.error("Failed to hydrate voice messages from session storage", {
        error: error?.message,
      });
    }
  })();

  return hydrationPromise;
}

/**
 * Write the in-memory cache back to session storage.
 * Session storage is JSON-serialised, so the Map is flattened to an array of items.
 *
 * @param voiceMessages - Voice message data store
 */
async function persist(voiceMessages: VoiceMessageStore): Promise<void> {
  try {
    await chrome.storage.session.set({
      [STORAGE_KEYS.VOICE_MESSAGES]: Array.from(voiceMessages.items.values()),
    });
  } catch (error: any) {
    // Losing a write means the item survives only until the worker is evicted;
    // the current request still succeeds, so this is logged rather than thrown.
    logger.error("Failed to persist voice messages to session storage", {
      error: error?.message,
      itemCount: voiceMessages.items.size,
    });
  }
}

/**
 * Reset the hydration state. Exported for tests, which simulate a service-worker
 * restart by discarding the module-scope cache while session storage survives.
 */
export function resetHydrationState(): void {
  hydrationPromise = null;
  voiceMessagesInstance = null;
}

/**
 * Create the voice message data store (singleton pattern)
 * Provides a single data structure to manage the mapping between voice message elements and download URLs
 *
 * Construction is synchronous so the background script can register its event
 * listeners in the first turn of the event loop, as MV3 requires; the store
 * hydrates lazily on first access.
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
    // Map with ID as key, caching the persisted voice message data
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
    registerElement: (elementId: string, durationMs: number) =>
      registerElement(voiceMessagesInstance!, elementId, durationMs),
    findPendingItemByDuration: (durationMs: number) =>
      findPendingItemByDuration(voiceMessagesInstance!, durationMs),
    findItemByDuration: (durationMs: number) =>
      findItemByDuration(voiceMessagesInstance!, durationMs),
    getDownloadUrlForElement: (element: Element) =>
      getDownloadUrlForElement(voiceMessagesInstance!, element),
    getAllItems: () => getAllItems(voiceMessagesInstance!),
    updateItem: (id: string, patch: Partial<VoiceMessageItem>) =>
      updateItem(voiceMessagesInstance!, id, patch),
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
 * Find the item whose duration is nearest to the target, within MATCHING_TOLERANCE.
 * When several candidates fall inside the band the nearest wins with a warning;
 * when the two nearest are equally distant the match is refused (returning null)
 * rather than guessing, so callers fall through to their fallback path.
 *
 * Operates on the already-hydrated cache; callers are responsible for awaiting
 * hydrate() first.
 *
 * @param voiceMessages - Voice message data store
 * @param durationMs - Target duration (milliseconds)
 * @param filter - Optional additional predicate on candidate items
 * @param context - Caller name, included in ambiguity warnings
 * @returns Nearest item, or null when nothing (or nothing unambiguous) matches
 */
function findNearestItemByDuration(
  voiceMessages: VoiceMessageStore,
  durationMs: number,
  filter: (item: VoiceMessageItem) => boolean = () => true,
  context: string = "findNearestItemByDuration"
): VoiceMessageItem | null {
  const candidates = Array.from(voiceMessages.items.values())
    .filter((item) => typeof item.durationMs === "number" && filter(item))
    .map((item) => ({
      item,
      diffMs: Math.abs(item.durationMs - durationMs),
    }))
    .filter(({ diffMs }) => diffMs <= MATCHING_TOLERANCE)
    .sort((a, b) => a.diffMs - b.diffMs);

  const nearest = candidates[0];
  if (!nearest) {
    return null;
  }

  const runnerUp = candidates[1];
  if (runnerUp) {
    const summary = candidates.map(({ item, diffMs }) => ({
      id: item.id,
      durationMs: item.durationMs,
      diffMs,
    }));

    if (nearest.diffMs === runnerUp.diffMs) {
      logger.warn(
        "Ambiguous duration match: nearest candidates are equally distant, refusing to guess",
        { context, durationMs, candidates: summary }
      );
      return null;
    }

    logger.warn(
      "Multiple items within matching tolerance, choosing the nearest",
      { context, durationMs, candidates: summary }
    );
  }

  return nearest.item;
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
export async function registerDownloadUrl(
  voiceMessages: VoiceMessageStore,
  durationMs: number,
  downloadUrl: string,
  lastModified: string | null = null,
  blobType: string | null = null,
  blobSize: number | null = null
): Promise<string> {
  await hydrate(voiceMessages);

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

  // Tier 1: a near-identical duration means the same audio was re-registered
  // (e.g. the page re-created the blob URL) — update that item in place.
  // Tier 2: an element registered from the DOM carries an integer-second
  // duration, so it sits up to ~1s away from the decoded blob duration; only
  // items still without a download URL are eligible, to avoid clobbering a
  // distinct message's URL.
  const matchingItem =
    findNearestItemByDuration(
      voiceMessages,
      durationMs,
      (item) => isDurationMatch(item.durationMs, durationMs, EXACT_MATCHING_TOLERANCE),
      "registerDownloadUrl(exact)"
    ) ??
    findNearestItemByDuration(
      voiceMessages,
      durationMs,
      (item) => !item.downloadUrl,
      "registerDownloadUrl(pending-element)"
    );

  if (matchingItem) {
    const id = matchingItem.id;
    logger.debug("Found matching item, updating info", {
      id,
      oldUrl: matchingItem.downloadUrl
        ? matchingItem.downloadUrl.substring(0, 30) + "..."
        : null,
      newUrl: downloadUrl ? downloadUrl.substring(0, 30) + "..." : null,
    });

    // Update properties
    matchingItem.downloadUrl = downloadUrl;

    // Update other properties if provided
    if (lastModified) {
      matchingItem.lastModified = lastModified;
    }
    if (blobType) {
      matchingItem.blobType = blobType;
    }
    if (blobSize) {
      matchingItem.blobSize = blobSize;
    }

    // Log update diagnostic info
    const updateData = {
      itemId: id,
      durationMs: matchingItem.durationMs,
      blobType: matchingItem.blobType,
      blobSize: matchingItem.blobSize,
      timestamp: new Date().toISOString(),
    };

    logger.debug("DATASTORE-UPDATE", updateData);

    await persist(voiceMessages);

    return id;
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

  await persist(voiceMessages);

  return id;
}

/**
 * Register a voice message element discovered in the DOM, keyed by its element ID.
 *
 * @param voiceMessages - Voice message data store
 * @param elementId - Element ID assigned by the content script
 * @param durationMs - Duration read from the DOM (milliseconds)
 * @returns The stored item
 */
export async function registerElement(
  voiceMessages: VoiceMessageStore,
  elementId: string,
  durationMs: number
): Promise<VoiceMessageItem> {
  await hydrate(voiceMessages);

  const item: VoiceMessageItem = {
    id: elementId,
    element: null,
    durationMs,
    downloadUrl: null,
    lastModified: null,
    timestamp: Date.now(),
    isPending: true,
  };

  voiceMessages.items.set(elementId, item);
  await persist(voiceMessages);

  return item;
}

/**
 * Apply a partial update to a stored item and persist the result.
 *
 * @param voiceMessages - Voice message data store
 * @param id - Item ID
 * @param patch - Fields to overwrite
 * @returns The updated item, or null when no item carries that ID
 */
export async function updateItem(
  voiceMessages: VoiceMessageStore,
  id: string,
  patch: Partial<VoiceMessageItem>
): Promise<VoiceMessageItem | null> {
  await hydrate(voiceMessages);

  const item = voiceMessages.items.get(id);
  if (!item) {
    logger.error("Cannot find item to update", { id });
    return null;
  }

  Object.assign(item, patch);
  await persist(voiceMessages);

  return item;
}

/**
 * Return every stored item, hydrating from session storage first.
 *
 * @param voiceMessages - Voice message data store
 * @returns All stored items
 */
export async function getAllItems(
  voiceMessages: VoiceMessageStore
): Promise<VoiceMessageItem[]> {
  await hydrate(voiceMessages);
  return Array.from(voiceMessages.items.values());
}

/**
 * Find a pending item by duration
 *
 * @param voiceMessages - Voice message data store
 * @param durationMs - Duration (milliseconds)
 * @returns Pending item, or null if not found
 */
export async function findPendingItemByDuration(
  voiceMessages: VoiceMessageStore,
  durationMs: number
): Promise<VoiceMessageItem | null> {
  await hydrate(voiceMessages);

  return findNearestItemByDuration(
    voiceMessages,
    durationMs,
    (item) => !!item.isPending,
    "findPendingItemByDuration"
  );
}

/**
 * Find the corresponding download URL by element
 *
 * @param voiceMessages - Voice message data store
 * @param element - Voice message element
 * @returns Object containing downloadUrl and lastModified, or null if not found
 */
export async function getDownloadUrlForElement(
  voiceMessages: VoiceMessageStore,
  element: Element
): Promise<DownloadUrlResult | null> {
  if (!element) {
    logger.debug("getDownloadUrlForElement: element is null");
    return null;
  }

  await hydrate(voiceMessages);

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
      const durationMs = domDurationToMilliseconds(durationSec);
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

      const item = findNearestItemByDuration(
        voiceMessages,
        durationMs,
        undefined,
        "getDownloadUrlForElement"
      );
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
export async function findItemByDuration(
  voiceMessages: VoiceMessageStore,
  durationMs: number
): Promise<VoiceMessageItem | null> {
  await hydrate(voiceMessages);

  return findNearestItemByDuration(
    voiceMessages,
    durationMs,
    undefined,
    "findItemByDuration"
  );
}

/**
 * Clean up expired voice message items
 *
 * @param voiceMessages - Voice message data store
 * @param maxAgeMs - Maximum lifetime (milliseconds), default is 7 days
 */
export async function cleanupOldItems(
  voiceMessages: VoiceMessageStore,
  maxAgeMs: number = TIME_CONSTANTS.DATA_RETENTION_PERIOD
): Promise<void> {
  await hydrate(voiceMessages);

  const now = Date.now();
  let removed = 0;

  for (const [id, item] of voiceMessages.items.entries()) {
    // Check if the item is expired
    if (now - item.timestamp > maxAgeMs) {
      voiceMessages.items.delete(id);
      removed++;
    }
  }

  if (removed > 0) {
    await persist(voiceMessages);
  }
}
