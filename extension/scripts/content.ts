/**
 * content.ts
 * Main content script responsible for initializing and coordinating other modules
 */

import { Logger } from "./utils/logger";
import {
  SUPPORTED_SITES,
  MESSAGE_SOURCES,
  MODULE_NAMES,
} from "./utils/constants";
import { initMessageHandler } from "./content/message-handler";
import { initContextMenuHandler } from "./content/context-menu-handler";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.CONTENT_SCRIPT);

// ================================================
// Type Definitions
// ================================================

/**
 * Page context message event interface
 */
interface PageContextMessageEvent extends MessageEvent {
  data: {
    type: string;
    message: any;
  };
}

/**
 * Chrome runtime message listener callback type
 */
type RuntimeMessageListener = (
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean | void;

// ================================================
// Main Initialization Logic
// ================================================

// Check if on a supported site
const isSupportedSite = SUPPORTED_SITES.DOMAINS.some((domain) =>
  window.location.hostname.includes(domain)
);

if (!isSupportedSite) {
  logger.debug("Unsupported site, extension will not start");
} else {
  // Create page context script tag
  const script = document.createElement("script");
  script.type = "module";
  script.src = chrome.runtime.getURL("scripts/page-context.js");
  script.onload = function () {
    logger.debug(
      "Facebook Messenger voice message downloader has loaded the page context module"
    );
    script.remove(); // Remove the script tag after loading
  };

  // Ensure the script tag is added to the page
  try {
    // Add to the page
    (document.head || document.documentElement).appendChild(script);
    logger.debug("Page context script has been added to the page");
  } catch (error) {
    logger.error("Error adding page context script", { error });
  }

  // Set up message listener to handle communication between scripts and background scripts
  window.addEventListener("message", function (event: MessageEvent) {
    // Ensure the message comes from the same page
    if (event.source !== window) {
      return;
    }

    // Handle messages from the page context
    if (event.data.type && event.data.type === MESSAGE_SOURCES.PAGE_CONTEXT) {
      const pageEvent = event as PageContextMessageEvent;
      logger.debug(
        "Received page context message, forwarding to background script",
        {
          message: pageEvent.data.message,
        }
      );
      chrome.runtime.sendMessage(pageEvent.data.message, function (response) {
        logger.debug("Background script response", { response });
      });
    }
  });

  // Forward messages from the background script to the page context
  const messageListener: RuntimeMessageListener = function (
    message: any,
    _sender: chrome.runtime.MessageSender,
    _sendResponse: (response?: any) => void
  ): boolean {
    logger.debug("Received background script message", { message });

    // Forward to the page context
    window.postMessage(
      {
        type: MESSAGE_SOURCES.BACKGROUND_SCRIPT,
        message: message,
      },
      "*"
    );
    return true;
  };

  chrome.runtime.onMessage.addListener(messageListener);

  // Initialize context menu handler
  initContextMenuHandler();
  logger.debug("Context menu handler has been initialized");

  // Initialize content script message handler
  // Ensure the page context has been loaded
  setTimeout(() => {
    initMessageHandler();
    logger.debug("Content script message handler has been initialized");
  }, 300);

  logger.info(
    "Facebook Messenger voice message downloader has been initialized"
  );
}
