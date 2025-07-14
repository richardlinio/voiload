/**
 * message-handler.test.ts
 * Unit tests for content message-handler module
 */

// Mock chrome runtime first
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
  },
};
(global as any).chrome = mockChrome;

// Mock logger
const mockMessageHandlerLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock all dependencies before imports
jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => mockMessageHandlerLogger),
  },
}));

jest.mock("../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    CONTENT_MESSAGE_HANDLER: "content-message-handler",
  },
  MESSAGE_SOURCES: {
    PAGE_CONTEXT: "PAGE_CONTEXT",
    BACKGROUND_SCRIPT: "BACKGROUND_SCRIPT",
  },
  MESSAGE_ACTIONS: {
    REGISTER_BLOB_URL: "REGISTER_BLOB_URL",
    BLOB_DETECTED: "BLOB_DETECTED",
    GET_AUDIO_DURATION: "GET_AUDIO_DURATION",
    REGISTER_AUDIO_URL: "REGISTER_AUDIO_URL",
  },
}));

const mockHandleGetAudioDurationRequest = jest.fn();

jest.mock("../../../extension/scripts/page-context/audio-analyzer", () => ({
  handleGetAudioDurationRequest: mockHandleGetAudioDurationRequest,
}));


describe("message-handler", () => {
  let messageHandler: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset window mock
    delete (global as any).window;
    (global as any).window = {
      addEventListener: jest.fn(),
    };

    // Import module fresh
    delete require.cache[
      require.resolve("../../../extension/scripts/content/message-handler")
    ];
    messageHandler = require("../../../extension/scripts/content/message-handler");
  });

  describe("module exports", () => {
    it("should export initMessageHandler function", () => {
      expect(typeof messageHandler.initMessageHandler).toBe("function");
    });
  });

  describe("initialization", () => {
    it("should initialize without errors", () => {
      expect(() => messageHandler.initMessageHandler()).not.toThrow();

      expect(mockMessageHandlerLogger.debug).toHaveBeenCalledWith(
        "Initializing content script message handler"
      );
      expect(mockMessageHandlerLogger.info).toHaveBeenCalledWith(
        "Content script message handler initialized"
      );
    });

    it("should add message event listener", () => {
      messageHandler.initMessageHandler();

      expect((global as any).window.addEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
    });
  });

  describe("message handling functionality", () => {
    beforeEach(() => {
      messageHandler.initMessageHandler();
    });

    it("should handle page context blob URL registration", () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "PAGE_CONTEXT",
          message: {
            action: "REGISTER_BLOB_URL",
            blobUrl: "blob:test-url",
          },
        },
      };

      eventHandler(mockEvent);

      expect(mockMessageHandlerLogger.debug).toHaveBeenCalledWith(
        "Received page context message",
        { message: mockEvent.data.message }
      );
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        mockEvent.data.message,
        expect.any(Function)
      );
    });

    it("should handle blob detection messages", () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "PAGE_CONTEXT",
          message: {
            action: "BLOB_DETECTED",
            blobUrl: "blob:test-url",
          },
        },
      };

      eventHandler(mockEvent);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        mockEvent.data.message,
        expect.any(Function)
      );
    });

    it("should handle page context initialization message", () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "PAGE_CONTEXT",
          message: {
            action: "pageContextInitialized",
          },
        },
      };

      eventHandler(mockEvent);

      expect(mockMessageHandlerLogger.info).toHaveBeenCalledWith(
        "Page context initialized"
      );
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it("should forward unknown page context messages", () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "PAGE_CONTEXT",
          message: {
            action: "UNKNOWN_ACTION",
            data: "test",
          },
        },
      };

      eventHandler(mockEvent);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        mockEvent.data.message,
        expect.any(Function)
      );
    });

    it("should ignore messages from different sources", () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: {},
        data: {
          type: "PAGE_CONTEXT",
          message: {
            action: "REGISTER_BLOB_URL",
          },
        },
      };

      eventHandler(mockEvent);

      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it("should handle GET_AUDIO_DURATION from background", async () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "BACKGROUND_SCRIPT",
          message: {
            action: "GET_AUDIO_DURATION",
            url: "https://test-audio.mp3",
          },
        },
      };

      mockHandleGetAudioDurationRequest.mockResolvedValue(5000);

      await eventHandler(mockEvent);

      expect(mockHandleGetAudioDurationRequest).toHaveBeenCalledWith(
        mockEvent.data.message
      );
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "REGISTER_AUDIO_URL",
          audioUrl: "https://test-audio.mp3",
          durationMs: 5000,
        }),
        expect.any(Function)
      );
    });

    it("should not register when audio duration is invalid", async () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "BACKGROUND_SCRIPT",
          message: {
            action: "GET_AUDIO_DURATION",
            url: "https://test-audio.mp3",
          },
        },
      };

      mockHandleGetAudioDurationRequest.mockResolvedValue(null);

      await eventHandler(mockEvent);

      expect(mockMessageHandlerLogger.debug).toHaveBeenCalledWith(
        "Invalid audio duration obtained",
        { url: "https://test-audio.mp3" }
      );
    });


    it("should handle unknown background message types", async () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "BACKGROUND_SCRIPT",
          message: {
            action: "UNKNOWN_ACTION",
          },
        },
      };

      await eventHandler(mockEvent);

      expect(mockMessageHandlerLogger.warn).toHaveBeenCalledWith(
        "Unhandled message type",
        {
          action: "UNKNOWN_ACTION",
        }
      );
    });

    it("should handle messages without action", async () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "BACKGROUND_SCRIPT",
          message: {},
        },
      };

      await eventHandler(mockEvent);

      expect(mockMessageHandlerLogger.warn).toHaveBeenCalledWith(
        "Unhandled message type",
        {
          action: "no action",
        }
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      messageHandler.initMessageHandler();
    });

    it("should handle chrome.runtime.sendMessage errors", () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];
      const mockError = new Error("Runtime error");

      mockChrome.runtime.sendMessage.mockImplementation(() => {
        throw mockError;
      });

      const mockEvent = {
        source: global.window,
        data: {
          type: "PAGE_CONTEXT",
          message: {
            action: "REGISTER_BLOB_URL",
            blobUrl: "blob:test-url",
          },
        },
      };

      eventHandler(mockEvent);

      expect(mockMessageHandlerLogger.error).toHaveBeenCalledWith(
        "Error sending message to background script",
        { error: mockError }
      );
    });

    it("should log background script responses", () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];
      const mockResponse = { success: true };

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(mockResponse);
      });

      const mockEvent = {
        source: global.window,
        data: {
          type: "PAGE_CONTEXT",
          message: {
            action: "REGISTER_BLOB_URL",
            blobUrl: "blob:test-url",
          },
        },
      };

      eventHandler(mockEvent);

      expect(mockMessageHandlerLogger.debug).toHaveBeenCalledWith(
        "Background script responded",
        { response: mockResponse }
      );
    });

    it("should handle events with empty data", () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {},
      };

      expect(() => eventHandler(mockEvent)).not.toThrow();
    });

    it("should handle async errors gracefully", async () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "BACKGROUND_SCRIPT",
          message: {
            action: "GET_AUDIO_DURATION",
            url: "https://test-audio.mp3",
          },
        },
      };

      mockHandleGetAudioDurationRequest.mockRejectedValue(
        new Error("Audio analysis failed")
      );

      // The async function should handle the rejection and not crash
      await expect(eventHandler(mockEvent)).rejects.toThrow(
        "Audio analysis failed"
      );
    });
  });

  describe("audio URL registration", () => {
    beforeEach(() => {
      messageHandler.initMessageHandler();
    });

    it("should include timestamp in registration", async () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const mockEvent = {
        source: global.window,
        data: {
          type: "BACKGROUND_SCRIPT",
          message: {
            action: "GET_AUDIO_DURATION",
            url: "https://test-audio.mp3",
          },
        },
      };

      mockHandleGetAudioDurationRequest.mockResolvedValue(3000);

      await eventHandler(mockEvent);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "REGISTER_AUDIO_URL",
          audioUrl: "https://test-audio.mp3",
          durationMs: 3000,
          timestamp: expect.any(String),
        }),
        expect.any(Function)
      );
    });

    it("should log URL registration details", async () => {
      const eventHandler = (
        (global as any).window.addEventListener as jest.Mock
      ).mock.calls[0][1];

      const longUrl = "https://example.com/" + "a".repeat(100);
      const mockEvent = {
        source: global.window,
        data: {
          type: "BACKGROUND_SCRIPT",
          message: {
            action: "GET_AUDIO_DURATION",
            url: longUrl,
          },
        },
      };

      mockHandleGetAudioDurationRequest.mockResolvedValue(2500);

      await eventHandler(mockEvent);

      expect(mockMessageHandlerLogger.debug).toHaveBeenCalledWith(
        "Sent Audio URL registration info to background script",
        {
          audioUrl: longUrl.substring(0, 50),
          durationMs: 2500,
        }
      );
    });
  });

});
