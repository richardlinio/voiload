/**
 * @jest-environment jsdom
 */
/// <reference types="jest" />

// Mock modules before importing the content script
jest.mock("../../extension/scripts/content/message-handler");
jest.mock("../../extension/scripts/content/context-menu-handler");
jest.mock("../../extension/scripts/utils/logger");

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe("content.ts", () => {
  let mockInitMessageHandler: jest.Mock;
  let mockInitContextMenuHandler: jest.Mock;
  let mockLogger: any;
  let originalLocation: Location;
  let mockChrome: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Store original location
    originalLocation = window.location;

    // Setup chrome mock
    mockChrome = {
      runtime: {
        getURL: jest.fn(),
        sendMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn(),
        },
      },
    };

    (global as any).chrome = mockChrome;

    // Setup module mocks
    mockInitMessageHandler = jest.fn();
    mockInitContextMenuHandler = jest.fn();

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    const mockLoggerModule = {
      Logger: {
        createModuleLogger: jest.fn(() => mockLogger),
      },
    };

    // Setup module mocks
    (jest.doMock as any)(
      "../../extension/scripts/content/message-handler",
      () => ({
        initMessageHandler: mockInitMessageHandler,
      })
    );

    (jest.doMock as any)(
      "../../extension/scripts/content/context-menu-handler",
      () => ({
        initContextMenuHandler: mockInitContextMenuHandler,
      })
    );

    (jest.doMock as any)(
      "../../extension/scripts/utils/logger",
      () => mockLoggerModule
    );

    // Mock constants
    (jest.doMock as any)("../../extension/scripts/utils/constants", () => ({
      SUPPORTED_SITES: {
        DOMAINS: ["facebook.com", "messenger.com"],
      },
      MESSAGE_SOURCES: {
        PAGE_CONTEXT: "PAGE_CONTEXT",
        BACKGROUND_SCRIPT: "BACKGROUND_SCRIPT",
      },
      MODULE_NAMES: {
        CONTENT_SCRIPT: "content-script",
      },
    }));

    // Mock setTimeout
    jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback: Function) => {
        callback();
        return 1 as any;
      });

    // Mock chrome runtime methods
    mockChrome.runtime.getURL.mockReturnValue(
      "chrome-extension://id/scripts/page-context.js"
    );
    mockChrome.runtime.sendMessage.mockImplementation(
      (message: any, callback?: any) => {
        if (callback) {
          callback({ success: true });
        }
      }
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    // Restore original location
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  const mockLocation = (hostname: string) => {
    Object.defineProperty(window, "location", {
      value: {
        ...originalLocation,
        hostname,
      },
      writable: true,
    });
  };

  describe("Supported Sites Detection", () => {
    it("should initialize on facebook.com", () => {
      mockLocation("www.facebook.com");

      require("../../extension/scripts/content");

      expect(mockInitContextMenuHandler).toHaveBeenCalled();
      expect(mockInitMessageHandler).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Facebook Messenger voice message downloader has been initialized"
      );
    });

    it("should initialize on messenger.com", () => {
      mockLocation("www.messenger.com");

      require("../../extension/scripts/content");

      expect(mockInitContextMenuHandler).toHaveBeenCalled();
      expect(mockInitMessageHandler).toHaveBeenCalled();
    });

    it("should not initialize on unsupported sites", () => {
      mockLocation("www.google.com");

      require("../../extension/scripts/content");

      expect(mockInitContextMenuHandler).not.toHaveBeenCalled();
      expect(mockInitMessageHandler).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Unsupported site, extension will not start"
      );
    });
  });

  describe("Page Context Script Injection", () => {
    beforeEach(() => {
      mockLocation("www.facebook.com");
    });

    it("should inject page context script on supported sites", () => {
      const appendChildSpy = jest.spyOn(document.head, "appendChild");

      require("../../extension/scripts/content");

      expect(appendChildSpy).toHaveBeenCalled();
      const scriptElement = appendChildSpy.mock
        .calls[0]?.[0] as HTMLScriptElement;
      expect(scriptElement.type).toBe("module");
      expect(scriptElement.src).toBe(
        "chrome-extension://id/scripts/page-context.js"
      );
    });

    it("should remove script tag after loading", () => {
      const removeSpy = jest.fn();
      const mockScript = {
        type: "",
        src: "",
        onload: null as any,
        remove: removeSpy,
      };

      jest.spyOn(document, "createElement").mockReturnValue(mockScript as any);
      jest.spyOn(document.head, "appendChild");

      require("../../extension/scripts/content");

      // Trigger onload
      if (mockScript.onload) {
        mockScript.onload();
      }

      expect(removeSpy).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Facebook Messenger voice message downloader has loaded the page context module"
      );
    });

    it("should handle script injection errors", () => {
      jest.spyOn(document.head, "appendChild").mockImplementation(() => {
        throw new Error("Injection failed");
      });

      require("../../extension/scripts/content");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error adding page context script",
        {
          error: expect.any(Error),
        }
      );
    });

    it("should fallback to documentElement if head is not available", () => {
      // Mock document with no head
      Object.defineProperty(document, "head", {
        value: null,
        writable: true,
      });

      const appendChildSpy = jest.spyOn(
        document.documentElement,
        "appendChild"
      );

      require("../../extension/scripts/content");

      expect(appendChildSpy).toHaveBeenCalled();

      // Restore head
      Object.defineProperty(document, "head", {
        value: document.createElement("head"),
        writable: true,
      });
    });
  });

  describe("Message Communication", () => {
    beforeEach(() => {
      mockLocation("www.facebook.com");
    });

    describe("Page Context to Background", () => {
      it("should forward page context messages to background script", () => {
        require("../../extension/scripts/content");

        const testMessage = { action: "test", data: "testData" };
        const event = new MessageEvent("message", {
          data: {
            type: "PAGE_CONTEXT",
            message: testMessage,
          },
          source: window,
        });

        window.dispatchEvent(event);

        expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
          testMessage,
          expect.any(Function)
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Received page context message, forwarding to background script",
          { message: testMessage }
        );
      });

      it("should ignore messages from other sources", () => {
        require("../../extension/scripts/content");

        const event = new MessageEvent("message", {
          data: {
            type: "PAGE_CONTEXT",
            message: { action: "test" },
          },
          source: {} as Window, // Different source
        });

        window.dispatchEvent(event);

        expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
      });

      it("should ignore messages without correct type", () => {
        require("../../extension/scripts/content");

        const event = new MessageEvent("message", {
          data: {
            type: "OTHER_TYPE",
            message: { action: "test" },
          },
          source: window,
        });

        window.dispatchEvent(event);

        expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
      });

      it("should log background script response", () => {
        require("../../extension/scripts/content");

        const testMessage = { action: "test" };
        const testResponse = { success: true };

        mockChrome.runtime.sendMessage.mockImplementation(
          (message: any, callback?: any) => {
            if (callback) {
              callback(testResponse);
            }
          }
        );

        const event = new MessageEvent("message", {
          data: {
            type: "PAGE_CONTEXT",
            message: testMessage,
          },
          source: window,
        });

        window.dispatchEvent(event);

        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Background script response",
          {
            response: testResponse,
          }
        );
      });
    });

    describe("Background to Page Context", () => {
      it("should register runtime message listener", () => {
        require("../../extension/scripts/content");

        expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
          expect.any(Function)
        );
      });

      it("should forward background messages to page context", () => {
        const postMessageSpy = jest.spyOn(window, "postMessage");

        require("../../extension/scripts/content");

        const messageListener =
          mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
        const testMessage = { action: "test", data: "testData" };

        const result = messageListener(testMessage, {}, jest.fn());

        expect(postMessageSpy).toHaveBeenCalledWith(
          {
            type: "BACKGROUND_SCRIPT",
            message: testMessage,
          },
          "*"
        );
        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Received background script message",
          {
            message: testMessage,
          }
        );
      });
    });
  });

  describe("Module Initialization", () => {
    beforeEach(() => {
      mockLocation("www.facebook.com");
    });

    it("should initialize context menu handler immediately", () => {
      require("../../extension/scripts/content");

      expect(mockInitContextMenuHandler).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Context menu handler has been initialized"
      );
    });

    it("should initialize message handler with delay", () => {
      require("../../extension/scripts/content");

      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 300);
      expect(mockInitMessageHandler).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Content script message handler has been initialized"
      );
    });

    it("should create module logger with correct name", () => {
      require("../../extension/scripts/content");

      const mockLoggerModule = require("../../extension/scripts/utils/logger");
      expect(mockLoggerModule.Logger.createModuleLogger).toHaveBeenCalledWith(
        "content-script"
      );
    });
  });

  describe("Type Definitions", () => {
    it("should handle PageContextMessageEvent interface properly", () => {
      require("../../extension/scripts/content");

      const event = new MessageEvent("message", {
        data: {
          type: "PAGE_CONTEXT",
          message: { action: "test" },
        },
        source: window,
      });

      // This test ensures the type casting works without runtime errors
      window.dispatchEvent(event);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it("should handle RuntimeMessageListener type properly", () => {
      mockLocation("www.facebook.com");

      require("../../extension/scripts/content");

      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
      const messageListener =
        mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Test with various parameter combinations
      expect(typeof messageListener({ action: "test" }, {}, jest.fn())).toBe(
        "boolean"
      );
    });
  });
});
