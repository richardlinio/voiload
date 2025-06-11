/**
 * chrome-extension.ts
 * Chrome Extension API 相關類型擴展
 */

// ================================================
// Chrome Extension 事件和 API 擴展
// ================================================

/**
 * 通用擴充功能訊息事件介面
 */
export interface ExtensionMessageEvent<T = any> extends MessageEvent {
  data: {
    type: string;
    message: T;
  };
}

/**
 * 頁面上下文訊息事件介面
 */
export interface PageContextMessageEvent extends ExtensionMessageEvent {
  // 繼承通用介面，專用於頁面上下文
}

/**
 * 背景腳本訊息事件介面
 */
export interface BackgroundScriptMessageEvent extends ExtensionMessageEvent {
  // 繼承通用介面，專用於背景腳本
}

// ================================================
// Window 全域介面擴展 (從 blob-monitor.ts 遷移)
// ================================================

import type { SendToContentMessage } from "./messages";

declare global {
  interface Window {
    sendToContent?: (message: SendToContentMessage) => void;
  }
}
