/**
 * page-context.ts
 * Script running in the page context, responsible for executing functions that require the page environment.
 * This file is loaded as an ES6 module, allowing the use of import/export syntax.
 */

import { Logger } from "./utils/logger";
import { MESSAGE_SOURCES, MODULE_NAMES } from "./utils/constants";
import { initBlobMonitor } from "./page-context/blob-monitor";

// ================================================
// Type Definitions
// ================================================

/**
 * Page context message interface
 */
interface PageContextMessage {
  action: string;
  url?: string;
  hostname?: string;
}

// Window interface extension is defined in blob-monitor.ts

// Create a module-specific logger - using the new module name
const logger = Logger.createModuleLogger(MODULE_NAMES.PAGE_CONTEXT);

/**
 * Main initialization function
 */
function initialize(): void {
  logger.info("Initializing page context module");

  // Check if on a supported site
  const isSupportedSite =
    window.location.hostname.includes("facebook.com") ||
    window.location.hostname.includes("messenger.com");

  if (!isSupportedSite) {
    logger.debug("Unsupported site, extension will not start");
    return;
  }

  try {
    // Initialize Blob monitoring module
    logger.debug("Preparing to initialize Blob monitoring module");
    initBlobMonitor();
    logger.debug("Blob monitoring module initialized successfully");
  } catch (error: any) {
    logger.error("Error initializing Blob monitoring module", { error });
  }

  // Notify content script that the page context has been initialized
  const initMessage: PageContextMessage = {
    action: "pageContextInitialized",
    url: window.location.href,
    hostname: window.location.hostname,
  };

  window.postMessage(
    {
      type: MESSAGE_SOURCES.PAGE_CONTEXT,
      message: initMessage,
    },
    "*"
  );

  // Define a helper function to send messages to the content script
  window.sendToContent = function (message: any): void {
    try {
      logger.debug("Preparing to send message to content script", { message });

      // Use postMessage to send the message
      window.postMessage(
        {
          type: MESSAGE_SOURCES.PAGE_CONTEXT,
          message: message,
        },
        "*"
      );

      logger.debug("Message sent to content script");
    } catch (error: any) {
      logger.error("Error sending message to content script", { error });
    }
  };

  logger.info("Page context module has started");
}

// Initialize when the DOM is fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
