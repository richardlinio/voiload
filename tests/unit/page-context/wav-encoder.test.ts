/**
 * wav-encoder.test.ts
 * Unit tests for the PCM WAV encoder used to re-package captured voice messages.
 *
 * Header offsets are asserted against the RIFF/WAVE layout rather than against
 * a golden file, so a wrong field is reported by name instead of as a diff.
 */

const mockWavEncoderLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => mockWavEncoderLogger),
  },
}));

import { encodeWav, convertBlobToWav } from "../../../extension/scripts/page-context/wav-encoder";

/** Minimal AudioBuffer stand-in: jsdom has no Web Audio implementation. */
function fakeAudioBuffer(
  channels: Float32Array[],
  sampleRate: number
): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0]!.length,
    duration: channels[0]!.length / sampleRate,
    getChannelData: (i: number) => channels[i]!,
  } as unknown as AudioBuffer;
}

const ascii = (view: DataView, offset: number, length: number): string =>
  Array.from({ length }, (_, i) =>
    String.fromCharCode(view.getUint8(offset + i))
  ).join("");

describe("wav-encoder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("encodeWav header", () => {
    // Mono 48kHz matches what Facebook serves and what decodeAudioData returns.
    const SAMPLE_RATE = 48000;
    const FRAMES = 100;

    let view: DataView;
    let buffer: ArrayBuffer;

    beforeEach(() => {
      const samples = new Float32Array(FRAMES);
      buffer = encodeWav(fakeAudioBuffer([samples], SAMPLE_RATE));
      view = new DataView(buffer);
    });

    it("writes the RIFF/WAVE magic", () => {
      expect(ascii(view, 0, 4)).toBe("RIFF");
      expect(ascii(view, 8, 4)).toBe("WAVE");
    });

    it("declares an uncompressed PCM fmt chunk", () => {
      expect(ascii(view, 12, 4)).toBe("fmt ");
      expect(view.getUint32(16, true)).toBe(16); // fmt body size for PCM
      expect(view.getUint16(20, true)).toBe(1); // format tag: PCM
      expect(view.getUint16(34, true)).toBe(16); // bits per sample
    });

    it("records the source sample rate and channel count", () => {
      expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
      expect(view.getUint16(22, true)).toBe(1);
    });

    it("derives byte rate and block align from the format", () => {
      const blockAlign = 1 * 2; // mono, 16-bit
      expect(view.getUint16(32, true)).toBe(blockAlign);
      expect(view.getUint32(28, true)).toBe(SAMPLE_RATE * blockAlign);
    });

    it("sizes the data chunk to the sample payload", () => {
      const dataSize = FRAMES * 1 * 2;
      expect(ascii(view, 36, 4)).toBe("data");
      expect(view.getUint32(40, true)).toBe(dataSize);
      // RIFF size counts everything after the first 8 bytes.
      expect(view.getUint32(4, true)).toBe(36 + dataSize);
      expect(buffer.byteLength).toBe(44 + dataSize);
    });

    it("sizes a stereo buffer by channel count", () => {
      const left = new Float32Array(FRAMES);
      const right = new Float32Array(FRAMES);
      const stereo = encodeWav(fakeAudioBuffer([left, right], SAMPLE_RATE));
      const stereoView = new DataView(stereo);

      expect(stereoView.getUint16(22, true)).toBe(2);
      expect(stereoView.getUint16(32, true)).toBe(4); // 2ch * 2 bytes
      expect(stereoView.getUint32(40, true)).toBe(FRAMES * 2 * 2);
    });
  });

  describe("encodeWav samples", () => {
    it("scales full-scale samples to the int16 range without wrapping", () => {
      // int16 is asymmetric (-32768..32767); using one scale factor for both
      // signs would wrap +1.0 around to -32768.
      const samples = new Float32Array([1, -1, 0]);
      const view = new DataView(encodeWav(fakeAudioBuffer([samples], 48000)));

      expect(view.getInt16(44, true)).toBe(32767);
      expect(view.getInt16(46, true)).toBe(-32768);
      expect(view.getInt16(48, true)).toBe(0);
    });

    it("clamps samples beyond [-1, 1] instead of overflowing", () => {
      const samples = new Float32Array([2, -2]);
      const view = new DataView(encodeWav(fakeAudioBuffer([samples], 48000)));

      expect(view.getInt16(44, true)).toBe(32767);
      expect(view.getInt16(46, true)).toBe(-32768);
    });

    it("interleaves channels frame by frame", () => {
      const left = new Float32Array([1, 0]);
      const right = new Float32Array([0, -1]);
      const view = new DataView(encodeWav(fakeAudioBuffer([left, right], 48000)));

      // frame 0: L, R ; frame 1: L, R
      expect(view.getInt16(44, true)).toBe(32767);
      expect(view.getInt16(46, true)).toBe(0);
      expect(view.getInt16(48, true)).toBe(0);
      expect(view.getInt16(50, true)).toBe(-32768);
    });
  });

  describe("convertBlobToWav", () => {
    const originalAudioContext = (global as any).AudioContext;

    afterEach(() => {
      (global as any).AudioContext = originalAudioContext;
    });

    /** Install an AudioContext whose decodeAudioData behaves as specified. */
    function stubAudioContext(
      decode: (ab: ArrayBuffer) => Promise<AudioBuffer>
    ): { close: jest.Mock } {
      const close = jest.fn();
      (global as any).AudioContext = jest.fn(() => ({
        decodeAudioData: decode,
        close,
      }));
      return { close };
    }

    /** A Blob whose arrayBuffer() resolves, which jsdom's Blob does not do. */
    function fakeBlob(type: string, size: number): Blob {
      return {
        type,
        size,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(size)),
      } as unknown as Blob;
    }

    it("returns a WAV blob when the audio decodes", async () => {
      const samples = new Float32Array(48);
      stubAudioContext(() =>
        Promise.resolve(fakeAudioBuffer([samples], 48000))
      );

      const result = await convertBlobToWav(fakeBlob("audio/ogg", 3323));

      expect(result).not.toBeNull();
      expect(result!.type).toBe("audio/wav");
      expect(result!.size).toBe(44 + 48 * 2);
    });

    it("returns null when the audio cannot be decoded", async () => {
      stubAudioContext(() => Promise.reject(new Error("unsupported codec")));

      const result = await convertBlobToWav(fakeBlob("audio/ogg", 3323));

      // Null means "download the original": a file in the wrong container beats
      // no file at all.
      expect(result).toBeNull();
      expect(mockWavEncoderLogger.warn).toHaveBeenCalledWith(
        "WAV conversion failed, keeping original audio",
        expect.objectContaining({ error: "unsupported codec" })
      );
    });

    it("closes the AudioContext even when decoding throws", async () => {
      const { close } = stubAudioContext(() =>
        Promise.reject(new Error("boom"))
      );

      await convertBlobToWav(fakeBlob("audio/ogg", 3323));

      // Each capture builds a context; leaking them exhausts the browser's
      // limited pool and later conversions start failing.
      expect(close).toHaveBeenCalled();
    });
  });
});
