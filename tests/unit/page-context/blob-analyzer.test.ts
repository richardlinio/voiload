/**
 * blob-analyzer.test.ts
 * Unit tests for page-context blob-analyzer module
 */

// Mock logger
const mockBlobAnalyzerLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock FileReader
const mockFileReader = {
  readAsDataURL: jest.fn(),
  result: null as any,
  onload: null as any,
  onerror: null as any,
};

(global as any).FileReader = jest.fn(() => mockFileReader);

// Mock fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Mock all dependencies before imports
jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => mockBlobAnalyzerLogger),
  },
}));

jest.mock("../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    BLOB_ANALYZER: "blob-analyzer",
  },
  BLOB_MONITOR_CONSTANTS: {
    POSSIBLE_AUDIO_TYPES: [
      "audio/mpeg",
      "audio/mp4",
      "audio/ogg",
      "audio/wav",
      "audio/webm",
    ],
    MIN_VALID_AUDIO_SIZE: 2 * 1024, // Mirrors production value (pinned in constants.test.ts)
    MAX_VALID_AUDIO_SIZE: 10485760,
  },
}));

describe("blob-analyzer", () => {
  let blobAnalyzer: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset FileReader mock
    mockFileReader.readAsDataURL.mockClear();
    mockFileReader.result = null;
    mockFileReader.onload = null;
    mockFileReader.onerror = null;

    // Reset fetch mock
    mockFetch.mockClear();

    // Import module fresh
    delete require.cache[
      require.resolve("../../../extension/scripts/page-context/blob-analyzer")
    ];
    blobAnalyzer = require("../../../extension/scripts/page-context/blob-analyzer");
  });

  describe("module exports", () => {
    it("should export extractBlobContent function", () => {
      expect(typeof blobAnalyzer.extractBlobContent).toBe("function");
    });

    it("should export isLikelyVoiceMessageBlob function", () => {
      expect(typeof blobAnalyzer.isLikelyVoiceMessageBlob).toBe("function");
    });
  });

  describe("extractBlobContent", () => {
    it("should successfully extract blob content", async () => {
      const testBlobUrl = "blob:test-url";
      const mockBlob = {
        type: "audio/mpeg",
        size: 5000,
      };
      const base64Data = "dGVzdCBhdWRpbyBkYXRh"; // "test audio data" in base64

      // Mock fetch response
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      // Mock FileReader
      mockFileReader.result = `data:audio/mpeg;base64,${base64Data}`;

      // Start the extraction
      const extractPromise = blobAnalyzer.extractBlobContent(testBlobUrl);

      // Simulate FileReader success
      setTimeout(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload();
        }
      }, 0);

      const result = await extractPromise;

      expect(result).toEqual({
        base64data: base64Data,
        blobType: "audio/mpeg",
        blobSize: 5000,
      });

      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Start extracting blob content",
        { blobUrl: testBlobUrl }
      );
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Successfully fetched blob",
        {
          blobType: "audio/mpeg",
          blobSize: 5000,
        }
      );
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Successfully converted blob to base64",
        {
          dataLength: base64Data.length,
        }
      );
    });

    it("should handle fetch errors", async () => {
      const testBlobUrl = "blob:test-url";

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(
        blobAnalyzer.extractBlobContent(testBlobUrl)
      ).rejects.toThrow("Failed to fetch blob content: 404 Not Found");

      expect(mockBlobAnalyzerLogger.error).toHaveBeenCalledWith(
        "Error extracting blob content",
        { error: expect.any(Error) }
      );
    });

    it("should handle network fetch errors", async () => {
      const testBlobUrl = "blob:test-url";
      const networkError = new Error("Network error");

      mockFetch.mockRejectedValue(networkError);

      await expect(
        blobAnalyzer.extractBlobContent(testBlobUrl)
      ).rejects.toThrow("Network error");

      expect(mockBlobAnalyzerLogger.error).toHaveBeenCalledWith(
        "Error extracting blob content",
        { error: networkError }
      );
    });

    it("should handle FileReader errors", async () => {
      const testBlobUrl = "blob:test-url";
      const mockBlob = {
        type: "audio/mpeg",
        size: 5000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const extractPromise = blobAnalyzer.extractBlobContent(testBlobUrl);

      // Simulate FileReader error
      setTimeout(() => {
        if (mockFileReader.onerror) {
          mockFileReader.onerror();
        }
      }, 0);

      await expect(extractPromise).rejects.toThrow(
        "Failed to read blob content"
      );
    });

    it("should handle non-string FileReader result", async () => {
      const testBlobUrl = "blob:test-url";
      const mockBlob = {
        type: "audio/mpeg",
        size: 5000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      mockFileReader.result = new ArrayBuffer(8); // Non-string result

      const extractPromise = blobAnalyzer.extractBlobContent(testBlobUrl);

      setTimeout(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload();
        }
      }, 0);

      await expect(extractPromise).rejects.toThrow(
        "FileReader result is not a string"
      );

      expect(mockBlobAnalyzerLogger.error).toHaveBeenCalledWith(
        "Error processing base64 data",
        { error: expect.any(Error) }
      );
    });

    it("should handle invalid base64 data", async () => {
      const testBlobUrl = "blob:test-url";
      const mockBlob = {
        type: "audio/mpeg",
        size: 5000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      mockFileReader.result = "data:audio/mpeg;base64,"; // No actual base64 data

      const extractPromise = blobAnalyzer.extractBlobContent(testBlobUrl);

      setTimeout(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload();
        }
      }, 0);

      await expect(extractPromise).rejects.toThrow(
        "Failed to get valid base64 data"
      );
    });

    it("should handle malformed data URL", async () => {
      const testBlobUrl = "blob:test-url";
      const mockBlob = {
        type: "audio/mpeg",
        size: 5000,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      mockFileReader.result = "invalid-data-url"; // No comma separator

      const extractPromise = blobAnalyzer.extractBlobContent(testBlobUrl);

      setTimeout(() => {
        if (mockFileReader.onload) {
          mockFileReader.onload();
        }
      }, 0);

      await expect(extractPromise).rejects.toThrow(
        "Failed to get valid base64 data"
      );
    });

    it("should handle blob conversion errors", async () => {
      const testBlobUrl = "blob:test-url";

      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.reject(new Error("Blob conversion failed")),
      });

      await expect(
        blobAnalyzer.extractBlobContent(testBlobUrl)
      ).rejects.toThrow("Blob conversion failed");
    });
  });

  describe("isLikelyVoiceMessageBlob", () => {
    it("should return true for valid audio blob", () => {
      const mockBlob = {
        type: "audio/mpeg",
        size: 50000,
      } as Blob;

      const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);

      expect(result).toBe(true);
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Evaluating if Blob is an audio file",
        {
          blobType: "audio/mpeg",
          blobSize: 50000,
        }
      );
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Blob meets the basic conditions for an audio file"
      );
    });

    it("should return false for null blob", () => {
      const result = blobAnalyzer.isLikelyVoiceMessageBlob(null);

      expect(result).toBe(false);
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Blob does not exist or lacks basic info"
      );
    });

    it("should return false for blob without type", () => {
      const mockBlob = {
        type: "",
        size: 50000,
      } as Blob;

      const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);

      expect(result).toBe(false);
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Blob does not exist or lacks basic info"
      );
    });

    it("should return false for blob without size", () => {
      const mockBlob = {
        type: "audio/mpeg",
        size: 0,
      } as Blob;

      const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);

      expect(result).toBe(false);
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Blob does not exist or lacks basic info"
      );
    });

    it("should return false for non-audio blob types", () => {
      const mockBlob = {
        type: "video/mp4",
        size: 50000,
      } as Blob;

      const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);

      expect(result).toBe(false);
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Blob type is not in the list of possible audio types"
      );
    });

    it("should return false for blob too small", () => {
      const mockBlob = {
        type: "audio/mpeg",
        size: 500, // Below minimum size
      } as Blob;

      const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);

      expect(result).toBe(false);
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Blob size is too small"
      );
    });

    it("should return false for blob too large", () => {
      const mockBlob = {
        type: "audio/mpeg",
        size: 20971520, // Above maximum size
      } as Blob;

      const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);

      expect(result).toBe(false);
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Blob size is too large"
      );
    });

    it("should work with all supported audio types", () => {
      const audioTypes = [
        "audio/mpeg",
        "audio/mp4",
        "audio/ogg",
        "audio/wav",
        "audio/webm",
      ];

      audioTypes.forEach((type) => {
        const mockBlob = {
          type: type,
          size: 50000,
        } as Blob;

        const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);
        expect(result).toBe(true);
      });
    });

    it("should handle partial type matching", () => {
      const mockBlob = {
        type: "audio/mpeg; codecs=mp3",
        size: 50000,
      } as Blob;

      const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);

      expect(result).toBe(true);
    });

    it("should return false for text blob types", () => {
      const mockBlob = {
        type: "text/plain",
        size: 50000,
      } as Blob;

      const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);

      expect(result).toBe(false);
    });

    it("should return false for image blob types", () => {
      const mockBlob = {
        type: "image/jpeg",
        size: 50000,
      } as Blob;

      const result = blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob);

      expect(result).toBe(false);
    });

    it("should handle edge case sizes", () => {
      // Test minimum valid size
      const minSizeBlob = {
        type: "audio/mpeg",
        size: 2049, // Just above minimum
      } as Blob;

      expect(blobAnalyzer.isLikelyVoiceMessageBlob(minSizeBlob)).toBe(true);

      // Test maximum valid size
      const maxSizeBlob = {
        type: "audio/mpeg",
        size: 10485759, // Just below maximum
      } as Blob;

      expect(blobAnalyzer.isLikelyVoiceMessageBlob(maxSizeBlob)).toBe(true);
    });

    // Fixtures measured from real messenger.com e2ee voice messages
    // (blob sizes captured at runtime: 7s = 3,323 bytes, 3s = 10,543 bytes, 61s = 192,713 bytes)
    it("should accept real short voice message blobs (measured e2ee audio/ogg sizes)", () => {
      const measuredSizes = [3323, 10543, 192713];

      measuredSizes.forEach((size) => {
        const mockBlob = {
          type: "audio/ogg",
          size,
        } as Blob;

        expect(blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob)).toBe(true);
      });
    });

    it("should reject sub-1KB blobs as noise", () => {
      const mockBlob = {
        type: "audio/ogg",
        size: 1000,
      } as Blob;

      expect(blobAnalyzer.isLikelyVoiceMessageBlob(mockBlob)).toBe(false);
      expect(mockBlobAnalyzerLogger.debug).toHaveBeenCalledWith(
        "Blob size is too small"
      );
    });
  });
});
