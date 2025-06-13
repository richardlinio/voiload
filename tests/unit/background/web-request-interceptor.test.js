/**
 * web-request-interceptor.test.js
 * Unit tests for web-request-interceptor module
 */

// Mock the chrome API before importing
const mockChrome = {
  webRequest: {
    onHeadersReceived: {
      addListener: jest.fn(),
    },
    onCompleted: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
  runtime: {
    lastError: null,
  },
};

// Mock modules
jest.mock("../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    WEB_REQUEST: "web-request",
  },
  VOICE_MESSAGE_URL_PATTERNS: ["*://*.fbcdn.net/*", "*://*.facebook.com/*"],
  MESSAGE_ACTIONS: {
    GET_AUDIO_DURATION: "GET_AUDIO_DURATION",
  },
  SUPPORTED_SITES: {
    PATTERNS: ["https://*.facebook.com/*", "https://*.messenger.com/*"],
  },
  TIME_CONSTANTS: {
    CLEANUP_INTERVAL: 1800000, // 30 minutes
  },
}));

jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

jest.mock("../../../extension/scripts/page-context/audio-analyzer", () => ({
  isLikelyVoiceMessage: jest.fn(),
}));

// Set up global chrome mock
global.chrome = mockChrome;

// Mock timers
jest.useFakeTimers();

describe("WebRequestInterceptor", () => {
  let initWebRequestInterceptor;
  let mockLogger;
  let mockVoiceMessagesStore;
  let mockIsLikelyVoiceMessage;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset chrome API mocks
    mockChrome.webRequest.onHeadersReceived.addListener.mockClear();
    mockChrome.webRequest.onCompleted.addListener.mockClear();
    mockChrome.tabs.query.mockClear();
    mockChrome.tabs.sendMessage.mockClear();
    mockChrome.runtime.lastError = null;

    // Create fresh mock logger for each test
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    // Create mock voice messages store
    mockVoiceMessagesStore = {
      items: new Map(),
      addVoiceMessage: jest.fn(),
      getVoiceMessage: jest.fn(),
      removeVoiceMessage: jest.fn(),
      cleanup: jest.fn(),
    };

    // Set up mocks
    const { Logger } = require("../../../extension/scripts/utils/logger");
    Logger.createModuleLogger.mockReturnValue(mockLogger);

    const {
      isLikelyVoiceMessage,
    } = require("../../../extension/scripts/page-context/audio-analyzer");
    mockIsLikelyVoiceMessage = isLikelyVoiceMessage;

    // Import after mocks are set up
    const webRequestInterceptor = require("../../../extension/scripts/background/web-request-interceptor");
    initWebRequestInterceptor = webRequestInterceptor.initWebRequestInterceptor;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe("initWebRequestInterceptor", () => {
    it("should correctly initialize webRequest interceptor", () => {
      initWebRequestInterceptor(mockVoiceMessagesStore);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Initializing webRequest interceptor"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "webRequest interceptor initialized",
        {
          patterns: ["*://*.fbcdn.net/*", "*://*.facebook.com/*"],
        }
      );
    });

    it("should set up network request listeners", () => {
      initWebRequestInterceptor(mockVoiceMessagesStore);

      expect(
        mockChrome.webRequest.onHeadersReceived.addListener
      ).toHaveBeenCalledWith(
        expect.any(Function),
        { urls: ["*://*.fbcdn.net/*", "*://*.facebook.com/*"] },
        ["responseHeaders"]
      );

      expect(
        mockChrome.webRequest.onCompleted.addListener
      ).toHaveBeenCalledWith(
        expect.any(Function),
        { urls: ["*://*.fbcdn.net/*", "*://*.facebook.com/*"] },
        ["responseHeaders"]
      );
    });

    it("should log an error when webRequest API is not available", () => {
      // Mock webRequest API not available
      global.chrome = { ...mockChrome, webRequest: undefined };

      initWebRequestInterceptor(mockVoiceMessagesStore);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "chrome.webRequest API is not available"
      );
    });

    it("should handle errors during initialization", () => {
      // Ensure webRequest API is available
      global.chrome = {
        ...mockChrome,
        webRequest: {
          onHeadersReceived: {
            addListener: jest.fn(() => {
              throw new Error("Mock initialization error");
            }),
          },
          onCompleted: {
            addListener: jest.fn(),
          },
        },
      };

      initWebRequestInterceptor(mockVoiceMessagesStore);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error initializing webRequest interceptor",
        {
          error: "Mock initialization error",
          stack: expect.any(String),
        }
      );
    });
  });

  describe("request handling", () => {
    let requestHandler;

    beforeEach(() => {
      // Reset chrome API to normal state
      global.chrome = mockChrome;

      initWebRequestInterceptor(mockVoiceMessagesStore);

      // Get registered request handler
      requestHandler =
        mockChrome.webRequest.onHeadersReceived.addListener.mock.calls[0][0];
    });

    it("should handle voice message requests", () => {
      mockIsLikelyVoiceMessage.mockReturnValue(true);

      const mockDetails = {
        url: "https://scontent.fbcdn.net/audio/test-voice-message.mp4",
        method: "GET",
        statusCode: 200,
        type: "xmlhttprequest",
        responseHeaders: [
          { name: "content-type", value: "audio/mp4" },
          { name: "content-length", value: "12345" },
        ],
      };

      requestHandler(mockDetails);

      expect(mockIsLikelyVoiceMessage).toHaveBeenCalledWith(
        mockDetails.url,
        mockDetails.method,
        mockDetails.statusCode,
        {
          contentDisposition: "",
          contentType: "audio/mp4",
          contentLength: "12345",
          lastModified: "",
        }
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Detected voice message request",
        {
          url: "https://scontent.fbcdn.net/audio/test-voice-message.mp4...",
          type: "xmlhttprequest",
          statusCode: 200,
          method: "GET",
        }
      );
    });

    it("should skip already processed URLs", () => {
      mockIsLikelyVoiceMessage.mockReturnValue(true);

      const mockDetails = {
        url: "https://scontent.fbcdn.net/audio/test-voice-message.mp4",
        method: "GET",
        statusCode: 200,
        responseHeaders: [{ name: "content-type", value: "audio/mp4" }],
      };

      // First handling
      requestHandler(mockDetails);
      expect(mockIsLikelyVoiceMessage).toHaveBeenCalledTimes(1);

      // Clear previous mock call records
      mockLogger.debug.mockClear();

      // Second handling of the same URL
      requestHandler(mockDetails);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "URL already processed, skipping",
        {
          url: "https://scontent.fbcdn.net/audio/test-voice-messag...",
        }
      );

      // isLikelyVoiceMessage should not be called again
      expect(mockIsLikelyVoiceMessage).toHaveBeenCalledTimes(1);
    });

    it("should ignore non-voice message requests", () => {
      mockIsLikelyVoiceMessage.mockReturnValue(false);

      const mockDetails = {
        url: "https://scontent.fbcdn.net/images/photo.jpg",
        method: "GET",
        statusCode: 200,
        responseHeaders: [{ name: "content-type", value: "image/jpeg" }],
      };

      requestHandler(mockDetails);

      expect(mockIsLikelyVoiceMessage).toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringMatching(/Detected voice message request/)
      );
    });

    it("should correctly extract metadata from response headers", () => {
      mockIsLikelyVoiceMessage.mockReturnValue(true);

      const mockDetails = {
        url: "https://scontent.fbcdn.net/audio/test.mp4",
        method: "GET",
        statusCode: 200,
        responseHeaders: [
          { name: "Content-Type", value: "audio/mp4" },
          { name: "Content-Length", value: "98765" },
          {
            name: "Content-Disposition",
            value: 'attachment; filename="voice.mp4"',
          },
          { name: "Last-Modified", value: "Wed, 21 Oct 2015 07:28:00 GMT" },
        ],
      };

      requestHandler(mockDetails);

      expect(mockIsLikelyVoiceMessage).toHaveBeenCalledWith(
        mockDetails.url,
        mockDetails.method,
        mockDetails.statusCode,
        {
          contentDisposition: 'attachment; filename="voice.mp4"',
          contentType: "audio/mp4",
          contentLength: "98765",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
        }
      );
    });

    it("should handle cases with no response headers", () => {
      mockIsLikelyVoiceMessage.mockReturnValue(true);

      const mockDetails = {
        url: "https://scontent.fbcdn.net/audio/test.mp4",
        method: "GET",
        statusCode: 200,
        responseHeaders: undefined,
      };

      requestHandler(mockDetails);

      expect(mockIsLikelyVoiceMessage).toHaveBeenCalledWith(
        mockDetails.url,
        mockDetails.method,
        mockDetails.statusCode,
        {
          contentDisposition: "",
          contentType: "",
          contentLength: "",
          lastModified: "",
        }
      );
    });

    it("should handle errors during request processing", () => {
      // Mock isLikelyVoiceMessage throwing an error
      mockIsLikelyVoiceMessage.mockImplementation(() => {
        throw new Error("Mock processing error");
      });

      const mockDetails = {
        url: "https://scontent.fbcdn.net/audio/test.mp4",
        method: "GET",
        statusCode: 200,
        responseHeaders: [],
      };

      requestHandler(mockDetails);

      expect(mockLogger.error).toHaveBeenCalledWith("Error handling request", {
        error: "Mock processing error",
        stack: expect.any(String),
      });
    });
  });

  describe("broadcasting to content scripts", () => {
    let requestHandler;

    beforeEach(() => {
      // Reset chrome API to normal state
      global.chrome = mockChrome;

      initWebRequestInterceptor(mockVoiceMessagesStore);
      requestHandler =
        mockChrome.webRequest.onHeadersReceived.addListener.mock.calls[0][0];
    });

    it("should broadcast messages to content scripts", () => {
      mockIsLikelyVoiceMessage.mockReturnValue(true);

      const mockTabs = [
        { id: 1, url: "https://www.facebook.com/messages" },
        { id: 2, url: "https://www.messenger.com" },
      ];

      mockChrome.tabs.query.mockImplementation((filter, callback) => {
        callback(mockTabs);
      });

      const mockDetails = {
        url: "https://scontent.fbcdn.net/audio/test.mp4",
        method: "GET",
        statusCode: 200,
        responseHeaders: [
          { name: "content-type", value: "audio/mp4" },
          { name: "content-length", value: "12345" },
        ],
      };

      requestHandler(mockDetails);

      expect(mockChrome.tabs.query).toHaveBeenCalledWith(
        { url: ["https://*.facebook.com/*", "https://*.messenger.com/*"] },
        expect.any(Function)
      );

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        {
          action: "GET_AUDIO_DURATION",
          url: mockDetails.url,
          metadata: {
            contentType: "audio/mp4",
            contentLength: "12345",
            lastModified: "",
          },
          timestamp: expect.any(Number),
        },
        expect.any(Function)
      );
    });

    it("should handle successful responses from sendMessage", () => {
      mockIsLikelyVoiceMessage.mockReturnValue(true);

      const mockTabs = [{ id: 1, url: "https://www.facebook.com/messages" }];

      mockChrome.tabs.query.mockImplementation((filter, callback) => {
        callback(mockTabs);
      });

      mockChrome.tabs.sendMessage.mockImplementation(
        (tabId, message, callback) => {
          callback({ success: true, data: "test response" });
        }
      );

      const mockDetails = {
        url: "https://scontent.fbcdn.net/audio/test.mp4",
        method: "GET",
        statusCode: 200,
        responseHeaders: [],
      };

      requestHandler(mockDetails);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Tab 1 received the message",
        {
          responseData: { success: true, data: "test response" },
        }
      );
    });

    it("should handle errors from sendMessage", () => {
      mockIsLikelyVoiceMessage.mockReturnValue(true);

      const mockTabs = [{ id: 1, url: "https://www.facebook.com/messages" }];

      mockChrome.tabs.query.mockImplementation((filter, callback) => {
        callback(mockTabs);
      });

      mockChrome.tabs.sendMessage.mockImplementation(
        (tabId, message, callback) => {
          mockChrome.runtime.lastError = { message: "Tab not found" };
          callback();
        }
      );

      const mockDetails = {
        url: "https://scontent.fbcdn.net/audio/test.mp4",
        method: "GET",
        statusCode: 200,
        responseHeaders: [],
      };

      requestHandler(mockDetails);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Failed to send message to tab 1",
        {
          error: "Tab not found",
        }
      );
    });
  });

  describe("periodic cleanup", () => {
    it("should periodically clean up URL cache", () => {
      initWebRequestInterceptor(mockVoiceMessagesStore);

      // Trigger timer
      jest.advanceTimersByTime(1800000); // 30 minutes

      expect(mockLogger.debug).toHaveBeenCalledWith("URL cache cleared");
    });

    it("should work correctly after multiple cleanups", () => {
      initWebRequestInterceptor(mockVoiceMessagesStore);

      // Trigger multiple timers
      jest.advanceTimersByTime(1800000);
      jest.advanceTimersByTime(1800000);
      jest.advanceTimersByTime(1800000);

      expect(mockLogger.debug).toHaveBeenCalledWith("URL cache cleared");
      expect(mockLogger.debug).toHaveBeenCalledTimes(4); // initialization + 3 cleanup calls
    });
  });
});
