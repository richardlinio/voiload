/**
 * blob-monitor.ts
 * Responsible for monitoring and handling Blob URLs to detect and process possible audio files
 */

import { Logger } from "../utils/logger";
import {
  MESSAGE_ACTIONS,
  MODULE_NAMES,
  BLOB_MONITOR_CONSTANTS,
} from "../utils/constants";
import type { BlobQueueItem } from "../types/messages";

import { isLikelyVoiceMessageBlob } from "./blob-analyzer";
import { getAudioDuration } from "./audio-analyzer";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.BLOB_MONITOR);

/**
 * Blob processing queue object
 */
const BlobProcessingQueue = {
  // Processing queue and state
  processingQueue: [] as BlobQueueItem[],
  isProcessing: false,

  // Track processed blobs
  processedBlobs: new WeakMap<Blob, boolean>(),

  // Check if this blob should be processed
  shouldProcess(blob: Blob): boolean {
    // Basic check - blob must exist and have a type
    if (!blob || !blob.type) {
      return false;
    }
    // Check if this blob has already been processed
    if (this.processedBlobs.has(blob)) {
      return false;
    }
    // Evaluate if the blob is likely a voice message
    const isLikelyVoiceMessage = isLikelyVoiceMessageBlob(blob);
    if (!isLikelyVoiceMessage) {
      return false;
    }
    return true;
  },

  // Add blob to processing queue
  enqueue(blob: Blob, blobUrl: string): void {
    this.processingQueue.push({ blob, blobUrl });
    logger.debug("Added blob URL to processing queue", {
      queueLength: this.processingQueue.length,
    });
    this.processNextInQueue();
  },

  // Process the next item in the queue
  async processNextInQueue(): Promise<void> {
    // If already processing or queue is empty, return immediately
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const queueItem = this.processingQueue.shift();
    if (!queueItem) {
      this.isProcessing = false;
      return;
    }

    const { blob, blobUrl } = queueItem;

    try {
      // Mark as processed
      this.processedBlobs.set(blob, true);

      // Calculate audio duration
      const durationMs = await getAudioDuration(blobUrl);

      // Register with backend
      registerBlobWithBackend(blob, blobUrl, durationMs);
    } catch (error) {
      logger.error("Error processing blob in queue", { error });
    } finally {
      this.isProcessing = false;
      // Continue processing the next item
      this.processNextInQueue();
    }
  },
};

/**
 * Set up Blob URL monitoring
 * Monkey-patch URL.createObjectURL to capture blob URL creation
 */
export function setupBlobUrlMonitor(): void {
  logger.info("Setting up Blob URL monitor");

  // Save the original URL.createObjectURL method
  const originalCreateObjectURL = URL.createObjectURL;

  // Monkey-patch URL.createObjectURL
  URL.createObjectURL = function (blob: Blob | MediaSource): string {
    // Call the original method to get the blob URL
    const blobUrl = originalCreateObjectURL.apply(this, [blob]);

    try {
      // Only process Blob type, not MediaSource
      if (blob instanceof Blob) {
        // Check if this blob should be processed
        if (BlobProcessingQueue.shouldProcess(blob)) {
          // Add blob to processing queue
          BlobProcessingQueue.enqueue(blob, blobUrl);
        }
      }
    } catch (error) {
      logger.error("Error processing blob URL", { error });
    }
    // Return the original blob URL
    return blobUrl;
  };
  logger.info("Blob URL monitor set up");
}

/**
 * Register Blob with backend
 */
function registerBlobWithBackend(
  blob: Blob,
  blobUrl: string,
  durationMs: number
): void {
  // Use sendToContent function to send message
  if (window.sendToContent) {
    window.sendToContent({
      action: MESSAGE_ACTIONS.REGISTER_BLOB_URL,
      blobUrl: blobUrl,
      blobType: blob.type,
      blobSize: blob.size,
      durationMs: durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  // Log details
  logger.info("Sent blob url registration info to content script", {
    blobUrl: blobUrl.substring(0, 50),
    blobType: blob.type,
    blobSizeBytes: blob.size,
    durationMs: durationMs,
  });
}

/**
 * Set up periodic cleanup
 * Periodically clear processed data to avoid memory leaks
 */
function setupPeriodicCleanup(): void {
  setInterval(() => {
    // Currently processedBlobs is a WeakMap, no need for manual cleanup
  }, BLOB_MONITOR_CONSTANTS.PERIODIC_CLEANUP_INTERVAL);
}

/**
 * Initialize Blob monitor module
 */
export function initBlobMonitor(): void {
  try {
    logger.info("Starting initialization of Blob monitor module");

    // Set up URL monitoring
    setupBlobUrlMonitor();

    // Set up periodic cleanup
    setupPeriodicCleanup();

    logger.info("Blob monitor module initialized");
  } catch (error) {
    logger.error("Error initializing Blob monitor module", { error });
  }
}
