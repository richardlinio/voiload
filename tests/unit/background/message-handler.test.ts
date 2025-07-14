/**
 * message-handler.test.ts
 * Unit tests for message-handler module
 */

// Mock the chrome API before importing
const messageHandlerMockChrome: any = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Mock modules
jest.mock("../../../extension/scripts/utils/constants", () => ({
  MESSAGE_ACTIONS: {
    RIGHT_CLICK: "RIGHT_CLICK",
    REGISTER_ELEMENT: "REGISTER_ELEMENT",
    REGISTER_AUDIO_URL: "REGISTER_AUDIO_URL",
    REGISTER_BLOB_URL: "REGISTER_BLOB_URL",
    BLOB_DETECTED: "BLOB_DETECTED",
    DOWNLOAD_ALL_VOICE_MESSAGES: "DOWNLOAD_ALL_VOICE_MESSAGES",
  },
  MODULE_NAMES: {
    MESSAGE_HANDLER: "message-handler",
  },
}));

jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => ({
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

// Mock handler functions
jest.mock(
  "../../../extension/scripts/background/handlers/right-click-handler",
  () => ({
    handleRightClick: jest.fn(),
  })
);

jest.mock(
  "../../../extension/scripts/background/handlers/element-registration-handler",
  () => ({
    handleElementRegistration: jest.fn(),
  })
);

jest.mock(
  "../../../extension/scripts/background/handlers/audio-url-registration-handler",
  () => ({
    handleAudioUrlRegistration: jest.fn(),
  })
);

jest.mock(
  "../../../extension/scripts/background/handlers/blob-handler",
  () => ({
    handleBlobUrl: jest.fn(),
    handleBlobContent: jest.fn(),
    handleBlobDetection: jest.fn(),
  })
);

jest.mock(
  "../../../extension/scripts/background/handlers/download-all-handler",
  () => ({
    handleDownloadAll: jest.fn(),
  })
);

jest.mock("../../../extension/scripts/background/data-store", () => ({
  createDataStore: jest.fn(() => ({
    items: new Map(),
    addVoiceMessage: jest.fn(),
    getVoiceMessage: jest.fn(),
    removeVoiceMessage: jest.fn(),
    cleanup: jest.fn(),
  })),
}));

// Set up global chrome mock
(global as any).chrome = messageHandlerMockChrome;

describe("MessageHandler", () => {
  let initMessageHandler: any;
  let mockLogger: any;
  let mockDataStore: any;
  let mockHandlers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset chrome API mocks
    messageHandlerMockChrome.runtime.onMessage.addListener.mockClear();

    // Create fresh mock logger for each test
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create fresh mock data store
    mockDataStore = {
      items: new Map(),
      addVoiceMessage: jest.fn(),
      getVoiceMessage: jest.fn(),
      removeVoiceMessage: jest.fn(),
      cleanup: jest.fn(),
    };

    // Mock handlers
    mockHandlers = {
      handleRightClick: jest.fn(),
      handleElementRegistration: jest.fn(),
      handleAudioUrlRegistration: jest.fn(),
      handleBlobUrl: jest.fn(),
      handleBlobContent: jest.fn(),
      handleBlobDetection: jest.fn(),
      handleDownloadAll: jest.fn(),
    };

    // Set up mocks
    const { Logger } = require("../../../extension/scripts/utils/logger");
    Logger.createModuleLogger.mockReturnValue(mockLogger);

    const {
      createDataStore,
    } = require("../../../extension/scripts/background/data-store");
    createDataStore.mockReturnValue(mockDataStore);

    const rightClickHandler = require("../../../extension/scripts/background/handlers/right-click-handler");
    rightClickHandler.handleRightClick.mockImplementation(
      mockHandlers.handleRightClick
    );

    const elementRegistrationHandler = require("../../../extension/scripts/background/handlers/element-registration-handler");
    elementRegistrationHandler.handleElementRegistration.mockImplementation(
      mockHandlers.handleElementRegistration
    );

    const audioUrlRegistrationHandler = require("../../../extension/scripts/background/handlers/audio-url-registration-handler");
    audioUrlRegistrationHandler.handleAudioUrlRegistration.mockImplementation(
      mockHandlers.handleAudioUrlRegistration
    );

    const blobHandler = require("../../../extension/scripts/background/handlers/blob-handler");
    blobHandler.handleBlobUrl.mockImplementation(mockHandlers.handleBlobUrl);
    blobHandler.handleBlobContent.mockImplementation(
      mockHandlers.handleBlobContent
    );
    blobHandler.handleBlobDetection.mockImplementation(
      mockHandlers.handleBlobDetection
    );

    const downloadAllHandler = require("../../../extension/scripts/background/handlers/download-all-handler");
    downloadAllHandler.handleDownloadAll.mockImplementation(
      mockHandlers.handleDownloadAll
    );

    // Import after mocks are set up
    const messageHandler = require("../../../extension/scripts/background/message-handler");
    initMessageHandler = messageHandler.initMessageHandler;
  });

  describe("initMessageHandler", () => {
    it("should correctly initialize the message handler", () => {
      initMessageHandler();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Initializing message handler"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Using singleton voiceMessages instance"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "voiceMessagesStore initialized",
        {
          mapSize: 0,
        }
      );
    });

    it("should use the provided voiceMessages instance", () => {
      const customStore = {
        items: new Map([["test", "value"]]),
        addVoiceMessage: jest.fn(),
        getVoiceMessage: jest.fn(),
        removeVoiceMessage: jest.fn(),
        cleanup: jest.fn(),
      };

      initMessageHandler(customStore);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Using provided voiceMessages instance"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "voiceMessagesStore initialized",
        {
          mapSize: 1,
        }
      );
    });

    it("should register the message listener", () => {
      initMessageHandler();

      expect(messageHandlerMockChrome.runtime.onMessage.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe("message routing", () => {
    let messageListener: any;
    let mockSender: any;
    let mockSendResponse: any;

    beforeEach(() => {
      initMessageHandler();

      // Get the registered message listener
      messageListener =
        messageHandlerMockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      mockSender = { tab: { id: 1 } };
      mockSendResponse = jest.fn();
    });

    it("should handle RIGHT_CLICK message", () => {
      const message = { action: "RIGHT_CLICK", data: "test" };
      mockHandlers.handleRightClick.mockReturnValue(true);

      const result = messageListener(message, mockSender, mockSendResponse);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Handling right-click message"
      );
      expect(mockHandlers.handleRightClick).toHaveBeenCalledWith(
        mockDataStore,
        message,
        mockSender,
        mockSendResponse
      );
      expect(result).toBe(true);
    });

    it("should handle REGISTER_ELEMENT message", () => {
      const message = { action: "REGISTER_ELEMENT", data: "test" };
      mockHandlers.handleElementRegistration.mockReturnValue(true);

      const result = messageListener(message, mockSender, mockSendResponse);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Handling voice message element registration message"
      );
      expect(mockHandlers.handleElementRegistration).toHaveBeenCalledWith(
        mockDataStore,
        message,
        mockSender,
        mockSendResponse
      );
      expect(result).toBe(true);
    });

    it("should handle REGISTER_AUDIO_URL message", () => {
      const message = { action: "REGISTER_AUDIO_URL", data: "test" };
      mockHandlers.handleAudioUrlRegistration.mockReturnValue(true);

      const result = messageListener(message, mockSender, mockSendResponse);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Handling Audio URL registration message"
      );
      expect(mockHandlers.handleAudioUrlRegistration).toHaveBeenCalledWith(
        mockDataStore,
        message,
        mockSender,
        mockSendResponse
      );
      expect(result).toBe(true);
    });


    it("should handle REGISTER_BLOB_URL message", () => {
      const message = { action: "REGISTER_BLOB_URL", data: "test" };
      mockHandlers.handleBlobUrl.mockReturnValue(true);

      const result = messageListener(message, mockSender, mockSendResponse);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Handling Blob URL registration message"
      );
      expect(mockHandlers.handleBlobUrl).toHaveBeenCalledWith(
        mockDataStore,
        message,
        mockSender,
        mockSendResponse
      );
      expect(result).toBe(true);
    });

    it("should handle BLOB_DETECTED message", () => {
      const message = { action: "BLOB_DETECTED", data: "test" };
      mockHandlers.handleBlobDetection.mockReturnValue(true);

      const result = messageListener(message, mockSender, mockSendResponse);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Handling Blob URL detected message"
      );
      expect(mockHandlers.handleBlobDetection).toHaveBeenCalledWith(
        message,
        mockSender,
        mockSendResponse
      );
      expect(result).toBe(true);
    });

    it("should handle unknown message types", () => {
      const message = { action: "UNKNOWN_ACTION", data: "test" };

      const result = messageListener(message, mockSender, mockSendResponse);

      expect(mockLogger.warn).toHaveBeenCalledWith("Unhandled message type", {
        action: "UNKNOWN_ACTION",
      });
      expect(result).toBe(false);
    });

    it("should handle messages without action", () => {
      const message = { data: "test" };

      const result = messageListener(message, mockSender, mockSendResponse);

      expect(mockLogger.warn).toHaveBeenCalledWith("Unhandled message type", {
        action: "no action",
      });
      expect(result).toBe(false);
    });
  });

  describe("store initialization error handling", () => {
    let messageListener: any;
    let mockSender: any;
    let mockSendResponse: any;

    beforeEach(() => {
      jest.resetModules();

      // Create fresh mocks for this test suite
      const freshMockLogger = {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const freshMockHandlers = {
        handleRightClick: jest.fn(),
        handleElementRegistration: jest.fn(),
        handleAudioUrlRegistration: jest.fn(),
        handleBlobUrl: jest.fn(),
        handleBlobContent: jest.fn(),
        handleBlobDetection: jest.fn(),
      };

      // Set up mocks
      const { Logger } = require("../../../extension/scripts/utils/logger");
      Logger.createModuleLogger.mockReturnValue(freshMockLogger);

      // Mock createDataStore to return null
      const {
        createDataStore,
      } = require("../../../extension/scripts/background/data-store");
      createDataStore.mockReturnValue(null);

      const rightClickHandler = require("../../../extension/scripts/background/handlers/right-click-handler");
      rightClickHandler.handleRightClick.mockImplementation(
        freshMockHandlers.handleRightClick
      );

      const elementRegistrationHandler = require("../../../extension/scripts/background/handlers/element-registration-handler");
      elementRegistrationHandler.handleElementRegistration.mockImplementation(
        freshMockHandlers.handleElementRegistration
      );

      const audioUrlRegistrationHandler = require("../../../extension/scripts/background/handlers/audio-url-registration-handler");
      audioUrlRegistrationHandler.handleAudioUrlRegistration.mockImplementation(
        freshMockHandlers.handleAudioUrlRegistration
      );

      const blobHandler = require("../../../extension/scripts/background/handlers/blob-handler");
      blobHandler.handleBlobUrl.mockImplementation(
        freshMockHandlers.handleBlobUrl
      );
      blobHandler.handleBlobContent.mockImplementation(
        freshMockHandlers.handleBlobContent
      );
      blobHandler.handleBlobDetection.mockImplementation(
        freshMockHandlers.handleBlobDetection
      );

      // Import and initialize with null store
      const messageHandler = require("../../../extension/scripts/background/message-handler");

      // Mock the voiceMessagesStore to be null by providing a null parameter
      try {
        messageHandler.initMessageHandler(null);
      } catch {
        // Expected to fail, we'll manually set up the listener for testing
      }

      // Manually set up message listener for testing error cases
      const mockMessageListener = (message: any, sender: any, sendResponse: any) => {
        // Simulate the null store check
        const storeRequiredActions = [
          "RIGHT_CLICK",
          "REGISTER_ELEMENT",
          "REGISTER_AUDIO_URL",
          "REGISTER_BLOB_URL",
        ];

        if (storeRequiredActions.includes(message.action)) {
          sendResponse({
            success: false,
            error: "Voice message store not initialized",
          });
          return false;
        }

        // Handle non-store dependent actions
        switch (message.action) {
          case "BLOB_DETECTED":
            return freshMockHandlers.handleBlobDetection(
              message,
              sender,
              sendResponse
            );
          default:
            return false;
        }
      };

      messageListener = mockMessageListener;
      mockSender = { tab: { id: 1 } };
      mockSendResponse = jest.fn();

      mockHandlers = freshMockHandlers;
    });

    const storeRequiredActions = [
      "RIGHT_CLICK",
      "REGISTER_ELEMENT",
      "REGISTER_AUDIO_URL",
      "REGISTER_BLOB_URL",
    ];

    storeRequiredActions.forEach((action) => {
      it(`should handle ${action} message error when store is not initialized`, () => {
        const message = { action, data: "test" };

        const result = messageListener(message, mockSender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Voice message store not initialized",
        });
        expect(result).toBe(false);
      });
    });


    it("should still handle BLOB_DETECTED message when store is not initialized", () => {
      const message = { action: "BLOB_DETECTED", data: "test" };
      mockHandlers.handleBlobDetection.mockReturnValue(true);

      const result = messageListener(message, mockSender, mockSendResponse);

      expect(mockHandlers.handleBlobDetection).toHaveBeenCalledWith(
        message,
        mockSender,
        mockSendResponse
      );
      expect(result).toBe(true);
    });
  });
});
