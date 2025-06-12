/**
 * element-registration-handler.ts
 * Handles voice message element registration related messages
 */

import { Logger } from "../../utils/logger";
import { MODULE_NAMES } from "../../utils/constants";
import { type VoiceMessageStore, type VoiceMessageItem } from "../data-store";
import type { ElementRegistrationMessage } from "../../types/messages";

// Create a module-specific logger
const logger = Logger.createModuleLogger(
  MODULE_NAMES.ELEMENT_REGISTRATION_HANDLER
);

/**
 * Handle voice message element registration message
 */
export function handleElementRegistration(
  voiceMessagesStore: VoiceMessageStore,
  message: ElementRegistrationMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  const { elementId, durationMs } = message;
  logger.debug("Handling voice message element registration message", {
    elementId,
    durationMs,
  });

  if (!elementId || !durationMs || !voiceMessagesStore) {
    logger.error(
      "Missing required information or voiceMessagesStore does not exist"
    );
    sendResponse({ success: false, error: "Missing required information" });
    return true;
  }

  try {
    // Create a new item in voiceMessages
    voiceMessagesStore.items.set(elementId, {
      id: elementId,
      element: null,
      durationMs,
      downloadUrl: null,
      lastModified: null,
      timestamp: Date.now(),
      isPending: true,
    });

    // Check if there is a pending download URL that can be matched
    const matchingItem = findMatchingPendingItem(
      voiceMessagesStore,
      elementId,
      durationMs
    );

    if (matchingItem && matchingItem.downloadUrl) {
      // If a matching item is found, update the element's download URL
      updateElementWithMatchingItem(
        voiceMessagesStore,
        elementId,
        matchingItem
      );

      // Notify content script to update UI
      notifyContentScriptToUpdateUI(
        _sender.tab?.id,
        elementId,
        matchingItem.downloadUrl
      );

      sendResponse({
        success: true,
        downloadUrl: matchingItem.downloadUrl,
        lastModified: matchingItem.lastModified,
      });
    } else {
      logger.debug("No matching pending item found");
      sendResponse({
        success: true,
        message: "Element registered, but no matching download URL",
      });
    }
  } catch (error: any) {
    logger.error(
      "Error occurred while handling voice message element registration:",
      error
    );
    sendResponse({ success: false, error: error.message });
  }

  return true; // Keep the connection open for async response
}

/**
 * Find a matching pending item
 */
function findMatchingPendingItem(
  voiceMessagesStore: VoiceMessageStore,
  elementId: string,
  durationMs: number
): VoiceMessageItem | null {
  // Use a tolerance value to find a matching item
  const tolerance = 5; // Tolerance (milliseconds)

  for (const [id, item] of voiceMessagesStore.items) {
    if (
      id !== elementId && // Not itself
      item.downloadUrl && // Has download URL
      item.durationMs && // Has duration
      Math.abs(item.durationMs - durationMs) <= tolerance
    ) {
      // Duration matches
      logger.debug("Found matching pending item", { item });
      return item;
    }
  }

  return null;
}

/**
 * Update element with matching item
 *
 * @param {Object} voiceMessagesStore - Voice message data store
 * @param {string} elementId - Element ID
 * @param {Object} matchingItem - Matching item
 * @private
 */
function updateElementWithMatchingItem(
  voiceMessagesStore: VoiceMessageStore,
  elementId: string,
  matchingItem: any
) {
  const currentItem = voiceMessagesStore.items.get(elementId);
  if (!currentItem) {
    logger.error("Cannot find item to update", { elementId });
    return;
  }
  currentItem.downloadUrl = matchingItem.downloadUrl;
  currentItem.lastModified = matchingItem.lastModified;

  logger.debug("Updated element's download URL:", {
    elementId,
    downloadUrl: matchingItem.downloadUrl.substring(0, 50) + "...",
  });
}

/**
 * Notify content script to update UI
 *
 * @param {number|undefined} tabId - Tab ID
 * @param {string} elementId - Element ID
 * @param {string} downloadUrl - Download URL
 * @private
 */
function notifyContentScriptToUpdateUI(
  tabId: number | undefined,
  elementId: string,
  downloadUrl: string
) {
  if (tabId) {
    try {
      chrome.tabs.sendMessage(tabId, {
        action: "updateVoiceMessageElement",
        elementId: elementId,
        downloadUrl: downloadUrl,
      });
    } catch (error) {
      logger.error(
        "Error occurred while sending update message to content script:",
        error
      );
    }
  }
}
