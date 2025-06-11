/**
 * page-context.ts
 * 在頁面上下文中運行的腳本，負責執行需要頁面環境的功能
 * 這個檔案會以 ES6 模組的方式載入，可以使用 import/export 語法
 */

import { Logger } from "./utils/logger";
import { MESSAGE_SOURCES, MODULE_NAMES } from "./utils/constants";
import { initBlobMonitor } from "./page-context/blob-monitor";

// ================================================
// 類型定義
// ================================================

/**
 * 頁面上下文訊息介面
 */
interface PageContextMessage {
  action: string;
  url?: string;
  hostname?: string;
}

// Window 介面擴展已在 blob-monitor.ts 中定義

// 創建模組特定的日誌記錄器 - 使用新的模組名稱
const logger = Logger.createModuleLogger(MODULE_NAMES.PAGE_CONTEXT);

/**
 * 主要初始化函數
 */
function initialize(): void {
  logger.info("初始化頁面上下文模組");

  // 檢查是否在支援的網站上
  const isSupportedSite =
    window.location.hostname.includes("facebook.com") ||
    window.location.hostname.includes("messenger.com");

  if (!isSupportedSite) {
    logger.debug("不支援的網站，擴充功能不會啟動");
    return;
  }

  try {
    // 初始化 Blob 監控模組
    logger.debug("準備初始化 Blob 監控模組");
    initBlobMonitor();
    logger.debug("Blob 監控模組初始化完成");
  } catch (error: any) {
    logger.error("初始化 Blob 監控模組時出錯", { error });
  }

  // 通知內容腳本頁面上下文已初始化
  const initMessage: PageContextMessage = {
    action: "pageContextInitialized",
    url: window.location.href,
    hostname: window.location.hostname,
  };

  window.postMessage(
    {
      type: MESSAGE_SOURCES.PAGE_CONTEXT,
      message: initMessage,
    },
    "*"
  );

  // 定義向內容腳本發送訊息的輔助函數
  window.sendToContent = function (message: any): void {
    try {
      logger.debug("準備發送訊息到內容腳本", { message });

      // 使用 postMessage 發送訊息
      window.postMessage(
        {
          type: MESSAGE_SOURCES.PAGE_CONTEXT,
          message: message,
        },
        "*"
      );

      logger.debug("訊息已發送到內容腳本");
    } catch (error: any) {
      logger.error("發送訊息到內容腳本時發生錯誤", { error });
    }
  };

  logger.info("頁面上下文模組已啟動");
}

// 當 DOM 完全載入後初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
