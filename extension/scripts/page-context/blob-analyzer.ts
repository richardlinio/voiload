/**
 * blob-analyzer.ts
 * 負責處理音檔分析相關功能，包含持續時間計算和音訊資料處理
 */

import { Logger } from "../utils/logger";
import {
  MODULE_NAMES,
  BLOB_MONITOR_CONSTANTS,
} from "../utils/constants";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger(MODULE_NAMES.BLOB_ANALYZER);

/**
 * Blob 內容結果介面
 */
export interface BlobContentResult {
  base64data: string;
  blobType: string;
  blobSize: number;
}

/**
 * 提取 Blob 內容並轉換為 base64 格式
 *
 * @param blobUrl - blob URL
 * @returns 包含 base64data、blobType 和 blobSize 的對象
 */
export async function extractBlobContent(blobUrl: string): Promise<BlobContentResult> {
  try {
    logger.debug("開始提取 blob 內容", { blobUrl });

    // 使用 fetch 獲取 blob 內容
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(
        `無法獲取 blob 內容: ${response.status} ${response.statusText}`
      );
    }

    // 獲取 blob 內容
    const blob = await response.blob();
    logger.debug("成功獲取 blob", {
      blobType: blob.type,
      blobSize: blob.size,
    });

    // 將 blob 轉換為 base64
    return new Promise<BlobContentResult>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          // 確保我們取得正確的 base64 數據
          const result = reader.result;
          if (typeof result !== 'string') {
            throw new Error("FileReader 結果不是字串格式");
          }
          
          const base64data = result.split(",")[1];

          if (!base64data) {
            throw new Error("無法取得有效的 base64 數據");
          }

          logger.debug("成功將 blob 轉換為 base64", {
            dataLength: base64data.length,
          });

          resolve({
            base64data,
            blobType: blob.type,
            blobSize: blob.size,
          });
        } catch (innerError) {
          logger.error("處理 base64 數據時發生錯誤", { error: innerError });
          reject(innerError);
        }
      };
      reader.onerror = () => {
        reject(new Error("讀取 blob 內容失敗"));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logger.error("提取 blob 內容時發生錯誤", { error });
    throw error;
  }
}

/**
 * 檢查 Blob 是否可能是音訊檔案
 * 根據多項指標評估可能性並返回信心分數
 *
 * @param blob - 要評估的 Blob 對象
 * @returns 評估結果
 */
export function isLikelyVoiceMessageBlob(blob: Blob): boolean {
  logger.debug("評估 Blob 是否為音訊檔案", {
    blobType: blob.type,
    blobSize: blob.size,
  });

  // 基本檢查 - blob 必須存在、有類型、有大小
  if (!blob || !blob.type || !blob.size) {
    logger.debug("Blob 不存在或無法取得基本資訊");
    return false;
  }

  // 必須為可能的音訊類型之一
  if (
    !BLOB_MONITOR_CONSTANTS.POSSIBLE_AUDIO_TYPES.some((type) =>
      blob.type.includes(type)
    )
  ) {
    logger.debug("Blob 的類型不在可能的音訊類型列表中");
    return false;
  }

  // 檔案不能太小
  if (blob.size <= BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE) {
    logger.debug("Blob 的大小太小");
    return false;
  }

  if (blob.size >= BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE) {
    logger.debug("Blob 的大小太大");
    return false;
  }

  logger.debug("Blob 滿足音訊檔案的基本條件");
  return true;
}
