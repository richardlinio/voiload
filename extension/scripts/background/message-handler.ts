/**
 * message-handler.ts
 * Responsible for handling messages from the content script and routing them to the correct handler
 */

import { Logger } from "../utils/logger";
import { MESSAGE_ACTIONS, MODULE_NAMES } from "../utils/constants";

import { handleRightClick } from "./handlers/right-click-handler";
import { handleElementRegistration } from "./handlers/element-registration-handler";
import { handleAudioUrlRegistration } from "./handlers/audio-url-registration-handler";
import {
  handleBlobUrl,
  handleBlobContent,
  handleBlobDetection,
} from "./handlers/blob-handler";
import { createDataStore, type VoiceMessageStore } from "./data-store";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.MESSAGE_HANDLER);

// Use singleton pattern to get the voice message data store
let voiceMessagesStore: VoiceMessageStore | null = null;

/**
 * Initialize the message handler
 *
 * @param voiceMessages - Voice message data store (optional, if not provided, use singleton)
 */
export function initMessageHandler(voiceMessages?: VoiceMessageStore): void {
  logger.debug("Initializing message handler");

  // If a voiceMessages parameter is provided, use it; otherwise use singleton
  if (voiceMessages) {
    logger.debug("Using provided voiceMessages instance");
    voiceMessagesStore = voiceMessages;
  } else {
    logger.debug("Using singleton voiceMessages instance");
    voiceMessagesStore = createDataStore();
  }

  logger.debug("voiceMessagesStore initialized", {
    mapSize: voiceMessagesStore.items.size,
  });

  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener(
    (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      logger.debug("Received message", { message });
      logger.debug("Sender info", { sender });

      // Route to the appropriate handler based on message type
      switch (message.action) {
        case MESSAGE_ACTIONS.RIGHT_CLICK:
          logger.debug("Handling right-click message");
          if (!voiceMessagesStore) {
            sendResponse({
              success: false,
              error: "Voice message store not initialized",
            });
            return false;
          }
          return handleRightClick(
            voiceMessagesStore,
            message,
            sender,
            sendResponse
          );

        case MESSAGE_ACTIONS.REGISTER_ELEMENT:
          logger.debug("Handling voice message element registration message");
          if (!voiceMessagesStore) {
            sendResponse({
              success: false,
              error: "Voice message store not initialized",
            });
            return false;
          }
          return handleElementRegistration(
            voiceMessagesStore,
            message,
            sender,
            sendResponse
          );

        case MESSAGE_ACTIONS.REGISTER_AUDIO_URL:
          logger.debug("Handling Audio URL registration message");
          if (!voiceMessagesStore) {
            sendResponse({
              success: false,
              error: "Voice message store not initialized",
            });
            return false;
          }
          return handleAudioUrlRegistration(
            voiceMessagesStore,
            message,
            sender,
            sendResponse
          );

        case MESSAGE_ACTIONS.DOWNLOAD_BLOB:
          logger.debug("Handling Blob content download message");
          return handleBlobContent(message, sender, sendResponse);

        case MESSAGE_ACTIONS.REGISTER_BLOB_URL:
          logger.debug("Handling Blob URL registration message");
          if (!voiceMessagesStore) {
            sendResponse({
              success: false,
              error: "Voice message store not initialized",
            });
            return false;
          }
          return handleBlobUrl(
            voiceMessagesStore,
            message,
            sender,
            sendResponse
          );

        case MESSAGE_ACTIONS.BLOB_DETECTED:
          logger.debug("Handling Blob URL detected message");
          return handleBlobDetection(message, sender, sendResponse);

        default:
          logger.warn("Unhandled message type", {
            action: message.action || "no action",
          });
          return false;
      }
    }
  );
}
