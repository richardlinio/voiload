/**
 * message-handler.ts
 * Responsible for handling messages from the background script and routing them to the correct handler
 */

import { Logger } from "../utils/logger";
import {
  MESSAGE_SOURCES,
  MESSAGE_ACTIONS,
  MODULE_NAMES,
} from "../utils/constants";
import { handleGetAudioDurationRequest } from "../page-context/audio-analyzer";
import { handleExtractBlobRequest } from "../page-context/blob-monitor";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.CONTENT_MESSAGE_HANDLER);

// ================================================
// Type Definitions
// ================================================

/**
 * Page context message event interface
 */
interface PageContextMessageEvent extends MessageEvent {
  data: {
    type: string;
    message: any;
  };
}

/**
 * Background script message event interface
 */
interface BackgroundScriptMessageEvent extends MessageEvent {
  data: {
    type: string;
    message: any;
  };
}

/**
 * Audio URL registration message interface
 */
interface AudioUrlRegistrationMessage {
  action: string;
  audioUrl: string;
  durationMs: number;
  timestamp: string;
}

/**
 * Get audio duration request message interface
 */
interface GetAudioDurationMessage {
  action: string;
  url: string;
}

/**
 * Download Blob request message interface
 */
interface DownloadBlobMessage {
  action: string;
  blobUrl: string;
  blobType?: string;
  requestId?: string;
}

// ================================================
// Message Handling Functions
// ================================================

/**
 * Initialize the message handler
 * Sets up message listeners to handle messages from the background script
 */
export function initMessageHandler(): void {
  logger.debug("Initializing content script message handler");

  // Set up message listener to handle messages from the page context
  window.addEventListener("message", async function (event: MessageEvent) {
    // Ensure the message is from the same window
    if (event.source !== window) {
      return;
    }

    // Handle messages from the page context
    if (event.data.type && event.data.type === MESSAGE_SOURCES.PAGE_CONTEXT) {
      const pageEvent = event as PageContextMessageEvent;
      const message = pageEvent.data.message;
      logger.debug("Received page context message", { message });

      // Handle specific types of messages
      switch (message.action) {
        case MESSAGE_ACTIONS.REGISTER_BLOB_URL:
          // Handle Blob URL registration message - forward to background script
          sendMessageToBackground(message);
          break;

        case MESSAGE_ACTIONS.BLOB_DETECTED:
          // Handle Blob detected message - forward to background script
          sendMessageToBackground(message);
          break;

        case "pageContextInitialized":
          // Handle page context initialized message
          logger.info("Page context initialized");
          break;

        default:
          // Forward other messages to background script
          sendMessageToBackground(message);
          break;
      }
    }

    // Handle messages from the background script
    if (
      event.data.type &&
      event.data.type === MESSAGE_SOURCES.BACKGROUND_SCRIPT
    ) {
      const backgroundEvent = event as BackgroundScriptMessageEvent;
      const message = backgroundEvent.data.message;
      logger.debug("Received background script message", { message });

      // Route to the appropriate handler based on message action
      await handleMessage(message);
    }
  });

  logger.info("Content script message handler initialized");
}

/**
 * Send a message to the background script
 * @param message - The message to send
 */
function sendMessageToBackground(message: any): void {
  try {
    logger.debug("Preparing to send message to background script", { message });

    chrome.runtime.sendMessage(message, function (response) {
      logger.debug("Background script responded", { response });
    });

    logger.debug("Message sent to background script");
  } catch (error) {
    logger.error("Error sending message to background script", { error });
  }
}

/**
 * Route to the appropriate handler based on message type
 * @param message - The received message
 */
async function handleMessage(message: any): Promise<void> {
  logger.debug("Start handling message", { action: message.action });

  switch (message.action) {
    case MESSAGE_ACTIONS.GET_AUDIO_DURATION:
      logger.debug("Handling get audio duration request");
      const durationMessage = message as GetAudioDurationMessage;
      const durationMs = await handleGetAudioDurationRequest(durationMessage);

      // Only register if duration was successfully obtained
      if (durationMs !== undefined && durationMs !== null) {
        registerAudioUrlWithBackend(durationMessage.url, durationMs);
      } else {
        logger.debug("Invalid audio duration obtained", {
          url: durationMessage.url,
        });
      }
      break;

    case MESSAGE_ACTIONS.DOWNLOAD_BLOB:
      logger.debug("Handling extract Blob content request");
      const blobMessage = message as DownloadBlobMessage;
      await handleExtractBlobRequest(blobMessage, (response) => {
        logger.debug("Extract Blob content response", { response });
      });
      break;

    // Add more message type handlers as needed...

    default:
      logger.warn("Unhandled message type", {
        action: message.action || "no action",
      });
      break;
  }
}

/**
 * Register Audio URL with the background script
 * @param url - Audio URL
 * @param durationMs - Audio duration (milliseconds)
 */
function registerAudioUrlWithBackend(url: string, durationMs: number): void {
  // Build the message to send
  const message: AudioUrlRegistrationMessage = {
    action: MESSAGE_ACTIONS.REGISTER_AUDIO_URL,
    audioUrl: url,
    durationMs: durationMs,
    timestamp: new Date().toISOString(),
  };

  // Send the message to the background script
  sendMessageToBackground(message);

  // Log details
  logger.debug("Sent Audio URL registration info to background script", {
    audioUrl: url.substring(0, 50),
    durationMs: durationMs,
  });
}
