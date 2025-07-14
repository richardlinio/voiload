/**
 * download-all-handler.ts
 * Handles download all voice messages related messages
 */

import { downloadAllVoiceMessages } from "../download-manager";
import { Logger } from "../../utils/logger";
import { type VoiceMessageStore } from "../data-store";
import type { DownloadAllMessage } from "../../types/messages";

// Create a module-specific logger
const logger = Logger.createModuleLogger("download-all-handler");

/**
 * Handle download all voice messages message
 *
 * @param voiceMessagesStore - Voice message data store
 * @param message - Message object
 * @param sender - Sender info
 * @param sendResponse - Response callback
 * @returns Whether to keep the connection open
 */
export function handleDownloadAll(
  voiceMessagesStore: VoiceMessageStore,
  message: DownloadAllMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  logger.debug("Handling download all voice messages request");

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
    mapSize: voiceMessagesStore.items ? voiceMessagesStore.items.size : 0,
  });

  // Execute batch download
  logger.info("Executing batch download of all available voice messages");
  const downloadCount = downloadAllVoiceMessages(voiceMessagesStore);

  if (downloadCount > 0) {
    logger.info("Batch download initiated", { downloadCount });
    sendResponse({
      success: true,
      message: `Started downloading all available voice messages (${downloadCount} files)`,
      downloadCount,
    });
  } else {
    logger.warn("No downloadable voice messages found in cache");
    sendResponse({
      success: true,
      message: "No downloadable voice messages available in cache",
      downloadCount: 0,
    });
  }

  logger.debug("Download all voice messages handling complete");
  return true; // Keep the connection open for async response
}