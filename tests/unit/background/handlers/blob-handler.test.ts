/**
 * blob-handler.test.ts
 * Unit tests for blob-handler module
 */

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
      it("should successfully register blob URL with all parameters", () => {
        const mockId = "blob-id-123";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

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

      it("should register blob URL without optional parameters", () => {
        const mockId = "blob-id-456";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

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

      it("should log debug information with truncated blob URL", () => {
        const mockId = "blob-id-789";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

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

      it("should log current store state after registration", () => {
        const mockId = "blob-id-state";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

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

        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Current voiceMessagesStore item count",
          { itemsCount: 2 }
        );
      });
    });

    describe("Validation and Error Handling", () => {
      it("should handle null voiceMessagesStore", () => {
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

      it("should handle missing blobUrl", () => {
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

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Blob URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Blob URL or duration information",
        });
      });

      it("should handle null blobUrl", () => {
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

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Blob URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Blob URL or duration information",
        });
      });

      it("should handle missing durationMs", () => {
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

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Blob URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Blob URL or duration information",
        });
      });

      it("should handle zero durationMs", () => {
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

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Blob URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Blob URL or duration information",
        });
      });

      it("should handle registration error from voiceMessagesStore", () => {
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
      it("should handle blob detection message with all information", () => {
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

      it("should handle blob detection message without optional fields", () => {
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

      it("should handle blob detection message with error", () => {
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

  describe("handleBlobContent", () => {
    describe("Normal Cases", () => {
      it("should successfully download blob content with MP3 type", () => {
        const mockDownloadId = 12345;
        (global.chrome as any).downloads.download.mockImplementation(
          (options: any, callback: any) => {
            callback(mockDownloadId);
          }
        );

        const base64Data =
          "SUQzAwAAAAABUEZUIT0AAAA4AAAAL/////8AAABJRCMBAAAAAElEMwMAAAEAAAA=";
        const message = {
          blobUrl: "blob:https://facebook.com/content-test",
          blobType: "audio/mpeg",
          base64data: base64Data,
          requestId: "req-123",
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobContent(
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect((global.chrome as any).downloads.download).toHaveBeenCalledWith(
          {
            url: `data:audio/mpeg;base64,${base64Data}`,
            filename: "voice-message-2023-10-21T10-00-00.mp3",
            saveAs: false,
          },
          expect.any(Function)
        );
        expect(mockLogger.info).toHaveBeenCalledWith("Started file download", {
          downloadId: mockDownloadId,
          filename: "voice-message-2023-10-21T10-00-00.mp3",
          blobType: "audio/mpeg",
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "File download started",
          downloadId: mockDownloadId,
          filename: "voice-message-2023-10-21T10-00-00.mp3",
        });
      });

      it("should generate correct filename for different audio types", () => {
        const mockDownloadId = 67890;
        (global.chrome as any).downloads.download.mockImplementation(
          (options: any, callback: any) => {
            callback(mockDownloadId);
          }
        );

        const testCases = [
          { blobType: "audio/wav", expectedExt: ".wav" },
          { blobType: "audio/mp4", expectedExt: ".mp4" },
          { blobType: "video/mp4", expectedExt: ".mp4" },
          { blobType: "audio/ogg", expectedExt: ".ogg" },
          { blobType: "audio/aac", expectedExt: ".aac" },
          { blobType: "unknown/type", expectedExt: ".bin" },
        ];

        testCases.forEach((testCase, _index) => {
          (global.chrome as any).downloads.download.mockClear();
          mockSendResponse.mockClear();

          const message = {
            blobType: testCase.blobType,
            base64data: "dGVzdGRhdGE=",
            timestamp: "2023-10-21T15:30:45.123Z",
          };

          const result = blobHandler.handleBlobContent(
            message,
            mockSender,
            mockSendResponse
          );

          expect(result).toBe(true);
          expect(
            (global.chrome as any).downloads.download
          ).toHaveBeenCalledWith(
            expect.objectContaining({
              filename: `voice-message-2023-10-21T15-30-45${testCase.expectedExt}`,
            }),
            expect.any(Function)
          );
        });
      });

      it("should handle blob content without timestamp", () => {
        const mockDownloadId = 11111;
        (global.chrome as any).downloads.download.mockImplementation(
          (options: any, callback: any) => {
            callback(mockDownloadId);
          }
        );

        const mockTimestamp = 1698753600000; // Mock Date.now()
        jest.spyOn(Date, "now").mockReturnValue(mockTimestamp);
        jest
          .spyOn(Date.prototype, "toISOString")
          .mockReturnValue("2023-10-31T12-00-00.000Z");

        const message = {
          blobType: "audio/mpeg",
          base64data: "bW9ja2RhdGE=",
        };

        const result = blobHandler.handleBlobContent(
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect((global.chrome as any).downloads.download).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: "voice-message-2023-10-31T12-00-00.mp3",
          }),
          expect.any(Function)
        );

        jest.restoreAllMocks();
      });
    });

    describe("Validation and Error Handling", () => {
      it("should handle missing base64data", () => {
        const message = {
          blobType: "audio/mpeg",
          base64data: "",
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobContent(
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required parameters"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Missing required parameters",
        });
        expect(
          (global.chrome as any).downloads.download
        ).not.toHaveBeenCalled();
      });

      it("should handle missing blobType", () => {
        const message = {
          blobType: "",
          base64data: "dGVzdGRhdGE=",
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobContent(
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required parameters"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Missing required parameters",
        });
      });

      it("should handle download API error", () => {
        const errorMessage = "Download failed";
        (global.chrome as any).runtime.lastError = { message: errorMessage };
        (global.chrome as any).downloads.download.mockImplementation(
          (options: any, callback: any) => {
            callback(null);
          }
        );

        const message = {
          blobType: "audio/mpeg",
          base64data: "ZXJyb3J0ZXN0",
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobContent(
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error occurred while downloading file",
          { error: (global.chrome as any).runtime.lastError }
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: errorMessage,
        });
      });

      it("should handle exception during blob content processing", () => {
        // Mock Date constructor to throw error
        const originalDate = Date;
        global.Date = jest.fn(() => {
          throw new Error("Date construction failed");
        }) as any;
        global.Date.now = originalDate.now;

        const message = {
          blobType: "audio/mpeg",
          base64data: "ZXhjZXB0aW9udGVzdA==",
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = blobHandler.handleBlobContent(
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error occurred while handling blob content download",
          {
            error: "Date construction failed",
            stack: expect.any(String),
          }
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Date construction failed",
        });

        // Restore Date
        global.Date = originalDate;
      });
    });

    describe("File Extension Logic", () => {
      it("should correctly map MIME types to file extensions", () => {
        const mockDownloadId = 99999;
        (global.chrome as any).downloads.download.mockImplementation(
          (options: any, callback: any) => {
            callback(mockDownloadId);
          }
        );

        const mimeTypeTests = [
          { input: "audio/mpeg", expected: ".mp3" },
          { input: "audio/mp3", expected: ".mp3" },
          { input: "audio/mp4", expected: ".mp4" },
          { input: "video/mp4", expected: ".mp4" },
          { input: "audio/wav", expected: ".wav" },
          { input: "audio/ogg", expected: ".ogg" },
          { input: "audio/aac", expected: ".aac" },
          { input: "application/octet-stream", expected: ".bin" },
          { input: "unknown", expected: ".bin" },
        ];

        mimeTypeTests.forEach((test) => {
          (global.chrome as any).downloads.download.mockClear();

          const message = {
            blobType: test.input,
            base64data: "dGVzdA==",
            timestamp: "2023-10-21T10:00:00.000Z",
          };

          blobHandler.handleBlobContent(message, mockSender, mockSendResponse);

          expect(
            (global.chrome as any).downloads.download
          ).toHaveBeenCalledWith(
            expect.objectContaining({
              filename: expect.stringContaining(test.expected),
            }),
            expect.any(Function)
          );
        });
      });
    });

    describe("Integration Tests", () => {
      it("should work with realistic blob content download workflow", () => {
        const mockDownloadId1 = 11111;
        const mockDownloadId2 = 22222;

        (global.chrome as any).downloads.download
          .mockImplementationOnce((options: any, callback: any) =>
            callback(mockDownloadId1)
          )
          .mockImplementationOnce((options: any, callback: any) =>
            callback(mockDownloadId2)
          );

        // First download
        const message1 = {
          blobType: "audio/mpeg",
          base64data: "Zmlyc3R0ZXN0ZGF0YQ==",
          requestId: "req-1",
          timestamp: "2023-10-21T09:00:00.000Z",
        };

        let result = blobHandler.handleBlobContent(
          message1,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenLastCalledWith({
          success: true,
          message: "File download started",
          downloadId: mockDownloadId1,
          filename: "voice-message-2023-10-21T09-00-00.mp3",
        });

        // Second download with different type
        mockSendResponse.mockClear();
        const message2 = {
          blobType: "audio/wav",
          base64data: "c2Vjb25kdGVzdGRhdGE=",
          requestId: "req-2",
          timestamp: "2023-10-21T10:30:15.456Z",
        };

        result = blobHandler.handleBlobContent(
          message2,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect((global.chrome as any).downloads.download).toHaveBeenCalledTimes(
          2
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "File download started",
          downloadId: mockDownloadId2,
          filename: "voice-message-2023-10-21T10-30-15.wav",
        });
      });
    });
  });
});
