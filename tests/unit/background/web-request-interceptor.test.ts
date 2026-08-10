/**
 * web-request-interceptor.test.ts
 * Unit tests for web-request-interceptor module
 */

// Mock the chrome API before importing
const webRequestMockChrome: any = {
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
(global as any).chrome = webRequestMockChrome;

// Mock timers
jest.useFakeTimers();

describe("WebRequestInterceptor", () => {
  let initWebRequestInterceptor: any;
  let mockLogger: any;
  let mockVoiceMessagesStore: any;
  let mockIsLikelyVoiceMessage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset chrome API mocks
    webRequestMockChrome.webRequest.onHeadersReceived.addListener.mockClear();
    webRequestMockChrome.webRequest.onCompleted.addListener.mockClear();
    webRequestMockChrome.tabs.query.mockClear();
    webRequestMockChrome.tabs.sendMessage.mockClear();
    webRequestMockChrome.runtime.lastError = null;

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
        webRequestMockChrome.webRequest.onHeadersReceived.addListener
      ).toHaveBeenCalledWith(
        expect.any(Function),
        { urls: ["*://*.fbcdn.net/*", "*://*.facebook.com/*"] },
        ["responseHeaders"]
      );

      expect(
        webRequestMockChrome.webRequest.onCompleted.addListener
      ).toHaveBeenCalledWith(
        expect.any(Function),
        { urls: ["*://*.fbcdn.net/*", "*://*.facebook.com/*"] },
        ["responseHeaders"]
      );
    });

    it("should log an error when webRequest API is not available", () => {
      // Mock webRequest API not available
      (global as any).chrome = { ...webRequestMockChrome, webRequest: undefined };

      initWebRequestInterceptor(mockVoiceMessagesStore);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "chrome.webRequest API is not available"
      );
    });

    it("should handle errors during initialization", () => {
      // Ensure webRequest API is available
      (global as any).chrome = {
        ...webRequestMockChrome,
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
    let requestHandler: any;

    beforeEach(() => {
      // Reset chrome API to normal state
      (global as any).chrome = webRequestMockChrome;

      initWebRequestInterceptor(mockVoiceMessagesStore);

      // Get registered request handler
      requestHandler =
        webRequestMockChrome.webRequest.onHeadersReceived.addListener.mock.calls[0][0];
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
    let requestHandler: any;

    beforeEach(() => {
      // Reset chrome API to normal state
      (global as any).chrome = webRequestMockChrome;

      initWebRequestInterceptor(mockVoiceMessagesStore);
      requestHandler =
        webRequestMockChrome.webRequest.onHeadersReceived.addListener.mock.calls[0][0];
    });

    it("should broadcast messages to content scripts", () => {
      mockIsLikelyVoiceMessage.mockReturnValue(true);

      const mockTabs = [
        { id: 1, url: "https://www.facebook.com/messages" },
        { id: 2, url: "https://www.messenger.com" },
      ];

      webRequestMockChrome.tabs.query.mockImplementation((filter: any, callback: any) => {
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

      expect(webRequestMockChrome.tabs.query).toHaveBeenCalledWith(
        { url: ["https://*.facebook.com/*", "https://*.messenger.com/*"] },
        expect.any(Function)
      );

      expect(webRequestMockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(webRequestMockChrome.tabs.sendMessage).toHaveBeenCalledWith(
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

      webRequestMockChrome.tabs.query.mockImplementation((filter: any, callback: any) => {
        callback(mockTabs);
      });

      webRequestMockChrome.tabs.sendMessage.mockImplementation(
        (tabId: any, _message: any, callback: any) => {
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

      webRequestMockChrome.tabs.query.mockImplementation((filter: any, callback: any) => {
        callback(mockTabs);
      });

      webRequestMockChrome.tabs.sendMessage.mockImplementation(
        (tabId: any, _message: any, callback: any) => {
          (webRequestMockChrome.runtime as any).lastError = { message: "Tab not found" };
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
