/**
 * message-handler.js
 * 負責處理來自內容腳本的訊息並路由到正確的處理器
 */

import { handleRightClick } from "./handlers/right-click-handler.js";
import { handleElementRegistration } from "./handlers/element-registration-handler.js";
import { handleAudioUrlRegistration } from "./handlers/audio-url-registration-handler.js";
import {
  handleBlobUrl,
  handleBlobContent,
  handleBlobDetection,
} from "./handlers/blob-handler.js";
import { createDataStore } from "./data-store.js";
import Logger from "../utils/logger";
import {
  MESSAGE_ACTIONS,
  MESSAGE_SOURCES,
  MODULE_NAMES,
} from "../utils/constants";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.MESSAGE_HANDLER);

// 使用單例模式獲取語音訊息資料存儲
let voiceMessagesStore = null;

/**
 * 初始化訊息處理器
 *
 * @param {Object} [voiceMessages] - 語音訊息資料存儲（可選，如果未提供則使用單例）
 */
export function initMessageHandler(voiceMessages) {
  logger.debug("初始化訊息處理器");

  // 如果提供了 voiceMessages 參數，使用它；否則使用單例
  if (voiceMessages) {
    logger.debug("使用提供的 voiceMessages 實例");
    voiceMessagesStore = voiceMessages;
  } else {
    logger.debug("使用單例 voiceMessages 實例");
    voiceMessagesStore = createDataStore();
  }

  logger.debug("voiceMessagesStore 初始化完成", {
    mapSize: voiceMessagesStore.items.size,
  });

  // 監聽來自內容腳本的訊息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    logger.debug("收到訊息", { message });
    logger.debug("發送者資訊", { sender });

    // 根據訊息類型路由到對應的處理器
    switch (message.action) {
      case MESSAGE_ACTIONS.RIGHT_CLICK:
        logger.debug("處理右鍵點擊訊息");
        return handleRightClick(
          voiceMessagesStore,
          message,
          sender,
          sendResponse
        );

      case MESSAGE_ACTIONS.REGISTER_ELEMENT:
        logger.debug("處理語音訊息元素註冊訊息");
        return handleElementRegistration(
          voiceMessagesStore,
          message,
          sender,
          sendResponse
        );

      case MESSAGE_ACTIONS.REGISTER_AUDIO_URL:
        logger.debug("處理 Audio URL 註冊訊息");
        return handleAudioUrlRegistration(
          voiceMessagesStore,
          message,
          sender,
          sendResponse
        );

      case MESSAGE_ACTIONS.DOWNLOAD_BLOB:
        logger.debug("處理 Blob 內容下載訊息");
        return handleBlobContent(message, sender, sendResponse);

      case MESSAGE_ACTIONS.REGISTER_BLOB_URL:
        logger.debug("處理 Blob URL 註冊訊息");
        return handleBlobUrl(voiceMessagesStore, message, sender, sendResponse);

      case MESSAGE_ACTIONS.BLOB_DETECTED:
        logger.debug("處理 Blob URL 偵測訊息");
        return handleBlobDetection(message, sender, sendResponse);

      default:
        logger.warn("未處理的訊息類型", {
          action: message.action || "無動作",
        });
        return false;
    }
  });
}
