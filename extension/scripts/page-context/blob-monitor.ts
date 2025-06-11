/**
 * blob-monitor.ts
 * 負責監控和處理 Blob URL，以檢測和處理可能的音訊檔案
 */

import { Logger } from "../utils/logger";
import {
  MESSAGE_ACTIONS,
  MODULE_NAMES,
  BLOB_MONITOR_CONSTANTS,
} from "../utils/constants";
import { isLikelyVoiceMessageBlob, extractBlobContent } from "./blob-analyzer";
import { getAudioDuration } from "./audio-analyzer";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.BLOB_MONITOR);

import type {
  BlobQueueItem,
  ExtractBlobRequestMessage,
  SendToContentMessage,
} from "../types/messages";

/**
 * Blob processing queue object
 */
const BlobProcessingQueue = {
  // 處理佇列和狀態
  processingQueue: [] as BlobQueueItem[],
  isProcessing: false,

  // 追蹤已處理過的 blob
  processedBlobs: new WeakMap<Blob, boolean>(),

  // 檢查是否應該處理這個 blob
  shouldProcess(blob: Blob): boolean {
    // 基本檢查 - blob 必須存在且有類型
    if (!blob || !blob.type) {
      return false;
    }
    // 檢查是否已處理過此 blob
    if (this.processedBlobs.has(blob)) {
      return false;
    }
    // 評估 blob 是否可能是語音訊息
    const isLikelyVoiceMessage = isLikelyVoiceMessageBlob(blob);
    if (!isLikelyVoiceMessage) {
      return false;
    }
    return true;
  },

  // 將 blob 加入處理佇列
  enqueue(blob: Blob, blobUrl: string): void {
    this.processingQueue.push({ blob, blobUrl });
    logger.debug("將 blob URL 加入處理佇列", {
      queueLength: this.processingQueue.length,
    });
    this.processNextInQueue();
  },

  // 處理佇列中的下一個項目
  async processNextInQueue(): Promise<void> {
    // 如果已經在處理或佇列為空，則直接返回
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const queueItem = this.processingQueue.shift();
    if (!queueItem) {
      this.isProcessing = false;
      return;
    }

    const { blob, blobUrl } = queueItem;

    try {
      // 標記為已處理
      this.processedBlobs.set(blob, true);

      // 計算音訊持續時間
      const durationMs = await getAudioDuration(blobUrl);

      // 註冊到背景腦本
      registerBlobWithBackend(blob, blobUrl, durationMs);
    } catch (error) {
      logger.error("處理佇列中的 blob 時發生錯誤", { error });
    } finally {
      this.isProcessing = false;
      // 繼續處理下一個
      this.processNextInQueue();
    }
  },
};

/**
 * 設置 Blob URL 監控
 * 攻截 URL.createObjectURL 方法來捕獲 blob URL 的創建
 */
export function setupBlobUrlMonitor(): void {
  logger.info("設置 Blob URL 監控");

  // 保存原始的 URL.createObjectURL 方法
  const originalCreateObjectURL = URL.createObjectURL;

  // 攻截 URL.createObjectURL 方法
  URL.createObjectURL = function (blob: Blob | MediaSource): string {
    // 調用原始方法獲取 blob URL
    const blobUrl = originalCreateObjectURL.apply(this, [blob]);

    try {
      // 只處理 Blob 類型，不處理 MediaSource
      if (blob instanceof Blob) {
        // 檢查是否應該處理這個 blob
        if (BlobProcessingQueue.shouldProcess(blob)) {
          // 將 blob 加入處理佇列
          BlobProcessingQueue.enqueue(blob, blobUrl);
        }
      }
    } catch (error) {
      logger.error("處理 blob URL 時發生錯誤", { error });
    }
    // 返回原始的 blob URL
    return blobUrl;
  };
  logger.info("Blob URL 監控已設置");
}

/**
 * 向背景腦本註冊 Blob
 */
function registerBlobWithBackend(
  blob: Blob,
  blobUrl: string,
  durationMs: number
): void {
  // 使用 sendToContent 函數發送訊息
  if (window.sendToContent) {
    window.sendToContent({
      action: MESSAGE_ACTIONS.REGISTER_BLOB_URL,
      blobUrl: blobUrl,
      blobType: blob.type,
      blobSize: blob.size,
      durationMs: durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  // 記錄詳細資訊
  logger.info("向內容腦本發送 blob url 註冊資訊", {
    blobUrl: blobUrl.substring(0, 50),
    blobType: blob.type,
    blobSizeBytes: blob.size,
    durationMs: durationMs,
  });
}

/**
 * 設置定期清理
 * 定期清空已處理的資料，避免記憶體洩漏
 */
function setupPeriodicCleanup(): void {
  setInterval(() => {
    // 目前 processedBlobs 是弱引用，不用主動清理
  }, BLOB_MONITOR_CONSTANTS.PERIODIC_CLEANUP_INTERVAL);
}

/**
 * 處理提取 blob 內容的請求
 *
 * @param message - 包含 blobUrl 的消息對象
 * @param sendResponse - 回應函數
 * @returns 標示是否保持連接開啟
 */
export async function handleExtractBlobRequest(
  message: ExtractBlobRequestMessage,
  sendResponse: (response: {
    success: boolean;
    message?: string;
    error?: string;
  }) => void
): Promise<boolean> {
  logger.debug("收到提取 blob 內容要求", {
    blobUrl: message.blobUrl,
    blobType: message.blobType,
    requestId: message.requestId,
  });

  try {
    // 提取 blob 內容
    const result = await extractBlobContent(message.blobUrl);
    logger.debug("提取 blob 內容成功，發送回背景腦本");

    // 構建結果並發送到背景腦本
    chrome.runtime.sendMessage(
      {
        action: MESSAGE_ACTIONS.DOWNLOAD_BLOB,
        blobType: result.blobType,
        base64data: result.base64data,
        requestId: message.requestId,
        timestamp: new Date().toISOString(),
      },
      (response) => {
        logger.debug("背景腦本回應下載要求", { response });
      }
    );

    sendResponse({
      success: true,
      message: "已發送 blob 內容到背景腦本進行下載",
    });
  } catch (error) {
    logger.error("提取 blob 內容失敗", { error });
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return true; // 保持連接開啟，以便異步回應
}

/**
 * 初始化 Blob 監控模組
 */
export function initBlobMonitor(): void {
  try {
    logger.info("開始初始化 Blob 監控模組");

    // 設置 URL 監控
    setupBlobUrlMonitor();

    // 設置定期清理
    setupPeriodicCleanup();

    logger.info("Blob 監控模組初始化完成");
  } catch (error) {
    logger.error("初始化 Blob 監控模組時發生錯誤", { error });
  }
}
