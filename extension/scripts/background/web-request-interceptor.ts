/**
 * web-request-interceptor.ts
 * Uses Chrome's webRequest API to monitor network requests, for intercepting voice message download URLs
 */

import { isLikelyVoiceMessage } from "../page-context/audio-analyzer";
import { Logger } from "../utils/logger";
import {
  MODULE_NAMES,
  VOICE_MESSAGE_URL_PATTERNS,
  MESSAGE_ACTIONS,
  SUPPORTED_SITES,
  TIME_CONSTANTS,
} from "../utils/constants";

import { type VoiceMessageStore } from "./data-store";

// ================================================
// Type Definitions
// ================================================

// Removed unused interface definitions
// interface RequestMetadata and AudioDurationMessage are defined elsewhere

const logger = Logger.createModuleLogger(MODULE_NAMES.WEB_REQUEST);

// Use a Set to store already processed URLs
let processedUrls = new Set<string>();

// ================================================
// Public Functions
// ================================================

/**
 * Initialize the webRequest interceptor
 * @param voiceMessages - Voice message data store
 */
export function initWebRequestInterceptor(
  voiceMessages: VoiceMessageStore
): void {
  try {
    logger.debug("Initializing webRequest interceptor");

    // Check if the WebRequest API is available
    if (!chrome || !chrome.webRequest) {
      logger.error("chrome.webRequest API is not available");
      return;
    }

    // Set up network request listeners
    setupWebRequestListeners(voiceMessages);

    // Set up periodic cleanup mechanism
    setupPeriodicUrlCacheCleanup();

    logger.info("webRequest interceptor initialized", {
      patterns: VOICE_MESSAGE_URL_PATTERNS,
    });
  } catch (error: any) {
    logger.error("Error initializing webRequest interceptor", {
      error: error.message,
      stack: error.stack,
    });
  }
}

// ================================================
// Listener Initialization
// ================================================

/**
 * Set up network request listeners
 * @param {Object} voiceMessages - Voice message data store
 */
function setupWebRequestListeners(voiceMessages: VoiceMessageStore) {
  // Listen for requests with received headers - mainly for early detection
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => handleRequest(voiceMessages, details),
    { urls: [...VOICE_MESSAGE_URL_PATTERNS] },
    ["responseHeaders"]
  );

  // Listen for completed requests - ensures all data has been received
  chrome.webRequest.onCompleted.addListener(
    (details) => handleRequest(voiceMessages, details),
    { urls: [...VOICE_MESSAGE_URL_PATTERNS] },
    ["responseHeaders"]
  );
}

/**
 * Set up periodic cleanup of expired URL cache
 * Simplified: just clear the entire cache
 */
function setupPeriodicUrlCacheCleanup() {
  setInterval(() => {
    // Create a new Set, letting the old one be garbage collected
    processedUrls = new Set();

    logger.debug("URL cache cleared");
  }, TIME_CONSTANTS.CLEANUP_INTERVAL);
}

// ================================================
// Request Handling Functions
// ================================================

/**
 * Handle network request
 * @param {Object} voiceMessages - Voice message data store
 * @param {Object} details - Request details
 */
function handleRequest(
  voiceMessages: VoiceMessageStore,
  details: chrome.webRequest.WebResponseHeadersDetails
) {
  try {
    const { url, method, statusCode, responseHeaders } = details;

    // Check if the URL has already been processed
    if (processedUrls.has(url)) {
      logger.debug("URL already processed, skipping", {
        url: url.substring(0, 50) + "...",
      });
      return;
    }

    // Extract metadata
    const metadata = getMetadata(responseHeaders);

    // Determine if this is likely a voice message
    if (!isLikelyVoiceMessage(url, method, statusCode, metadata)) {
      return;
    }

    logger.debug("Detected voice message request", {
      url: url.substring(0, 100) + "...",
      type: details.type,
      statusCode: statusCode,
      method: method,
    });

    // Mark this URL as processed
    markUrlAsProcessed(url);

    // Broadcast message to all possible tabs, requesting audio duration calculation
    broadcastToContentScripts({
      action: MESSAGE_ACTIONS.GET_AUDIO_DURATION,
      url: url,
      metadata: {
        contentType: metadata.contentType,
        contentLength: metadata.contentLength,
        lastModified: metadata.lastModified,
      },
      timestamp: Date.now(),
    });
  } catch (error: any) {
    logger.error("Error handling request", {
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Mark a URL as processed
 * @param {string} url - The URL to mark
 */
function markUrlAsProcessed(url: string) {
  processedUrls.add(url);
  logger.debug("URL marked as processed", {
    url: url.substring(0, 50) + "...",
    cacheSize: processedUrls.size,
  });
}

// ================================================
// Metadata Extraction Functions
// ================================================

/**
 * Extract metadata from response headers
 * @param {Array} responseHeaders - Response headers array
 * @returns {Object} - Extracted metadata
 */
function getMetadata(
  responseHeaders: chrome.webRequest.HttpHeader[] | undefined
) {
  const metadata = {
    contentDisposition: "",
    contentType: "",
    contentLength: "",
    lastModified: "",
  };

  if (!responseHeaders) {
    return metadata;
  }

  // Extract information from headers
  for (const header of responseHeaders) {
    const headerName = header.name.toLowerCase();
    const headerValue = header.value;

    switch (headerName) {
      case "content-disposition":
        metadata.contentDisposition = headerValue || "";
        break;
      case "content-type":
        metadata.contentType = headerValue || "";
        break;
      case "content-length":
        metadata.contentLength = headerValue || "";
        break;
      case "last-modified":
        metadata.lastModified = headerValue || "";
        break;
    }
  }
  return metadata;
}

// ================================================
// Broadcast Message to Content Scripts
// ================================================

/**
 * Broadcast a message to all tabs
 * @param {Object} message - The message to send
 */
function broadcastToContentScripts(message: any) {
  chrome.tabs.query({ url: [...SUPPORTED_SITES.PATTERNS] }, (tabs) => {
    logger.debug(`Broadcasting message to ${tabs.length} tabs`, { message });

    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            logger.debug(`Failed to send message to tab ${tab.id}`, {
              error: chrome.runtime.lastError.message,
            });
          } else if (response && response.success) {
            logger.debug(`Tab ${tab.id} received the message`, {
              responseData: response,
            });
          }
        });
      }
    }
  });
}
