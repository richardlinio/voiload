/**
 * web-request-interceptor.ts
 * 使用 Chrome 的 webRequest API 監控網路請求，用於攔截語音訊息的下載 URL
 */

import { isLikelyVoiceMessage } from "../page-context/audio-analyzer";
import { Logger } from "../utils/logger";
import {
  MODULE_NAMES,
  VOICE_MESSAGE_URL_PATTERNS,
  MESSAGE_ACTIONS,
  SUPPORTED_SITES,
  TIME_CONSTANTS,
} from "../utils/constants";

import { type VoiceMessageStore } from "./data-store";

// ================================================
// 類型定義
// ================================================

/**
 * 請求 Metadata 介面
 */
interface RequestMetadata {
  contentDisposition: string;
  contentType: string;
  contentLength: string;
  lastModified: string;
}

/**
 * 音訊時長訊息介面
 */
interface AudioDurationMessage {
  action: string;
  url: string;
  metadata: {
    contentType?: string;
    contentLength?: string;
    lastModified?: string;
  };
  timestamp: number;
}

const logger = Logger.createModuleLogger(MODULE_NAMES.WEB_REQUEST);

// 使用 Set 結構來儲存已處理過的 URL
let processedUrls = new Set<string>();

// ================================================
// 公開函數
// ================================================

/**
 * 初始化 webRequest 攔截器
 * @param voiceMessages - 語音訊息資料存儲
 */
export function initWebRequestInterceptor(
  voiceMessages: VoiceMessageStore
): void {
  try {
    logger.debug("初始化 webRequest 攔截器");

    // 檢查 WebRequest API 是否可用
    if (!chrome || !chrome.webRequest) {
      logger.error("chrome.webRequest API 不可用");
      return;
    }

    // 設置網路請求監聽器
    setupWebRequestListeners(voiceMessages);

    // 設置定期清理機制
    setupPeriodicUrlCacheCleanup();

    logger.info("webRequest 攔截器已初始化", {
      patterns: VOICE_MESSAGE_URL_PATTERNS,
    });
  } catch (error: any) {
    logger.error("初始化 webRequest 攔截器時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
  }
}

// ================================================
// 監聽器初始化
// ================================================

/**
 * 設置網路請求監聽器
 * @param {Object} voiceMessages - 語音訊息資料存儲
 */
function setupWebRequestListeners(voiceMessages: VoiceMessageStore) {
  // 監聽已接收標頭的請求 - 主要用於早期識別
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => handleRequest(voiceMessages, details),
    { urls: [...VOICE_MESSAGE_URL_PATTERNS] },
    ["responseHeaders"]
  );

  // 監聽完成的請求 - 確保所有數據都已接收
  chrome.webRequest.onCompleted.addListener(
    (details) => handleRequest(voiceMessages, details),
    { urls: [...VOICE_MESSAGE_URL_PATTERNS] },
    ["responseHeaders"]
  );
}

/**
 * 設置定期清理過期的 URL 快取
 * 簡化版：直接清空整個快取
 */
function setupPeriodicUrlCacheCleanup() {
  setInterval(() => {
    // 直接創建新的 Set，讓舊的被垃圾回收
    processedUrls = new Set();

    logger.debug("已清空 URL 快取");
  }, TIME_CONSTANTS.CLEANUP_INTERVAL);
}

// ================================================
// 請求處理函數
// ================================================

/**
 * 處理網路請求
 * @param {Object} voiceMessages - 語音訊息資料存儲
 * @param {Object} details - 請求詳情
 */
function handleRequest(
  voiceMessages: VoiceMessageStore,
  details: chrome.webRequest.WebResponseHeadersDetails
) {
  try {
    const { url, method, statusCode, responseHeaders } = details;

    // 檢查 URL 是否已經處理過
    if (processedUrls.has(url)) {
      logger.debug("已處理過此 URL，跳過", {
        url: url.substring(0, 50) + "...",
      });
      return;
    }

    // 提取 metadata
    const metadata = getMetadata(responseHeaders);

    // 判斷是否可能為語音訊息
    if (!isLikelyVoiceMessage(url, method, statusCode, metadata)) {
      return;
    }

    logger.debug("偵測到語音訊息請求", {
      url: url.substring(0, 100) + "...",
      type: details.type,
      statusCode: statusCode,
      method: method,
    });

    // 將此 URL 標記為已處理
    markUrlAsProcessed(url);

    // 向所有可能的標籤頁發送訊息，請求計算音訊持續時間
    broadcastToContentScripts({
      action: MESSAGE_ACTIONS.GET_AUDIO_DURATION,
      url: url,
      metadata: {
        contentType: metadata.contentType,
        contentLength: metadata.contentLength,
        lastModified: metadata.lastModified,
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    logger.error("處理請求時發生錯誤", {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * 將 URL 標記為已處理
 * @param {string} url - 要標記的 URL
 */
function markUrlAsProcessed(url: string) {
  processedUrls.add(url);
  logger.debug("URL 已標記為已處理", {
    url: url.substring(0, 50) + "...",
    cacheSize: processedUrls.size,
  });
}

// ================================================
// Metadata 提取函數
// ================================================

/**
 * 從請求標頭中提取 metadata
 * @param {Array} responseHeaders - 回應標頭陣列
 * @returns {Object} - 提取 metadata
 */
function getMetadata(
  responseHeaders: chrome.webRequest.HttpHeader[] | undefined
) {
  const metadata = {
    contentDisposition: "",
    contentType: "",
    contentLength: "",
    lastModified: "",
  };

  if (!responseHeaders) {return metadata;}

  // 從標頭中提取資訊
  for (const header of responseHeaders) {
    const headerName = header.name.toLowerCase();
    const headerValue = header.value;

    switch (headerName) {
      case "content-disposition":
        metadata.contentDisposition = headerValue || "";
        break;
      case "content-type":
        metadata.contentType = headerValue || "";
        break;
      case "content-length":
        metadata.contentLength = headerValue || "";
        break;
      case "last-modified":
        metadata.lastModified = headerValue || "";
        break;
    }
  }
  return metadata;
}

// ================================================
// 向內容腳本廣播訊息函數
// ================================================

/**
 * 向所有標籤頁廣播訊息
 * @param {Object} message - 要發送的訊息
 */
function broadcastToContentScripts(message: any) {
  chrome.tabs.query({ url: [...SUPPORTED_SITES.PATTERNS] }, (tabs) => {
    logger.debug(`向 ${tabs.length} 個標籤頁廣播訊息`, { message });

    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            logger.debug(`向標籤頁 ${tab.id} 發送訊息失敗`, {
              error: chrome.runtime.lastError.message,
            });
          } else if (response && response.success) {
            logger.debug(`標籤頁 ${tab.id} 已接收訊息`, {
              responseData: response,
            });
          }
        });
      }
    }
  });
}
