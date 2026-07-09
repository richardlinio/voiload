/**
 * download-all-handler.test.ts
 * Unit tests for download-all-handler module
 */

import { flushPromises } from "../../../helpers/flush-promises";

// Mock modules first
const mockDownloadAllVoiceMessages = jest.fn();
jest.mock("../../../../extension/scripts/background/download-manager", () => ({
  downloadAllVoiceMessages: mockDownloadAllVoiceMessages,
}));

jest.mock("../../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    DOWNLOAD_ALL_HANDLER: "download-all-handler",
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

describe("download-all-handler.ts", () => {
  let mockLogger: any;
  let downloadAllHandler: any;
  let mockVoiceMessagesStore: any;
  let mockSender: any;
  let mockSendResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

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
      findItemByDuration: jest.fn(),
    };

    // Create mock sender and response
    mockSender = {
      tab: { id: 123 },
    };
    mockSendResponse = jest.fn();

    // Set up mocks
    const { Logger } = require("../../../../extension/scripts/utils/logger");
    Logger.createModuleLogger.mockReturnValue(mockLogger);

    // Clear download manager mock
    mockDownloadAllVoiceMessages.mockClear();

    // Import after mocks are set up
    downloadAllHandler = require("../../../../extension/scripts/background/handlers/download-all-handler");
  });

  describe("handleDownloadAll", () => {
    describe("Normal Cases", () => {
      it("should handle download all request with items available", async () => {
        // Mock store with items
        mockVoiceMessagesStore.items.set("item1", {
          id: "item1",
          durationMs: 5000,
          downloadUrl: "https://example.com/audio1.mp3",
          lastModified: null,
        });

        mockVoiceMessagesStore.items.set("item2", {
          id: "item2",
          durationMs: 3000,
          downloadUrl: "https://example.com/audio2.mp3",
          lastModified: null,
        });

        mockDownloadAllVoiceMessages.mockResolvedValue(2);

        const message = {};

        const result = downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockDownloadAllVoiceMessages).toHaveBeenCalledWith(mockVoiceMessagesStore);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Started downloading all available voice messages (2 files)",
          downloadCount: 2,
        });
      });

      it("should handle download all request with no items available", async () => {
        // Empty store
        mockDownloadAllVoiceMessages.mockResolvedValue(0);

        const message = {};

        const result = downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockDownloadAllVoiceMessages).toHaveBeenCalledWith(mockVoiceMessagesStore);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "No downloadable voice messages available in cache",
          downloadCount: 0,
        });
      });

      it("should handle download all request with single item", async () => {
        mockVoiceMessagesStore.items.set("item1", {
          id: "item1",
          durationMs: 5000,
          downloadUrl: "https://example.com/audio1.mp3",
          lastModified: null,
        });

        mockDownloadAllVoiceMessages.mockResolvedValue(1);

        const message = {};

        const result = downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockDownloadAllVoiceMessages).toHaveBeenCalledWith(mockVoiceMessagesStore);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Started downloading all available voice messages (1 files)",
          downloadCount: 1,
        });
      });

      it("should handle download all request with large number of items", async () => {
        // Mock a large number of items
        for (let i = 0; i < 50; i++) {
          mockVoiceMessagesStore.items.set(`item${i}`, {
            id: `item${i}`,
            durationMs: 1000 + i * 100,
            downloadUrl: `https://example.com/audio${i}.mp3`,
            lastModified: null,
          });
        }

        mockDownloadAllVoiceMessages.mockResolvedValue(50);

        const message = {};

        const result = downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockDownloadAllVoiceMessages).toHaveBeenCalledWith(mockVoiceMessagesStore);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Started downloading all available voice messages (50 files)",
          downloadCount: 50,
        });
      });
    });

    describe("Error Handling", () => {
      it("should handle null voiceMessagesStore", async () => {
        const message = {};

        const result = downloadAllHandler.handleDownloadAll(
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
        expect(mockDownloadAllVoiceMessages).not.toHaveBeenCalled();
      });

      it("should handle undefined voiceMessagesStore", async () => {
        const message = {};

        const result = downloadAllHandler.handleDownloadAll(
          undefined,
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
        expect(mockDownloadAllVoiceMessages).not.toHaveBeenCalled();
      });

      it("should handle voiceMessagesStore without items property", async () => {
        const invalidStore = {};

        mockDownloadAllVoiceMessages.mockResolvedValue(0);

        const message = {};

        const result = downloadAllHandler.handleDownloadAll(
          invalidStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockDownloadAllVoiceMessages).toHaveBeenCalledWith(invalidStore);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "No downloadable voice messages available in cache",
          downloadCount: 0,
        });
      });
    });

    describe("Integration with downloadAllVoiceMessages", () => {
      it("should pass correct store to downloadAllVoiceMessages", async () => {
        const message = {};

        mockDownloadAllVoiceMessages.mockResolvedValue(3);

        const result = downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockDownloadAllVoiceMessages).toHaveBeenCalledTimes(1);
        expect(mockDownloadAllVoiceMessages).toHaveBeenCalledWith(mockVoiceMessagesStore);
      });

      it("should report the failure rather than reject when downloadAllVoiceMessages throws", async () => {
        const message = {};

        mockDownloadAllVoiceMessages.mockRejectedValue(
          new Error("Download failed")
        );

        // The download now runs after the listener has returned, so a rejection
        // must surface through sendResponse instead of escaping the handler.
        const result = downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockDownloadAllVoiceMessages).toHaveBeenCalledWith(
          mockVoiceMessagesStore
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message:
            "Error occurred while downloading all voice messages: Download failed",
        });
      });
    });

    describe("Logging Behavior", () => {
      it("should log debug information", async () => {
        mockDownloadAllVoiceMessages.mockResolvedValue(1);

        const message = {};

        downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Handling download all voice messages request"
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Download all voice messages handling complete"
        );
      });

      it("should log info for successful downloads", async () => {
        mockDownloadAllVoiceMessages.mockResolvedValue(5);

        const message = {};

        downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(mockLogger.info).toHaveBeenCalledWith(
          "Executing batch download of all available voice messages"
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          "Batch download initiated",
          { downloadCount: 5 }
        );
      });

      it("should log warning when no downloads available", async () => {
        mockDownloadAllVoiceMessages.mockResolvedValue(0);

        const message = {};

        downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          "No downloadable voice messages found in cache"
        );
      });
    });

    describe("Response Format", () => {
      it("should return response with correct format for successful downloads", async () => {
        mockDownloadAllVoiceMessages.mockResolvedValue(3);

        const message = {};

        downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Started downloading all available voice messages (3 files)",
          downloadCount: 3,
        });
      });

      it("should return response with correct format for no downloads", async () => {
        mockDownloadAllVoiceMessages.mockResolvedValue(0);

        const message = {};

        downloadAllHandler.handleDownloadAll(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "No downloadable voice messages available in cache",
          downloadCount: 0,
        });
      });

      it("should return error response for invalid store", async () => {
        const message = {};

        downloadAllHandler.handleDownloadAll(
          null,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Internal error: voiceMessagesStore does not exist",
        });
      });
    });
  });
});