/**
 * blob-monitor.ts
 * Responsible for monitoring and handling Blob URLs to detect and process possible audio files
 */

import { Logger } from "../utils/logger";
import {
  MESSAGE_ACTIONS,
  MESSAGE_SOURCES,
  MODULE_NAMES,
  BLOB_MONITOR_CONSTANTS,
  SOURCE_BLOB_CONSTANTS,
  MATCHING_TOLERANCE,
} from "../utils/constants";
import type { BlobQueueItem } from "../types/messages";

import { isLikelyVoiceMessageBlob } from "./blob-analyzer";
import { getAudioDuration } from "./audio-analyzer";
import { convertBlobToWav } from "./wav-encoder";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.BLOB_MONITOR);

// The unpatched URL.createObjectURL, captured when the monitor is installed.
// Converted WAV blobs must be published through this rather than the patched
// function: a WAV blob passes isLikelyVoiceMessageBlob (audio MIME, plausible
// size), so routing it through the patch would re-enqueue it, decode it, and
// convert it again, without end.
let originalCreateObjectURL: typeof URL.createObjectURL = URL.createObjectURL;

// The patch currently installed on URL.createObjectURL, if it is ours. Compared
// against the live function rather than tracked with a boolean: a second install
// would otherwise capture the patch as the original and delegate to itself.
let installedPatch: typeof URL.createObjectURL | null = null;

// Whether the page is already answering conversion requests.
let isWavListenerInstalled = false;

/**
 * Captured opus blobs, newest last, keyed by the duration measured from them.
 *
 * Retained rather than re-fetched at conversion time because the blob URL belongs
 * to Facebook: it revokes the URL when the message row unmounts, which would
 * leave an older message with no recoverable audio.
 */
const sourceBlobs = new Map<number, Blob>();

// The single live WAV blob URL, revoked when the next conversion supersedes it.
let currentWavUrl: string | null = null;

/**
 * Retain a captured blob for later on-demand conversion, dropping the oldest
 * once the cap is reached.
 */
function retainSourceBlob(durationMs: number, blob: Blob): void {
  sourceBlobs.set(durationMs, blob);

  while (sourceBlobs.size > SOURCE_BLOB_CONSTANTS.MAX_RETAINED) {
    const oldest = sourceBlobs.keys().next();
    if (oldest.done) {
      break;
    }
    sourceBlobs.delete(oldest.value);
  }
}

/**
 * Find the retained blob whose duration is nearest the requested one.
 *
 * The caller's duration comes from the DOM (integer seconds), while the retained
 * key was decoded from the audio (precise milliseconds), so an equality check
 * would never hit. Mirrors the tolerance the background store matches on.
 */
function findSourceBlob(durationMs: number): Blob | null {
  let best: Blob | null = null;
  let bestDiff = Infinity;

  for (const [retainedMs, blob] of sourceBlobs) {
    const diff = Math.abs(retainedMs - durationMs);
    if (diff <= MATCHING_TOLERANCE && diff < bestDiff) {
      best = blob;
      bestDiff = diff;
    }
  }

  return best;
}

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

      // Duration is read from the original audio, never from the decoded WAV.
      // decodeAudioData drops opus pre-skip (priming) samples, making the WAV
      // ~7ms shorter than the container reports; that gap exceeds
      // EXACT_MATCHING_TOLERANCE and would break duration matching downstream.
      const durationMs = await getAudioDuration(blobUrl);

      // Keep the opus bytes so a later download can re-encode them. Converting
      // here instead would decode every scrolled-past message into PCM.
      retainSourceBlob(durationMs, blob);

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
 * Re-encode the retained blob for one voice message and publish it as a blob URL.
 *
 * Only one WAV is alive at a time: PCM is roughly thirty times the size of the
 * opus it came from, so the previous one is revoked before a new one is made.
 *
 * @param durationMs - Duration of the message the user asked to download
 * @returns Blob URL of the WAV, or null when there is nothing to convert
 */
async function prepareWavUrl(durationMs: number): Promise<string | null> {
  const blob = findSourceBlob(durationMs);
  if (!blob) {
    logger.warn("No retained audio for the requested duration", {
      durationMs,
      retained: sourceBlobs.size,
    });
    return null;
  }

  const wavBlob = await convertBlobToWav(blob);
  if (!wavBlob) {
    return null;
  }

  if (currentWavUrl) {
    // Revoking removes the URL->blob mapping, and Chrome does not read the bytes
    // until the user confirms the Save-As dialog -- so callers must let a download
    // of this URL start before asking for the next conversion. Both download paths
    // await downloadVoiceMessage for that reason.
    URL.revokeObjectURL(currentWavUrl);
  }

  // Deliberately the unpatched function -- see originalCreateObjectURL above.
  currentWavUrl = originalCreateObjectURL(wavBlob);
  return currentWavUrl;
}

/**
 * Answer content-script requests to re-encode a message for a download.
 *
 * The request arrives when the user actually asks to download, so a message is
 * only ever decoded once someone wants it -- a right-click alone costs nothing.
 */
function setupWavRequestListener(): void {
  // A second listener would convert and answer the same request twice, revoking
  // the first WAV before its answer reached the content script.
  if (isWavListenerInstalled) {
    return;
  }
  isWavListenerInstalled = true;

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) {
      return;
    }
    if (event.data?.type !== MESSAGE_SOURCES.CONTENT_SCRIPT) {
      return;
    }

    const message = event.data.message;
    if (message?.action !== MESSAGE_ACTIONS.PREPARE_WAV) {
      return;
    }

    const { durationMs, requestId } = message;

    void prepareWavUrl(durationMs)
      .catch((error) => {
        logger.error("WAV preparation failed", { error, durationMs });
        return null;
      })
      .then((wavUrl) => {
        window.sendToContent?.({
          action: MESSAGE_ACTIONS.PREPARE_WAV_RESULT,
          requestId,
          wavUrl,
        });
      });
  });
}

/**
 * Set up Blob URL monitoring
 * Monkey-patch URL.createObjectURL to capture blob URL creation
 */
export function setupBlobUrlMonitor(): void {
  logger.info("Setting up Blob URL monitor");

  // Installing over our own patch would capture it as the original, leaving it
  // delegating to itself on every call.
  if (installedPatch && URL.createObjectURL === installedPatch) {
    logger.debug("Blob URL monitor already installed");
    return;
  }

  // Save the original URL.createObjectURL method, both to delegate to below and
  // to publish converted WAV blobs without re-entering this patch.
  originalCreateObjectURL = URL.createObjectURL;

  // Monkey-patch URL.createObjectURL
  const patched = function (this: unknown, blob: Blob | MediaSource): string {
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

  URL.createObjectURL = patched;
  installedPatch = patched;

  logger.info("Blob URL monitor set up");
}

/**
 * Register Blob with backend
 *
 * @param blob - Captured audio blob
 * @param blobUrl - Blob URL of the original audio, used as the download fallback
 * @param durationMs - Duration measured from the original audio
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

    // Answer on-demand WAV conversion requests from the content script
    setupWavRequestListener();

    // Set up periodic cleanup
    setupPeriodicCleanup();

    logger.info("Blob monitor module initialized");
  } catch (error) {
    logger.error("Error initializing Blob monitor module", { error });
  }
}
