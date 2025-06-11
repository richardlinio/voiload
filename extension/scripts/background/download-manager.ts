/**
 * download-manager.ts
 * 負責處理下載功能
 */

import { generateVoiceMessageFilename } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import { DOWNLOAD_CONSTANTS } from "../utils/constants";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("download-manager");

// ================================================
// 類型定義
// ================================================

/**
 * 右鍵點擊資訊介面
 */
interface RightClickInfo {
  elementId: string | null;
  downloadUrl: string | null;
  lastModified?: string | null;
  tabId?: number;
}

/**
 * 下載訊息介面
 */
interface DownloadMessage {
  base64data: string;
  blobType: string;
  requestId?: string;
  timestamp?: string;
}

// 儲存最後一次右鍵點擊的資訊
let lastRightClickedInfo: RightClickInfo | null = null;

/**
 * 初始化下載管理器
 */
export function initDownloadManager(): void {
  logger.info("初始化下載管理器");

  // 監聽右鍵選單點擊事件
  chrome.contextMenus.onClicked.addListener(
    (
      info: chrome.contextMenus.OnClickData,
      tab: chrome.tabs.Tab | undefined
    ) => {
      logger.debug("右鍵選單點擊", {
        menuItemId: info.menuItemId,
        hasLastRightClickedInfo: !!lastRightClickedInfo,
      });

      if (info.menuItemId === "downloadVoiceMessage") {
        if (lastRightClickedInfo) {
          logger.info("開始下載語音訊息", {
            url: lastRightClickedInfo.downloadUrl
              ? lastRightClickedInfo.downloadUrl.substring(0, 50) + "..."
              : null,
            lastModified: lastRightClickedInfo.lastModified,
          });
          downloadVoiceMessage(
            lastRightClickedInfo.downloadUrl,
            lastRightClickedInfo.lastModified
          );
        } else {
          logger.error("無法下載，沒有右鍵點擊資訊");
        }
      }
    }
  );
}

/**
 * 設置最後一次右鍵點擊的資訊
 *
 * @param info - 右鍵點擊資訊
 */
export function setLastRightClickedInfo(info: RightClickInfo): void {
  lastRightClickedInfo = info;

  logger.debug("設置最後一次右鍵點擊的資訊", {
    elementId: info.elementId,
    downloadUrl: info.downloadUrl
      ? info.downloadUrl.substring(0, 50) + "..."
      : null,
    lastModified: info.lastModified,
    tabId: info.tabId,
  });
}

/**
 * 下載語音訊息
 *
 * @param url - 下載 URL
 * @param lastModified - Last-Modified 標頭值
 */
export function downloadVoiceMessage(url: string, lastModified?: string): void {
  logger.debug("下載語音訊息函數被調用");

  if (!url) {
    logger.error("下載 URL 無效");
    return;
  }

  // 生成檔案名稱
  const filename = `${generateVoiceMessageFilename(lastModified)}.mp4`;
  logger.debug("生成的檔案名稱", { filename });

  // 使用 Chrome 下載 API 下載檔案
  logger.debug("準備調用 chrome.downloads.download API");
  chrome.downloads.download(
    {
      url: url,
      filename: filename,
      saveAs: DOWNLOAD_CONSTANTS.SAVE_AS,
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        logger.error("下載失敗", chrome.runtime.lastError);
      } else {
        logger.info("下載成功", { downloadId });
      }
    }
  );

  logger.info("開始下載語音訊息", {
    url: url.substring(0, 50) + "...",
    filename,
  });
}

/**
 * 處理 blob 內容下載訊息
 *
 * @param message - 訊息物件
 * @param sender - 發送者資訊
 * @param sendResponse - 回應函數
 */
export function downloadBlobContent(
  message: DownloadMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): void {
  try {
    logger.debug("處理 blob 內容下載訊息", {
      blobType: message.blobType,
      base64Length: message.base64data ? message.base64data.length : 0,
      requestId: message.requestId,
      timestamp: message.timestamp,
    });

    // 檢查必要的參數
    if (!message.base64data || !message.blobType) {
      logger.error("缺少必要的參數");
      sendResponse({ success: false, error: "缺少必要的參數" });
      return;
    }

    // 注意：在背景腳本（Service Worker）中不能使用 URL.createObjectURL

    // 直接使用 base64 資料，不需要轉換為 blob
    logger.debug("使用 base64 資料直接下載:", {
      blobType: message.blobType,
      base64Length: message.base64data.length,
    });

    // 根據 MIME 類型決定副檔名
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

    // 生成檔案名稱
    const timestamp = message.timestamp
      ? new Date(message.timestamp)
      : new Date();
    const formattedDate = timestamp
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `voice-message-${formattedDate}${fileExtension}`;

    // 創建 Data URL
    const dataUrl = `data:${message.blobType};base64,${message.base64data}`;

    // 下載檔案
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: filename,
        saveAs: DOWNLOAD_CONSTANTS.SAVE_AS,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          logger.error("下載檔案時發生錯誤", {
            error: chrome.runtime.lastError,
          });
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }

        logger.info("已開始下載檔案", {
          downloadId,
          filename,
          blobType: message.blobType,
        });

        sendResponse({
          success: true,
          message: "已開始下載檔案",
          downloadId,
          filename,
        });
      }
    );
  } catch (error) {
    logger.error("處理 blob 內容下載時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
    sendResponse({ success: false, error: error.message });
  }
}
