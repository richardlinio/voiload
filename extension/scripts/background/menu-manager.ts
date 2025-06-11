/**
 * menu-manager.ts
 * 負責管理右鍵選單
 */
import { UI_CONSTANTS } from "../utils/constants";
import { Logger } from "../utils/logger";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("menu-manager");

/**
 * 初始化右鍵選單
 */
export function initMenuManager(): void {
  logger.info("初始化右鍵選單管理器");

  // 創建右鍵選單項目
  chrome.contextMenus.create(
    {
      id: UI_CONSTANTS.CONTEXT_MENU_ID,
      title: UI_CONSTANTS.CONTEXT_MENU_TITLE,
      contexts: ["all"],
      documentUrlPatterns: ["*://*.facebook.com/*", "*://*.messenger.com/*"],
    },
    () => {
      if (chrome.runtime.lastError) {
        logger.error("創建右鍵選單失敗", chrome.runtime.lastError);
      } else {
        logger.info("創建右鍵選單成功");
      }
    }
  );

  // 監聽右鍵選單點擊事件
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    logger.debug("右鍵選單點擊事件", {
      menuItemId: info.menuItemId,
      pageUrl: tab?.url?.substring(0, 50) + "...",
    });

    if (info.menuItemId === "downloadVoiceMessage") {
      logger.debug("調用 handleMenuClick 函數");
      handleMenuClick(info, tab);
    } else {
      logger.debug("非目標選單項目", { menuItemId: info.menuItemId });
    }
  });
}

/**
 * 處理右鍵選單點擊事件
 *
 * @param info - 選單資訊
 * @param tab - 標籤頁資訊
 */
function handleMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined
): void {
  logger.debug("右鍵選單點擊詳細資訊", {
    menuItemId: info.menuItemId,
    frameId: info.frameId,
    pageUrl: tab?.url?.substring(0, 50) + "...",
  });

  // 這裡不需要做任何事情，因為我們已經在 lastRightClickedInfo 中保存了下載資訊
  // 實際的下載邏輯在 download-manager.js 中處理
  logger.debug("右鍵選單點擊處理完成");
}
