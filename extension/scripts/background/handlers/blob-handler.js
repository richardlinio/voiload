/**
 * blob-handler.js
 * 處理 Blob 相關的訊息
 */

import Logger from "../../utils/logger";
import { MODULE_NAMES } from "../../utils/constants";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.BLOB_HANDLER);

/**
 * 處理 Blob URL 註冊訊息
 * 將 Blob URL 與其持續時間一起存儲到 voiceMessagesStore 中
 *
 * @param {Object} voiceMessagesStore - 語音訊息資料存儲
 * @param {Object} message - 訊息物件，包含 blobUrl, durationMs 等資訊
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數
 * @returns {boolean} - 是否需要保持連接開啟
 */
export function handleBlobUrl(
  voiceMessagesStore,
  message,
  sender,
  sendResponse
) {
  // 取得基本資訊
  const { blobUrl, blobType, blobSize, durationMs, timestamp } = message;
  const urlFeatures = blobUrl ? blobUrl.substring(0, 30) + "..." : null;

  logger.debug("處理 Blob URL 註冊訊息", {
    blobUrl: urlFeatures,
    durationMs,
    blobType,
    blobSize,
    timestamp,
  });

  // 確保我們有 voiceMessagesStore
  if (!voiceMessagesStore) {
    logger.error("voiceMessagesStore 不存在");
    sendResponse({
      success: false,
      message: "內部錯誤：voiceMessagesStore 不存在",
    });
    return true;
  }

  // 確保有必要的資訊
  if (!blobUrl || !durationMs) {
    logger.error("缺少必要的 Blob URL 或持續時間資訊");
    sendResponse({
      success: false,
      message: "缺少必要的 Blob URL 或持續時間資訊",
    });
    return true;
  }

  try {
    // 使用 registerDownloadUrl 函數將 Blob URL 註冊到 voiceMessagesStore
    const id = voiceMessagesStore.registerDownloadUrl(
      voiceMessagesStore,
      durationMs,
      blobUrl,
      null, // 沒有 lastModified 資訊
      blobType,
      blobSize
    );

    logger.info(`成功註冊 Blob URL，ID: ${id}，持續時間: ${durationMs}ms`);

    // 輸出當前 voiceMessagesStore 的狀態
    logger.debug("voiceMessagesStore 當前項目數量", {
      itemsCount: voiceMessagesStore.items.size,
    });

    sendResponse({
      success: true,
      message: "成功註冊 Blob URL",
      id: id,
    });
  } catch (error) {
    logger.error("註冊 Blob URL 時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
    sendResponse({
      success: false,
      message: `註冊 Blob URL 時發生錯誤: ${error.message}`,
    });
  }

  return true; // 保持連接開啟，以便異步回應
}

/**
 * 處理 Blob URL 偵測訊息
 * 記錄 Blob URL 資訊，但不進行註冊（因為沒有持續時間資訊）
 *
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數
 * @returns {boolean} - 是否需要保持連接開啟
 */
export function handleBlobDetection(message, sender, sendResponse) {
  logger.debug("處理 Blob URL 偵測訊息", {
    blobUrl: message.blobUrl ? message.blobUrl.substring(0, 30) + "..." : null,
    blobType: message.blobType,
    blobSize: message.blobSize,
    timestamp: message.timestamp,
    error: message.error,
  });

  // 只記錄資訊，不進行實際的註冊
  // 如果有錯誤，記錄錯誤資訊
  if (message.error) {
    logger.error("Blob URL 偵測中的錯誤", {
      error: message.error,
    });
  }

  sendResponse({
    success: true,
    message: "已記錄 Blob URL 偵測資訊",
  });

  return true; // 保持連接開啟，以便異步回應
}

/**
 * 處理 blob 內容下載訊息
 *
 * @param {Object} message - 訊息物件
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數
 * @returns {boolean} - 是否需要保持連接開啟
 */
export function handleBlobContent(message, sender, sendResponse) {
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
      return true;
    }

    // 注意：在背景腳本（Service Worker）中不能使用 URL.createObjectURL

    // 直接使用 base64 資料，不需要轉換為 blob
    logger.debug("使用 base64 資料直接下載:", {
      blobType: message.blobType,
      base64Length: message.base64data.length,
    });

    // 根據 MIME 類型決定副檔名
    const fileExtension = getFileExtensionForMimeType(message.blobType);

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
        saveAs: false,
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

  return true; // 保持連接開啟，以便異步回應
}

/**
 * 根據 MIME 類型獲取適當的檔案副檔名
 *
 * @param {string} mimeType - MIME 類型
 * @returns {string} - 檔案副檔名（包含點號）
 * @private
 */
function getFileExtensionForMimeType(mimeType) {
  if (mimeType.includes("audio/mpeg") || mimeType.includes("audio/mp3")) {
    return ".mp3";
  } else if (mimeType.includes("audio/mp4") || mimeType.includes("video/mp4")) {
    return ".mp4";
  } else if (mimeType.includes("audio/wav")) {
    return ".wav";
  } else if (mimeType.includes("audio/ogg")) {
    return ".ogg";
  } else if (mimeType.includes("audio/aac")) {
    return ".aac";
  }
  return ".bin"; // 預設二進制檔案副檔名
}
