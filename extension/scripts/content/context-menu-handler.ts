/**
 * context-menu-handler.ts
 * 負責處理右鍵選單事件
 */

import {
  findVoiceMessageElement,
  getDurationFromSlider,
  type VoiceMessageElementResult,
} from "./dom-utils";
import { secondsToMilliseconds } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import { MESSAGE_ACTIONS, MODULE_NAMES } from "../utils/constants";

// ================================================
// 類型定義
// ================================================

/**
 * 右鍵點擊訊息介面
 */
interface RightClickMessage {
  action: string;
  elementId: string | null;
  downloadUrl: string | null;
  lastModified?: string | null | undefined;
  durationMs?: number | undefined;
}

// ================================================
// 右鍵選單處理函數
// ================================================

/**
 * 初始化右鍵選單處理器
 */
export function initContextMenuHandler(): void {
  Logger.info("初始化右鍵選單處理器", { module: MODULE_NAMES.CONTEXT_MENU });

  // 監聽 contextmenu 事件
  document.addEventListener("contextmenu", (event: MouseEvent) => {
    handleContextMenu(event);
  });
}

/**
 * 處理右鍵選單事件
 *
 * @param event - 滑鼠事件
 */
function handleContextMenu(event: MouseEvent): void {
  // 記錄實際點擊的元素
  const clickedElement = event.target as Element;
  Logger.debug("右鍵點擊元素", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: clickedElement,
  });

  // 尋找語音訊息元素
  const result: VoiceMessageElementResult | null =
    findVoiceMessageElement(clickedElement);
  Logger.debug("尋找語音訊息元素結果", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: result,
  });

  if (!result) {
    // 如果找不到語音訊息元素，不做任何處理
    Logger.debug("未找到語音訊息元素", { module: MODULE_NAMES.CONTEXT_MENU });
    return;
  }

  const { element, type } = result;
  Logger.debug("找到語音訊息元素類型", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: type,
  });

  // 根據元素類型獲取滑桿元素
  const sliderElement = type === "slider" ? element : null;
  Logger.debug("滑桿元素", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: sliderElement,
  });

  if (!sliderElement) {
    Logger.debug("未找到滑桿元素", { module: MODULE_NAMES.CONTEXT_MENU });
    return;
  }

  // 檢查元素是否有 data-voice-message-id 屬性
  const id = sliderElement.getAttribute("data-voice-message-id");
  Logger.debug("語音訊息 ID", { module: MODULE_NAMES.CONTEXT_MENU, data: id });

  // 從滑桿元素獲取持續時間
  const durationSec = getDurationFromSlider(sliderElement);
  Logger.debug("從滑桿獲取的持續時間(秒)", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: durationSec,
  });

  if (durationSec !== null) {
    // 將秒轉換為毫秒
    const durationMs = secondsToMilliseconds(durationSec);
    Logger.debug("持續時間(毫秒)", {
      module: MODULE_NAMES.CONTEXT_MENU,
      data: durationMs,
    });

    // 發送訊息到背景腳本，包含元素 ID 和持續時間
    Logger.debug("準備發送右鍵點擊訊息", { module: MODULE_NAMES.CONTEXT_MENU });
    sendRightClickMessage(id, null, null, durationMs);
  } else {
    Logger.debug("無法從滑桿獲取持續時間", {
      module: MODULE_NAMES.CONTEXT_MENU,
    });
  }
}

/**
 * 發送右鍵點擊訊息到背景腳本
 *
 * @param elementId - 元素 ID
 * @param downloadUrl - 下載 URL
 * @param lastModified - Last-Modified 標頭值
 * @param durationMs - 持續時間（毫秒）
 */
function sendRightClickMessage(
  elementId: string | null,
  downloadUrl: string | null,
  lastModified?: string | null,
  durationMs?: number
): void {
  // 準備訊息物件
  const message: RightClickMessage = {
    action: MESSAGE_ACTIONS.RIGHT_CLICK,
    elementId,
    downloadUrl,
    lastModified,
    durationMs,
  };

  Logger.debug("準備發送訊息到背景腳本", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: message,
  });

  // 使用 chrome.runtime.sendMessage 直接發送訊息
  try {
    chrome.runtime.sendMessage(message, (response) => {
      Logger.debug("chrome.runtime.sendMessage 回應", {
        module: MODULE_NAMES.CONTEXT_MENU,
        data: response,
      });
    });
    Logger.debug("已直接發送訊息到背景腳本", {
      module: MODULE_NAMES.CONTEXT_MENU,
    });
  } catch (error) {
    Logger.error("使用 chrome.runtime.sendMessage 發生錯誤", {
      module: MODULE_NAMES.CONTEXT_MENU,
      data: error,
    });
  }

  Logger.info("發送右鍵點擊訊息", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: {
      elementId,
      downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
      lastModified,
    },
  });
}
