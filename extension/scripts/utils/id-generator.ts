/**
 * id-generator.ts
 * 提供生成唯一 ID 的功能，用於標識語音訊息元素和相關資料
 */

import { Logger } from "./logger";
import { ID_CONSTANTS } from "./constants";

/**
 * 生成語音訊息的唯一 ID
 * 格式：voice-msg-{timestamp}-{隨機字串}
 */
export function generateVoiceMessageId(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const id = `${ID_CONSTANTS.VOICE_MESSAGE_ID_PREFIX}${timestamp}-${randomString}`;

  Logger.debug("生成語音訊息 ID", { id, timestamp });
  return id;
}

/**
 * 檢查 ID 是否為語音訊息 ID
 */
export function isVoiceMessageId(id: string): boolean {
  return typeof id === "string" && id.startsWith(ID_CONSTANTS.VOICE_MESSAGE_ID_PREFIX);
}

/**
 * 從 ID 中提取時間戳
 * 
 * @returns 時間戳（毫秒），如果 ID 格式不正確則返回 null
 */
export function extractTimestampFromId(id: string): number | null {
  if (!isVoiceMessageId(id)) {
    Logger.warn("嘗試從無效 ID 提取時間戳", { id });
    return null;
  }

  const parts = id.split("-");
  if (parts.length >= 3 && parts[2]) {
    const timestamp = parseInt(parts[2], 10);
    if (isNaN(timestamp)) {
      Logger.warn("從 ID 提取的時間戳無效", { id, parts });
      return null;
    }
    Logger.debug("從 ID 提取時間戳成功", { id, timestamp });
    return timestamp;
  }

  Logger.warn("ID 格式不正確，無法提取時間戳", { id, parts });
  return null;
}