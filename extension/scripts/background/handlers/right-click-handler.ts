/**
 * right-click-handler.ts
 * Handles right-click related messages
 */

import { setLastRightClickedInfo } from "../download-manager";
import { Logger } from "../../utils/logger";
import { MODULE_NAMES } from "../../utils/constants";
import { type VoiceMessageStore, type VoiceMessageItem } from "../data-store";
import type { RightClickMessage } from "../../types/messages";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.RIGHT_CLICK_HANDLER);

/**
 * Handle right-click message
 *
 * @param voiceMessagesStore - Voice message data store
 * @param message - Message object
 * @param sender - Sender info
 * @param sendResponse - Response callback
 * @returns Whether to keep the connection open
 */
export function handleRightClick(
  voiceMessagesStore: VoiceMessageStore,
  message: RightClickMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  const { elementId, downloadUrl, lastModified, durationMs } = message;
  logger.debug("Handling right-click message details", {
    elementId,
    downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
    lastModified,
    durationMs,
  });

  // Ensure we have voiceMessagesStore
  if (!voiceMessagesStore) {
    logger.error("voiceMessagesStore does not exist");
    sendResponse({
      success: false,
      message: "Internal error: voiceMessagesStore does not exist",
    });
    return true;
  }

  logger.debug("voiceMessagesStore Map size", {
    mapSize: voiceMessagesStore.items.size,
  });

  // Output all items' durations and download URL status for debugging
  logStoreItems(voiceMessagesStore);

  // If no download URL is provided but duration exists, try to find from voiceMessagesStore
  let finalDownloadUrl = downloadUrl;
  let finalLastModified = lastModified;

  if (!downloadUrl && durationMs) {
    logger.debug("Trying to find download URL from data store", {
      durationMs,
    });

    // Log target duration
    const targetDuration = durationMs;

    logger.debug("Start matching process", {
      phase: "start",
      targetDuration,
      timestamp: new Date().toISOString(),
      itemsCount: voiceMessagesStore.items.size,
    });

    const matchingItem = findItemByDuration(voiceMessagesStore, durationMs);

    if (matchingItem && matchingItem.downloadUrl) {
      logger.debug("Found matching download URL in data store", {
        id: matchingItem.id,
        durationMs: matchingItem.durationMs,
        downloadUrl: matchingItem.downloadUrl
          ? matchingItem.downloadUrl.substring(0, 30) + "..."
          : null,
      });
      finalDownloadUrl = matchingItem.downloadUrl;
      finalLastModified = matchingItem.lastModified || lastModified;
    } else {
      logger.warn("No matching download URL found in data store");
      logAllDurations(voiceMessagesStore);
    }
  }

  if (!finalDownloadUrl) {
    logger.warn(
      "Download URL is invalid, but still recording right-click info"
    );
    // Even if there is no download URL, record the right-click info for later use when the URL is captured
    setLastRightClickedInfo({
      elementId,
      downloadUrl: null,
      lastModified: null,
      tabId: sender.tab?.id || undefined,
      durationMs: durationMs || undefined,
    });

    sendResponse({
      success: true,
      message: "Right-click info recorded, but download URL not found",
    });
    return true;
  }

  // Set the last right-clicked info
  logger.debug("Setting last right-clicked info", {
    elementId,
    downloadUrl: finalDownloadUrl
      ? finalDownloadUrl.substring(0, 30) + "..."
      : null,
    hasLastModified: !!finalLastModified,
    tabId: sender.tab?.id,
    durationMs,
  });

  setLastRightClickedInfo({
    elementId,
    downloadUrl: finalDownloadUrl,
    lastModified: finalLastModified || null,
    tabId: sender.tab?.id || undefined,
    durationMs: durationMs || undefined,
  });

  // Respond to content script
  const response = {
    success: true,
    message: "Ready to download voice message",
  };
  logger.debug("Responding to content script", { response });
  sendResponse(response);

  logger.debug("Right-click message handling complete");
  return true; // Keep the connection open for async response
}

/**
 * Find a matching item by duration
 *
 * @param voiceMessagesStore - Voice message data store
 * @param durationMs - Target duration (ms)
 * @returns Matching item or null
 */
function findItemByDuration(
  voiceMessagesStore: VoiceMessageStore,
  durationMs: number
): VoiceMessageItem | null {
  // Method 1: Use findItemByDuration function if available
  let matchingItem = null;
  if (typeof voiceMessagesStore.findItemByDuration === "function") {
    logger.debug("Using findItemByDuration function to search");
    matchingItem = voiceMessagesStore.findItemByDuration(durationMs);
    logger.debug("findItemByDuration result", {
      found: !!matchingItem,
    });

    if (matchingItem) {
      logger.debug("Match found", {
        phase: "findItemByDuration",
        result: "success",
        itemId: matchingItem.id,
        itemDuration: matchingItem.durationMs,
        targetDuration: durationMs,
        difference: Math.abs(matchingItem.durationMs - durationMs),
        hasUrl: !!matchingItem.downloadUrl,
        isPending: !!matchingItem.isPending,
        timestamp: new Date().toISOString(),
      });
      return matchingItem;
    } else {
      logger.debug("No match found", {
        phase: "findItemByDuration",
        result: "failure",
        targetDuration: durationMs,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Method 2: Directly iterate items collection
  logger.debug("Directly iterating items collection to search");
  const tolerance = 5; // Tolerance (ms)
  let attemptCount = 0;
  const matchStartTime = Date.now();

  for (const [id, item] of voiceMessagesStore.items.entries()) {
    attemptCount++;
    const difference = Math.abs(item.durationMs - durationMs);

    // Log each matching attempt
    logger.debug("Matching attempt details", {
      phase: "iteration",
      attemptNumber: attemptCount,
      itemId: id,
      itemDuration: item.durationMs,
      targetDuration: durationMs,
      difference: difference,
      withinTolerance: difference <= tolerance,
      hasUrl: !!item.downloadUrl,
      isPending: !!item.isPending,
      timestamp: new Date().toISOString(),
    });

    if (item.durationMs && difference <= tolerance) {
      logger.debug("Found matching item", {
        durationMs: item.durationMs,
        hasDownloadUrl: !!item.downloadUrl,
      });
      matchingItem = item;
      break;
    }
  }

  // Log iteration result
  logger.debug("Iteration complete", {
    phase: "iterationComplete",
    result: matchingItem ? "success" : "failure",
    attemptCount: attemptCount,
    elapsedMs: Date.now() - matchStartTime,
    timestamp: new Date().toISOString(),
  });

  return matchingItem;
}

/**
 * Output all items' durations and download URL status for debugging
 *
 * @param voiceMessagesStore - Voice message data store
 */
function logStoreItems(voiceMessagesStore: VoiceMessageStore): void {
  logger.debug("All items' durations and download URL status");
  for (const [id, item] of voiceMessagesStore.items.entries()) {
    logger.debug(`Item status`, {
      id,
      durationMs: item.durationMs,
      hasUrl: !!item.downloadUrl,
      isPending: !!item.isPending,
    });
  }
}

/**
 * Output all items' durations for comparison
 *
 * @param voiceMessagesStore - Voice message data store
 */
function logAllDurations(voiceMessagesStore: VoiceMessageStore): void {
  // Output data store status for debugging
  logger.debug("Number of items in data store", {
    itemsCount: voiceMessagesStore.items.size,
  });

  // Output all items' durations for comparison
  const allDurations = [];
  for (const [, item] of voiceMessagesStore.items.entries()) {
    if (item.durationMs) {
      allDurations.push(item.durationMs);
    }
  }
  logger.debug("All durations in data store", {
    durations: allDurations,
  });
}
