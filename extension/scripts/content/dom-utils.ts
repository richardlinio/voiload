/**
 * dom-utils.ts
 * Provides helper functions for DOM operations
 */

import { Logger } from "../utils/logger";
import { DOM_CONSTANTS } from "../utils/constants";
import type { VoiceMessageElementResult } from "../types/dom";

// Re-export type for backward compatibility
export type { VoiceMessageElementResult };

// ================================================
// DOM Utility Functions
// ================================================

/**
 * Check if an element is a voice message slider
 *
 * @param element - The element to check
 * @returns True if the element is a voice message slider
 */
export function isVoiceMessageSlider(
  element: Element | null
): element is Element {
  if (
    !element ||
    element.nodeType !== Node.ELEMENT_NODE ||
    element.getAttribute("role") !== "slider"
  ) {
    return false;
  }

  const elementLabel = element.getAttribute("aria-label");
  if (!elementLabel) {
    return false;
  }

  // Check if the element's aria-label is in the supported label list
  return DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL.includes(
    elementLabel as any
  );
}

/**
 * Get audio duration (in seconds) from a slider element
 *
 * @param sliderElement - The slider element
 * @returns Duration in seconds, or null if not available
 */
export function getDurationFromSlider(sliderElement: Element): number | null {
  if (!isVoiceMessageSlider(sliderElement)) {
    Logger.warn("Attempted to get duration from a non-slider element", {
      element: (sliderElement as any)?.tagName,
    });
    return null;
  }

  const ariaValueMax = sliderElement.getAttribute("aria-valuemax");
  if (!ariaValueMax) {
    Logger.warn("Slider element is missing aria-valuemax attribute", {
      element: sliderElement.tagName,
    });
    return null;
  }

  const durationSec = parseFloat(ariaValueMax);
  if (isNaN(durationSec)) {
    Logger.warn("Invalid duration value from slider element", {
      element: sliderElement.tagName,
      ariaValueMax,
    });
    return null;
  }

  Logger.debug("Successfully got duration from slider element", {
    durationSec,
  });
  return durationSec;
}

/**
 * Check if an element is a potential voice message container
 *
 * @param element - The element to check
 * @returns True if the element is a potential voice message container
 */
export function isPotentialVoiceMessageContainer(
  element: Element | null
): boolean {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  // Check if the element contains any voice message related elements
  let hasSlider = false;

  // Iterate through all possible voice message slider labels
  for (const label of DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL) {
    if (element.querySelector(`[role="slider"][aria-label="${label}"]`)) {
      hasSlider = true;
      break;
    }
  }

  return hasSlider;
}

/**
 * Find the voice message element from a clicked element
 * Uses multiple strategies to locate the relevant voice message element
 *
 * @param clickedElement - The clicked element
 * @returns An object containing element (the voice message element) and type ('slider' or 'playButton'), or null if not found
 */
export function findVoiceMessageElement(
  clickedElement: Element | null
): VoiceMessageElementResult | null {
  if (!clickedElement) {
    Logger.warn("Attempted to find voice message element on a null element");
    return null;
  }

  Logger.debug("Start searching for voice message element", {
    elementTag: clickedElement.tagName,
  });

  // Strategy 1: Check the clicked element itself
  if (isVoiceMessageSlider(clickedElement)) {
    Logger.debug("Found voice message slider element directly");
    return { element: clickedElement, type: "slider" };
  }

  // Strategy 2: Search inside the clicked element
  Logger.debug("Searching inside the element for voice message element");
  let sliderInside: Element | null = null;

  // Iterate through all possible voice message slider labels
  for (const label of DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL) {
    const foundSlider = (clickedElement as Element).querySelector(
      `[role="slider"][aria-label="${label}"]`
    );
    if (foundSlider) {
      sliderInside = foundSlider;
      break;
    }
  }
  if (sliderInside) {
    Logger.debug("Found voice message slider inside the element");
    return { element: sliderInside, type: "slider" };
  }

  // Strategy 3: Traverse up the DOM tree
  Logger.debug(
    "Start traversing up the DOM tree to find voice message element"
  );
  let parent: Element | null = (clickedElement as Element).parentElement;
  let depth = 0;

  while (parent) {
    depth++;
    // Check if the parent is a potential container
    if (isPotentialVoiceMessageContainer(parent)) {
      Logger.debug("Found potential voice message container", {
        depth,
        elementTag: parent.tagName,
      });

      // Search for slider in the parent element
      let slider: Element | null = null;

      // Iterate through all possible voice message slider labels
      for (const label of DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL) {
        const foundSlider = parent.querySelector(
          `[role="slider"][aria-label="${label}"]`
        );
        if (foundSlider) {
          slider = foundSlider;
          break;
        }
      }
      if (slider) {
        Logger.debug("Found voice message slider in the container");
        return { element: slider, type: "slider" };
      }
    }

    // Traverse up the DOM tree
    parent = parent.parentElement;

    // Limit traversal depth to avoid infinite loop
    if (parent === document.body) {
      Logger.debug("Reached document.body, stopping search");
      break;
    }
  }

  Logger.warn("Could not find voice message element");
  return null;
}
