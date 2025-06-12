/**
 * audio-analyzer.ts
 * Helper functions for analyzing audio
 */

import { Logger } from "../utils/logger";
import {
  MODULE_NAMES,
  SUPPORTED_SITES,
  BLOB_MONITOR_CONSTANTS,
  WEB_REQUEST_CONSTANTS,
} from "../utils/constants";
import type { RequestMetadata } from "../types/audio";
import type { AudioDurationMessage } from "../types/messages";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.AUDIO_ANALYZER);

// ================================================
// Voice message detection functions
// ================================================

/**
 * Determine if a request is likely a voice message
 * @param url - Request URL
 * @param method - HTTP method
 * @param statusCode - HTTP status code
 * @param metadata - Optional, request metadata
 * @returns Whether it is likely a voice message
 */
export function isLikelyVoiceMessage(
  url: string,
  method: string,
  statusCode?: number,
  metadata: RequestMetadata = {}
): boolean {
  // 1. Basic check: URL exists, is a GET request, status code indicates success
  if (!url || method !== "GET") {
    return false;
  }

  if (
    statusCode &&
    !WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES.includes(statusCode as any)
  ) {
    return false;
  }

  // 2. Domain check: is it from a known CDN
  const isFromKnownCdn = SUPPORTED_SITES.CDN_PATTERNS.some((pattern) => {
    const domain = pattern.replace("*://*.", "").replace("/*", "");
    return url.includes(domain);
  });

  if (!isFromKnownCdn) {
    return false;
  }

  // 3. Content type check: is it audio
  if (
    metadata.contentType &&
    !WEB_REQUEST_CONSTANTS.AUDIO_CONTENT_TYPES.includes(
      metadata.contentType as any
    )
  ) {
    return false;
  }

  // 4. File size check: is it within a reasonable range
  if (metadata.contentLength) {
    const fileSizeBytes = parseInt(metadata.contentLength, 10);
    if (
      !isNaN(fileSizeBytes) &&
      (fileSizeBytes < BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE ||
        fileSizeBytes > BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE)
    ) {
      return false;
    }
  }

  return true;
}

// ===========================================
// Get audio duration
// ===========================================

/**
 * Calculate audio duration using HTML5 Audio element
 * @param url - Audio URL
 * @returns Duration in milliseconds
 */
export function getAudioDuration(url: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    logger.debug("Start calculating audio duration", {
      url: url.substring(0, 50) + "...",
    });

    // Create audio element
    const audio = new Audio();

    // Key setting: only preload metadata, do not download the whole file
    audio.preload = "metadata";

    // Set up event listeners
    audio.addEventListener("loadedmetadata", onMetadataLoaded);
    audio.addEventListener("error", onError);

    // Start loading
    audio.src = url;

    // When metadata is loaded
    function onMetadataLoaded() {
      // Calculate duration (milliseconds)
      const durationMs = Math.round(audio.duration * 1000);

      logger.debug("Audio duration calculation complete", {
        url: url.substring(0, 50) + "...",
        durationMs: durationMs,
      });

      // Clean up listeners
      audio.removeEventListener("loadedmetadata", onMetadataLoaded);
      audio.removeEventListener("error", onError);

      // Release resources
      audio.src = "";

      resolve(durationMs);
    }

    // Handle errors
    function onError(e: Event) {
      const errorEvent = e as ErrorEvent;
      logger.error("Error occurred while loading audio", {
        error: errorEvent.error || "Unknown error",
        url: url.substring(0, 50) + "...",
      });

      // Clean up listeners
      audio.removeEventListener("loadedmetadata", onMetadataLoaded);
      audio.removeEventListener("error", onError);

      // Release resources
      audio.src = "";

      reject(
        new Error(
          `Error occurred while loading audio: ${
            errorEvent.error || "Unknown error"
          }`
        )
      );
    }
  });
}

/**
 * Handle request to calculate audio duration
 * @param message - Request message
 * @returns Duration or undefined
 */
export async function handleGetAudioDurationRequest(
  message: AudioDurationMessage
): Promise<number | undefined> {
  try {
    // Await calculation result
    const result = await getAudioDuration(message.url);

    logger.debug("Obtained audio duration calculation result", { result });
    return result;
  } catch (error) {
    logger.error("Error occurred while calculating audio duration", {
      error: error instanceof Error ? error.message : String(error),
      url: message.url.substring(0, 50) + "...",
    });
    return undefined;
  }
}
