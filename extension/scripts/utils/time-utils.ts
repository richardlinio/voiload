/**
 * time-utils.ts
 * Provides utility functions for time handling
 */

import { Logger } from "./logger";
import { FILENAME_CONSTANTS } from "./constants";

/**
 * Converts the HTTP Last-Modified header format time to a Date object
 * Example format: Wed, 19 Mar 2025 14:04:40 GMT
 */
export function parseLastModifiedHeader(
  lastModifiedHeader: string
): Date | null {
  if (!lastModifiedHeader) {
    return null;
  }

  try {
    return new Date(lastModifiedHeader);
  } catch (error) {
    Logger.error("Failed to parse Last-Modified header", {
      error: error instanceof Error ? error.message : String(error),
      header: lastModifiedHeader,
    });
    return null;
  }
}

/**
 * Formats a date into a filename-friendly format
 * Format: YYYY-MM-DD-HH-mm-ss
 */
export function formatDateForFilename(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return formatDateForFilename(new Date()); // Use current time as fallback
  }

  const pad = (num: number): string => String(num).padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // Month is 0-based
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}

/**
 * Generates a voice message filename based on the Last-Modified header or current time
 *
 * @returns Formatted filename (without extension)
 */
export function generateVoiceMessageFilename(lastModified?: string): string {
  const date = lastModified
    ? parseLastModifiedHeader(lastModified)
    : new Date();
  const formattedDate = formatDateForFilename(date || new Date());
  return `${FILENAME_CONSTANTS.VOICE_MESSAGE_FILENAME_PREFIX}${formattedDate}`;
}

/**
 * Converts milliseconds to seconds, keeping a specified number of decimal places
 */
export function millisecondsToSeconds(
  milliseconds: number,
  decimals: number = 1
): number {
  if (typeof milliseconds !== "number" || isNaN(milliseconds)) {
    return 0;
  }

  const seconds = milliseconds / 1000;
  return Number(seconds.toFixed(decimals));
}

/**
 * Converts seconds to milliseconds
 */
export function secondsToMilliseconds(seconds: number): number {
  if (typeof seconds !== "number" || isNaN(seconds)) {
    return 0;
  }

  return Math.round(seconds * 1000);
}
