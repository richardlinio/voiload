/**
 * id-generator.ts
 * Provides unique ID generation functionality for identifying voice message elements and related data
 */

import { Logger } from "./logger";
import { ID_CONSTANTS } from "./constants";

/**
 * Generate a unique ID for a voice message
 * Format: voice-msg-{timestamp}-{randomString}
 */
export function generateVoiceMessageId(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 10);
  const id = `${ID_CONSTANTS.VOICE_MESSAGE_ID_PREFIX}${timestamp}-${randomString}`;

  Logger.debug("Generated voice message ID", { id, timestamp });
  return id;
}

/**
 * Check if the ID is a voice message ID
 */
export function isVoiceMessageId(id: string): boolean {
  return (
    typeof id === "string" &&
    id.startsWith(ID_CONSTANTS.VOICE_MESSAGE_ID_PREFIX)
  );
}

/**
 * Extract timestamp from ID
 *
 * @returns timestamp (milliseconds), or null if the ID format is invalid
 */
export function extractTimestampFromId(id: string): number | null {
  if (!isVoiceMessageId(id)) {
    Logger.warn("Attempted to extract timestamp from invalid ID", { id });
    return null;
  }

  const parts = id.split("-");
  if (parts.length >= 3 && parts[2]) {
    const timestamp = parseInt(parts[2], 10);
    if (isNaN(timestamp)) {
      Logger.warn("Extracted timestamp from ID is invalid", { id, parts });
      return null;
    }
    Logger.debug("Successfully extracted timestamp from ID", { id, timestamp });
    return timestamp;
  }

  Logger.warn("ID format incorrect, unable to extract timestamp", {
    id,
    parts,
  });
  return null;
}
