/**
 * right-click-handler.test.ts
 * Unit tests for right-click-handler module
 */

import { flushPromises } from "../../../helpers/flush-promises";

// Mock modules first
const mockSetLastRightClickedInfo = jest.fn();
jest.mock("../../../../extension/scripts/background/download-manager", () => ({
  setLastRightClickedInfo: mockSetLastRightClickedInfo,
}));

jest.mock("../../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    RIGHT_CLICK_HANDLER: "right-click-handler",
    DATA_STORE: "data-store",
  },
  MESSAGE_ACTIONS: {
    DOWNLOAD_ALL_VOICE_MESSAGES: "downloadAllVoiceMessages",
  },
  // Needed by the shared data-store search the handler delegates to
  // (mirrors production values, pinned in constants.test.ts)
  MATCHING_TOLERANCE: 1000,
  EXACT_MATCHING_TOLERANCE: 5,
  TIME_CONSTANTS: {
    DATA_RETENTION_PERIOD: 7 * 24 * 60 * 60 * 1000,
  },
  STORAGE_KEYS: {
    VOICE_MESSAGES: "voiceMessages",
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

describe("right-click-handler.ts", () => {
  let mockLogger: any;
  let rightClickHandler: any;
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

    // Create mock voice messages store — `getAllItems` reads through the seeded
    // Map so tests keep seeding `items` while the handler uses the async accessors
    mockVoiceMessagesStore = {
      items: new Map(),
      findItemByDuration: jest.fn(),
      getAllItems: jest.fn(async () =>
        Array.from(mockVoiceMessagesStore.items.values())
      ),
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
    mockSetLastRightClickedInfo.mockClear();

    // Import after mocks are set up
    rightClickHandler = require("../../../../extension/scripts/background/handlers/right-click-handler");
  });

  describe("handleRightClick", () => {
    describe("Normal Cases", () => {
      it("should handle right-click with valid download URL", async () => {
        const message = {
          elementId: "element-123",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Ready to download voice message",
        });
      });

      it("should handle right-click without download URL but find match in store", async () => {
        // Mock store to have matching item
        const matchingItem = {
          id: "stored-item",
          durationMs: 5002,
          downloadUrl: "https://example.com/matched.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
        };
        mockVoiceMessagesStore.items.set("stored-item", matchingItem);
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(matchingItem);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.findItemByDuration).toHaveBeenCalledWith(
          5000
        );
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/matched.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Ready to download voice message",
        });
      });

      it("should handle right-click without tab ID", async () => {
        const message = {
          elementId: "element-123",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: null,
          durationMs: 5000,
        };

        const senderWithoutTab = { tab: undefined };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          senderWithoutTab,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: null,
          tabId: undefined,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
      });

      it("should record right-click info and suggest download all when no valid download URL", async () => {
        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        // No matching items in store
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(null);

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          action: "downloadAllVoiceMessages",
          message: "No matching voice message found, ready to download all available voice messages",
        });
      });
    });

    describe("Duration Matching Logic", () => {
      it("should match an integer-second DOM duration against a fractional blob duration", async () => {
        // Delegates to the shared data-store search when the store has no
        // findItemByDuration method (real runtime fixture: valuemax=61 ↔ 60547ms)
        delete mockVoiceMessagesStore.findItemByDuration;

        const fixtureItem = {
          id: "fixture-61s",
          durationMs: 60547,
          downloadUrl: "https://example.com/61s.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("fixture-61s", fixtureItem);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 61000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/61s.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 61000,
          isWav: false,
          blobType: null,
        });
      });

      it("should not match items outside the matching tolerance", async () => {
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(null);

        // Add item outside tolerance (2s difference)
        const outsideToleranceItem = {
          id: "outside-item",
          durationMs: 7000, // 2000ms difference, outside tolerance
          downloadUrl: "https://example.com/outside.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("outside-item", outsideToleranceItem);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          action: "downloadAllVoiceMessages",
          message: "No matching voice message found, ready to download all available voice messages",
        });
      });

      it("should not match items without download URL", async () => {
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(null);

        // Add item without download URL
        const noUrlItem = {
          id: "no-url-item",
          durationMs: 5000, // Perfect match but no URL
          downloadUrl: null,
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("no-url-item", noUrlItem);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          action: "downloadAllVoiceMessages",
          message: "No matching voice message found, ready to download all available voice messages",
        });
      });

      it("should not match items without durationMs", async () => {
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(null);

        // Add item without durationMs
        const noDurationItem = {
          id: "no-duration-item",
          durationMs: null,
          downloadUrl: "https://example.com/no-duration.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("no-duration-item", noDurationItem);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          action: "downloadAllVoiceMessages",
          message: "No matching voice message found, ready to download all available voice messages",
        });
      });

      it("should return the nearest item when multiple matches exist", async () => {
        delete mockVoiceMessagesStore.findItemByDuration;

        // Add multiple matching items
        const fartherMatch = {
          id: "farther-match",
          durationMs: 5202,
          downloadUrl: "https://example.com/farther.mp3",
          lastModified: null,
        };
        const nearerMatch = {
          id: "nearer-match",
          durationMs: 5101,
          downloadUrl: "https://example.com/nearer.mp3",
          lastModified: null,
        };

        mockVoiceMessagesStore.items.set("farther-match", fartherMatch);
        mockVoiceMessagesStore.items.set("nearer-match", nearerMatch);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        // Should match the item with the smallest duration difference
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/nearer.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
      });
    });

    describe("WAV re-encoding preference", () => {
      it("should prefer the wavUrl the page sent and mark isWav true", async () => {
        // The store holds only the original audio; the page re-encodes on
        // right-click and hands the WAV blob URL over on the message.
        const matchingItem = {
          id: "wav-item",
          durationMs: 5002,
          downloadUrl: "https://example.com/original.ogg",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
        };
        mockVoiceMessagesStore.items.set("wav-item", matchingItem);
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(matchingItem);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
          wavUrl: "blob:https://example.com/wav-reencoded",
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "blob:https://example.com/wav-reencoded",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          tabId: 123,
          durationMs: 5000,
          isWav: true,
          blobType: null,
        });
      });

      it("should fall back to the original downloadUrl and mark isWav false when the matched item has no wavUrl", async () => {
        const matchingItem = {
          id: "no-wav-item",
          durationMs: 5002,
          downloadUrl: "https://example.com/original.ogg",
          // Carried through so the download is named after the container the
          // audio is actually in, instead of being mislabelled a WAV.
          blobType: "audio/ogg",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
        };
        mockVoiceMessagesStore.items.set("no-wav-item", matchingItem);
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(matchingItem);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/original.ogg",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: "audio/ogg",
        });
      });
    });

    describe("Store Method Fallback", () => {
      it("should fallback to iteration when findItemByDuration is not available", async () => {
        // Remove findItemByDuration method
        delete mockVoiceMessagesStore.findItemByDuration;

        const matchingItem = {
          id: "iteration-only",
          durationMs: 5002,
          downloadUrl: "https://example.com/iteration-only.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("iteration-only", matchingItem);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/iteration-only.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
      });

      it("should trust the store method's null result and fall back to download-all", async () => {
        // The store method owns the matching semantics (including the
        // ambiguity refusal), so its null must not be second-guessed
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(null);

        const nearbyItem = {
          id: "nearby-item",
          durationMs: 5001,
          downloadUrl: "https://example.com/nearby.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("nearby-item", nearbyItem);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.findItemByDuration).toHaveBeenCalledWith(
          5000
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          action: "downloadAllVoiceMessages",
          message: "No matching voice message found, ready to download all available voice messages",
        });
      });
    });

    describe("Validation and Error Handling", () => {
      it("should handle null voiceMessagesStore", async () => {
        const message = {
          elementId: "element-123",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
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
        expect(mockSetLastRightClickedInfo).not.toHaveBeenCalled();
      });

      it("should handle message without durationMs when searching store", async () => {
        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: undefined,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          tabId: 123,
          durationMs: undefined,
          isWav: false,
          blobType: null,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          action: "downloadAllVoiceMessages",
          message: "No matching voice message found, ready to download all available voice messages",
        });
      });

      it("should handle empty elementId", async () => {
        const message = {
          elementId: "",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
      });
    });

    describe("Integration Tests", () => {
      it("should work with realistic right-click workflow", async () => {
        // Step 1: Right-click without URL, no match in store
        const message1 = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(null);

        let result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message1,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenLastCalledWith({
          success: true,
          action: "downloadAllVoiceMessages",
          message: "No matching voice message found, ready to download all available voice messages",
        });

        // Step 2: Add matching item to store
        mockSendResponse.mockClear();
        const matchingItem = {
          id: "late-arrival",
          durationMs: 5002,
          downloadUrl: "https://example.com/late-arrival.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
        };
        mockVoiceMessagesStore.items.set("late-arrival", matchingItem);
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(matchingItem);

        // Step 3: Right-click again, should find match
        const message2 = {
          elementId: "element-456",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message2,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenLastCalledWith({
          elementId: "element-456",
          downloadUrl: "https://example.com/late-arrival.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Ready to download voice message",
        });
      });

      it("should prefer provided download URL over store lookup", async () => {
        // Add matching item to store
        const storeItem = {
          id: "store-item",
          durationMs: 5000,
          downloadUrl: "https://example.com/from-store.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("store-item", storeItem);
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(storeItem);

        // Message with its own download URL
        const message = {
          elementId: "element-123",
          downloadUrl: "https://example.com/from-message.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        // Should use URL from message, not from store
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/from-message.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          tabId: 123,
          durationMs: 5000,
          isWav: false,
          blobType: null,
        });
        // Should not call store lookup methods
        expect(
          mockVoiceMessagesStore.findItemByDuration
        ).not.toHaveBeenCalled();
      });

      it("should suggest download all when no download URL found", async () => {
        // Mock store with some items but no matching duration
        mockVoiceMessagesStore.items.set("item1", {
          id: "item1",
          durationMs: 3000,
          downloadUrl: "https://example.com/audio1.mp3",
          lastModified: null,
        });
        
        mockVoiceMessagesStore.items.set("item2", {
          id: "item2",
          durationMs: 7000,
          downloadUrl: "https://example.com/audio2.mp3",
          lastModified: null,
        });

        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(null);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          action: "downloadAllVoiceMessages",
          message: "No matching voice message found, ready to download all available voice messages",
        });
      });

      it("should suggest download all even when no items in store", async () => {
        mockVoiceMessagesStore.findItemByDuration.mockResolvedValue(null);

        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );
        await flushPromises();

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          action: "downloadAllVoiceMessages",
          message: "No matching voice message found, ready to download all available voice messages",
        });
      });
    });
  });
});
