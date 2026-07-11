/// <reference types="jest" />

import * as downloadManager from "../../../extension/scripts/background/download-manager";
import type {
  RightClickInfo,
} from "../../../extension/scripts/types/download";
import type { VoiceMessageStore } from "../../../extension/scripts/background/data-store";

const {
  initDownloadManager,
  setLastRightClickedInfo,
  downloadVoiceMessage,
  downloadAllVoiceMessages,
} = downloadManager;

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

// Spread the real constants rather than hand-copying them: the extension names
// are also read by the un-mocked download-url module, and a hand-written mock
// silently yields `undefined` (and a filename ending in "undefined") the moment
// a constant is renamed.
jest.mock("../../../extension/scripts/utils/constants", () => ({
  ...jest.requireActual("../../../extension/scripts/utils/constants"),
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
  tabs: {
    // The batch download asks the page to re-encode each message in turn.
    sendMessage: jest.fn(),
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
  const store: VoiceMessageStore = {
    items: new Map(),
    registerDownloadUrl: jest.fn(),
    findItemByDuration: jest.fn(),
    // Reads through the seeded Map, mirroring the real hydrate-then-read store
    getAllItems: jest.fn(async () => Array.from(store.items.values())),
    updateItem: jest.fn(),
  };
  return store;
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

    it("should handle context menu click for downloadVoiceMessage", async () => {
      // Setup last right-clicked info
      const rightClickInfo = createMockRightClickInfo(
        "test-id",
        "https://example.com/audio.mp4",
        "Wed, 19 Mar 2025 14:04:40 GMT"
      );

      // The listener awaits Chrome accepting the download, which is signalled by
      // this callback, so the WAV blob URL survives until Chrome has taken it.
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(1);
      });

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

      // The listener now re-encodes to WAV before handing the URL to Chrome
      await addedListener(mockInfo, undefined);

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://example.com/audio.mp4",
          filename: "voice-message-2025-03-19-14-04-40.mp4",
          saveAs: true,
        },
        expect.any(Function)
      );
    });

    it("should trigger batch download when download URL is null", async () => {
      const mockStore = createMockVoiceMessageStore();
      mockStore.items.set("voice-msg-001", {
        id: "voice-msg-001",
        durationMs: 3000,
        downloadUrl: "https://example.com/audio1.mp4",
        lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        element: null,
        timestamp: Date.now(),
        isPending: false,
      });

      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(999);
      });

      initDownloadManager(mockStore);
      const addedListener =
        mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];

      // Set right-click info with null download URL
      setLastRightClickedInfo(createMockRightClickInfo("test-id", null));

      // Simulate context menu click
      const mockInfo: chrome.contextMenus.OnClickData = {
        menuItemId: "downloadVoiceMessage",
      } as chrome.contextMenus.OnClickData;

      // The listener now awaits the session-storage-backed store before downloading
      await addedListener(mockInfo, undefined);

      // Should call chrome.downloads.download for batch download with first file saveAs: true
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
          saveAs: true, // First file should show dialog when triggered from context menu
        }),
        expect.any(Function)
      );
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
    it("should store right-click info correctly", async () => {
      const rightClickInfo = createMockRightClickInfo(
        "test-element-id",
        "https://example.com/test-audio.mp4",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        123,
        5000
      );

      // The stored tabId and durationMs make the listener ask the page to
      // re-encode; a page that cannot convert leaves the original audio.
      mockChrome.tabs.sendMessage.mockResolvedValue({ wavUrl: null });

      setLastRightClickedInfo(rightClickInfo);

      // Initialize and trigger context menu to verify the info was stored
      initDownloadManager();
      const addedListener =
        mockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];

      const mockInfo: chrome.contextMenus.OnClickData = {
        menuItemId: "downloadVoiceMessage",
      } as chrome.contextMenus.OnClickData;

      await addedListener(mockInfo, undefined);

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

    it("should download voice message with saveAs: false", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(777);
      });

      downloadVoiceMessage(
        "https://example.com/audio.mp4",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        "test-id",
        false
      );

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://example.com/audio.mp4",
          filename: "voice-message-2025-03-19-14-04-40-test-id.mp4",
          saveAs: false,
        },
        expect.any(Function)
      );
    });

    it("should download voice message with saveAs: true explicitly", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(666);
      });

      downloadVoiceMessage(
        "https://example.com/audio.mp4",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        "test-id",
        true
      );

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://example.com/audio.mp4",
          filename: "voice-message-2025-03-19-14-04-40-test-id.mp4",
          saveAs: true,
        },
        expect.any(Function)
      );
    });

    it("should produce a .wav filename when isWav is true", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(555);
      });

      downloadVoiceMessage(
        "https://example.com/audio.wav",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        "test-id",
        true,
        true
      );

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://example.com/audio.wav",
          filename: "voice-message-2025-03-19-14-04-40-test-id.wav",
          saveAs: true,
        },
        expect.any(Function)
      );
    });

    it("should name un-converted audio after its own container, not .wav", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(544);
      });

      // The blob path always records the blob's MIME type, so a voice message
      // whose WAV conversion failed is downloaded as the opus it still is.
      downloadVoiceMessage(
        "blob:https://www.facebook.com/abc",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        "test-id",
        true,
        false,
        "audio/ogg"
      );

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "blob:https://www.facebook.com/abc",
          filename: "voice-message-2025-03-19-14-04-40-test-id.ogg",
          saveAs: true,
        },
        expect.any(Function)
      );
    });

    it("should fall back to .mp4 when the container is unknown", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(533);
      });

      // The webRequest path registers a CDN URL without reading the body, so no
      // MIME type is known. Facebook serves that media as MP4.
      downloadVoiceMessage(
        "https://cdn.fbcdn.net/audio.mp4",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        "test-id",
        true,
        false
      );

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: "https://cdn.fbcdn.net/audio.mp4",
          filename: "voice-message-2025-03-19-14-04-40-test-id.mp4",
          saveAs: true,
        },
        expect.any(Function)
      );
    });

    it("should never name un-converted audio .wav when isWav is omitted", () => {
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(522);
      });

      // The default must be the safe direction: a mislabelled .wav opens in no
      // player, while a WAV named after its source container still plays.
      downloadVoiceMessage(
        "blob:https://www.facebook.com/abc",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        "test-id",
        true
      );

      const call = mockChrome.downloads.download.mock.calls[0]![0];
      expect(call.filename).not.toMatch(/\.wav$/);
    });
  });

  describe("downloadAllVoiceMessages", () => {
    it("should return 0 when datastore is empty", async () => {
      const mockStore = createMockVoiceMessageStore();
      
      const result = await downloadAllVoiceMessages(mockStore);
      
      expect(result).toBe(0);
      expect(mockChrome.downloads.download).not.toHaveBeenCalled();
    });

    it("should download all voice messages with valid URLs", async () => {
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

      const result = await downloadAllVoiceMessages(mockStore);

      expect(result).toBe(2);
      expect(mockChrome.downloads.download).toHaveBeenCalledTimes(2);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
          saveAs: false,
        }),
        expect.any(Function)
      );
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio2.mp4",
          saveAs: false,
        }),
        expect.any(Function)
      );
    });

    it("should skip items without download URLs", async () => {
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

      const result = await downloadAllVoiceMessages(mockStore);

      expect(result).toBe(1);
      expect(mockChrome.downloads.download).toHaveBeenCalledTimes(1);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
          saveAs: false,
        }),
        expect.any(Function)
      );
    });

    it("should skip items with empty download URLs", async () => {
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

      const result = await downloadAllVoiceMessages(mockStore);

      expect(result).toBe(0);
      expect(mockChrome.downloads.download).not.toHaveBeenCalled();
    });

    it("should include unique identifiers in filenames for batch download", async () => {
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

      const result = await downloadAllVoiceMessages(mockStore);

      expect(result).toBe(2);
      expect(mockChrome.downloads.download).toHaveBeenCalledTimes(2);
      
      // Verify that filenames include unique identifiers and saveAs is false for batch downloads
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
          filename: "voice-message-2025-03-19-14-04-40-voice-msg-001.mp4",
          saveAs: false,
        }),
        expect.any(Function)
      );

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio2.mp4",
          filename: "voice-message-2025-03-19-12-00-00-voice-msg-002.mp4",
          saveAs: false,
        }),
        expect.any(Function)
      );
    });

    it("should download with first dialog when showFirstDialog is true", async () => {
      const mockStore = createMockVoiceMessageStore();
      mockStore.items.set("voice-msg-001", {
        id: "voice-msg-001",
        durationMs: 3000,
        downloadUrl: "https://example.com/audio1.mp4",
        lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        element: null,
        timestamp: Date.now(),
        isPending: false,
      });
      mockStore.items.set("voice-msg-002", {
        id: "voice-msg-002",
        durationMs: 5000,
        downloadUrl: "https://example.com/audio2.mp4",
        lastModified: null,
        element: null,
        timestamp: Date.now(),
        isPending: false,
      });

      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });

      const result = await downloadAllVoiceMessages(mockStore, true);

      expect(result).toBe(2);
      expect(mockChrome.downloads.download).toHaveBeenCalledTimes(2);
      
      // First file should have saveAs: true
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
          filename: "voice-message-2025-03-19-14-04-40-voice-msg-001.mp4",
          saveAs: true,
        }),
        expect.any(Function)
      );

      // Second file should have saveAs: false
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio2.mp4",
          filename: "voice-message-2025-03-19-12-00-00-voice-msg-002.mp4",
          saveAs: false,
        }),
        expect.any(Function)
      );
    });

    it("should download single file with dialog when showFirstDialog is true", async () => {
      const mockStore = createMockVoiceMessageStore();
      mockStore.items.set("voice-msg-001", {
        id: "voice-msg-001",
        durationMs: 3000,
        downloadUrl: "https://example.com/audio1.mp4",
        lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        element: null,
        timestamp: Date.now(),
        isPending: false,
      });

      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });

      const result = await downloadAllVoiceMessages(mockStore, true);

      expect(result).toBe(1);
      expect(mockChrome.downloads.download).toHaveBeenCalledTimes(1);
      
      // Single file should have saveAs: true when showFirstDialog is true
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
          filename: "voice-message-2025-03-19-14-04-40-voice-msg-001.mp4",
          saveAs: true,
        }),
        expect.any(Function)
      );
    });

    it("should download the WAV the page re-encodes for each item, under a .wav filename", async () => {
      const mockStore = createMockVoiceMessageStore();
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

      // The store holds only the original; the page converts on request.
      mockChrome.tabs.sendMessage.mockResolvedValue({
        wavUrl: "https://example.com/audio1.wav",
      });
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });

      const result = await downloadAllVoiceMessages(mockStore, false, 42);

      expect(result).toBe(1);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(42, {
        action: "requestWav",
        durationMs: 5000,
      });
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.wav",
          filename: "voice-message-2025-03-19-14-04-40-voice-msg-001.wav",
          saveAs: false,
        }),
        expect.any(Function)
      );
    });

    it("should download the original audio when the page cannot re-encode it", async () => {
      const mockStore = createMockVoiceMessageStore();
      mockStore.items.set("voice-msg-002", {
        id: "voice-msg-002",
        element: null,
        durationMs: 5000,
        downloadUrl: "https://example.com/audio2.ogg",
        lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        blobType: "audio/ogg",
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });

      // A message the page can no longer convert is downloaded in its original
      // format rather than skipped.
      mockChrome.tabs.sendMessage.mockResolvedValue({ wavUrl: null });
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(124);
      });

      const result = await downloadAllVoiceMessages(mockStore, false, 42);

      expect(result).toBe(1);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio2.ogg",
          filename: "voice-message-2025-03-19-14-04-40-voice-msg-002.ogg",
        }),
        expect.any(Function)
      );
    });

    it("should fall back to item.downloadUrl with a .ogg filename when wavUrl is null and blobType is audio/ogg", async () => {
      const mockStore = createMockVoiceMessageStore();
      mockStore.items.set("voice-msg-001", {
        id: "voice-msg-001",
        element: null,
        durationMs: 5000,
        downloadUrl: "https://example.com/audio1.mp4",
        lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        blobType: "audio/ogg",
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });

      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });

      const result = await downloadAllVoiceMessages(mockStore);

      expect(result).toBe(1);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
          filename: "voice-message-2025-03-19-14-04-40-voice-msg-001.ogg",
          saveAs: false,
        }),
        expect.any(Function)
      );
    });

    it("should name a fallback item by its blobType, and .mp4 when blobType is unknown", async () => {
      const mockStore = createMockVoiceMessageStore();
      mockStore.items.set("voice-msg-ogg", {
        id: "voice-msg-ogg",
        element: null,
        durationMs: 5000,
        downloadUrl: "https://example.com/audio1.mp4",
        lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        blobType: "audio/ogg",
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });
      mockStore.items.set("voice-msg-unknown", {
        id: "voice-msg-unknown",
        element: null,
        durationMs: 5000,
        downloadUrl: "https://example.com/audio2.mp4",
        lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        blobType: null,
        blobSize: null,
        timestamp: Date.now(),
        isPending: false,
      });

      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });

      const result = await downloadAllVoiceMessages(mockStore);

      expect(result).toBe(2);
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio1.mp4",
          filename: "voice-message-2025-03-19-14-04-40-voice-msg-ogg.ogg",
          saveAs: false,
        }),
        expect.any(Function)
      );
      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio2.mp4",
          filename: "voice-message-2025-03-19-14-04-40-voice-msg-unknown.mp4",
          saveAs: false,
        }),
        expect.any(Function)
      );
    });
  });
});
