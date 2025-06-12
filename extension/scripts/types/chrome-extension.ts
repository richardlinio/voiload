/**
 * chrome-extension.ts
 * Chrome Extension API related type extensions
 */

// ================================================
// Chrome Extension Events and API Extensions
// ================================================

/**
 * Generic extension message event interface
 */
export interface ExtensionMessageEvent<T = any> extends MessageEvent {
  data: {
    type: string;
    message: T;
  };
}

/**
 * Page context message event interface
 */
export interface PageContextMessageEvent extends ExtensionMessageEvent {
  // Inherits the generic interface, specialized for page context
}

/**
 * Background script message event interface
 */
export interface BackgroundScriptMessageEvent extends ExtensionMessageEvent {
  // Inherits the generic interface, specialized for background scripts
}

// ================================================
// Window global interface extension (migrated from blob-monitor.ts)
// ================================================

import type { SendToContentMessage } from "./messages";

declare global {
  interface Window {
    sendToContent?: (message: SendToContentMessage) => void;
  }
}
