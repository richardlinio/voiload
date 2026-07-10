/**
 * context-menu-handler.ts
 * Responsible for handling context menu (right-click) events
 */

import { domDurationToMilliseconds } from "../utils/time-utils";
import { Logger } from "../utils/logger";
import { MESSAGE_ACTIONS, MODULE_NAMES } from "../utils/constants";

import {
  findVoiceMessageElement,
  getDurationFromSlider,
  type VoiceMessageElementResult,
} from "./dom-utils";
import { requestWavUrl } from "./wav-request";

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
  /** Blob URL of the WAV re-encoding; null when it could not be produced. */
  wavUrl?: string | null;
}

// Bumped on every right-click that reaches the background, so a WAV that
// finishes encoding after a newer right-click cannot resurrect stale state.
let rightClickSeq = 0;

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
    rightClickSeq++;
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
    const durationMs = domDurationToMilliseconds(durationSec);
    Logger.debug("Duration (milliseconds)", {
      module: MODULE_NAMES.CONTEXT_MENU,
      data: durationMs,
    });

    // Populate the background's state right away: the menu item is clickable the
    // moment it renders, and a click before the WAV is ready must download THIS
    // message (as original audio), not whatever a previous right-click left.
    const seq = ++rightClickSeq;
    sendRightClickMessage(id, null, null, durationMs);

    // Re-encode this one message while the user reads the context menu, so the
    // eventual download click stays instant. A failure keeps the provisional
    // message above and the original audio is downloaded.
    void requestWavUrl(durationMs).then((wavUrl) => {
      if (!wavUrl || seq !== rightClickSeq) {
        // Nothing to upgrade with, or a newer right-click already owns the
        // background's state — upgrading now would point it at the wrong message.
        return;
      }
      Logger.debug("Upgrading right-click message with WAV", {
        module: MODULE_NAMES.CONTEXT_MENU,
        data: { hasWavUrl: true },
      });
      sendRightClickMessage(id, null, null, durationMs, wavUrl);
    });
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
 * @param wavUrl - Blob URL of the WAV re-encoding, when one could be produced
 */
function sendRightClickMessage(
  elementId: string | null,
  downloadUrl: string | null,
  lastModified?: string | null,
  durationMs?: number,
  wavUrl: string | null = null
): void {
  // Prepare the message object
  const message: RightClickMessage = {
    action: MESSAGE_ACTIONS.RIGHT_CLICK,
    elementId,
    downloadUrl,
    lastModified,
    durationMs,
    wavUrl,
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
