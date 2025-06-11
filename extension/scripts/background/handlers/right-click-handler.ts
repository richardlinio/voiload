/**
 * right-click-handler.ts
 * 處理右鍵點擊相關的訊息
 */

import { setLastRightClickedInfo } from "../download-manager";
import { Logger } from "../../utils/logger";
import { MODULE_NAMES } from "../../utils/constants";
import { type VoiceMessageStore, type VoiceMessageItem } from "../data-store";
import type { RightClickMessage } from "../../types/messages";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.RIGHT_CLICK_HANDLER);

/**
 * 處理右鍵點擊訊息
 *
 * @param voiceMessagesStore - 語音訊息資料存儲
 * @param message - 訊息物件
 * @param sender - 發送者資訊
 * @param sendResponse - 回應函數
 * @returns 是否需要保持連接開啟
 */
export function handleRightClick(
  voiceMessagesStore: VoiceMessageStore,
  message: RightClickMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  const { elementId, downloadUrl, lastModified, durationMs } = message;
  logger.debug("處理右鍵點擊訊息詳細資訊", {
    elementId,
    downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
    lastModified,
    durationMs,
  });

  // 確保我們有 voiceMessagesStore
  if (!voiceMessagesStore) {
    logger.error("voiceMessagesStore 不存在");
    sendResponse({
      success: false,
      message: "內部錯誤：voiceMessagesStore 不存在",
    });
    return true;
  }

  logger.debug("voiceMessagesStore Map 大小", {
    mapSize: voiceMessagesStore.items.size,
  });

  // 輸出所有項目的持續時間和下載 URL 狀態，用於調試
  logStoreItems(voiceMessagesStore);

  // 如果沒有提供下載 URL，但有持續時間，嘗試從 voiceMessagesStore 中查找
  let finalDownloadUrl = downloadUrl;
  let finalLastModified = lastModified;

  if (!downloadUrl && durationMs) {
    logger.debug("嘗試從資料存儲中查找下載 URL", {
      durationMs,
    });

    // 記錄目標持續時間
    const targetDuration = durationMs;

    logger.debug("開始匹配過程", {
      phase: "start",
      targetDuration,
      timestamp: new Date().toISOString(),
      itemsCount: voiceMessagesStore.items.size,
    });

    const matchingItem = findItemByDuration(voiceMessagesStore, durationMs);

    if (matchingItem && matchingItem.downloadUrl) {
      logger.debug("在資料存儲中找到匹配的下載 URL", {
        id: matchingItem.id,
        durationMs: matchingItem.durationMs,
        downloadUrl: matchingItem.downloadUrl
          ? matchingItem.downloadUrl.substring(0, 30) + "..."
          : null,
      });
      finalDownloadUrl = matchingItem.downloadUrl;
      finalLastModified = matchingItem.lastModified || lastModified;
    } else {
      logger.warn("在資料存儲中未找到匹配的下載 URL");
      logAllDurations(voiceMessagesStore);
    }
  }

  if (!finalDownloadUrl) {
    logger.warn("下載 URL 無效，但仍然記錄右鍵點擊資訊");
    // 即使沒有下載 URL，也記錄右鍵點擊的資訊，以便後續捕獲到 URL 時可以使用
    setLastRightClickedInfo({
      elementId,
      downloadUrl: null,
      lastModified: null,
      tabId: sender.tab?.id || undefined,
      durationMs: durationMs || undefined,
    });

    sendResponse({
      success: true,
      message: "已記錄右鍵點擊資訊，但無法找到下載 URL",
    });
    return true;
  }

  // 設置最後一次右鍵點擊的資訊
  logger.debug("設置最後一次右鍵點擊的資訊", {
    elementId,
    downloadUrl: finalDownloadUrl
      ? finalDownloadUrl.substring(0, 30) + "..."
      : null,
    hasLastModified: !!finalLastModified,
    tabId: sender.tab?.id,
    durationMs,
  });

  setLastRightClickedInfo({
    elementId,
    downloadUrl: finalDownloadUrl,
    lastModified: finalLastModified || null,
    tabId: sender.tab?.id || undefined,
    durationMs: durationMs || undefined,
  });

  // 回應內容腳本
  const response = {
    success: true,
    message: "已準備好下載語音訊息",
  };
  logger.debug("回應內容腳本", { response });
  sendResponse(response);

  logger.debug("右鍵點擊訊息處理完成");
  return true; // 保持連接開啟，以便異步回應
}

/**
 * 根據持續時間查找匹配的項目
 *
 * @param voiceMessagesStore - 語音訊息資料存儲
 * @param durationMs - 目標持續時間（毫秒）
 * @returns 匹配的項目或 null
 */
function findItemByDuration(
  voiceMessagesStore: VoiceMessageStore,
  durationMs: number
): VoiceMessageItem | null {
  // 方法 1: 使用 findItemByDuration 函數
  let matchingItem = null;
  if (typeof voiceMessagesStore.findItemByDuration === "function") {
    logger.debug("使用 findItemByDuration 函數查找");
    matchingItem = voiceMessagesStore.findItemByDuration(durationMs);
    logger.debug("findItemByDuration 結果", {
      found: !!matchingItem,
    });

    if (matchingItem) {
      logger.debug("匹配成功", {
        phase: "findItemByDuration",
        result: "success",
        itemId: matchingItem.id,
        itemDuration: matchingItem.durationMs,
        targetDuration: durationMs,
        difference: Math.abs(matchingItem.durationMs - durationMs),
        hasUrl: !!matchingItem.downloadUrl,
        isPending: !!matchingItem.isPending,
        timestamp: new Date().toISOString(),
      });
      return matchingItem;
    } else {
      logger.debug("匹配失敗", {
        phase: "findItemByDuration",
        result: "failure",
        targetDuration: durationMs,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // 方法 2: 直接遍歷 items 集合
  logger.debug("直接遍歷 items 集合查找");
  const tolerance = 5; // 容差值（毫秒）
  let attemptCount = 0;
  const matchStartTime = Date.now();

  for (const [id, item] of voiceMessagesStore.items.entries()) {
    attemptCount++;
    const difference = Math.abs(item.durationMs - durationMs);

    // 記錄每次匹配嘗試
    logger.debug("匹配嘗試詳細", {
      phase: "iteration",
      attemptNumber: attemptCount,
      itemId: id,
      itemDuration: item.durationMs,
      targetDuration: durationMs,
      difference: difference,
      withinTolerance: difference <= tolerance,
      hasUrl: !!item.downloadUrl,
      isPending: !!item.isPending,
      timestamp: new Date().toISOString(),
    });

    if (item.durationMs && difference <= tolerance) {
      logger.debug("找到匹配項目", {
        durationMs: item.durationMs,
        hasDownloadUrl: !!item.downloadUrl,
      });
      matchingItem = item;
      break;
    }
  }

  // 記錄遍歷結果
  logger.debug("遍歷完成", {
    phase: "iterationComplete",
    result: matchingItem ? "success" : "failure",
    attemptCount: attemptCount,
    elapsedMs: Date.now() - matchStartTime,
    timestamp: new Date().toISOString(),
  });

  return matchingItem;
}

/**
 * 輸出所有項目的持續時間和下載 URL 狀態，用於調試
 *
 * @param voiceMessagesStore - 語音訊息資料存儲
 */
function logStoreItems(voiceMessagesStore: VoiceMessageStore): void {
  logger.debug("所有項目的持續時間和下載 URL 狀態");
  for (const [id, item] of voiceMessagesStore.items.entries()) {
    logger.debug(`項目狀態`, {
      id,
      durationMs: item.durationMs,
      hasUrl: !!item.downloadUrl,
      isPending: !!item.isPending,
    });
  }
}

/**
 * 輸出所有項目的持續時間以進行比較
 *
 * @param voiceMessagesStore - 語音訊息資料存儲
 */
function logAllDurations(voiceMessagesStore: VoiceMessageStore): void {
  // 輸出資料存儲的狀態以協助調試
  logger.debug("資料存儲中的項目數量", {
    itemsCount: voiceMessagesStore.items.size,
  });

  // 輸出所有項目的持續時間以進行比較
  const allDurations = [];
  for (const [, item] of voiceMessagesStore.items.entries()) {
    if (item.durationMs) {
      allDurations.push(item.durationMs);
    }
  }
  logger.debug("資料存儲中的所有持續時間", {
    durations: allDurations,
  });
}
