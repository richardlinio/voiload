/**
 * audio-analyzer.test.ts
 * Unit tests for page-context audio-analyzer module
 */

// Mock Audio constructor first
const mockAudio = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  duration: 0,
  preload: "",
  src: "",
};

(global as any).Audio = jest.fn(() => mockAudio);

// Mock logger
const mockAudioAnalyzerLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock all dependencies before imports
jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => mockAudioAnalyzerLogger),
  },
}));

jest.mock("../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    AUDIO_ANALYZER: "audio-analyzer",
  },
  SUPPORTED_SITES: {
    CDN_PATTERNS: [
      "*://*.fbcdn.net/*",
      "*://*.cdninstagram.com/*",
      "*://*.facebook.com/*",
    ],
  },
  BLOB_MONITOR_CONSTANTS: {
    MIN_VALID_AUDIO_SIZE: 2 * 1024, // Mirrors production value (pinned in constants.test.ts)
    MAX_VALID_AUDIO_SIZE: 10485760,
  },
  WEB_REQUEST_CONSTANTS: {
    SUCCESS_STATUS_CODES: [200, 206, 304],
    AUDIO_CONTENT_TYPES: [
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav",
      "audio/webm",
    ],
  },
}));

describe("audio-analyzer", () => {
  let audioAnalyzer: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset Audio mock
    mockAudio.addEventListener.mockClear();
    mockAudio.removeEventListener.mockClear();
    mockAudio.duration = 0;
    mockAudio.preload = "";
    mockAudio.src = "";

    // Import module fresh
    delete require.cache[
      require.resolve("../../../extension/scripts/page-context/audio-analyzer")
    ];
    audioAnalyzer = require("../../../extension/scripts/page-context/audio-analyzer");
  });

  describe("module exports", () => {
    it("should export isLikelyVoiceMessage function", () => {
      expect(typeof audioAnalyzer.isLikelyVoiceMessage).toBe("function");
    });

    it("should export getAudioDuration function", () => {
      expect(typeof audioAnalyzer.getAudioDuration).toBe("function");
    });

    it("should export handleGetAudioDurationRequest function", () => {
      expect(typeof audioAnalyzer.handleGetAudioDurationRequest).toBe(
        "function"
      );
    });
  });

  describe("isLikelyVoiceMessage", () => {
    it("should return true for valid voice message request", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage(
        "https://scontent.fbcdn.net/v/t1.15752-9/audio.mp3",
        "GET",
        200,
        {
          contentType: "audio/mpeg",
          contentLength: "50000",
        }
      );

      expect(result).toBe(true);
    });

    it("should return false for empty URL", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage("", "GET", 200);
      expect(result).toBe(false);
    });

    it("should return false for non-GET requests", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage(
        "https://scontent.fbcdn.net/audio.mp3",
        "POST",
        200
      );
      expect(result).toBe(false);
    });

    it("should return false for unsuccessful status codes", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage(
        "https://scontent.fbcdn.net/audio.mp3",
        "GET",
        404
      );
      expect(result).toBe(false);
    });

    it("should return false for URLs from unknown CDNs", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage(
        "https://unknown-cdn.com/audio.mp3",
        "GET",
        200
      );
      expect(result).toBe(false);
    });

    it("should return false for non-audio content types", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage(
        "https://scontent.fbcdn.net/video.mp4",
        "GET",
        200,
        {
          contentType: "video/mp4",
        }
      );
      expect(result).toBe(false);
    });

    it("should return false for files too small", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage(
        "https://scontent.fbcdn.net/audio.mp3",
        "GET",
        200,
        {
          contentType: "audio/mpeg",
          contentLength: "500", // Below minimum
        }
      );
      expect(result).toBe(false);
    });

    it("should accept real short voice message sizes (measured e2ee values)", () => {
      // Sizes captured at runtime: 7s = 3,323 bytes, 3s = 10,543 bytes, 61s = 192,713 bytes
      const measuredSizes = ["3323", "10543", "192713"];

      measuredSizes.forEach((contentLength) => {
        const result = audioAnalyzer.isLikelyVoiceMessage(
          "https://scontent.fbcdn.net/audio.mp3",
          "GET",
          200,
          {
            contentType: "audio/mpeg",
            contentLength,
          }
        );
        expect(result).toBe(true);
      });
    });

    it("should return false for files too large", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage(
        "https://scontent.fbcdn.net/audio.mp3",
        "GET",
        200,
        {
          contentType: "audio/mpeg",
          contentLength: "20971520", // Above maximum
        }
      );
      expect(result).toBe(false);
    });

    it("should handle missing metadata gracefully", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage(
        "https://scontent.fbcdn.net/audio.mp3",
        "GET",
        200
      );
      expect(result).toBe(true);
    });

    it("should handle invalid content length", () => {
      const result = audioAnalyzer.isLikelyVoiceMessage(
        "https://scontent.fbcdn.net/audio.mp3",
        "GET",
        200,
        {
          contentType: "audio/mpeg",
          contentLength: "invalid",
        }
      );
      expect(result).toBe(true);
    });

    it("should work with different CDN patterns", () => {
      const cdnUrls = [
        "https://scontent.fbcdn.net/audio.mp3",
        "https://scontent.cdninstagram.com/audio.mp3",
        "https://www.facebook.com/audio.mp3",
      ];

      cdnUrls.forEach((url) => {
        const result = audioAnalyzer.isLikelyVoiceMessage(url, "GET", 200);
        expect(result).toBe(true);
      });
    });

    it("should work with different audio content types", () => {
      const contentTypes = [
        "audio/mpeg",
        "audio/mp4",
        "audio/ogg",
        "audio/wav",
        "audio/webm",
      ];

      contentTypes.forEach((contentType) => {
        const result = audioAnalyzer.isLikelyVoiceMessage(
          "https://scontent.fbcdn.net/audio.mp3",
          "GET",
          200,
          { contentType }
        );
        expect(result).toBe(true);
      });
    });
  });

  describe("getAudioDuration", () => {
    it("should calculate audio duration successfully", async () => {
      const testUrl = "https://test-audio.mp3";
      mockAudio.duration = 45.5;

      // Setup promise to resolve when loadedmetadata is called
      const durationPromise = audioAnalyzer.getAudioDuration(testUrl);

      // Simulate metadata loaded event
      const loadedMetadataCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "loadedmetadata"
      )[1];
      loadedMetadataCallback();

      const result = await durationPromise;

      expect(result).toBe(45500); // 45.5 seconds = 45500 ms
      expect(mockAudio.preload).toBe("metadata");
      expect(mockAudio.src).toBe("");
      expect(mockAudio.removeEventListener).toHaveBeenCalledWith(
        "loadedmetadata",
        expect.any(Function)
      );
      expect(mockAudio.removeEventListener).toHaveBeenCalledWith(
        "error",
        expect.any(Function)
      );
    });

    it("should handle audio loading errors", async () => {
      const testUrl = "https://test-audio.mp3";
      const testError = new Error("Network error");

      const durationPromise = audioAnalyzer.getAudioDuration(testUrl);

      // Simulate error event
      const errorCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "error"
      )[1];
      errorCallback({ error: testError });

      await expect(durationPromise).rejects.toThrow(
        "Error occurred while loading audio: Error: Network error"
      );
      expect(mockAudioAnalyzerLogger.error).toHaveBeenCalledWith(
        "Error occurred while loading audio",
        {
          error: testError,
          url: "https://test-audio.mp3...",
        }
      );
    });

    it("should handle error events without error details", async () => {
      const testUrl = "https://test-audio.mp3";

      const durationPromise = audioAnalyzer.getAudioDuration(testUrl);

      // Simulate error event without error details
      const errorCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "error"
      )[1];
      errorCallback({});

      await expect(durationPromise).rejects.toThrow(
        "Error occurred while loading audio: Unknown error"
      );
    });

    it("should clean up resources on success", async () => {
      const testUrl = "https://test-audio.mp3";
      mockAudio.duration = 30;

      const durationPromise = audioAnalyzer.getAudioDuration(testUrl);

      const loadedMetadataCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "loadedmetadata"
      )[1];
      loadedMetadataCallback();

      await durationPromise;

      expect(mockAudio.src).toBe("");
      expect(mockAudio.removeEventListener).toHaveBeenCalledTimes(2);
    });

    it("should clean up resources on error", async () => {
      const testUrl = "https://test-audio.mp3";

      const durationPromise = audioAnalyzer.getAudioDuration(testUrl);

      const errorCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "error"
      )[1];
      errorCallback({ error: new Error("Test error") });

      try {
        await durationPromise;
      } catch {
        // Expected to throw
      }

      expect(mockAudio.src).toBe("");
      expect(mockAudio.removeEventListener).toHaveBeenCalledTimes(2);
    });

    it("should round duration to nearest millisecond", async () => {
      const testUrl = "https://test-audio.mp3";
      mockAudio.duration = 12.3456789;

      const durationPromise = audioAnalyzer.getAudioDuration(testUrl);

      const loadedMetadataCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "loadedmetadata"
      )[1];
      loadedMetadataCallback();

      const result = await durationPromise;

      expect(result).toBe(12346); // Rounded to nearest ms
    });

    it("should log debug messages during processing", async () => {
      const testUrl = "https://very-long-url-that-should-be-truncated.mp3";
      mockAudio.duration = 25;

      const durationPromise = audioAnalyzer.getAudioDuration(testUrl);

      expect(mockAudioAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Start calculating audio duration",
        {
          url: "https://very-long-url-that-should-be-truncated.mp3...",
        }
      );

      const loadedMetadataCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "loadedmetadata"
      )[1];
      loadedMetadataCallback();

      await durationPromise;

      expect(mockAudioAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Audio duration calculation complete",
        {
          url: "https://very-long-url-that-should-be-truncated.mp3...",
          durationMs: 25000,
        }
      );
    });
  });

  describe("handleGetAudioDurationRequest", () => {
    it("should handle successful duration calculation", async () => {
      const mockMessage = {
        action: "GET_AUDIO_DURATION",
        url: "https://test-audio.mp3",
      };

      mockAudio.duration = 15;

      // Start the handler
      const resultPromise =
        audioAnalyzer.handleGetAudioDurationRequest(mockMessage);

      // Simulate successful metadata loading
      const loadedMetadataCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "loadedmetadata"
      )[1];
      loadedMetadataCallback();

      const result = await resultPromise;

      expect(result).toBe(15000);
      expect(mockAudioAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Obtained audio duration calculation result",
        { result: 15000 }
      );
    });

    it("should handle duration calculation errors", async () => {
      const mockMessage = {
        action: "GET_AUDIO_DURATION",
        url: "https://test-audio.mp3",
      };

      const resultPromise =
        audioAnalyzer.handleGetAudioDurationRequest(mockMessage);

      // Simulate error
      const errorCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "error"
      )[1];
      errorCallback({ error: new Error("Audio load failed") });

      const result = await resultPromise;

      expect(result).toBeUndefined();
      expect(mockAudioAnalyzerLogger.error).toHaveBeenCalledWith(
        "Error occurred while calculating audio duration",
        {
          error: "Error occurred while loading audio: Error: Audio load failed",
          url: "https://test-audio.mp3...",
        }
      );
    });

    it("should handle non-Error exceptions", async () => {
      const mockMessage = {
        action: "GET_AUDIO_DURATION",
        url: "https://test-audio.mp3",
      };

      const resultPromise =
        audioAnalyzer.handleGetAudioDurationRequest(mockMessage);

      // Simulate non-Error exception
      const errorCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "error"
      )[1];
      errorCallback({ error: "String error" });

      const result = await resultPromise;

      expect(result).toBeUndefined();
      expect(mockAudioAnalyzerLogger.error).toHaveBeenCalledWith(
        "Error occurred while calculating audio duration",
        {
          error: "Error occurred while loading audio: String error",
          url: "https://test-audio.mp3...",
        }
      );
    });

    it("should truncate long URLs in error logs", async () => {
      const longUrl =
        "https://very-long-cdn-url-that-exceeds-fifty-characters-limit.fbcdn.net/audio.mp3";
      const mockMessage = {
        action: "GET_AUDIO_DURATION",
        url: longUrl,
      };

      const resultPromise =
        audioAnalyzer.handleGetAudioDurationRequest(mockMessage);

      const errorCallback = mockAudio.addEventListener.mock.calls.find(
        (call) => call[0] === "error"
      )[1];
      errorCallback({ error: new Error("Test error") });

      await resultPromise;

      expect(mockAudioAnalyzerLogger.error).toHaveBeenCalledWith(
        "Error occurred while calculating audio duration",
        {
          error: expect.any(String),
          url: longUrl.substring(0, 50) + "...",
        }
      );
    });
  });
});
