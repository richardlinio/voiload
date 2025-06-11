/**
 * messages.ts
 * 所有訊息相關介面定義
 */

// 基礎訊息介面
export interface BaseMessage {
  action: string;
  timestamp?: number;
}

// TODO: 在 Phase 9.4 中統一各種訊息類型
// 暫時導出空物件，避免 import 錯誤
export {};