/**
 * download-url.ts
 * Chooses which of a voice message's stored URLs to download, and under what
 * file extension.
 *
 * Kept free of store and logger imports so both the data store and the download
 * manager can share it without pulling one another in.
 */

import type { VoiceMessageItem } from "../types/voice-message";

import { DOWNLOAD_CONSTANTS } from "./constants";

/**
 * Result of choosing a download URL for a stored voice message.
 */
export interface SelectedDownloadUrl {
  url: string | null;
  /** True when url points at the WAV re-encoding rather than the original audio. */
  isWav: boolean;
}

/**
 * Map a MIME type to the file extension its container uses.
 *
 * @param mimeType - MIME type of the audio, if known
 * @returns File extension including the leading dot
 */
export function getFileExtensionForMimeType(
  mimeType: string | null | undefined
): string {
  if (!mimeType) {
    // The webRequest path registers a CDN URL without ever reading the body, so
    // nothing is known about the container. Facebook serves those as MP4.
    return DOWNLOAD_CONSTANTS.UNKNOWN_EXTENSION;
  }
  if (mimeType.includes("audio/wav")) {
    return DOWNLOAD_CONSTANTS.WAV_EXTENSION;
  }
  if (mimeType.includes("audio/ogg")) {
    return DOWNLOAD_CONSTANTS.OGG_EXTENSION;
  }
  if (mimeType.includes("audio/mpeg") || mimeType.includes("audio/mp3")) {
    return ".mp3";
  }
  if (mimeType.includes("audio/mp4") || mimeType.includes("video/mp4")) {
    return DOWNLOAD_CONSTANTS.UNKNOWN_EXTENSION;
  }
  if (mimeType.includes("audio/aac")) {
    return ".aac";
  }
  return DOWNLOAD_CONSTANTS.UNKNOWN_EXTENSION;
}

/**
 * Pick the URL to download for an item, preferring the WAV re-encoding.
 *
 * The original audio is kept as a fallback: a conversion can fail (corrupt
 * audio, an unsupported codec, a revoked blob), and downloading the original
 * beats downloading nothing.
 *
 * @param item - Stored voice message item
 * @returns The chosen URL and whether it is the WAV re-encoding
 */
export function selectDownloadUrl(item: VoiceMessageItem): SelectedDownloadUrl {
  if (item.wavUrl) {
    return { url: item.wavUrl, isWav: true };
  }
  return { url: item.downloadUrl, isWav: false };
}

/**
 * Choose the file extension for a download.
 *
 * Only audio the extension re-encoded may be named .wav; everything else keeps
 * the extension of the container it was actually served in. Naming un-converted
 * audio .wav produces a file no player can open.
 *
 * @param isWav - Whether the chosen URL is the WAV re-encoding
 * @param sourceMimeType - MIME type of the original audio, when known
 * @returns File extension including the leading dot
 */
export function selectDownloadExtension(
  isWav: boolean,
  sourceMimeType?: string | null
): string {
  return isWav
    ? DOWNLOAD_CONSTANTS.WAV_EXTENSION
    : getFileExtensionForMimeType(sourceMimeType);
}
