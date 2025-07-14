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
 * Download all voice messages from the data store
 *
 * @param voiceMessagesStore - Voice message data store
 * @returns Number of downloads started
 */
export function downloadAllVoiceMessages(voiceMessagesStore: VoiceMessageStore): number {
  logger.debug("downloadAllVoiceMessages function called");

  if (!voiceMessagesStore || !voiceMessagesStore.items) {
    logger.error("Invalid voice messages store");
    return 0;
  }

  let downloadCount = 0;

  logger.debug("Iterating through voice message store", {
    totalItems: voiceMessagesStore.items.size,
  });

  for (const [id, item] of voiceMessagesStore.items.entries()) {
    if (item.downloadUrl && item.downloadUrl.trim() !== "") {
      logger.debug("Downloading voice message", {
        id,
        durationMs: item.durationMs,
        url: item.downloadUrl.substring(0, 50) + "...",
      });

      downloadVoiceMessage(item.downloadUrl, item.lastModified || undefined);
      downloadCount++;
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
