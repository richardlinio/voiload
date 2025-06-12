/**
 * menu-manager.ts
 * Responsible for managing the context menu
 */
import { UI_CONSTANTS } from "../utils/constants";
import { Logger } from "../utils/logger";

// Create a module-specific logger
const logger = Logger.createModuleLogger("menu-manager");

/**
 * Initialize the context menu
 */
export function initMenuManager(): void {
  logger.info("Initializing context menu manager");

  // Create context menu item
  chrome.contextMenus.create(
    {
      id: UI_CONSTANTS.CONTEXT_MENU_ID,
      title: UI_CONSTANTS.CONTEXT_MENU_TITLE,
      contexts: ["all"],
      documentUrlPatterns: ["*://*.facebook.com/*", "*://*.messenger.com/*"],
    },
    () => {
      if (chrome.runtime.lastError) {
        logger.error("Failed to create context menu", chrome.runtime.lastError);
      } else {
        logger.info("Context menu created successfully");
      }
    }
  );

  // Listen for context menu click events
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    logger.debug("Context menu click event", {
      menuItemId: info.menuItemId,
      pageUrl: tab?.url?.substring(0, 50) + "...",
    });

    if (info.menuItemId === "downloadVoiceMessage") {
      logger.debug("Calling handleMenuClick function");
      handleMenuClick(info, tab);
    } else {
      logger.debug("Not the target menu item", { menuItemId: info.menuItemId });
    }
  });
}

/**
 * Handle context menu click event
 *
 * @param info - Menu info
 * @param tab - Tab info
 */
function handleMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined
): void {
  logger.debug("Context menu click details", {
    menuItemId: info.menuItemId,
    frameId: info.frameId,
    pageUrl: tab?.url?.substring(0, 50) + "...",
  });

  // No action needed here, as the download info is already saved in lastRightClickedInfo
  // The actual download logic is handled in download-manager.js
  logger.debug("Context menu click handling complete");
}
