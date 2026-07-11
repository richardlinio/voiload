/**
 * audio-url-registration-handler.ts
 * Handles Audio URL registration related messages
 */

import { Logger } from "../../utils/logger";
import { MODULE_NAMES } from "../../utils/constants";
import { type VoiceMessageStore } from "../data-store";
import type { AudioUrlRegistrationMessage } from "../../types/messages";

// Create a module-specific logger
const logger = Logger.createModuleLogger(
  MODULE_NAMES.AUDIO_URL_REGISTRATION_HANDLER
);

/**
 * Handle Audio URL registration message
 * Stores the Audio URL and its duration in the voiceMessagesStore
 *
 * @param voiceMessagesStore - Voice message data store
 * @param message - Message object containing url, durationMs, etc.
 * @param sender - Sender information
 * @param sendResponse - Response callback
 * @returns Whether to keep the connection open
 */
export function handleAudioUrlRegistration(
  voiceMessagesStore: VoiceMessageStore,
  message: AudioUrlRegistrationMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  // Get basic info
  const { audioUrl, durationMs, timestamp } = message;

  logger.debug("Handling Audio URL registration message", {
    audioUrl: audioUrl,
    durationMs,
    timestamp,
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
  if (!audioUrl || !durationMs) {
    logger.error("Missing required Audio URL or duration information");
    sendResponse({
      success: false,
      message: "Missing required Audio URL or duration information",
    });
    return true;
  }

  void registerAndRespond(voiceMessagesStore, audioUrl, durationMs, sendResponse);

  return true; // Keep the connection open for async response
}

/**
 * Persist the Audio URL and respond once session storage settles.
 */
async function registerAndRespond(
  voiceMessagesStore: VoiceMessageStore,
  audioUrl: string,
  durationMs: number,
  sendResponse: (response?: any) => void
): Promise<void> {
  try {
    // Use registerDownloadUrl to register the Audio URL in voiceMessagesStore
    const id = await voiceMessagesStore.registerDownloadUrl(
      durationMs,
      audioUrl
    );

    logger.info(
      `Successfully registered Audio URL, ID: ${id}, duration: ${durationMs}ms`
    );

    // Output current state of voiceMessagesStore
    logger.debug("Current voiceMessagesStore item count", {
      itemsCount: voiceMessagesStore.items.size,
    });

    sendResponse({
      success: true,
      message: "Successfully registered Audio URL",
      id: id,
    });
  } catch (error: any) {
    logger.error("Error occurred while registering Audio URL", {
      error: error.message,
      stack: error.stack,
    });
    sendResponse({
      success: false,
      message: `Error occurred while registering Audio URL: ${error.message}`,
    });
  }
}
