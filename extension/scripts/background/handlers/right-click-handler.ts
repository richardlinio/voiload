/**
 * right-click-handler.ts
 * Handles right-click related messages
 */

import { setLastRightClickedInfo } from "../download-manager";
import { Logger } from "../../utils/logger";
import { MODULE_NAMES, MESSAGE_ACTIONS } from "../../utils/constants";
import { selectDownloadUrl } from "../../utils/download-url";
import {
  findItemByDuration as findItemByDurationInStore,
  type VoiceMessageStore,
  type VoiceMessageItem,
} from "../data-store";
import type { RightClickMessage } from "../../types/messages";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.RIGHT_CLICK_HANDLER);

/**
 * Handle right-click message
 *
 * The store is backed by chrome.storage.session, so the lookup is async while the
 * listener contract stays synchronous: `true` is returned immediately to keep the
 * message port open, and sendResponse fires once the lookup settles.
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

  void resolveAndRespond(voiceMessagesStore, message, sender, sendResponse);

  return true; // Keep the connection open for async response
}

/**
 * Resolve the download URL for the right-clicked element and respond.
 */
async function resolveAndRespond(
  voiceMessagesStore: VoiceMessageStore,
  message: RightClickMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  const { elementId, downloadUrl, lastModified, durationMs, wavUrl } = message;

  try {
    // Output all items' durations and download URL status for debugging
    await logStoreItems(voiceMessagesStore);

    // If no download URL is provided but duration exists, try to find from voiceMessagesStore
    let finalDownloadUrl = downloadUrl;
    let finalLastModified = lastModified;
    // The page re-encodes on right-click and sends the WAV blob URL along; a URL
    // supplied directly on the message is the original audio.
    let isWav = false;
    // Names the file when the audio was not re-encoded; unknown for a URL that
    // arrived on the message rather than from a stored item.
    let blobType: string | null = null;

    if (!downloadUrl && durationMs) {
      logger.debug("Trying to find download URL from data store", {
        durationMs,
      });

      logger.debug("Start matching process", {
        phase: "start",
        targetDuration: durationMs,
        timestamp: new Date().toISOString(),
      });

      const matchingItem = await findItemByDuration(
        voiceMessagesStore,
        durationMs
      );

      if (matchingItem && matchingItem.downloadUrl) {
        // Prefer the WAV the page just produced; fall back to the stored original.
        const selected = selectDownloadUrl({
          ...matchingItem,
          wavUrl: wavUrl ?? null,
        });
        logger.debug("Found matching download URL in data store", {
          id: matchingItem.id,
          durationMs: matchingItem.durationMs,
          downloadUrl: selected.url!.substring(0, 30) + "...",
          isWav: selected.isWav,
        });
        finalDownloadUrl = selected.url;
        finalLastModified = matchingItem.lastModified || lastModified;
        isWav = selected.isWav;
        blobType = matchingItem.blobType ?? null;
      } else {
        logger.warn("No matching download URL found in data store");
        await logAllDurations(voiceMessagesStore);
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
        isWav: false,
        blobType: null,
      });

      // Suggest downloading all available voice messages as fallback
      logger.info(
        "No matching voice message found, suggesting download all as fallback"
      );
      sendResponse({
        success: true,
        action: MESSAGE_ACTIONS.DOWNLOAD_ALL_VOICE_MESSAGES,
        message:
          "No matching voice message found, ready to download all available voice messages",
      });
      return;
    }

    // Set the last right-clicked info
    logger.debug("Setting last right-clicked info", {
      elementId,
      downloadUrl: finalDownloadUrl.substring(0, 30) + "...",
      hasLastModified: !!finalLastModified,
      tabId: sender.tab?.id,
      durationMs,
      isWav,
    });

    setLastRightClickedInfo({
      elementId,
      downloadUrl: finalDownloadUrl,
      lastModified: finalLastModified || null,
      tabId: sender.tab?.id || undefined,
      durationMs: durationMs || undefined,
      isWav,
      blobType,
    });

    // Respond to content script
    const response = {
      success: true,
      message: "Ready to download voice message",
    };
    logger.debug("Responding to content script", { response });
    sendResponse(response);

    logger.debug("Right-click message handling complete");
  } catch (error: any) {
    logger.error("Error occurred while handling right-click message", {
      error: error?.message,
      stack: error?.stack,
    });
    sendResponse({
      success: false,
      message: `Error occurred while handling right-click message: ${error?.message}`,
    });
  }
}

/**
 * Find a matching item by duration
 *
 * @param voiceMessagesStore - Voice message data store
 * @param durationMs - Target duration (ms)
 * @returns Matching item or null
 */
async function findItemByDuration(
  voiceMessagesStore: VoiceMessageStore,
  durationMs: number
): Promise<VoiceMessageItem | null> {
  // Prefer the store's own method; fall back to the shared data-store search
  // so both paths use the same nearest-neighbour matching semantics
  const matchingItem =
    typeof voiceMessagesStore.findItemByDuration === "function"
      ? await voiceMessagesStore.findItemByDuration(durationMs)
      : await findItemByDurationInStore(voiceMessagesStore, durationMs);

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
  } else {
    logger.debug("No match found", {
      phase: "findItemByDuration",
      result: "failure",
      targetDuration: durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  return matchingItem;
}

/**
 * Output all items' durations and download URL status for debugging
 *
 * @param voiceMessagesStore - Voice message data store
 */
async function logStoreItems(
  voiceMessagesStore: VoiceMessageStore
): Promise<void> {
  logger.debug("All items' durations and download URL status");
  const items = await voiceMessagesStore.getAllItems();
  for (const item of items) {
    logger.debug(`Item status`, {
      id: item.id,
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
async function logAllDurations(
  voiceMessagesStore: VoiceMessageStore
): Promise<void> {
  const items = await voiceMessagesStore.getAllItems();

  // Output data store status for debugging
  logger.debug("Number of items in data store", {
    itemsCount: items.length,
  });

  // Output all items' durations for comparison
  const allDurations = items
    .filter((item) => item.durationMs)
    .map((item) => item.durationMs);

  logger.debug("All durations in data store", {
    durations: allDurations,
  });
}
