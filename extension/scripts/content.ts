/**
 * content.ts
 * 主要內容腳本，負責初始化和協調其他模組
 */

import { Logger } from "./utils/logger";
import {
  SUPPORTED_SITES,
  MESSAGE_SOURCES,
  MODULE_NAMES,
} from "./utils/constants";
import { initMessageHandler } from "./content/message-handler";
import { initContextMenuHandler } from "./content/context-menu-handler";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.CONTENT_SCRIPT);

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
 * Chrome 運行時訊息監聽器回調類型
 */
type RuntimeMessageListener = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean | void;

// ================================================
// 主要初始化邏輯
// ================================================

// 檢查是否在支援的網站上
const isSupportedSite = SUPPORTED_SITES.DOMAINS.some((domain) =>
  window.location.hostname.includes(domain)
);

if (!isSupportedSite) {
  logger.debug("不支援的網站，擴充功能不會啟動");
} else {
  // 創建頁面上下文腳本標籤
  const script = document.createElement("script");
  script.type = "module";
  script.src = chrome.runtime.getURL("scripts/page-context.js");
  script.onload = function () {
    logger.debug("Facebook Messenger 語音訊息下載器已載入頁面上下文模組");
    script.remove(); // 載入後移除腳本標籤
  };

  // 確保腳本標籤被添加到頁面
  try {
    // 添加到頁面
    (document.head || document.documentElement).appendChild(script);
    logger.debug("頁面上下文腳本已添加到頁面");
  } catch (error) {
    logger.error("添加頁面上下文腳本時出錯", { error });
  }

  // 設置訊息監聽器，處理腳本與背景腳本的通訊
  window.addEventListener("message", function (event: MessageEvent) {
    // 確保訊息來自同一個頁面
    if (event.source !== window) return;

    // 處理來自頁面上下文的訊息
    if (event.data.type && event.data.type === MESSAGE_SOURCES.PAGE_CONTEXT) {
      const pageEvent = event as PageContextMessageEvent;
      logger.debug("收到頁面上下文訊息，轉發到背景腳本", {
        message: pageEvent.data.message,
      });
      chrome.runtime.sendMessage(pageEvent.data.message, function (response) {
        logger.debug("背景腳本回應", { response });
      });
    }
  });

  // 將來自背景腳本的訊息轉發到頁面上下文
  const messageListener: RuntimeMessageListener = function (
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    logger.debug("收到背景腳本訊息", { message });

    // 轉發到頁面上下文
    window.postMessage(
      {
        type: MESSAGE_SOURCES.BACKGROUND_SCRIPT,
        message: message,
      },
      "*"
    );
    return true;
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // 初始化右鍵選單處理器
  initContextMenuHandler();
  logger.debug("已初始化右鍵選單處理器");

  // 初始化內容腳本訊息處理器
  // 確保頁面上下文已經載入
  setTimeout(() => {
    initMessageHandler();
    logger.debug("內容腳本訊息處理器已初始化");
  }, 300);

  logger.info("Facebook Messenger 語音訊息下載器已初始化");
}
