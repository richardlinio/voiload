/// <reference types="jest" />

import {
  initDownloadManager,
  setLastRightClickedInfo,
  downloadVoiceMessage,
  downloadAllVoiceMessages,
} from "../../../extension/scripts/background/download-manager";
import type {
  RightClickInfo,
} from "../../../extension/scripts/types/download";
import type { VoiceMessageStore } from "../../../extension/scripts/background/data-store";

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

// Helper function to create mock voice message store
function createMockVoiceMessageStore(): VoiceMessageStore {
  return {
    items: new Map(),
    isDurationMatch: jest.fn(),
    registerDownloadUrl: jest.fn(),
    findPendingItemByDuration: jest.fn(),
    findItemByDuration: jest.fn(),
    getDownloadUrlForElement: jest.fn(),
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

    it("should download voice message with unique identifier", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(999);
      });

      downloadVoiceMessage(
        "https://example.com/audio.mp4",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        "unique-id-123"
      );

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://example.com/audio.mp4",
          filename: "voice-message-2025-03-19-14-04-40-unique-id-123.mp4",
          saveAs: true,
        },
        expect.any(Function)
      );
    });

    it("should download voice message with unique identifier but without lastModified", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(888);
      });

      downloadVoiceMessage(
        "https://example.com/audio.mp4",
        undefined,
        "another-unique-id"
      );

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://example.com/audio.mp4",
          filename: "voice-message-2025-03-19-12-00-00-another-unique-id.mp4",
          saveAs: true,
        },
        expect.any(Function)
      );
    });
  });

  describe("downloadAllVoiceMessages", () => {
    it("should return 0 when datastore is empty", () => {
      const mockStore = createMockVoiceMessageStore();
      
      const result = downloadAllVoiceMessages(mockStore);
      
      expect(result).toBe(0);
      expect(mockChrome.downloads.download).not.toHaveBeenCalled();
    });

    it("should download all voice messages with valid URLs", () => {
      const mockStore = createMockVoiceMessageStore();
      
      // Add test items to the store
      mockStore.items.set("item1", {
        id: "item1",
        element: null,
        durationMs: 5000,
        downloadUrl: "https://example.com/audio1.mp4",
        lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        blobType: null,
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });
      
      mockStore.items.set("item2", {
        id: "item2",
        element: null,
        durationMs: 3000,
        downloadUrl: "https://example.com/audio2.mp4",
        lastModified: null,
        blobType: null,
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });

      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });

      const result = downloadAllVoiceMessages(mockStore);

      expect(result).toBe(2);
      expect(mockChrome.downloads.download).toHaveBeenCalledTimes(2);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
        }),
        expect.any(Function)
      );
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio2.mp4",
        }),
        expect.any(Function)
      );
    });

    it("should skip items without download URLs", () => {
      const mockStore = createMockVoiceMessageStore();
      
      mockStore.items.set("item1", {
        id: "item1",
        element: null,
        durationMs: 5000,
        downloadUrl: "https://example.com/audio1.mp4",
        lastModified: null,
        blobType: null,
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });
      
      mockStore.items.set("item2", {
        id: "item2",
        element: null,
        durationMs: 3000,
        downloadUrl: null,
        lastModified: null,
        blobType: null,
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });

      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });

      const result = downloadAllVoiceMessages(mockStore);

      expect(result).toBe(1);
      expect(mockChrome.downloads.download).toHaveBeenCalledTimes(1);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
        }),
        expect.any(Function)
      );
    });

    it("should skip items with empty download URLs", () => {
      const mockStore = createMockVoiceMessageStore();
      
      mockStore.items.set("item1", {
        id: "item1",
        element: null,
        durationMs: 5000,
        downloadUrl: "",
        lastModified: null,
        blobType: null,
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });

      const result = downloadAllVoiceMessages(mockStore);

      expect(result).toBe(0);
      expect(mockChrome.downloads.download).not.toHaveBeenCalled();
    });

    it("should include unique identifiers in filenames for batch download", () => {
      const mockStore = createMockVoiceMessageStore();
      
      // Add test items with different IDs
      mockStore.items.set("voice-msg-001", {
        id: "voice-msg-001",
        element: null,
        durationMs: 5000,
        downloadUrl: "https://example.com/audio1.mp4",
        lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        blobType: null,
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });
      
      mockStore.items.set("voice-msg-002", {
        id: "voice-msg-002",
        element: null,
        durationMs: 3000,
        downloadUrl: "https://example.com/audio2.mp4",
        lastModified: null,
        blobType: null,
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });

      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });

      const result = downloadAllVoiceMessages(mockStore);

      expect(result).toBe(2);
      expect(mockChrome.downloads.download).toHaveBeenCalledTimes(2);
      
      // Verify that filenames include unique identifiers
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
          filename: "voice-message-2025-03-19-14-04-40-voice-msg-001.mp4",
        }),
        expect.any(Function)
      );
      
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio2.mp4",
          filename: "voice-message-2025-03-19-12-00-00-voice-msg-002.mp4",
        }),
        expect.any(Function)
      );
    });
  });
});
