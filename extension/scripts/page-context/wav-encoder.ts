/**
 * wav-encoder.ts
 * Re-packages decoded audio as PCM WAV.
 *
 * Facebook serves voice messages as opus in an ogg container, which Windows and
 * macOS refuse to play on a double-click and whose duration many players
 * mis-estimate from the bitrate. Decoding to PCM and writing a WAV header makes
 * the download play anywhere and read its length from the header.
 */

import { Logger } from "../utils/logger";
import { MODULE_NAMES, WAV_CONSTANTS } from "../utils/constants";

const logger = Logger.createModuleLogger(MODULE_NAMES.WAV_ENCODER);

/**
 * Write an ASCII string into a DataView. WAV chunk identifiers are ASCII, so
 * charCodeAt maps one character to one byte.
 */
function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Convert a float sample in [-1, 1] to signed 16-bit PCM.
 *
 * The positive and negative ranges are scaled by different factors because
 * two's-complement int16 is asymmetric: -32768..32767. Using 0x8000 for both
 * would clip +1.0 to -32768.
 */
function floatToPcm16(sample: number): number {
  const clamped = Math.max(-1, Math.min(1, sample));
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
}

/**
 * Encode an AudioBuffer as a PCM WAV (RIFF) ArrayBuffer.
 *
 * The buffer's own sample rate and channel count are preserved; no resampling
 * or downmixing is performed, so the output is sample-exact with what the
 * decoder produced.
 *
 * @param audioBuffer - Decoded audio
 * @returns RIFF/WAVE bytes, ready to wrap in a Blob
 */
export function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const frameCount = audioBuffer.length;

  const bytesPerSample = WAV_CONSTANTS.BITS_PER_SAMPLE / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = frameCount * blockAlign;

  const buffer = new ArrayBuffer(WAV_CONSTANTS.HEADER_SIZE + dataSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, WAV_CONSTANTS.HEADER_SIZE - 8 + dataSize, true);
  writeAscii(view, 8, "WAVE");

  // fmt sub-chunk
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk body is 16 bytes
  view.setUint16(20, WAV_CONSTANTS.FORMAT_PCM, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, WAV_CONSTANTS.BITS_PER_SAMPLE, true);

  // data sub-chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Channel data is planar in an AudioBuffer but interleaved in a WAV.
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  let offset = WAV_CONSTANTS.HEADER_SIZE;
  for (let frame = 0; frame < frameCount; frame++) {
    for (let c = 0; c < numChannels; c++) {
      view.setInt16(offset, floatToPcm16(channels[c]![frame]!), true);
      offset += bytesPerSample;
    }
  }

  return buffer;
}

/**
 * Decode compressed audio and re-encode it as a PCM WAV Blob.
 *
 * Callers treat a null return as "keep the original blob": a voice message the
 * user can download in its original format beats one they cannot download at all.
 *
 * @param blob - Source audio blob (opus/ogg as served by Facebook)
 * @returns WAV blob, or null when the audio cannot be decoded or re-encoded
 */
export async function convertBlobToWav(blob: Blob): Promise<Blob | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer();

    // decodeAudioData detaches the ArrayBuffer it is handed, so callers that
    // still need the original bytes must pass a copy. Here the copy is the
    // caller's own read, so it can be handed over directly.
    const audioContext = new AudioContext();
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } finally {
      void audioContext.close();
    }

    const wavBytes = encodeWav(audioBuffer);
    const wavBlob = new Blob([wavBytes], { type: WAV_CONSTANTS.MIME_TYPE });

    logger.debug("Converted audio blob to WAV", {
      sourceType: blob.type,
      sourceBytes: blob.size,
      wavBytes: wavBlob.size,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
    });

    return wavBlob;
  } catch (error) {
    // Decoding fails on corrupt audio, unsupported codecs, or a page that has
    // already revoked the blob. The caller falls back to the original file.
    logger.warn("WAV conversion failed, keeping original audio", {
      error: error instanceof Error ? error.message : String(error),
      sourceType: blob.type,
      sourceBytes: blob.size,
    });
    return null;
  }
}
