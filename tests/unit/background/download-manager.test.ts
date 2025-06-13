/// <reference types="jest" />

import {
  initDownloadManager,
  setLastRightClickedInfo,
  downloadVoiceMessage,
  downloadBlobContent,
} from "../../../extension/scripts/background/download-manager";
import type {
  RightClickInfo,
  DownloadMessage,
} from "../../../extension/scripts/types/download";

// Mock dependencies
jest.mock("../../../extension/scripts/utils/time-utils", () => ({
  generateVoiceMessageFilename: jest.fn((lastModified?: string) => {
    if (lastModified) {
      return "voice-message-2025-03-19-14-04-40";
    }
    return "voice-message-2025-03-19-12-00-00";
  }),
}));

jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

jest.mock("../../../extension/scripts/utils/constants", () => ({
  DOWNLOAD_CONSTANTS: {
    SAVE_AS: true,
  },
}));

// Mock Chrome APIs
const mockChrome = {
  contextMenus: {
    onClicked: {
      addListener: jest.fn(),
    },
  },
  downloads: {
    download: jest.fn(),
  },
  runtime: {
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
};

// Setup global chrome mock
(global as any).chrome = mockChrome;

// Helper function to create mock right-click info
function createMockRightClickInfo(
  elementId?: string | null,
  downloadUrl?: string | null,
  lastModified?: string | null,
  tabId?: number,
  durationMs?: number
): RightClickInfo {
  return {
    elementId: elementId || null,
    downloadUrl: downloadUrl || null,
    lastModified: lastModified || null,
    tabId: tabId,
    durationMs: durationMs,
  };
}

// Helper function to create mock download message
function createMockDownloadMessage(
  base64data?: string,
  blobType?: string,
  requestId?: string,
  timestamp?: string
): DownloadMessage {
  return {
    base64data: base64data !== undefined ? base64data : "",
    blobType: blobType !== undefined ? blobType : "",
    requestId: requestId !== undefined ? requestId : "",
    timestamp: timestamp !== undefined ? timestamp : "",
  };
}

// Helper function to create mock sender
function createMockSender(tabId?: number): chrome.runtime.MessageSender {
  return {
    tab: tabId ? ({ id: tabId } as chrome.tabs.Tab) : undefined,
  };
}

describe("download-manager.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset lastError before each test
    mockChrome.runtime.lastError = undefined;
  });

  describe("initDownloadManager", () => {
    it("should initialize download manager and add context menu listener", () => {
      initDownloadManager();

      expect(
        mockChrome.contextMenus.onClicked.addListener
      ).toHaveBeenCalledTimes(1);
      expect(
        mockChrome.contextMenus.onClicked.addListener
      ).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should handle context menu click without last right-clicked info", () => {
      // Initialize without setting any right-click info
      initDownloadManager();

      // Get the correct listener (the most recent one added)
      const allCalls = mockChrome.contextMenus.onClicked.addListener.mock.calls;
      const addedListener = allCalls[allCalls.length - 1][0];

      // Simulate context menu click without setting any right-click info first
      const mockInfo: chrome.contextMenus.OnClickData = {
        menuItemId: "downloadVoiceMessage",
      } as chrome.contextMenus.OnClickData;

      addedListener(mockInfo, undefined);

      expect(mockChrome.downloads.download).not.toHaveBeenCalled();
    });

    it("should handle context menu click for downloadVoiceMessage", () => {
      // Setup last right-clicked info
      const rightClickInfo = createMockRightClickInfo(
        "test-id",
        "https://example.com/audio.mp4",
        "Wed, 19 Mar 2025 14:04:40 GMT"
      );

      // Initialize and capture the listener
      initDownloadManager();
      const addedListener =
        mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];

      // Set the right-click info
      setLastRightClickedInfo(rightClickInfo);

      // Simulate context menu click
      const mockInfo: chrome.contextMenus.OnClickData = {
        menuItemId: "downloadVoiceMessage",
      } as chrome.contextMenus.OnClickData;

      addedListener(mockInfo, undefined);

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://example.com/audio.mp4",
          filename: "voice-message-2025-03-19-14-04-40.mp4",
          saveAs: true,
        },
        expect.any(Function)
      );
    });

    it("should handle context menu click with null download URL", () => {
      initDownloadManager();
      const addedListener =
        mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];

      // Set right-click info with null download URL
      setLastRightClickedInfo(createMockRightClickInfo("test-id", null));

      // Simulate context menu click
      const mockInfo: chrome.contextMenus.OnClickData = {
        menuItemId: "downloadVoiceMessage",
      } as chrome.contextMenus.OnClickData;

      addedListener(mockInfo, undefined);

      // downloadVoiceMessage should be called but should not call chrome.downloads.download due to empty URL
      expect(mockChrome.downloads.download).not.toHaveBeenCalled();
    });

    it("should ignore non-download menu items", () => {
      initDownloadManager();
      const addedListener =
        mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];

      const mockInfo: chrome.contextMenus.OnClickData = {
        menuItemId: "otherMenuItem",
      } as chrome.contextMenus.OnClickData;

      addedListener(mockInfo, undefined);

      expect(mockChrome.downloads.download).not.toHaveBeenCalled();
    });
  });

  describe("setLastRightClickedInfo", () => {
    it("should store right-click info correctly", () => {
      const rightClickInfo = createMockRightClickInfo(
        "test-element-id",
        "https://example.com/test-audio.mp4",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        123,
        5000
      );

      setLastRightClickedInfo(rightClickInfo);

      // Initialize and trigger context menu to verify the info was stored
      initDownloadManager();
      const addedListener =
        mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];

      const mockInfo: chrome.contextMenus.OnClickData = {
        menuItemId: "downloadVoiceMessage",
      } as chrome.contextMenus.OnClickData;

      addedListener(mockInfo, undefined);

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/test-audio.mp4",
        }),
        expect.any(Function)
      );
    });

    it("should handle null values", () => {
      const rightClickInfo = createMockRightClickInfo();

      setLastRightClickedInfo(rightClickInfo);

      // Should not throw errors
      expect(() => setLastRightClickedInfo(rightClickInfo)).not.toThrow();
    });

    it("should overwrite previous right-click info", () => {
      const firstInfo = createMockRightClickInfo(
        "id1",
        "https://first.com/audio.mp4"
      );
      const secondInfo = createMockRightClickInfo(
        "id2",
        "https://second.com/audio.mp4"
      );

      setLastRightClickedInfo(firstInfo);
      setLastRightClickedInfo(secondInfo);

      // Initialize and trigger to verify the second info is used
      initDownloadManager();
      const addedListener =
        mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];

      const mockInfo: chrome.contextMenus.OnClickData = {
        menuItemId: "downloadVoiceMessage",
      } as chrome.contextMenus.OnClickData;

      addedListener(mockInfo, undefined);

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://second.com/audio.mp4",
        }),
        expect.any(Function)
      );
    });
  });

  describe("downloadVoiceMessage", () => {
    it("should download voice message with URL and lastModified", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123); // Mock download ID
      });

      downloadVoiceMessage(
        "https://example.com/audio.mp4",
        "Wed, 19 Mar 2025 14:04:40 GMT"
      );

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://example.com/audio.mp4",
          filename: "voice-message-2025-03-19-14-04-40.mp4",
          saveAs: true,
        },
        expect.any(Function)
      );
    });

    it("should download voice message without lastModified", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(456);
      });

      downloadVoiceMessage("https://example.com/audio.mp4");

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://example.com/audio.mp4",
          filename: "voice-message-2025-03-19-12-00-00.mp4",
          saveAs: true,
        },
        expect.any(Function)
      );
    });

    it("should handle empty URL", () => {
      downloadVoiceMessage("");

      expect(mockChrome.downloads.download).not.toHaveBeenCalled();
    });

    it("should handle download success", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        // Simulate successful download
        mockChrome.runtime.lastError = undefined;
        callback(789);
      });

      downloadVoiceMessage("https://example.com/audio.mp4");

      expect(mockChrome.downloads.download).toHaveBeenCalled();
    });

    it("should handle download error", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        // Simulate download error
        mockChrome.runtime.lastError = { message: "Download failed" };
        callback(undefined);
      });

      downloadVoiceMessage("https://example.com/audio.mp4");

      expect(mockChrome.downloads.download).toHaveBeenCalled();
    });
  });

  describe("downloadBlobContent", () => {
    let mockSendResponse: jest.Mock;
    let mockSender: chrome.runtime.MessageSender;

    beforeEach(() => {
      mockSendResponse = jest.fn();
      mockSender = createMockSender(123);
    });

    describe("Normal Cases", () => {
      it("should download blob content with MP3 type", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(123);
          }
        );

        const message = createMockDownloadMessage(
          "SGVsbG8gV29ybGQ=", // "Hello World" in base64
          "audio/mpeg",
          "req-123",
          "2025-03-19T14:04:40.000Z"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          {
            url: "data:audio/mpeg;base64,SGVsbG8gV29ybGQ=",
            filename: "voice-message-2025-03-19T14-04-40.mp3",
            saveAs: true,
          },
          expect.any(Function)
        );

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "File download started",
          downloadId: 123,
          filename: "voice-message-2025-03-19T14-04-40.mp3",
        });
      });

      it("should download blob content with MP4 type", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(456);
          }
        );

        const message = createMockDownloadMessage(
          "dGVzdCBkYXRh", // "test data" in base64
          "audio/mp4",
          "req-456"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          expect.objectContaining({
            url: "data:audio/mp4;base64,dGVzdCBkYXRh",
            filename: expect.stringMatching(/voice-message-.*\.mp4/),
            saveAs: true,
          }),
          expect.any(Function)
        );
      });

      it("should download blob content with WAV type", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(789);
          }
        );

        const message = createMockDownloadMessage(
          "d2F2IGRhdGE=", // "wav data" in base64
          "audio/wav"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: expect.stringMatching(/voice-message-.*\.wav/),
          }),
          expect.any(Function)
        );
      });

      it("should download blob content with OGG type", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(101);
          }
        );

        const message = createMockDownloadMessage(
          "b2dnIGRhdGE=", // "ogg data" in base64
          "audio/ogg"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: expect.stringMatching(/voice-message-.*\.ogg/),
          }),
          expect.any(Function)
        );
      });

      it("should download blob content with AAC type", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(202);
          }
        );

        const message = createMockDownloadMessage(
          "YWFjIGRhdGE=", // "aac data" in base64
          "audio/aac"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: expect.stringMatching(/voice-message-.*\.aac/),
          }),
          expect.any(Function)
        );
      });

      it("should use .bin extension for unknown blob type", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(303);
          }
        );

        const message = createMockDownloadMessage(
          "dW5rbm93biBkYXRh", // "unknown data" in base64
          "application/unknown"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: expect.stringMatching(/voice-message-.*\.bin/),
          }),
          expect.any(Function)
        );
      });

      it("should generate filename with current timestamp when no timestamp provided", () => {
        const mockDate = new Date("2025-03-19T12:00:00.000Z");
        const originalDate = global.Date;
        (global.Date as any) = jest.fn(() => mockDate);
        global.Date.now = jest.fn(() => mockDate.getTime());

        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(404);
          }
        );

        const message = createMockDownloadMessage(
          "dGVzdA==", // "test" in base64
          "audio/mp3"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: "voice-message-2025-03-19T12-00-00.mp3",
          }),
          expect.any(Function)
        );

        global.Date = originalDate;
      });
    });

    describe("Error Handling", () => {
      it("should handle missing base64data", () => {
        const message = createMockDownloadMessage(
          "", // Empty base64data
          "audio/mp3"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).not.toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Missing required parameters",
        });
      });

      it("should handle missing blobType", () => {
        const message = createMockDownloadMessage(
          "dGVzdA==", // "test" in base64
          "" // Empty blobType
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).not.toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Missing required parameters",
        });
      });

      it("should handle download error from Chrome API", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            mockChrome.runtime.lastError = { message: "Permission denied" };
            callback(undefined);
          }
        );

        const message = createMockDownloadMessage("dGVzdA==", "audio/mp3");

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Permission denied",
        });
      });

      it("should handle severe exceptions during processing", () => {
        // Reset lastError before this test
        mockChrome.runtime.lastError = undefined;

        // Mock chrome.downloads.download to throw an error
        mockChrome.downloads.download.mockImplementation(() => {
          throw new Error("Chrome API unavailable");
        });

        const message = createMockDownloadMessage("dGVzdA==", "audio/mp3");

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: "Chrome API unavailable",
        });
      });
    });

    describe("File Extension Detection", () => {
      const testCases = [
        { blobType: "audio/mpeg", expectedExt: ".mp3" },
        { blobType: "audio/mp3", expectedExt: ".mp3" },
        { blobType: "audio/mp4", expectedExt: ".mp4" },
        { blobType: "video/mp4", expectedExt: ".mp4" },
        { blobType: "audio/wav", expectedExt: ".wav" },
        { blobType: "audio/ogg", expectedExt: ".ogg" },
        { blobType: "audio/aac", expectedExt: ".aac" },
        { blobType: "application/octet-stream", expectedExt: ".bin" },
        { blobType: "text/plain", expectedExt: ".bin" },
      ];

      testCases.forEach(({ blobType, expectedExt }) => {
        it(`should use ${expectedExt} extension for ${blobType}`, () => {
          mockChrome.downloads.download.mockImplementation(
            (options, callback) => {
              callback(123);
            }
          );

          const message = createMockDownloadMessage("dGVzdA==", blobType);

          downloadBlobContent(message, mockSender, mockSendResponse);

          expect(mockChrome.downloads.download).toHaveBeenCalledWith(
            expect.objectContaining({
              filename: expect.stringMatching(new RegExp(`\\${expectedExt}$`)),
            }),
            expect.any(Function)
          );
        });
      });
    });

    describe("Edge Cases", () => {
      it("should handle very long base64 data", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(999);
          }
        );

        const longBase64 = "a".repeat(10000); // Very long base64 string
        const message = createMockDownloadMessage(longBase64, "audio/mp3");

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          expect.objectContaining({
            url: `data:audio/mp3;base64,${longBase64}`,
          }),
          expect.any(Function)
        );

        expect(mockSendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
          })
        );
      });

      it("should handle special characters in blobType", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(111);
          }
        );

        const message = createMockDownloadMessage(
          "dGVzdA==",
          "audio/mp3; charset=utf-8"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          expect.objectContaining({
            url: "data:audio/mp3; charset=utf-8;base64,dGVzdA==",
            filename: expect.stringMatching(/\.mp3$/),
          }),
          expect.any(Function)
        );
      });

      it("should handle invalid timestamp format gracefully", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            callback(999);
          }
        );

        const message = createMockDownloadMessage(
          "dGVzdA==", // Valid base64
          "audio/mp3", // Valid blobType
          "req-123",
          "invalid-timestamp" // Invalid timestamp
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        // Should fallback to current time and continue with download
        expect(mockChrome.downloads.download).toHaveBeenCalled();
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "File download started",
          downloadId: 999,
          filename: expect.stringMatching(/voice-message-.*\.mp3/),
        });
      });
    });

    describe("Integration", () => {
      it("should work with full realistic workflow", () => {
        mockChrome.downloads.download.mockImplementation(
          (options, callback) => {
            // Simulate async download
            setTimeout(() => {
              callback(555);
            }, 0);
          }
        );

        const message = createMockDownloadMessage(
          "UklGRjAaAABXQVZFZm10IBAAAAABAAIAABAAAAAAAAAEAA==", // Real WAV header base64
          "audio/wav",
          "voice-msg-req-12345",
          "2025-03-19T14:04:40.123Z"
        );

        downloadBlobContent(message, mockSender, mockSendResponse);

        expect(mockChrome.downloads.download).toHaveBeenCalledWith(
          {
            url: "data:audio/wav;base64,UklGRjAaAABXQVZFZm10IBAAAAABAAIAABAAAAAAAAAEAA==",
            filename: "voice-message-2025-03-19T14-04-40.wav",
            saveAs: true,
          },
          expect.any(Function)
        );
      });
    });
  });
});
