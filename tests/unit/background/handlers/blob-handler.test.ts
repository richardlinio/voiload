/**
 * blob-handler.test.ts
 * Unit tests for blob-handler module
 */

import { flushPromises } from "../../../helpers/flush-promises";

// Chrome APIs are already mocked in setup.js

// Mock modules
jest.mock("../../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    BLOB_HANDLER: "blob-handler",
  },
}));

jest.mock("../../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

// Set up global chrome mock
// global.chrome is already set in setup.js

describe("blob-handler.ts", () => {
  let mockLogger: any;
  let blobHandler: any;
  let mockVoiceMessagesStore: any;
  let mockSender: any;
  let mockSendResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset chrome API to normal state
    // global.chrome is already set in setup.js
    (global.chrome as any).runtime.lastError = null;

    // Reset chrome API mocks
    (global.chrome as any).downloads.download.mockClear();

    // Create fresh mock logger for each test
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock voice messages store
    mockVoiceMessagesStore = {
      items: new Map(),
      registerDownloadUrl: jest.fn(),
    };

    // Create mock sender and response
    mockSender = {
      tab: { id: 123 },
    };
    mockSendResponse = jest.fn();

    // Set up mocks
    const { Logger } = require("../../../../extension/scripts/utils/logger");
    Logger.createModuleLogger.mockReturnValue(mockLogger);

    // Import after mocks are set up
    blobHandler = require("../../../../extension/scripts/background/handlers/blob-handler");
  });

  describe("handleBlobUrl", () => {
    describe("Normal Cases", () => {
      it("should successfully register blob URL with all parameters", async () => {
        const mockId = "blob-id-123";
        mockVoiceMessagesStore.registerDownloadUrl.mockResolvedValue(mockId);

        const message = {
          blobUrl:
            "blob:https://facebook.com/12345678-1234-1234-1234-123456789abc",
          blobType: "audio/mpeg",
          blobSize: 64000,
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.registerDownloadUrl).toHaveBeenCalledWith(
          5000,
          "blob:https://facebook.com/12345678-1234-1234-1234-123456789abc",
          null,
          "audio/mpeg",
          64000
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Successfully registered Blob URL, ID: ${mockId}, duration: 5000ms`
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Successfully registered Blob URL",
          id: mockId,
        });
      });

      it("should register blob URL without optional parameters", async () => {
        const mockId = "blob-id-456";
        mockVoiceMessagesStore.registerDownloadUrl.mockResolvedValue(mockId);

        const message = {
          blobUrl:
            "blob:https://facebook.com/87654321-4321-4321-4321-987654321cba",
          durationMs: 3000,
          timestamp: "2023-10-21T11:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.registerDownloadUrl).toHaveBeenCalledWith(
          3000,
          "blob:https://facebook.com/87654321-4321-4321-4321-987654321cba",
          null,
          undefined,
          undefined
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Successfully registered Blob URL",
          id: mockId,
        });
      });

      it("should log debug information with truncated blob URL", async () => {
        const mockId = "blob-id-789";
        mockVoiceMessagesStore.registerDownloadUrl.mockResolvedValue(mockId);

        const message = {
          blobUrl:
            "blob:https://facebook.com/very-long-uuid-12345678-1234-1234-1234-123456789abcdef",
          blobType: "audio/wav",
          blobSize: 128000,
          durationMs: 8000,
          timestamp: "2023-10-21T12:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Handling Blob URL registration message",
          {
            blobUrl: "blob:https://facebook.com/very...",
            durationMs: 8000,
            blobType: "audio/wav",
            blobSize: 128000,
            timestamp: "2023-10-21T12:00:00.000Z",
          }
        );
      });

      it("should log current store state after registration", async () => {
        const mockId = "blob-id-state";
        mockVoiceMessagesStore.registerDownloadUrl.mockResolvedValue(mockId);

        // Add some items to simulate store size
        mockVoiceMessagesStore.items.set("item1", { id: "item1" });
        mockVoiceMessagesStore.items.set("item2", { id: "item2" });

        const message = {
          blobUrl: "blob:https://facebook.com/state-test",
          durationMs: 4500,
          timestamp: "2023-10-21T13:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Current voiceMessagesStore item count",
          { itemsCount: 2 }
        );
      });

      it("should register only the original audio, never a wavUrl", async () => {
        const mockId = "blob-id-wav";
        mockVoiceMessagesStore.registerDownloadUrl.mockResolvedValue(mockId);

        const message = {
          blobUrl: "blob:https://facebook.com/wav-test",
          blobType: "audio/ogg",
          blobSize: 32000,
          durationMs: 6000,
          timestamp: "2023-10-21T14:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);

        // The page mints a WAV blob URL only on right-click and revokes it on the
        // next conversion, so the store must never hold one.
        expect(mockVoiceMessagesStore.registerDownloadUrl).toHaveBeenCalledWith(
          6000,
          "blob:https://facebook.com/wav-test",
          null,
          "audio/ogg",
          32000
        );
      });
    });

    describe("Validation and Error Handling", () => {
      it("should handle null voiceMessagesStore", async () => {
        const message = {
          blobUrl: "blob:https://facebook.com/test",
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          null,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "voiceMessagesStore does not exist"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Internal error: voiceMessagesStore does not exist",
        });
        expect(
          mockVoiceMessagesStore.registerDownloadUrl
        ).not.toHaveBeenCalled();
      });

      it("should handle missing blobUrl", async () => {
        const message = {
          blobUrl: "",
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Blob URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Blob URL or duration information",
        });
      });

      it("should handle null blobUrl", async () => {
        const message = {
          blobUrl: null,
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Blob URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Blob URL or duration information",
        });
      });

      it("should handle missing durationMs", async () => {
        const message = {
          blobUrl: "blob:https://facebook.com/test",
          durationMs: null,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Blob URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Blob URL or duration information",
        });
      });

      it("should handle zero durationMs", async () => {
        const message = {
          blobUrl: "blob:https://facebook.com/test",
          durationMs: 0,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Blob URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Blob URL or duration information",
        });
      });

      it("should handle registration error from voiceMessagesStore", async () => {
        const errorMessage = "Registration failed";
        mockVoiceMessagesStore.registerDownloadUrl.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        const message = {
          blobUrl: "blob:https://facebook.com/error-test",
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobUrl(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error occurred while registering Blob URL",
          {
            error: errorMessage,
            stack: expect.any(String),
          }
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: `Error occurred while registering Blob URL: ${errorMessage}`,
        });
      });
    });
  });

  describe("handleBlobDetection", () => {
    describe("Normal Cases", () => {
      it("should handle blob detection message with all information", async () => {
        const message = {
          url: "https://facebook.com/test",
          type: "audio",
          size: 64000,
          timestamp: "2023-10-21T10:00:00.000Z",
          blobUrl: "blob:https://facebook.com/detected",
          blobType: "audio/mpeg",
          blobSize: 64000,
        };

        const result = blobHandler.handleBlobDetection(
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Handling Blob URL detection message",
          {
            blobUrl: "blob:https://facebook.com/dete...",
            blobType: "audio/mpeg",
            blobSize: 64000,
            timestamp: "2023-10-21T10:00:00.000Z",
            error: undefined,
          }
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Blob URL detection info logged",
        });
      });

      it("should handle blob detection message without optional fields", async () => {
        const message = {
          url: "https://facebook.com/minimal",
          type: "audio",
          timestamp: "2023-10-21T11:00:00.000Z",
        };

        const result = blobHandler.handleBlobDetection(
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Handling Blob URL detection message",
          {
            blobUrl: null,
            blobType: undefined,
            blobSize: undefined,
            timestamp: "2023-10-21T11:00:00.000Z",
            error: undefined,
          }
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Blob URL detection info logged",
        });
      });

      it("should handle blob detection message with error", async () => {
        const message = {
          url: "https://facebook.com/error-case",
          type: "audio",
          timestamp: "2023-10-21T12:00:00.000Z",
          error: "Failed to analyze blob",
        };

        const result = blobHandler.handleBlobDetection(
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Handling Blob URL detection message",
          {
            blobUrl: null,
            blobType: undefined,
            blobSize: undefined,
            timestamp: "2023-10-21T12:00:00.000Z",
            error: "Failed to analyze blob",
          }
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error in Blob URL detection",
          { error: "Failed to analyze blob" }
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Blob URL detection info logged",
        });
      });
    });
  });
});
