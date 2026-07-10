/**
 * blob-handler.ts
 * Handles messages related to Blob objects
 */

import { Logger } from "../../utils/logger";
import { MODULE_NAMES } from "../../utils/constants";
import { type VoiceMessageStore } from "../data-store";

// ================================================
// Type Definitions
// ================================================

/**
 * Blob URL registration message interface
 */
interface BlobUrlMessage {
  blobUrl: string;
  blobType?: string;
  blobSize?: number;
  durationMs: number;
  timestamp: string;
  /** Blob URL of the WAV re-encoding; null when the conversion failed. */
  wavUrl?: string | null;
}

/**
 * Blob detection message interface
 */
interface BlobDetectionMessage {
  url: string;
  type: string;
  size?: number;
  timestamp: string;
  blobUrl?: string;
  blobType?: string;
  blobSize?: number;
  error?: string;
}

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.BLOB_HANDLER);

/**
 * Handle Blob URL registration message
 * Stores the Blob URL and its duration in the voiceMessagesStore
 *
 * @param {Object} voiceMessagesStore - Voice message data store
 * @param {Object} message - Message object containing blobUrl, durationMs, etc.
 * @param {Object} sender - Sender information
 * @param {Function} sendResponse - Response callback
 * @returns {boolean} - Whether to keep the connection open
 */
export function handleBlobUrl(
  voiceMessagesStore: VoiceMessageStore,
  message: BlobUrlMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  // Get basic info
  const { blobUrl, blobType, blobSize, durationMs, timestamp, wavUrl } = message;
  const urlFeatures = blobUrl ? blobUrl.substring(0, 30) + "..." : null;

  logger.debug("Handling Blob URL registration message", {
    blobUrl: urlFeatures,
    durationMs,
    blobType,
    blobSize,
    timestamp,
    hasWavUrl: !!wavUrl,
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

  // Ensure required info is present
  if (!blobUrl || !durationMs) {
    logger.error("Missing required Blob URL or duration information");
    sendResponse({
      success: false,
      message: "Missing required Blob URL or duration information",
    });
    return true;
  }

  void registerAndRespond(voiceMessagesStore, message, sendResponse);

  return true; // Keep the connection open for async response
}

/**
 * Persist the Blob URL and respond once session storage settles.
 */
async function registerAndRespond(
  voiceMessagesStore: VoiceMessageStore,
  message: BlobUrlMessage,
  sendResponse: (response?: any) => void
): Promise<void> {
  const { blobUrl, blobType, blobSize, durationMs, wavUrl } = message;

  try {
    // Use registerDownloadUrl to register the Blob URL in voiceMessagesStore
    const id = await voiceMessagesStore.registerDownloadUrl(
      durationMs,
      blobUrl,
      null, // No lastModified info
      blobType,
      blobSize,
      wavUrl
    );

    logger.info(
      `Successfully registered Blob URL, ID: ${id}, duration: ${durationMs}ms`
    );

    // Output current state of voiceMessagesStore
    logger.debug("Current voiceMessagesStore item count", {
      itemsCount: voiceMessagesStore.items.size,
    });

    sendResponse({
      success: true,
      message: "Successfully registered Blob URL",
      id: id,
    });
  } catch (error: any) {
    logger.error("Error occurred while registering Blob URL", {
      error: error.message,
      stack: error.stack,
    });
    sendResponse({
      success: false,
      message: `Error occurred while registering Blob URL: ${error.message}`,
    });
  }
}

/**
 * Handle Blob URL detection message
 * Logs Blob URL info but does not register (since duration info is missing)
 *
 * @param {Object} message - Message object
 * @param {Object} sender - Sender information
 * @param {Function} sendResponse - Response callback
 * @returns {boolean} - Whether to keep the connection open
 */
export function handleBlobDetection(
  message: BlobDetectionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  logger.debug("Handling Blob URL detection message", {
    blobUrl: message.blobUrl ? message.blobUrl.substring(0, 30) + "..." : null,
    blobType: message.blobType,
    blobSize: message.blobSize,
    timestamp: message.timestamp,
    error: message.error,
  });

  // Only log info, do not actually register
  // If there is an error, log the error info
  if (message.error) {
    logger.error("Error in Blob URL detection", {
      error: message.error,
    });
  }

  sendResponse({
    success: true,
    message: "Blob URL detection info logged",
  });

  return true; // Keep the connection open for async response
}
