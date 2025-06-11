/**
 * audio-url-registration-handler.js
 * 處理 Audio URL 註冊相關的訊息
 */

import Logger from "../../utils/logger";
import { MODULE_NAMES } from "../../utils/constants";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(
  MODULE_NAMES.AUDIO_URL_REGISTRATION_HANDLER
);

/**
 * 處理 Audio URL 註冊訊息
 * 將 Audio URL 與其持續時間一起存儲到 voiceMessagesStore 中
 *
 * @param {Object} voiceMessagesStore - 語音訊息資料存儲
 * @param {Object} message - 訊息物件，包含 url, durationMs 等資訊
 * @param {Object} sender - 發送者資訊
 * @param {Function} sendResponse - 回應函數
 * @returns {boolean} - 是否需要保持連接開啟
 */
export function handleAudioUrlRegistration(
  voiceMessagesStore,
  message,
  sender,
  sendResponse
) {
  // 取得基本資訊
  const { audioUrl, durationMs, timestamp } = message;

  logger.debug("處理 Audio URL 註冊訊息", {
    audioUrl: audioUrl,
    durationMs,
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
  if (!audioUrl || !durationMs) {
    logger.error("缺少必要的 Audio URL 或持續時間資訊");
    sendResponse({
      success: false,
      message: "缺少必要的 Audio URL 或持續時間資訊",
    });
    return true;
  }

  try {
    // 使用 registerDownloadUrl 函數將 Audio URL 註冊到 voiceMessagesStore
    const id = voiceMessagesStore.registerDownloadUrl(
      voiceMessagesStore,
      durationMs,
      audioUrl
    );

    logger.info(`成功註冊 Audio URL，ID: ${id}，持續時間: ${durationMs}ms`);

    // 輸出當前 voiceMessagesStore 的狀態
    logger.debug("voiceMessagesStore 當前項目數量", {
      itemsCount: voiceMessagesStore.items.size,
    });

    sendResponse({
      success: true,
      message: "成功註冊 Audio URL",
      id: id,
    });
  } catch (error) {
    logger.error("註冊 Audio URL 時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
    sendResponse({
      success: false,
      message: `註冊 Audio URL 時發生錯誤: ${error.message}`,
    });
  }

  return true; // 保持連接開啟，以便異步回應
}
