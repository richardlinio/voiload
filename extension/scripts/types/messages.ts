/**
 * messages.ts
 * All message-related interface definitions - Unified message type system
 */

import type { RequestMetadata } from "./audio";

// ================================================
// Base Message Interface
// ================================================

/**
 * Base message interface - common structure for all messages
 */
export interface BaseMessage {
  action?: string;
  timestamp?: number | string;
}

// ================================================
// Right Click Related Messages
// ================================================

/**
 * Right click message interface - unified version
 */
export interface RightClickMessage extends BaseMessage {
  elementId: string | null;
  downloadUrl: string | null;
  lastModified?: string | null;
  durationMs?: number;
}

// ================================================
// Element Registration Related Messages
// ================================================

/**
 * Element registration message interface
 */
export interface ElementRegistrationMessage extends BaseMessage {
  elementId: string;
  durationMs: number;
}

/**
 * Audio URL registration message interface - unified version
 */
export interface AudioUrlRegistrationMessage extends BaseMessage {
  audioUrl: string;
  durationMs: number;
}

// ================================================
// Blob Related Messages
// ================================================

/**
 * Blob URL registration message interface
 */
export interface BlobUrlMessage extends BaseMessage {
  blobUrl: string;
  blobType?: string;
  blobSize?: number;
  durationMs: number;
}

/**
 * Blob content message interface
 */
export interface BlobContentMessage extends BaseMessage {
  blobUrl: string;
  blobType: string;
  base64data: string;
  requestId?: string;
}

/**
 * Blob detection message interface
 */
export interface BlobDetectionMessage extends BaseMessage {
  url: string;
  type: string;
  size?: number;
  blobUrl?: string;
  blobType?: string;
  blobSize?: number;
  error?: string;
}

/**
 * Blob download request message interface
 */
export interface BlobDownloadMessage extends BaseMessage {
  blobUrl: string;
  blobType?: string;
  requestId?: string;
}

// ================================================
// Audio Related Messages
// ================================================

/**
 * Audio duration request message interface - unified version
 */
export interface AudioDurationMessage extends BaseMessage {
  url: string;
  metadata?: RequestMetadata;
}

// ================================================
// Download Related Messages
// ================================================

/**
 * Download all voice messages request message interface
 */
export interface DownloadAllMessage extends BaseMessage {
  // No additional parameters needed for download all request
}

// Chrome Extension event messages have been moved to chrome-extension.ts

// ================================================
// Page Context Specific Messages
// ================================================

/**
 * Blob queue item interface
 */
export interface BlobQueueItem {
  blob: Blob;
  blobUrl: string;
}

/**
 * Extract Blob request message interface
 */
export interface ExtractBlobRequestMessage extends BaseMessage {
  blobUrl: string;
  blobType?: string;
  requestId?: string;
}

/**
 * Message interface sent to content script
 */
export interface SendToContentMessage extends BaseMessage {
  blobUrl: string;
  blobType: string;
  blobSize: number;
  durationMs: number;
}
