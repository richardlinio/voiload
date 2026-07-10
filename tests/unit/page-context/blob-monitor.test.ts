/**
 * blob-monitor.test.ts
 * Unit tests for page-context blob-monitor module
 */

// Mock chrome runtime first
const mockBlobMonitorChrome = {
  runtime: {
    sendMessage: jest.fn(),
  },
};
(global as any).chrome = mockBlobMonitorChrome;

// Mock window.sendToContent
const mockSendToContent = jest.fn();
(global as any).window = {
  sendToContent: mockSendToContent,
};

// Mock logger
const mockBlobMonitorLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock setInterval
const mockSetInterval = jest.fn();
(global as any).setInterval = mockSetInterval;

// Mock blob analyzer functions
const mockIsLikelyVoiceMessageBlob = jest.fn();
const mockExtractBlobContent = jest.fn();

// Mock audio analyzer functions
const mockGetAudioDuration = jest.fn();

// Mock WAV encoder
const mockConvertBlobToWav = jest.fn();

// Mock all dependencies before imports
jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => mockBlobMonitorLogger),
  },
}));

jest.mock("../../../extension/scripts/utils/constants", () => ({
  MESSAGE_ACTIONS: {
    REGISTER_BLOB_URL: "REGISTER_BLOB_URL",
  },
  MODULE_NAMES: {
    BLOB_MONITOR: "blob-monitor",
  },
  BLOB_MONITOR_CONSTANTS: {
    PERIODIC_CLEANUP_INTERVAL: 30000,
  },
}));

jest.mock("../../../extension/scripts/page-context/blob-analyzer", () => ({
  isLikelyVoiceMessageBlob: mockIsLikelyVoiceMessageBlob,
  extractBlobContent: mockExtractBlobContent,
}));

jest.mock("../../../extension/scripts/page-context/audio-analyzer", () => ({
  getAudioDuration: mockGetAudioDuration,
}));

jest.mock("../../../extension/scripts/page-context/wav-encoder", () => ({
  convertBlobToWav: mockConvertBlobToWav,
}));

describe("blob-monitor", () => {
  let blobMonitor: any;
  let originalCreateObjectURL: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks
    mockSendToContent.mockClear();
    mockBlobMonitorChrome.runtime.sendMessage.mockClear();
    mockIsLikelyVoiceMessageBlob.mockClear();
    mockExtractBlobContent.mockClear();
    mockGetAudioDuration.mockClear();
    mockSetInterval.mockClear();
    mockConvertBlobToWav.mockReset();
    // Default: conversion fails, so tests that do not care about WAV see the
    // original blob URL flow through unchanged.
    mockConvertBlobToWav.mockResolvedValue(null);

    // Save original URL.createObjectURL
    originalCreateObjectURL = URL.createObjectURL;

    // Mock URL.createObjectURL if it doesn't exist
    if (!URL.createObjectURL) {
      URL.createObjectURL = jest.fn(() => "blob:mock-url-" + Math.random());
    }

    // Import module fresh
    delete require.cache[
      require.resolve("../../../extension/scripts/page-context/blob-monitor")
    ];
    blobMonitor = require("../../../extension/scripts/page-context/blob-monitor");
  });

  afterEach(() => {
    // Restore original URL.createObjectURL
    if (originalCreateObjectURL) {
      URL.createObjectURL = originalCreateObjectURL;
    }
  });

  describe("module exports", () => {
    it("should export setupBlobUrlMonitor function", () => {
      expect(typeof blobMonitor.setupBlobUrlMonitor).toBe("function");
    });


    it("should export initBlobMonitor function", () => {
      expect(typeof blobMonitor.initBlobMonitor).toBe("function");
    });
  });

  describe("setupBlobUrlMonitor", () => {
    it("should monkey-patch URL.createObjectURL", () => {
      const originalMethod = URL.createObjectURL;

      blobMonitor.setupBlobUrlMonitor();

      expect(URL.createObjectURL).not.toBe(originalMethod);
      expect(mockBlobMonitorLogger.info).toHaveBeenCalledWith(
        "Setting up Blob URL monitor"
      );
      expect(mockBlobMonitorLogger.info).toHaveBeenCalledWith(
        "Blob URL monitor set up"
      );
    });

    it("should process valid audio blobs", () => {
      blobMonitor.setupBlobUrlMonitor();

      const mockBlob = new Blob(["test"], { type: "audio/mpeg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);

      const result = URL.createObjectURL(mockBlob);

      expect(result).toMatch(/^blob:/);
      expect(mockIsLikelyVoiceMessageBlob).toHaveBeenCalledWith(mockBlob);
      expect(mockBlobMonitorLogger.debug).toHaveBeenCalledWith(
        "Added blob URL to processing queue",
        { queueLength: 1 }
      );
    });

    it("should ignore non-audio blobs", () => {
      blobMonitor.setupBlobUrlMonitor();

      const mockBlob = new Blob(["test"], { type: "text/plain" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(false);

      const result = URL.createObjectURL(mockBlob);

      expect(result).toMatch(/^blob:/);
      expect(mockIsLikelyVoiceMessageBlob).toHaveBeenCalledWith(mockBlob);
      expect(mockBlobMonitorLogger.debug).not.toHaveBeenCalledWith(
        "Added blob URL to processing queue",
        expect.any(Object)
      );
    });

    it("should handle MediaSource objects", () => {
      blobMonitor.setupBlobUrlMonitor();

      const mockMediaSource = {} as MediaSource;

      const result = URL.createObjectURL(mockMediaSource);

      expect(result).toMatch(/^blob:/);
      expect(mockIsLikelyVoiceMessageBlob).not.toHaveBeenCalled();
    });

    it("should handle errors during blob processing", () => {
      blobMonitor.setupBlobUrlMonitor();

      const mockBlob = new Blob(["test"], { type: "audio/mpeg" });
      mockIsLikelyVoiceMessageBlob.mockImplementation(() => {
        throw new Error("Processing error");
      });

      const result = URL.createObjectURL(mockBlob);

      expect(result).toMatch(/^blob:/);
      expect(mockBlobMonitorLogger.error).toHaveBeenCalledWith(
        "Error processing blob URL",
        { error: expect.any(Error) }
      );
    });
  });

  describe("blob processing queue", () => {
    beforeEach(() => {
      blobMonitor.setupBlobUrlMonitor();
    });

    it("should process blobs sequentially", async () => {
      const mockBlob = new Blob(["test"], { type: "audio/mpeg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);
      mockGetAudioDuration.mockResolvedValue(5000);

      // Call URL.createObjectURL to trigger the blob processing
      const blobUrl = URL.createObjectURL(mockBlob);

      // Check that it was added to queue
      expect(mockBlobMonitorLogger.debug).toHaveBeenCalledWith(
        "Added blob URL to processing queue",
        { queueLength: 1 }
      );

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify the audio duration was calculated
      expect(mockGetAudioDuration).toHaveBeenCalledWith(blobUrl);
    });

    it("should handle audio duration calculation errors", async () => {
      const mockBlob = new Blob(["test"], { type: "audio/mpeg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);
      mockGetAudioDuration.mockRejectedValue(new Error("Duration error"));

      URL.createObjectURL(mockBlob);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockBlobMonitorLogger.error).toHaveBeenCalledWith(
        "Error processing blob in queue",
        { error: expect.any(Error) }
      );
    });

    it("should not process the same blob twice", () => {
      const mockBlob = new Blob(["test"], { type: "audio/mpeg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);

      // First call should process
      URL.createObjectURL(mockBlob);
      expect(mockBlobMonitorLogger.debug).toHaveBeenCalledWith(
        "Added blob URL to processing queue",
        { queueLength: 1 }
      );

      mockBlobMonitorLogger.debug.mockClear();

      // Second call with same blob should not process
      URL.createObjectURL(mockBlob);
      expect(mockBlobMonitorLogger.debug).not.toHaveBeenCalledWith(
        "Added blob URL to processing queue",
        expect.any(Object)
      );
    });

    it("should handle blobs without type", () => {
      const mockBlob = new Blob(["test"]);
      mockIsLikelyVoiceMessageBlob.mockReturnValue(false);

      URL.createObjectURL(mockBlob);

      expect(mockIsLikelyVoiceMessageBlob).not.toHaveBeenCalled();
    });
  });


  describe("initBlobMonitor", () => {
    it("should initialize blob monitor successfully", () => {
      blobMonitor.initBlobMonitor();

      expect(mockBlobMonitorLogger.info).toHaveBeenCalledWith(
        "Starting initialization of Blob monitor module"
      );
      expect(mockBlobMonitorLogger.info).toHaveBeenCalledWith(
        "Setting up Blob URL monitor"
      );
      expect(mockBlobMonitorLogger.info).toHaveBeenCalledWith(
        "Blob URL monitor set up"
      );
      expect(mockBlobMonitorLogger.info).toHaveBeenCalledWith(
        "Blob monitor module initialized"
      );
      expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it("should handle initialization errors", () => {
      // Create a fresh module to test error handling
      delete require.cache[
        require.resolve("../../../extension/scripts/page-context/blob-monitor")
      ];

      // Mock setInterval to throw error
      const originalSetInterval = global.setInterval;
      global.setInterval = jest.fn(() => {
        throw new Error("Setup failed");
      });

      const testBlobMonitor = require("../../../extension/scripts/page-context/blob-monitor");

      testBlobMonitor.initBlobMonitor();

      expect(mockBlobMonitorLogger.error).toHaveBeenCalledWith(
        "Error initializing Blob monitor module",
        { error: expect.any(Error) }
      );

      // Restore original function
      global.setInterval = originalSetInterval;
    });
  });

  describe("registration with backend", () => {
    beforeEach(() => {
      blobMonitor.setupBlobUrlMonitor();
    });

    it("should register blob with backend when sendToContent is available", async () => {
      const mockBlob = new Blob(["test"], { type: "audio/mpeg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);
      mockGetAudioDuration.mockResolvedValue(3000);

      // Trigger blob processing
      const blobUrl = URL.createObjectURL(mockBlob);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that duration was calculated
      expect(mockGetAudioDuration).toHaveBeenCalledWith(blobUrl);

      // Check that logging occurred
      expect(mockBlobMonitorLogger.info).toHaveBeenCalledWith(
        "Sent blob url registration info to content script",
        expect.objectContaining({
          blobType: "audio/mpeg",
          blobSizeBytes: 4,
          durationMs: 3000,
        })
      );
    });

    it("should handle missing sendToContent function", async () => {
      // Remove sendToContent from window
      delete (global as any).window.sendToContent;

      const mockBlob = new Blob(["test"], { type: "audio/mpeg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);
      mockGetAudioDuration.mockResolvedValue(3000);

      URL.createObjectURL(mockBlob);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should still log the registration
      expect(mockBlobMonitorLogger.info).toHaveBeenCalledWith(
        "Sent blob url registration info to content script",
        expect.any(Object)
      );

      // Restore sendToContent
      (global as any).window.sendToContent = mockSendToContent;
    });

    it("should send the converted WAV url alongside the original blob url", async () => {
      const mockBlob = new Blob(["test"], { type: "audio/ogg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);
      mockGetAudioDuration.mockResolvedValue(3000);
      mockConvertBlobToWav.mockResolvedValue(
        new Blob(["wav"], { type: "audio/wav" })
      );

      const blobUrl = URL.createObjectURL(mockBlob);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockConvertBlobToWav).toHaveBeenCalledWith(mockBlob);
      expect(mockSendToContent).toHaveBeenCalledWith(
        expect.objectContaining({
          blobUrl,
          durationMs: 3000,
          wavUrl: expect.stringMatching(/^blob:/),
        })
      );

      // The original audio is kept as the download fallback, so the two URLs
      // must be distinct handles rather than the same blob.
      const sent = mockSendToContent.mock.calls[0]![0];
      expect(sent.wavUrl).not.toBe(sent.blobUrl);
    });

    it("should send a null wavUrl when conversion fails", async () => {
      const mockBlob = new Blob(["test"], { type: "audio/ogg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);
      mockGetAudioDuration.mockResolvedValue(3000);
      mockConvertBlobToWav.mockResolvedValue(null);

      const blobUrl = URL.createObjectURL(mockBlob);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Registration still happens: the user can download the original audio.
      expect(mockSendToContent).toHaveBeenCalledWith(
        expect.objectContaining({ blobUrl, wavUrl: null })
      );
    });

    it("should measure duration from the original audio, not the WAV", async () => {
      const mockBlob = new Blob(["test"], { type: "audio/ogg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);
      mockGetAudioDuration.mockResolvedValue(6757);
      mockConvertBlobToWav.mockResolvedValue(
        new Blob(["wav"], { type: "audio/wav" })
      );

      const blobUrl = URL.createObjectURL(mockBlob);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // decodeAudioData strips opus pre-skip samples, so a duration taken from
      // the WAV would be ~7ms short and drift past EXACT_MATCHING_TOLERANCE.
      expect(mockGetAudioDuration).toHaveBeenCalledTimes(1);
      expect(mockGetAudioDuration).toHaveBeenCalledWith(blobUrl);
      expect(mockSendToContent).toHaveBeenCalledWith(
        expect.objectContaining({ durationMs: 6757 })
      );
    });

    it("should not re-enqueue the WAV blob it just created", async () => {
      const mockBlob = new Blob(["test"], { type: "audio/ogg" });
      // A WAV blob would pass this predicate too (audio MIME, plausible size),
      // so publishing it through the patched createObjectURL would loop forever.
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);
      mockGetAudioDuration.mockResolvedValue(3000);
      mockConvertBlobToWav.mockResolvedValue(
        new Blob(["wav"], { type: "audio/wav" })
      );

      URL.createObjectURL(mockBlob);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Exactly one audio blob was analysed and converted: the source. The WAV
      // never re-entered the queue.
      expect(mockConvertBlobToWav).toHaveBeenCalledTimes(1);
      expect(mockGetAudioDuration).toHaveBeenCalledTimes(1);
      expect(mockSendToContent).toHaveBeenCalledTimes(1);
    });

    it("should truncate long blob URLs in logs", async () => {
      const mockBlob = new Blob(["test"], { type: "audio/mpeg" });
      mockIsLikelyVoiceMessageBlob.mockReturnValue(true);
      mockGetAudioDuration.mockResolvedValue(2000);

      // Create a blob URL that will be truncated in logs
      URL.createObjectURL(mockBlob);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockBlobMonitorLogger.info).toHaveBeenCalledWith(
        "Sent blob url registration info to content script",
        expect.objectContaining({
          blobUrl: expect.any(String),
        })
      );

      const logCall = mockBlobMonitorLogger.info.mock.calls.find(
        (call) =>
          call[0] === "Sent blob url registration info to content script"
      );

      if (logCall && logCall[1]) {
        const blobUrl = logCall[1].blobUrl;
        expect(blobUrl.length).toBeLessThanOrEqual(50);
      }
    });
  });
});
