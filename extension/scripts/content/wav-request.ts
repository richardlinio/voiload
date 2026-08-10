/**
 * wav-request.ts
 * Asks the page context to re-encode one captured voice message as WAV.
 *
 * Only the page can do the work: the source Blob and AudioContext both live
 * there. The request is issued when a download is actually asked for, so no
 * message is decoded on the strength of a right-click the user may abandon.
 */

import { Logger } from "../utils/logger";
import {
  MESSAGE_ACTIONS,
  MESSAGE_SOURCES,
  MODULE_NAMES,
  WAV_REQUEST_CONSTANTS,
} from "../utils/constants";

const logger = Logger.createModuleLogger(MODULE_NAMES.CONTENT_WAV_REQUEST);

let nextRequestId = 0;

/**
 * Ask the page to re-encode the message of this duration, resolving to its WAV
 * blob URL.
 *
 * Resolves to null rather than rejecting when the page cannot convert: a voice
 * message the user can download in its original format beats one they cannot
 * download at all. A page that never answers resolves null on a timeout, so a
 * torn-down page context cannot wedge the download.
 *
 * @param durationMs - Duration of the requested message, read from the DOM
 * @returns WAV blob URL, or null when the page has no audio or conversion failed
 */
export function requestWavUrl(durationMs: number): Promise<string | null> {
  const requestId = `wav-${nextRequestId++}`;

  return new Promise((resolve) => {
    let settled = false;

    const finish = (wavUrl: string | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      resolve(wavUrl);
    };

    const onMessage = (event: MessageEvent): void => {
      if (event.source !== window) {
        return;
      }
      if (event.data?.type !== MESSAGE_SOURCES.PAGE_CONTEXT) {
        return;
      }

      const message = event.data.message;
      if (
        message?.action !== MESSAGE_ACTIONS.PREPARE_WAV_RESULT ||
        message.requestId !== requestId
      ) {
        return;
      }

      finish(message.wavUrl ?? null);
    };

    const timer = setTimeout(() => {
      logger.warn("Page context did not answer the WAV request in time", {
        durationMs,
        requestId,
      });
      finish(null);
    }, WAV_REQUEST_CONSTANTS.TIMEOUT_MS);

    window.addEventListener("message", onMessage);

    window.postMessage(
      {
        type: MESSAGE_SOURCES.CONTENT_SCRIPT,
        message: {
          action: MESSAGE_ACTIONS.PREPARE_WAV,
          durationMs,
          requestId,
        },
      },
      "*"
    );
  });
}
