/**
 * element-registration-handler.ts
 * 處理語音訊息元素註冊相關的訊息
 */

import { Logger } from "../../utils/logger";
import { MODULE_NAMES } from "../../utils/constants";
import { type VoiceMessageStore, type VoiceMessageItem } from "../data-store";
import type { ElementRegistrationMessage } from "../../types/messages";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(
  MODULE_NAMES.ELEMENT_REGISTRATION_HANDLER
);

/**
 * 處理語音訊息元素註冊訊息
 */
export function handleElementRegistration(
  voiceMessagesStore: VoiceMessageStore,
  message: ElementRegistrationMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  const { elementId, durationMs } = message;
  logger.debug("處理語音訊息元素註冊訊息", {
    elementId,
    durationMs,
  });

  if (!elementId || !durationMs || !voiceMessagesStore) {
    logger.error("缺少必要資訊或 voiceMessagesStore 不存在");
    sendResponse({ success: false, error: "缺少必要資訊" });
    return true;
  }

  try {
    // 在 voiceMessages 中建立新項目
    voiceMessagesStore.items.set(elementId, {
      id: elementId,
      element: null,
      durationMs,
      downloadUrl: null,
      lastModified: null,
      timestamp: Date.now(),
      isPending: true,
    });

    // 檢查是否有待處理的下載 URL 可以匹配
    const matchingItem = findMatchingPendingItem(
      voiceMessagesStore,
      elementId,
      durationMs
    );

    if (matchingItem && matchingItem.downloadUrl) {
      // 如果找到匹配項目，更新元素的下載 URL
      updateElementWithMatchingItem(
        voiceMessagesStore,
        elementId,
        matchingItem
      );

      // 通知內容腳本更新 UI
      notifyContentScriptToUpdateUI(
        _sender.tab?.id,
        elementId,
        matchingItem.downloadUrl
      );

      sendResponse({
        success: true,
        downloadUrl: matchingItem.downloadUrl,
        lastModified: matchingItem.lastModified,
      });
    } else {
      logger.debug("未找到匹配的待處理項目");
      sendResponse({
        success: true,
        message: "元素已註冊，但無匹配的下載 URL",
      });
    }
  } catch (error: any) {
    logger.error("處理語音訊息元素註冊訊息時發生錯誤:", error);
    sendResponse({ success: false, error: error.message });
  }

  return true; // 保持連接開啟，以便異步回應
}

/**
 * 查找匹配的待處理項目
 */
function findMatchingPendingItem(
  voiceMessagesStore: VoiceMessageStore,
  elementId: string,
  durationMs: number
): VoiceMessageItem | null {
  // 使用容差值尋找匹配的項目
  const tolerance = 5; // 容差值（毫秒）

  for (const [id, item] of voiceMessagesStore.items) {
    if (
      id !== elementId && // 不是自己
      item.downloadUrl && // 有下載 URL
      item.durationMs && // 有持續時間
      Math.abs(item.durationMs - durationMs) <= tolerance
    ) {
      // 持續時間匹配
      logger.debug("找到匹配的待處理項目", { item });
      return item;
    }
  }

  return null;
}

/**
 * 使用匹配項目更新元素
 *
 * @param {Object} voiceMessagesStore - 語音訊息資料存儲
 * @param {string} elementId - 元素 ID
 * @param {Object} matchingItem - 匹配的項目
 * @private
 */
function updateElementWithMatchingItem(
  voiceMessagesStore: VoiceMessageStore,
  elementId: string,
  matchingItem: any
) {
  const currentItem = voiceMessagesStore.items.get(elementId);
  if (!currentItem) {
    logger.error("無法找到要更新的項目", { elementId });
    return;
  }
  currentItem.downloadUrl = matchingItem.downloadUrl;
  currentItem.lastModified = matchingItem.lastModified;

  logger.debug("已更新元素的下載 URL:", {
    elementId,
    downloadUrl: matchingItem.downloadUrl.substring(0, 50) + "...",
  });
}

/**
 * 通知內容腳本更新 UI
 *
 * @param {number|undefined} tabId - 標籤頁 ID
 * @param {string} elementId - 元素 ID
 * @param {string} downloadUrl - 下載 URL
 * @private
 */
function notifyContentScriptToUpdateUI(
  tabId: number | undefined,
  elementId: string,
  downloadUrl: string
) {
  if (tabId) {
    try {
      chrome.tabs.sendMessage(tabId, {
        action: "updateVoiceMessageElement",
        elementId: elementId,
        downloadUrl: downloadUrl,
      });
    } catch (error) {
      logger.error("發送更新訊息到內容腳本時發生錯誤:", error);
    }
  }
}
