/**
 * context-menu-handler.ts
 * Responsible for handling context menu (right-click) events
 */

import { secondsToMilliseconds } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import { MESSAGE_ACTIONS, MODULE_NAMES } from "../utils/constants";

import {
  findVoiceMessageElement,
  getDurationFromSlider,
  type VoiceMessageElementResult,
} from "./dom-utils";

// ================================================
// Type Definitions
// ================================================

/**
 * Interface for right-click message
 */
interface RightClickMessage {
  action: string;
  elementId: string | null;
  downloadUrl: string | null;
  lastModified?: string | null | undefined;
  durationMs?: number | undefined;
}

// ================================================
// Context Menu Handler Functions
// ================================================

/**
 * Initialize the context menu handler
 */
export function initContextMenuHandler(): void {
  Logger.info("Initializing context menu handler", {
    module: MODULE_NAMES.CONTEXT_MENU,
  });

  // Listen for contextmenu events
  document.addEventListener("contextmenu", (event: MouseEvent) => {
    handleContextMenu(event);
  });
}

/**
 * Handle context menu (right-click) event
 *
 * @param event - Mouse event
 */
function handleContextMenu(event: MouseEvent): void {
  // Record the actual clicked element
  const clickedElement = event.target as Element;
  Logger.debug("Right-clicked element", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: clickedElement,
  });

  // Find the voice message element
  const result: VoiceMessageElementResult | null =
    findVoiceMessageElement(clickedElement);
  Logger.debug("Result of finding voice message element", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: result,
  });

  if (!result) {
    // If no voice message element is found, still send right-click message for fallback
    Logger.debug("No voice message element found, sending right-click message for fallback", {
      module: MODULE_NAMES.CONTEXT_MENU,
    });
    
    // Send right-click message with null values - download all will be triggered when user clicks context menu
    sendRightClickMessage(null, null, null, undefined);
    return;
  }

  const { element, type } = result;
  Logger.debug("Found voice message element type", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: type,
  });

  // Get the slider element based on the element type
  const sliderElement = type === "slider" ? element : null;
  Logger.debug("Slider element", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: sliderElement,
  });

  if (!sliderElement) {
    Logger.debug("No slider element found", {
      module: MODULE_NAMES.CONTEXT_MENU,
    });
    return;
  }

  // Check if the element has a data-voice-message-id attribute
  const id = sliderElement.getAttribute("data-voice-message-id");
  Logger.debug("Voice message ID", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: id,
  });

  // Get duration from the slider element
  const durationSec = getDurationFromSlider(sliderElement);
  Logger.debug("Duration (seconds) obtained from slider", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: durationSec,
  });

  if (durationSec !== null) {
    // Convert seconds to milliseconds
    const durationMs = secondsToMilliseconds(durationSec);
    Logger.debug("Duration (milliseconds)", {
      module: MODULE_NAMES.CONTEXT_MENU,
      data: durationMs,
    });

    // Send message to background script, including element ID and duration
    Logger.debug("Preparing to send right-click message", {
      module: MODULE_NAMES.CONTEXT_MENU,
    });
    sendRightClickMessage(id, null, null, durationMs);
  } else {
    Logger.debug("Unable to get duration from slider", {
      module: MODULE_NAMES.CONTEXT_MENU,
    });
  }
}

/**
 * Send right-click message to background script
 *
 * @param elementId - Element ID
 * @param downloadUrl - Download URL
 * @param lastModified - Last-Modified header value
 * @param durationMs - Duration in milliseconds
 */
function sendRightClickMessage(
  elementId: string | null,
  downloadUrl: string | null,
  lastModified?: string | null,
  durationMs?: number
): void {
  // Prepare the message object
  const message: RightClickMessage = {
    action: MESSAGE_ACTIONS.RIGHT_CLICK,
    elementId,
    downloadUrl,
    lastModified,
    durationMs,
  };

  Logger.debug("Preparing to send message to background script", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: message,
  });

  // Use chrome.runtime.sendMessage to send the message directly
  try {
    chrome.runtime.sendMessage(message, (response) => {
      Logger.debug("chrome.runtime.sendMessage response", {
        module: MODULE_NAMES.CONTEXT_MENU,
        data: response,
      });
    });
    Logger.debug("Message sent directly to background script", {
      module: MODULE_NAMES.CONTEXT_MENU,
    });
  } catch (error) {
    Logger.error("Error using chrome.runtime.sendMessage", {
      module: MODULE_NAMES.CONTEXT_MENU,
      data: error,
    });
  }

  Logger.info("Sent right-click message", {
    module: MODULE_NAMES.CONTEXT_MENU,
    data: {
      elementId,
      downloadUrl: downloadUrl ? downloadUrl.substring(0, 50) + "..." : null,
      lastModified,
    },
  });
}
