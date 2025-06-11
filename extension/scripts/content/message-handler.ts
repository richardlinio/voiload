/**
 * message-handler.ts
 * 負責處理來自背景腳本的訊息並路由到正確的處理器
 */

import { Logger } from "../utils/logger";
import {
  MESSAGE_SOURCES,
  MESSAGE_ACTIONS,
  MODULE_NAMES,
} from "../utils/constants";
import { handleGetAudioDurationRequest } from "../page-context/audio-analyzer";
import { handleExtractBlobRequest } from "../page-context/blob-monitor";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.CONTENT_MESSAGE_HANDLER);

// ================================================
// 類型定義
// ================================================

/**
 * 頁面上下文訊息事件介面
 */
interface PageContextMessageEvent extends MessageEvent {
  data: {
    type: string;
    message: any;
  };
}

/**
 * 背景腳本訊息事件介面
 */
interface BackgroundScriptMessageEvent extends MessageEvent {
  data: {
    type: string;
    message: any;
  };
}

/**
 * 音訊 URL 註冊訊息介面
 */
interface AudioUrlRegistrationMessage {
  action: string;
  audioUrl: string;
  durationMs: number;
  timestamp: string;
}

/**
 * 獲取音訊持續時間請求訊息介面
 */
interface GetAudioDurationMessage {
  action: string;
  url: string;
}

/**
 * 下載 Blob 請求訊息介面
 */
interface DownloadBlobMessage {
  action: string;
  blobUrl: string;
  blobType?: string;
  requestId?: string;
}

// ================================================
// 訊息處理函數
// ================================================

/**
 * 初始化訊息處理器
 * 設置訊息監聽器，處理來自背景腳本的訊息
 */
export function initMessageHandler(): void {
  logger.debug("初始化內容腳本訊息處理器");

  // 設置訊息監聽器，處理來自頁面上下文的訊息
  window.addEventListener("message", async function (event: MessageEvent) {
    // 確保訊息來自同一個頁面
    if (event.source !== window) {return;}

    // 處理來自頁面上下文的訊息
    if (event.data.type && event.data.type === MESSAGE_SOURCES.PAGE_CONTEXT) {
      const pageEvent = event as PageContextMessageEvent;
      const message = pageEvent.data.message;
      logger.debug("收到頁面上下文訊息", { message });

      // 處理特定類型的訊息
      switch (message.action) {
        case MESSAGE_ACTIONS.REGISTER_BLOB_URL:
          // 處理 Blob URL 註冊訊息 - 轉發到背景腳本
          sendMessageToBackground(message);
          break;

        case MESSAGE_ACTIONS.BLOB_DETECTED:
          // 處理 Blob 偵測到的訊息 - 轉發到背景腳本
          sendMessageToBackground(message);
          break;

        case "pageContextInitialized":
          // 處理頁面上下文初始化訊息
          logger.info("頁面上下文已初始化");
          break;

        default:
          // 其他訊息轉發到背景腳本
          sendMessageToBackground(message);
          break;
      }
    }

    // 處理來自背景腳本的訊息
    if (
      event.data.type &&
      event.data.type === MESSAGE_SOURCES.BACKGROUND_SCRIPT
    ) {
      const backgroundEvent = event as BackgroundScriptMessageEvent;
      const message = backgroundEvent.data.message;
      logger.debug("收到背景腳本訊息", { message });

      // 根據訊息動作路由到對應的處理器
      await handleMessage(message);
    }
  });

  logger.info("內容腳本訊息處理器已初始化");
}

/**
 * 將訊息發送到背景腳本
 * @param message - 要發送的訊息
 */
function sendMessageToBackground(message: any): void {
  try {
    logger.debug("準備將訊息發送到背景腳本", { message });

    chrome.runtime.sendMessage(message, function (response) {
      logger.debug("背景腳本回應", { response });
    });

    logger.debug("訊息已發送到背景腳本");
  } catch (error) {
    logger.error("發送訊息到背景腳本時發生錯誤", { error });
  }
}

/**
 * 根據訊息類型路由到對應的處理器
 * @param message - 接收到的訊息
 */
async function handleMessage(message: any): Promise<void> {
  logger.debug("開始處理訊息", { action: message.action });

  switch (message.action) {
    case MESSAGE_ACTIONS.GET_AUDIO_DURATION:
      logger.debug("處理獲取音訊時長請求");
      const durationMessage = message as GetAudioDurationMessage;
      const durationMs = await handleGetAudioDurationRequest(durationMessage);

      // 只有在成功獲得持續時間後才註冊
      if (durationMs !== undefined && durationMs !== null) {
        registerAudioUrlWithBackend(durationMessage.url, durationMs);
      } else {
        logger.debug("獲取的音訊持續時間無效", { url: durationMessage.url });
      }
      break;

    case MESSAGE_ACTIONS.DOWNLOAD_BLOB:
      logger.debug("處理提取 Blob 內容請求");
      const blobMessage = message as DownloadBlobMessage;
      await handleExtractBlobRequest(blobMessage, (response) => {
        logger.debug("提取 Blob 內容回應", { response });
      });
      break;

    // 可以添加更多訊息類型的處理...

    default:
      logger.warn("未處理的訊息類型", {
        action: message.action || "無動作",
      });
      break;
  }
}

/**
 * 向背景腳本註冊 Audio URL
 * @param url - 音訊 URL
 * @param durationMs - 音訊持續時間（毫秒）
 */
function registerAudioUrlWithBackend(url: string, durationMs: number): void {
  // 建立要發送的訊息
  const message: AudioUrlRegistrationMessage = {
    action: MESSAGE_ACTIONS.REGISTER_AUDIO_URL,
    audioUrl: url,
    durationMs: durationMs,
    timestamp: new Date().toISOString(),
  };

  // 發送訊息到背景腳本
  sendMessageToBackground(message);

  // 記錄詳細資訊
  logger.debug("向背景腳本發送 Audio URL 註冊資訊", {
    audioUrl: url.substring(0, 50),
    durationMs: durationMs,
  });
}
