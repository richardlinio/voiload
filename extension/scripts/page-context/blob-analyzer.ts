/**
 * blob-analyzer.ts
 * Responsible for handling audio file analysis functions, including duration calculation and audio data processing
 */

import { Logger } from "../utils/logger";
import { MODULE_NAMES, BLOB_MONITOR_CONSTANTS } from "../utils/constants";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.BLOB_ANALYZER);

/**
 * Blob content result interface
 */
export interface BlobContentResult {
  base64data: string;
  blobType: string;
  blobSize: number;
}

/**
 * Extracts Blob content and converts it to base64 format
 *
 * @param blobUrl - blob URL
 * @returns An object containing base64data, blobType, and blobSize
 */
export async function extractBlobContent(
  blobUrl: string
): Promise<BlobContentResult> {
  try {
    logger.debug("Start extracting blob content", { blobUrl });

    // Fetch the blob content using fetch
    const response = await fetch(blobUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch blob content: ${response.status} ${response.statusText}`
      );
    }

    // Get the blob content
    const blob = await response.blob();
    logger.debug("Successfully fetched blob", {
      blobType: blob.type,
      blobSize: blob.size,
    });

    // Convert blob to base64
    return new Promise<BlobContentResult>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          // Ensure we get the correct base64 data
          const result = reader.result;
          if (typeof result !== "string") {
            throw new Error("FileReader result is not a string");
          }

          const base64data = result.split(",")[1];

          if (!base64data) {
            throw new Error("Failed to get valid base64 data");
          }

          logger.debug("Successfully converted blob to base64", {
            dataLength: base64data.length,
          });

          resolve({
            base64data,
            blobType: blob.type,
            blobSize: blob.size,
          });
        } catch (innerError) {
          logger.error("Error processing base64 data", { error: innerError });
          reject(innerError);
        }
      };
      reader.onerror = () => {
        reject(new Error("Failed to read blob content"));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logger.error("Error extracting blob content", { error });
    throw error;
  }
}

/**
 * Checks if a Blob is likely an audio file
 * Evaluates multiple indicators and returns a confidence score
 *
 * @param blob - The Blob object to evaluate
 * @returns Evaluation result
 */
export function isLikelyVoiceMessageBlob(blob: Blob): boolean {
  logger.debug("Evaluating if Blob is an audio file", {
    blobType: blob.type,
    blobSize: blob.size,
  });

  // Basic check - blob must exist, have a type, and have a size
  if (!blob || !blob.type || !blob.size) {
    logger.debug("Blob does not exist or lacks basic info");
    return false;
  }

  // Must be one of the possible audio types
  if (
    !BLOB_MONITOR_CONSTANTS.POSSIBLE_AUDIO_TYPES.some((type) =>
      blob.type.includes(type)
    )
  ) {
    logger.debug("Blob type is not in the list of possible audio types");
    return false;
  }

  // File must not be too small
  if (blob.size <= BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE) {
    logger.debug("Blob size is too small");
    return false;
  }

  if (blob.size >= BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE) {
    logger.debug("Blob size is too large");
    return false;
  }

  logger.debug("Blob meets the basic conditions for an audio file");
  return true;
}
