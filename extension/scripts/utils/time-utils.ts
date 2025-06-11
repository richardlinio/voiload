/**
 * time-utils.ts
 * 提供時間處理相關的輔助函數
 */

import { Logger } from "./logger";
import { FILENAME_CONSTANTS } from "./constants";

/**
 * 將 HTTP Last-Modified 標頭格式的時間轉換為 Date 物件
 * 格式範例：Wed, 19 Mar 2025 14:04:40 GMT
 */
export function parseLastModifiedHeader(lastModifiedHeader: string): Date | null {
  if (!lastModifiedHeader) {
    return null;
  }

  try {
    return new Date(lastModifiedHeader);
  } catch (error) {
    Logger.error("解析 Last-Modified 標頭失敗", {
      error: error instanceof Error ? error.message : String(error),
      header: lastModifiedHeader,
    });
    return null;
  }
}

/**
 * 將日期格式化為檔案名稱友好的格式
 * 格式：YYYY-MM-DD-HH-mm-ss
 */
export function formatDateForFilename(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return formatDateForFilename(new Date()); // 使用當前時間作為後備
  }

  const pad = (num: number): string => String(num).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // 月份從 0 開始
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

/**
 * 根據 Last-Modified 標頭或當前時間生成語音訊息檔案名稱
 * 
 * @returns 格式化的檔案名稱（不含副檔名）
 */
export function generateVoiceMessageFilename(lastModified?: string): string {
  const date = lastModified
    ? parseLastModifiedHeader(lastModified)
    : new Date();
  const formattedDate = formatDateForFilename(date || new Date());
  return `${FILENAME_CONSTANTS.VOICE_MESSAGE_FILENAME_PREFIX}${formattedDate}`;
}

/**
 * 將毫秒轉換為秒，並保留指定位數的小數
 */
export function millisecondsToSeconds(milliseconds: number, decimals: number = 1): number {
  if (typeof milliseconds !== "number" || isNaN(milliseconds)) {
    return 0;
  }

  const seconds = milliseconds / 1000;
  return Number(seconds.toFixed(decimals));
}

/**
 * 將秒轉換為毫秒
 */
export function secondsToMilliseconds(seconds: number): number {
  if (typeof seconds !== "number" || isNaN(seconds)) {
    return 0;
  }

  return Math.round(seconds * 1000);
}