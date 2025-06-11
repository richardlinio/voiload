/**
 * background.js
 * 主要背景腳本，負責初始化和協調背景模組
 */

// 使用 import 語句
import { initMenuManager } from "./background/menu-manager.js";
import { initDownloadManager } from "./background/download-manager.js";
import { initMessageHandler } from "./background/message-handler.js";
import { initWebRequestInterceptor } from "./background/web-request-interceptor.js";
import { createDataStore, cleanupOldItems } from "./background/data-store.js";
import { Logger } from "./utils/logger";
import {
  UI_CONSTANTS,
  TIME_CONSTANTS,
  MODULE_NAMES,
} from "./utils/constants";
import {
  checkOnboardingStatus,
  markOnboardingShown,
} from "./background/onboarding-utils.js";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.BACKGROUND);

// 添加調試資訊
logger.debug("背景腳本開始加載");
logger.debug("模組導入成功");

// 檢查 chrome API 是否可用
logger.debug("chrome API 可用性", {
  chrome: typeof chrome !== "undefined",
  webRequest:
    typeof chrome !== "undefined" && typeof chrome.webRequest !== "undefined",
  contextMenus:
    typeof chrome !== "undefined" && typeof chrome.contextMenus !== "undefined",
  downloads:
    typeof chrome !== "undefined" && typeof chrome.downloads !== "undefined",
});

/**
 * 主要初始化函數
 */
function initialize() {
  logger.info("初始化背景腳本");

  try {
    // 創建語音訊息資料存儲
    const voiceMessages = createDataStore();
    logger.debug("語音訊息資料存儲已創建");

    // 初始化右鍵選單管理器
    initMenuManager();
    logger.debug("右鍵選單管理器已初始化");

    // 初始化下載管理器
    initDownloadManager();
    logger.debug("下載管理器已初始化");

    // 初始化訊息處理器
    initMessageHandler(voiceMessages);
    logger.debug("訊息處理器已初始化");

    // 初始化 webRequest 攔截器
    logger.debug("準備初始化 webRequest 攔截器");
    initWebRequestInterceptor(voiceMessages);
    logger.debug("webRequest 攔截器已初始化");

    // 設置定期清理過期項目
    setInterval(() => {
      cleanupOldItems(voiceMessages);
    }, TIME_CONSTANTS.CLEANUP_INTERVAL); // 每 30 分鐘清理一次

    logger.info("背景腳本初始化完成");
    return voiceMessages; // 返回語音訊息資料存儲，以便其他函數使用
  } catch (error) {
    logger.error("初始化過程中發生錯誤", { error });
    throw error; // 重新拋出錯誤，以便上層函數可以捕捉
  }
}

// 當擴充功能安裝或更新時執行
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.info("Facebook Messenger 語音訊息下載器已安裝或更新", {
    reason: details.reason,
    previousVersion: details.previousVersion,
  });

  // 初始化擴充功能狀態
  chrome.action.setBadgeText({
    text: UI_CONSTANTS.BADGE_TEXT,
  });

  chrome.action.setBadgeBackgroundColor({
    color: UI_CONSTANTS.BADGE_COLOR,
  });

  // 處理首次安裝
  if (details.reason === "install") {
    logger.info("首次安裝擴充功能，準備開啟 onboarding");

    try {
      // 記錄安裝時間
      await chrome.storage.local.set({
        installTime: Date.now(),
      });

      // 檢查 onboarding 狀態
      const status = await checkOnboardingStatus();

      if (!status.completed) {
        // 開啟 onboarding 頁面
        const onboardingUrl = chrome.runtime.getURL("onboarding/welcome.html");
        chrome.tabs.create({
          url: onboardingUrl,
          active: true,
        });

        // 標記已顯示 onboarding
        await markOnboardingShown();
        logger.info("已開啟 onboarding 頁面");
      }
    } catch (error) {
      logger.error("處理首次安裝時發生錯誤", { error });
    }
  } else if (details.reason === "update") {
    logger.info("擴充功能已更新", {
      fromVersion: details.previousVersion,
      toVersion: chrome.runtime.getManifest().version,
    });

    // 可以在這裡添加版本更新的提醒邏輯
  }
});

// 執行初始化
try {
  logger.debug("準備執行初始化函數");
  initialize();
  logger.debug("初始化函數已執行完成");
} catch (error) {
  logger.error("執行初始化函數時發生錯誤", {
    message: error.message,
    stack: error.stack,
  });
}
