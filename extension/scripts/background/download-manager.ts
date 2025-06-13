/**
 * download-manager.ts
 * Responsible for handling download functionality
 */

import { generateVoiceMessageFilename } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import { DOWNLOAD_CONSTANTS } from "../utils/constants";
import type { RightClickInfo, DownloadMessage } from "../types/download";

// Create a module-specific logger
const logger = Logger.createModuleLogger("download-manager");

// Store the last right-clicked info
let lastRightClickedInfo: RightClickInfo | null = null;

/**
 * Initialize the download manager
 */
export function initDownloadManager(): void {
  logger.info("Initializing download manager");

  // Listen for context menu click events
  chrome.contextMenus.onClicked.addListener(
    (
      info: chrome.contextMenus.OnClickData,
      _tab: chrome.tabs.Tab | undefined
    ) => {
      logger.debug("Context menu clicked", {
        menuItemId: info.menuItemId,
        hasLastRightClickedInfo: !!lastRightClickedInfo,
      });

      if (info.menuItemId === "downloadVoiceMessage") {
        if (lastRightClickedInfo) {
          logger.info("Starting voice message download", {
            url: lastRightClickedInfo.downloadUrl
              ? lastRightClickedInfo.downloadUrl.substring(0, 50) + "..."
              : null,
            lastModified: lastRightClickedInfo.lastModified,
          });
          downloadVoiceMessage(
            lastRightClickedInfo.downloadUrl!,
            lastRightClickedInfo.lastModified || undefined
          );
        } else {
          logger.error("Cannot download, no right-click info available");
        }
      }
    }
  );
}

/**
 * Set the last right-clicked info
 *
 * @param info - Right-click info
 */
export function setLastRightClickedInfo(info: RightClickInfo): void {
  lastRightClickedInfo = info;

  logger.debug("Set last right-clicked info", {
    elementId: info.elementId,
    downloadUrl: info.downloadUrl
      ? info.downloadUrl.substring(0, 50) + "..."
      : null,
    lastModified: info.lastModified,
    tabId: info.tabId,
  });
}

/**
 * Download a voice message
 *
 * @param url - Download URL
 * @param lastModified - Last-Modified header value
 */
export function downloadVoiceMessage(url: string, lastModified?: string): void {
  logger.debug("downloadVoiceMessage function called");

  if (!url) {
    logger.error("Invalid download URL");
    return;
  }

  // Generate filename
  const filename = `${generateVoiceMessageFilename(lastModified)}.mp4`;
  logger.debug("Generated filename", { filename });

  // Use Chrome downloads API to download the file
  logger.debug("Preparing to call chrome.downloads.download API");
  chrome.downloads.download(
    {
      url: url,
      filename: filename,
      saveAs: DOWNLOAD_CONSTANTS.SAVE_AS,
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        logger.error("Download failed", chrome.runtime.lastError);
      } else {
        logger.info("Download succeeded", { downloadId });
      }
    }
  );

  logger.info("Started voice message download", {
    url: url.substring(0, 50) + "...",
    filename,
  });
}

/**
 * Handle blob content download message
 *
 * @param message - Message object
 * @param sender - Sender info
 * @param sendResponse - Response callback
 */
export function downloadBlobContent(
  message: DownloadMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): void {
  try {
    logger.debug("Handling blob content download message", {
      blobType: message.blobType,
      base64Length: message.base64data ? message.base64data.length : 0,
      requestId: message.requestId,
      timestamp: message.timestamp,
    });

    // Check required parameters
    if (!message.base64data || !message.blobType) {
      logger.error("Missing required parameters");
      sendResponse({ success: false, error: "Missing required parameters" });
      return;
    }

    // Note: URL.createObjectURL cannot be used in background scripts (Service Worker)

    // Use base64 data directly, no need to convert to blob
    logger.debug("Downloading directly using base64 data:", {
      blobType: message.blobType,
      base64Length: message.base64data.length,
    });

    // Determine file extension based on MIME type
    let fileExtension = ".bin";
    if (
      message.blobType.includes("audio/mpeg") ||
      message.blobType.includes("audio/mp3")
    ) {
      fileExtension = ".mp3";
    } else if (
      message.blobType.includes("audio/mp4") ||
      message.blobType.includes("video/mp4")
    ) {
      fileExtension = ".mp4";
    } else if (message.blobType.includes("audio/wav")) {
      fileExtension = ".wav";
    } else if (message.blobType.includes("audio/ogg")) {
      fileExtension = ".ogg";
    } else if (message.blobType.includes("audio/aac")) {
      fileExtension = ".aac";
    }

    // Generate filename
    let timestamp: Date;
    try {
      timestamp = message.timestamp
        ? new Date(message.timestamp)
        : new Date();
      
      // Check if timestamp is valid
      if (isNaN(timestamp.getTime())) {
        logger.warn("Invalid timestamp provided, using current time", {
          providedTimestamp: message.timestamp,
        });
        timestamp = new Date();
      }
    } catch (error) {
      logger.warn("Error parsing timestamp, using current time", {
        providedTimestamp: message.timestamp,
        error: error instanceof Error ? error.message : String(error),
      });
      timestamp = new Date();
    }
    
    const formattedDate = timestamp
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `voice-message-${formattedDate}${fileExtension}`;

    // Create Data URL
    const dataUrl = `data:${message.blobType};base64,${message.base64data}`;

    // Download file
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: filename,
        saveAs: DOWNLOAD_CONSTANTS.SAVE_AS,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          logger.error("Error occurred while downloading file", {
            error: chrome.runtime.lastError,
          });
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }

        logger.info("Started file download", {
          downloadId,
          filename,
          blobType: message.blobType,
        });

        sendResponse({
          success: true,
          message: "File download started",
          downloadId,
          filename,
        });
      }
    );
  } catch (error: any) {
    logger.error("Error occurred while handling blob content download", {
      error: error.message,
      stack: error.stack,
    });
    sendResponse({ success: false, error: error.message });
  }
}
