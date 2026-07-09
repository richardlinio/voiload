/**
 * element-registration-handler.ts
 * Handles voice message element registration related messages
 */

import { Logger } from "../../utils/logger";
import { MODULE_NAMES, EXACT_MATCHING_TOLERANCE } from "../../utils/constants";
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

  void registerAndRespond(voiceMessagesStore, message, _sender, sendResponse);

  return true; // Keep the connection open for async response
}

/**
 * Persist the element and respond once the store settles.
 */
async function registerAndRespond(
  voiceMessagesStore: VoiceMessageStore,
  message: ElementRegistrationMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  const { elementId, durationMs } = message;

  try {
    // Create a new item in voiceMessages
    await voiceMessagesStore.registerElement(elementId, durationMs);

    // Check if there is a pending download URL that can be matched
    const matchingItem = await findMatchingPendingItem(
      voiceMessagesStore,
      elementId,
      durationMs
    );

    if (matchingItem && matchingItem.downloadUrl) {
      // If a matching item is found, update the element's download URL
      await voiceMessagesStore.updateItem(elementId, {
        downloadUrl: matchingItem.downloadUrl,
        lastModified: matchingItem.lastModified ?? null,
      });

      logger.debug("Updated element's download URL:", {
        elementId,
        downloadUrl: matchingItem.downloadUrl.substring(0, 50) + "...",
      });

      // Notify content script to update UI
      notifyContentScriptToUpdateUI(
        sender.tab?.id,
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
}

/**
 * Find another item, already carrying a download URL, whose duration is the same
 * audio as the just-registered element.
 */
async function findMatchingPendingItem(
  voiceMessagesStore: VoiceMessageStore,
  elementId: string,
  durationMs: number
): Promise<VoiceMessageItem | null> {
  const items = await voiceMessagesStore.getAllItems();

  for (const item of items) {
    if (
      item.id !== elementId && // Not itself
      item.downloadUrl && // Has download URL
      item.durationMs && // Has duration
      Math.abs(item.durationMs - durationMs) <= EXACT_MATCHING_TOLERANCE
    ) {
      // Duration matches
      logger.debug("Found matching pending item", { item });
      return item;
    }
  }

  return null;
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
