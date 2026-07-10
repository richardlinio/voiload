/**
 * download-manager.ts
 * Responsible for handling download functionality
 */

import { generateVoiceMessageFilename } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import { DOWNLOAD_CONSTANTS } from "../utils/constants";
import {
  selectDownloadUrl,
  selectDownloadExtension,
} from "../utils/download-url";
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
    async (
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
              isWav: lastRightClickedInfo.isWav,
            });
            downloadVoiceMessage(
              lastRightClickedInfo.downloadUrl,
              lastRightClickedInfo.lastModified || undefined,
              undefined,
              undefined,
              lastRightClickedInfo.isWav ?? false,
              lastRightClickedInfo.blobType
            );
          } else {
            logger.info("No specific voice message URL found, triggering batch download with first dialog");
            // Directly call downloadAllVoiceMessages if voiceMessagesStore is available
            if (voiceMessagesStore) {
              const downloadCount = await downloadAllVoiceMessages(voiceMessagesStore, true);
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
 * @param isWav - Whether url points at a WAV re-encoding rather than the original audio.
 *   Defaults to false: labelling un-converted audio as .wav yields a file no player
 *   can open, whereas the reverse merely names a WAV by its source container.
 * @param sourceMimeType - MIME type of the original audio, used to name the file
 *   when it was not re-encoded
 */
export function downloadVoiceMessage(url: string, lastModified?: string, uniqueIdentifier?: string, saveAs?: boolean, isWav: boolean = false, sourceMimeType?: string | null): void {
  logger.debug("downloadVoiceMessage function called");

  if (!url) {
    logger.error("Invalid download URL");
    return;
  }

  // Captured audio is re-encoded to WAV; un-converted audio keeps the extension
  // of the container it was served in.
  const extension = selectDownloadExtension(isWav, sourceMimeType);

  // Generate filename with unique identifier
  const baseFilename = generateVoiceMessageFilename(lastModified);
  const filename = uniqueIdentifier
    ? `${baseFilename}-${uniqueIdentifier}${extension}`
    : `${baseFilename}${extension}`;

  logger.debug("Generated filename", { filename, uniqueIdentifier, isWav });

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
export async function downloadAllVoiceMessages(voiceMessagesStore: VoiceMessageStore, showFirstDialog: boolean = false): Promise<number> {
  logger.debug("downloadAllVoiceMessages function called");

  if (!voiceMessagesStore || typeof voiceMessagesStore.getAllItems !== "function") {
    logger.error("Invalid voice messages store");
    return 0;
  }

  const items = await voiceMessagesStore.getAllItems();

  let downloadCount = 0;
  let isFirstFile = true;

  logger.debug("Iterating through voice message store", {
    totalItems: items.length,
    showFirstDialog,
  });

  for (const item of items) {
    const id = item.id;
    if (item.downloadUrl && item.downloadUrl.trim() !== "") {
      // Determine saveAs value: first file uses showFirstDialog, others use false
      const useSaveAs = isFirstFile && showFirstDialog;

      // Prefer the WAV re-encoding, falling back to the original audio.
      const { url, isWav } = selectDownloadUrl(item);

      logger.debug("Downloading voice message", {
        id,
        durationMs: item.durationMs,
        url: url!.substring(0, 50) + "...",
        isFirstFile,
        useSaveAs,
        isWav,
      });

      // Use voice message ID as unique identifier to prevent filename conflicts
      downloadVoiceMessage(url!, item.lastModified || undefined, id, useSaveAs, isWav, item.blobType);
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
    totalItems: items.length,
  });

  return downloadCount;
}
