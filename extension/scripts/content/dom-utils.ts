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
 * Check whether a slider's aria-label is one of the known translations.
 *
 * This is an auxiliary signal: detection never depends on it, so a voice message
 * in an unlisted language is still found. It exists to raise confidence in logs
 * and to let the canary monitor notice when Facebook changes its labels.
 *
 * @param element - The slider element to inspect
 * @returns True if the label is present in the known-label list
 */
export function hasKnownVoiceMessageLabel(element: Element): boolean {
  const label = element.getAttribute("aria-label");
  if (!label) {
    return false;
  }
  return DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL.includes(label as any);
}

/**
 * Check if an element is a voice message slider.
 *
 * Matches on language-independent attributes only: role, aria-valuemin and a
 * numeric aria-valuemax. The aria-label is deliberately not required -- relying
 * on it made every unlisted language fail silently.
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
    element.getAttribute("role") !== "slider" ||
    element.getAttribute("aria-valuemin") !== "0"
  ) {
    return false;
  }

  return parseSliderDuration(element) !== null;
}

/**
 * Parse a slider's aria-valuemax into a duration in seconds.
 *
 * @param element - The slider element
 * @returns Duration in seconds, or null when absent, non-numeric or non-positive
 */
function parseSliderDuration(element: Element): number | null {
  const ariaValueMax = element.getAttribute("aria-valuemax");
  if (!ariaValueMax) {
    return null;
  }

  const durationSec = parseFloat(ariaValueMax);
  if (!isFinite(durationSec) || durationSec <= 0) {
    return null;
  }

  return durationSec;
}

/**
 * Get audio duration (in seconds) from a slider element
 *
 * @param sliderElement - The slider element
 * @returns Duration in seconds, or null if not available
 */
export function getDurationFromSlider(sliderElement: Element): number | null {
  if (
    !sliderElement ||
    sliderElement.nodeType !== Node.ELEMENT_NODE ||
    sliderElement.getAttribute("role") !== "slider"
  ) {
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

  const durationSec = parseSliderDuration(sliderElement);
  if (durationSec === null) {
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
 * Check whether a container holds the companion controls of a voice message:
 * a play control and an mm:ss duration label, and no video element.
 *
 * The play control is matched on its role alone. Its aria-label is localized
 * just like the slider's, so matching the label would reintroduce the language
 * dependency this detection is meant to remove.
 *
 * @param container - The candidate container element
 * @returns True if the container carries voice message companion controls
 */
function hasVoiceMessageControls(container: Element): boolean {
  if (typeof container.querySelector !== "function") {
    return false;
  }

  // A video element in the container means this slider belongs to a video
  // player, not a voice message.
  if (container.querySelector(DOM_CONSTANTS.NON_VOICE_MEDIA_SELECTOR)) {
    return false;
  }

  if (!container.querySelector(DOM_CONSTANTS.PLAY_BUTTON_SELECTOR)) {
    return false;
  }

  return DOM_CONSTANTS.DURATION_TEXT_PATTERN.test(container.textContent || "");
}

/**
 * Find the voice message container that owns a slider, if any.
 *
 * Walks up a bounded number of ancestors looking for the element that pairs the
 * slider with its play control and duration text.
 *
 * @param slider - A slider element that already passed isVoiceMessageSlider
 * @returns The owning container, or null when the guard signals are absent
 */
function findVoiceMessageContainer(slider: Element): Element | null {
  let ancestor: Element | null = slider.parentElement;
  let depth = 0;

  while (ancestor && depth < DOM_CONSTANTS.VOICE_MESSAGE_CONTAINER_MAX_DEPTH) {
    depth++;
    if (hasVoiceMessageControls(ancestor)) {
      return ancestor;
    }
    ancestor = ancestor.parentElement;
  }

  return null;
}

/**
 * Check whether a slider is a voice message slider backed by its container's
 * companion controls. This is the guarded check used for detection; the bare
 * isVoiceMessageSlider only inspects the slider's own attributes.
 *
 * @param element - The element to check
 * @returns True if the element is a confirmed voice message slider
 */
export function isConfirmedVoiceMessageSlider(element: Element | null): boolean {
  if (!isVoiceMessageSlider(element)) {
    return false;
  }

  if (!findVoiceMessageContainer(element)) {
    Logger.debug("Slider rejected: no voice message controls in container", {
      ariaLabel: element.getAttribute("aria-label"),
    });
    return false;
  }

  if (!hasKnownVoiceMessageLabel(element)) {
    // Not a failure: the label dictionary is auxiliary. Logged so the canary
    // monitor and future debugging can spot new or changed translations.
    Logger.debug("Voice message slider with an unrecognised aria-label", {
      ariaLabel: element.getAttribute("aria-label"),
    });
  }

  return true;
}

/**
 * Find the first confirmed voice message slider within a subtree.
 *
 * @param root - The element to search inside
 * @returns The slider element, or null
 */
function querySliderInside(root: Element): Element | null {
  if (typeof root.querySelectorAll !== "function") {
    return null;
  }

  const candidates = root.querySelectorAll(
    DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_SELECTOR
  );
  for (const candidate of Array.from(candidates)) {
    if (isConfirmedVoiceMessageSlider(candidate)) {
      return candidate;
    }
  }

  return null;
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

  return querySliderInside(element) !== null;
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
  if (isConfirmedVoiceMessageSlider(clickedElement)) {
    Logger.debug("Found voice message slider element directly");
    return { element: clickedElement, type: "slider" };
  }

  // Strategy 2: Search inside the clicked element
  Logger.debug("Searching inside the element for voice message element");
  const sliderInside = querySliderInside(clickedElement);
  if (sliderInside) {
    Logger.debug("Found voice message slider inside the element");
    return { element: sliderInside, type: "slider" };
  }

  // Strategy 3: Traverse up the DOM tree
  Logger.debug(
    "Start traversing up the DOM tree to find voice message element"
  );
  let parent: Element | null = clickedElement.parentElement;
  let depth = 0;

  while (parent) {
    depth++;

    const slider = querySliderInside(parent);
    if (slider) {
      Logger.debug("Found potential voice message container", {
        depth,
        elementTag: parent.tagName,
      });
      Logger.debug("Found voice message slider in the container");
      return { element: slider, type: "slider" };
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
