/**
 * @jest-environment jsdom
 */
/// <reference types="jest" />

// Mock modules before importing the page context script
jest.mock("../../extension/scripts/page-context/blob-monitor");
jest.mock("../../extension/scripts/utils/logger");

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

describe("page-context.ts", () => {
  let mockInitBlobMonitor: jest.Mock;
  let mockLogger: any;
  let originalLocation: Location;
  let originalReadyState: string;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Store original values
    originalLocation = window.location;
    originalReadyState = document.readyState;

    // Setup module mocks
    mockInitBlobMonitor = jest.fn();

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
      "../../extension/scripts/page-context/blob-monitor",
      () => ({
        initBlobMonitor: mockInitBlobMonitor,
      })
    );

    (jest.doMock as any)(
      "../../extension/scripts/utils/logger",
      () => mockLoggerModule
    );

    // Mock constants
    (jest.doMock as any)("../../extension/scripts/utils/constants", () => ({
      MESSAGE_SOURCES: {
        PAGE_CONTEXT: "PAGE_CONTEXT",
      },
      MODULE_NAMES: {
        PAGE_CONTEXT: "page-context",
      },
    }));

    // Clean up any existing sendToContent function
    delete (window as any).sendToContent;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();

    // Restore original values
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });

    Object.defineProperty(document, "readyState", {
      value: originalReadyState,
      writable: true,
    });

    // Clean up sendToContent function
    delete (window as any).sendToContent;
  });

  const mockLocation = (hostname: string, href?: string) => {
    Object.defineProperty(window, "location", {
      value: {
        ...originalLocation,
        hostname,
        href: href || `https://${hostname}/`,
      },
      writable: true,
    });
  };

  const mockReadyState = (state: DocumentReadyState) => {
    Object.defineProperty(document, "readyState", {
      value: state,
      writable: true,
    });
  };

  describe("Module Logger Creation", () => {
    it("should create module logger with correct name", () => {
      mockLocation("www.facebook.com");
      mockReadyState("complete");

      require("../../extension/scripts/page-context");

      const mockLoggerModule = require("../../extension/scripts/utils/logger");
      expect(mockLoggerModule.Logger.createModuleLogger).toHaveBeenCalledWith(
        "page-context"
      );
    });
  });

  describe("Supported Site Detection", () => {
    beforeEach(() => {
      mockReadyState("complete");
    });

    it("should initialize on facebook.com", () => {
      mockLocation("www.facebook.com", "https://www.facebook.com/messages");

      require("../../extension/scripts/page-context");

      expect(mockInitBlobMonitor).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Initializing page context module"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Page context module has started"
      );
    });

    it("should initialize on messenger.com", () => {
      mockLocation("www.messenger.com", "https://www.messenger.com/t/123");

      require("../../extension/scripts/page-context");

      expect(mockInitBlobMonitor).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Page context module has started"
      );
    });

    it("should not initialize on unsupported sites", () => {
      mockLocation("www.google.com");

      require("../../extension/scripts/page-context");

      expect(mockInitBlobMonitor).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Unsupported site, extension will not start"
      );
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        "Page context module has started"
      );
    });

    it("should handle subdomain variations of facebook.com", () => {
      mockLocation("m.facebook.com");

      require("../../extension/scripts/page-context");

      expect(mockInitBlobMonitor).toHaveBeenCalled();
    });

    it("should handle subdomain variations of messenger.com", () => {
      mockLocation("web.messenger.com");

      require("../../extension/scripts/page-context");

      expect(mockInitBlobMonitor).toHaveBeenCalled();
    });
  });

  describe("Blob Monitor Initialization", () => {
    beforeEach(() => {
      mockLocation("www.facebook.com");
      mockReadyState("complete");
    });

    it("should initialize blob monitor successfully", () => {
      require("../../extension/scripts/page-context");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Preparing to initialize Blob monitoring module"
      );
      expect(mockInitBlobMonitor).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Blob monitoring module initialized successfully"
      );
    });

    it("should handle blob monitor initialization errors", () => {
      const error = new Error("Blob monitor init failed");
      mockInitBlobMonitor.mockImplementation(() => {
        throw error;
      });

      require("../../extension/scripts/page-context");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error initializing Blob monitoring module",
        { error }
      );
    });
  });

  describe("Message Communication", () => {
    beforeEach(() => {
      mockLocation("www.facebook.com", "https://www.facebook.com/messages");
      mockReadyState("complete");
    });

    it("should send initialization message to content script", () => {
      const postMessageSpy = jest.spyOn(window, "postMessage");

      require("../../extension/scripts/page-context");

      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: "PAGE_CONTEXT",
          message: {
            action: "pageContextInitialized",
            url: "https://www.facebook.com/messages",
            hostname: "www.facebook.com",
          },
        },
        "*"
      );
    });

    it("should create sendToContent helper function", () => {
      require("../../extension/scripts/page-context");

      expect(typeof (window as any).sendToContent).toBe("function");
    });

    it("should send messages through sendToContent helper", () => {
      const postMessageSpy = jest.spyOn(window, "postMessage");

      require("../../extension/scripts/page-context");

      const testMessage = {
        action: "test",
        blobUrl: "blob:test",
        blobType: "audio/mp3",
        blobSize: 1024,
        durationMs: 5000,
      };
      (window as any).sendToContent(testMessage);

      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: "PAGE_CONTEXT",
          message: testMessage,
        },
        "*"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Preparing to send message to content script",
        {
          message: testMessage,
        }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Message sent to content script"
      );
    });

    it("should handle sendToContent errors gracefully", () => {
      // Mock postMessage to work for initialization but fail for sendToContent calls
      let callCount = 0;
      jest.spyOn(window, "postMessage").mockImplementation(() => {
        callCount++;
        if (callCount > 1) {
          throw new Error("PostMessage failed");
        }
      });

      require("../../extension/scripts/page-context");

      const testMessage = {
        action: "test",
        blobUrl: "blob:test",
        blobType: "audio/mp3",
        blobSize: 1024,
        durationMs: 5000,
      };

      expect(() => {
        (window as any).sendToContent(testMessage);
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error sending message to content script",
        {
          error: expect.any(Error),
        }
      );
    });
  });

  describe("DOM Ready State Handling", () => {
    beforeEach(() => {
      mockLocation("www.facebook.com");
    });

    it("should initialize immediately if DOM is already loaded", () => {
      mockReadyState("complete");

      require("../../extension/scripts/page-context");

      expect(mockInitBlobMonitor).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Page context module has started"
      );
    });

    it("should initialize immediately if DOM is interactive", () => {
      mockReadyState("interactive");

      require("../../extension/scripts/page-context");

      expect(mockInitBlobMonitor).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Page context module has started"
      );
    });

    it("should wait for DOMContentLoaded if DOM is still loading", () => {
      mockReadyState("loading");
      const addEventListenerSpy = jest.spyOn(document, "addEventListener");

      require("../../extension/scripts/page-context");

      // Should not initialize immediately
      expect(mockInitBlobMonitor).not.toHaveBeenCalled();

      // Should add event listener
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "DOMContentLoaded",
        expect.any(Function)
      );

      // Simulate DOMContentLoaded event
      const domContentLoadedHandler = addEventListenerSpy.mock
        .calls[0]?.[1] as Function;
      domContentLoadedHandler();

      // Should initialize after event
      expect(mockInitBlobMonitor).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Page context module has started"
      );
    });
  });

  describe("Type Definitions", () => {
    beforeEach(() => {
      mockLocation("www.facebook.com");
      mockReadyState("complete");
    });

    it("should handle PageContextMessage interface properly", () => {
      const postMessageSpy = jest.spyOn(window, "postMessage");

      require("../../extension/scripts/page-context");

      // Test that initialization message follows the interface
      const initCall = postMessageSpy.mock.calls.find(
        (call: any) =>
          call &&
          call[0] &&
          call[0].message &&
          call[0].message.action === "pageContextInitialized"
      );

      expect(initCall).toBeDefined();
      if (initCall && initCall[0] && initCall[0].message) {
        expect(initCall[0].message).toHaveProperty("action");
        expect(initCall[0].message).toHaveProperty("url");
        expect(initCall[0].message).toHaveProperty("hostname");
      }
    });

    it("should properly extend Window interface with sendToContent", () => {
      require("../../extension/scripts/page-context");

      // Type check that sendToContent exists and is callable
      expect((window as any).sendToContent).toBeDefined();
      expect(typeof (window as any).sendToContent).toBe("function");

      // Test that it can be called with any message
      expect(() => {
        (window as any).sendToContent({
          action: "test",
          blobUrl: "blob:test",
          blobType: "audio/mp3",
          blobSize: 1024,
          durationMs: 5000,
        });
      }).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      mockLocation("www.facebook.com");
      mockReadyState("complete");
    });

    it("should continue execution despite blob monitor errors", () => {
      const error = new Error("Blob monitor failed");
      mockInitBlobMonitor.mockImplementation(() => {
        throw error;
      });

      require("../../extension/scripts/page-context");

      // Should still send initialization message and create helper function
      expect((window as any).sendToContent).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error initializing Blob monitoring module",
        { error }
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Page context module has started"
      );
    });

    it("should handle postMessage errors in initialization by throwing", () => {
      // The actual page-context script doesn't wrap postMessage in try-catch during initialization
      // This test should expect the error to propagate
      jest.spyOn(window, "postMessage").mockImplementationOnce(() => {
        throw new Error("PostMessage failed");
      });

      // Should throw since page-context doesn't handle postMessage errors during init
      expect(() => {
        require("../../extension/scripts/page-context");
      }).toThrow("PostMessage failed");
    });
  });
});
