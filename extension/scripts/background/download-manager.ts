/**
 * download-manager.ts
 * Responsible for handling download functionality
 */

import { generateVoiceMessageFilename } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import { DOWNLOAD_CONSTANTS } from "../utils/constants";
import type { RightClickInfo } from "../types/download";

import type { VoiceMessageStore } from "./data-store";

// Create a module-specific logger
const logger = Logger.createModuleLogger("download-manager");

// Store the last right-clicked info
let lastRightClickedInfo: RightClickInfo | null = null;

/**
 * Initialize the download manager
 */
export function initDownloadManager(voiceMessagesStore?: VoiceMessageStore): void {
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
          // Check if downloadUrl is valid
          if (lastRightClickedInfo.downloadUrl) {
            logger.info("Starting individual voice message download", {
              url: lastRightClickedInfo.downloadUrl.substring(0, 50) + "...",
              lastModified: lastRightClickedInfo.lastModified,
            });
            downloadVoiceMessage(
              lastRightClickedInfo.downloadUrl,
              lastRightClickedInfo.lastModified || undefined
            );
          } else {
            logger.info("No specific voice message URL found, triggering batch download with first dialog");
            // Directly call downloadAllVoiceMessages if voiceMessagesStore is available
            if (voiceMessagesStore) {
              const downloadCount = downloadAllVoiceMessages(voiceMessagesStore, true);
              logger.info("Batch download triggered with first dialog", { downloadCount });
            } else {
              logger.error("Cannot trigger batch download: voiceMessagesStore not available");
            }
          }
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
 * @param uniqueIdentifier - Unique identifier to avoid filename conflicts (e.g., voice message ID or duration)
 * @param saveAs - Whether to show save dialog (defaults to DOWNLOAD_CONSTANTS.SAVE_AS)
 */
export function downloadVoiceMessage(url: string, lastModified?: string, uniqueIdentifier?: string, saveAs?: boolean): void {
  logger.debug("downloadVoiceMessage function called");

  if (!url) {
    logger.error("Invalid download URL");
    return;
  }

  // Generate filename with unique identifier
  const baseFilename = generateVoiceMessageFilename(lastModified);
  const filename = uniqueIdentifier 
    ? `${baseFilename}-${uniqueIdentifier}.mp4`
    : `${baseFilename}.mp4`;
  
  logger.debug("Generated filename", { filename, uniqueIdentifier });

  // Use Chrome downloads API to download the file
  const useSaveAs = saveAs !== undefined ? saveAs : DOWNLOAD_CONSTANTS.SAVE_AS;
  logger.debug("Preparing to call chrome.downloads.download API", { saveAs: useSaveAs });
  chrome.downloads.download(
    {
      url: url,
      filename: filename,
      saveAs: useSaveAs,
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
 * Download all voice messages from the data store
 *
 * @param voiceMessagesStore - Voice message data store
 * @param showFirstDialog - Whether to show save dialog for the first file (defaults to false)
 * @returns Number of downloads started
 */
export function downloadAllVoiceMessages(voiceMessagesStore: VoiceMessageStore, showFirstDialog: boolean = false): number {
  logger.debug("downloadAllVoiceMessages function called");

  if (!voiceMessagesStore || !voiceMessagesStore.items) {
    logger.error("Invalid voice messages store");
    return 0;
  }

  let downloadCount = 0;
  let isFirstFile = true;

  logger.debug("Iterating through voice message store", {
    totalItems: voiceMessagesStore.items.size,
    showFirstDialog,
  });

  for (const [id, item] of voiceMessagesStore.items.entries()) {
    if (item.downloadUrl && item.downloadUrl.trim() !== "") {
      // Determine saveAs value: first file uses showFirstDialog, others use false
      const useSaveAs = isFirstFile && showFirstDialog;
      
      logger.debug("Downloading voice message", {
        id,
        durationMs: item.durationMs,
        url: item.downloadUrl.substring(0, 50) + "...",
        isFirstFile,
        useSaveAs,
      });

      // Use voice message ID as unique identifier to prevent filename conflicts
      downloadVoiceMessage(item.downloadUrl, item.lastModified || undefined, id, useSaveAs);
      downloadCount++;
      isFirstFile = false; // Mark that we've processed the first file
    } else {
      logger.debug("Skipping item without valid download URL", {
        id,
        hasUrl: !!item.downloadUrl,
        urlLength: item.downloadUrl?.length || 0,
      });
    }
  }

  logger.info("Batch download completed", {
    downloadCount,
    totalItems: voiceMessagesStore.items.size,
  });

  return downloadCount;
}
