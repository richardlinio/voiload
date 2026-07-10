/**
 * download-manager.ts
 * Responsible for handling download functionality
 */

import { generateVoiceMessageFilename } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import { DOWNLOAD_CONSTANTS, MESSAGE_ACTIONS } from "../utils/constants";
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
      tab: chrome.tabs.Tab | undefined
    ) => {
      logger.debug("Context menu clicked", {
        menuItemId: info.menuItemId,
        hasLastRightClickedInfo: !!lastRightClickedInfo,
      });

      if (info.menuItemId === "downloadVoiceMessage") {
        if (lastRightClickedInfo) {
          // Snapshot before the await below: a right-click on another message
          // replaces the global, and re-reading it afterwards would mix this
          // message's URL with that one's lastModified and blobType.
          const clicked = lastRightClickedInfo;

          // Check if downloadUrl is valid
          if (clicked.downloadUrl) {
            // Re-encode now rather than on right-click: the cost (5-46ms) is
            // imperceptible here, and the right-click no longer has to publish a
            // half-ready state that a fast click could catch.
            // Ask the tab the right-click came from, not the menu-click callback's
            // tab. clicked.tabId is the page that holds the captured audio (it sent
            // the RIGHT_CLICK); onClicked's `tab` may point elsewhere or be absent,
            // and sending REQUEST_WAV there fails with "receiving end does not exist"
            // so the WAV re-encode silently falls back to the original audio.
            const wavUrl = clicked.durationMs
              ? await requestWav(clicked.tabId ?? tab?.id, clicked.durationMs)
              : null;

            const { url, isWav } = selectDownloadUrl({
              downloadUrl: clicked.downloadUrl,
              wavUrl,
            });

            logger.info("Starting individual voice message download", {
              url: url!.substring(0, 50) + "...",
              lastModified: clicked.lastModified,
              isWav,
            });
            // Awaited for the same reason as the batch loop: the next message's
            // conversion revokes this WAV blob URL, and Chrome does not read the
            // blob's bytes until after the user confirms the Save-As dialog.
            await downloadVoiceMessage(
              url!,
              clicked.lastModified || undefined,
              undefined,
              undefined,
              isWav,
              clicked.blobType
            );
          } else {
            logger.info("No specific voice message URL found, triggering batch download with first dialog");
            // Directly call downloadAllVoiceMessages if voiceMessagesStore is available
            if (voiceMessagesStore) {
              const downloadCount = await downloadAllVoiceMessages(
                voiceMessagesStore,
                true,
                clicked.tabId ?? tab?.id
              );
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
export function downloadVoiceMessage(url: string, lastModified?: string, uniqueIdentifier?: string, saveAs?: boolean, isWav: boolean = false, sourceMimeType?: string | null): Promise<void> {
  logger.debug("downloadVoiceMessage function called");

  if (!url) {
    logger.error("Invalid download URL");
    return Promise.resolve();
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

  // Resolves once Chrome has accepted the URL. A batch download must not revoke
  // a WAV blob URL before Chrome has taken hold of it.
  return new Promise((resolve) => {
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
        resolve();
      }
    );

    logger.info("Started voice message download", {
      url: url.substring(0, 50) + "...",
      filename,
    });
  });
}

/**
 * Ask the content script in a tab to re-encode one message as WAV.
 *
 * Returns null when there is no tab to ask, or the page cannot convert; the
 * caller then downloads the original audio.
 */
async function requestWav(
  tabId: number | undefined,
  durationMs: number
): Promise<string | null> {
  if (tabId === undefined) {
    return null;
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: MESSAGE_ACTIONS.REQUEST_WAV,
      durationMs,
    });
    return response?.wavUrl ?? null;
  } catch (error) {
    logger.warn("Could not reach the page to re-encode a message", {
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Download all voice messages from the data store
 *
 * Each message is re-encoded to WAV just before its download and the blob URL is
 * released straight after, so the batch holds one WAV at a time rather than one
 * per message. A message the page cannot convert is downloaded in its original
 * format instead of being skipped.
 *
 * @param voiceMessagesStore - Voice message data store
 * @param showFirstDialog - Whether to show save dialog for the first file (defaults to false)
 * @param tabId - Tab whose page context holds the captured audio
 * @returns Number of downloads started
 */
export async function downloadAllVoiceMessages(voiceMessagesStore: VoiceMessageStore, showFirstDialog: boolean = false, tabId?: number): Promise<number> {
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

      const wavUrl = await requestWav(tabId, item.durationMs);

      // Prefer the WAV re-encoding, falling back to the original audio.
      const { url, isWav } = selectDownloadUrl({
        downloadUrl: item.downloadUrl,
        wavUrl,
      });

      logger.debug("Downloading voice message", {
        id,
        durationMs: item.durationMs,
        url: url!.substring(0, 50) + "...",
        isFirstFile,
        useSaveAs,
        isWav,
      });

      // Awaited so the next iteration's conversion cannot revoke this WAV blob
      // URL before Chrome has read it.
      // Use voice message ID as unique identifier to prevent filename conflicts
      await downloadVoiceMessage(url!, item.lastModified || undefined, id, useSaveAs, isWav, item.blobType);
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
