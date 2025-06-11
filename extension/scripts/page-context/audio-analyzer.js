/**
 * audio-analyzer.js
 * 分析音訊的輔助函數
 */

import { Logger } from "../utils/logger";
import {
  MODULE_NAMES,
  SUPPORTED_SITES,
  BLOB_MONITOR_CONSTANTS,
  WEB_REQUEST_CONSTANTS,
} from "../utils/constants";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.AUDIO_ANALYZER);

// ================================================
// 語音訊息檢測函數
// ================================================

/**
 * 判斷請求是否為語音訊息
 * @param {string} url - 請求 URL
 * @param {string} method - HTTP 方法
 * @param {number} statusCode - HTTP 狀態碼
 * @param {Object} metadata - 選擇性，請求的元數據
 * @returns {boolean} - 是否為語音訊息
 */
export function isLikelyVoiceMessage(url, method, statusCode, metadata) {
  // 1. 基本檢查：URL 存在、為 GET 請求、狀態碼表示成功
  if (!url || method !== "GET") return false;

  if (
    statusCode &&
    !WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES.includes(statusCode)
  ) {
    return false;
  }

  // 2. 網域檢查：是否來自已知 CDN
  const isFromKnownCdn = SUPPORTED_SITES.CDN_PATTERNS.some((pattern) => {
    const domain = pattern.replace("*://*.", "").replace("/*", "");
    return url.includes(domain);
  });

  if (!isFromKnownCdn) return false;

  // 3. 內容類型檢查：是否為音訊
  if (
    metadata.contentType &&
    !WEB_REQUEST_CONSTANTS.AUDIO_CONTENT_TYPES.includes(metadata.contentType)
  ) {
    return false;
  }

  // 4. 檔案大小檢查：是否在合理範圍內
  if (metadata.contentLength) {
    const fileSizeBytes = parseInt(metadata.contentLength, 10);
    if (
      !isNaN(fileSizeBytes) &&
      (fileSizeBytes < BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE ||
        fileSizeBytes > BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE)
    ) {
      return false;
    }
  }

  return true;
}

// ===========================================
// 獲得音訊持續時間
// ===========================================

/**
 * 使用 HTML5 Audio 元素計算音訊持續時間
 * @param {string} url - 音訊 URL
 * @returns {Promise<Object>} - 持續時間計算結果
 */
export function getAudioDuration(url) {
  return new Promise((resolve, reject) => {
    logger.debug("開始計算音訊持續時間", {
      url: url.substring(0, 50) + "...",
    });

    // 創建音訊元素
    const audio = new Audio();

    // 關鍵設置：只預載 metadata，不下載整個檔案
    audio.preload = "metadata";

    // 設置事件監聽器
    audio.addEventListener("loadedmetadata", onMetadataLoaded);
    audio.addEventListener("error", onError);

    // 開始載入
    audio.src = url;

    // 當載入元數據時
    function onMetadataLoaded() {
      // 計算持續時間（毫秒）
      const durationMs = Math.round(audio.duration * 1000);

      logger.debug("音訊持續時間計算完成", {
        url: url.substring(0, 50) + "...",
        durationMs: durationMs,
      });

      // 清理監聽器
      audio.removeEventListener("loadedmetadata", onMetadataLoaded);
      audio.removeEventListener("error", onError);

      // 釋放資源
      audio.src = "";

      resolve(durationMs);
    }

    // 處理錯誤
    function onError(e) {
      logger.error("載入音訊時發生錯誤", {
        error: e.error || "未知錯誤",
        url: url.substring(0, 50) + "...",
      });

      // 清理監聽器
      audio.removeEventListener("loadedmetadata", onMetadataLoaded);
      audio.removeEventListener("error", onError);

      // 釋放資源
      audio.src = "";

      reject(new Error(`載入音訊時發生錯誤：${e.error || "未知錯誤"}`));
    }
  });
}

/**
 * 處理計算音訊持續時間的請求
 * @param {Object} message - 請求訊息
 */
export async function handleGetAudioDurationRequest(message) {
  try {
    // 使用 await 等待計算結果
    const result = await getAudioDuration(message.url);

    logger.debug("已取得音訊持續時間計算結果", result);
    return result;
  } catch (error) {
    logger.error("計算音訊持續時間時發生錯誤", {
      error: error.message,
      url: message.url.substring(0, 50) + "...",
    });
  }
}
