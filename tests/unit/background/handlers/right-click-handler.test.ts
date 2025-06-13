/**
 * right-click-handler.test.ts
 * Unit tests for right-click-handler module
 */

// Mock modules first
const mockSetLastRightClickedInfo = jest.fn();
jest.mock("../../../../extension/scripts/background/download-manager", () => ({
  setLastRightClickedInfo: mockSetLastRightClickedInfo,
}));

jest.mock("../../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    RIGHT_CLICK_HANDLER: "right-click-handler",
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
    mockSetLastRightClickedInfo.mockClear();

    // Import after mocks are set up
    rightClickHandler = require("../../../../extension/scripts/background/handlers/right-click-handler");
  });

  describe("handleRightClick", () => {
    describe("Normal Cases", () => {
      it("should handle right-click with valid download URL", () => {
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

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          tabId: 123,
          durationMs: 5000,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Ready to download voice message",
        });
      });

      it("should handle right-click without download URL but find match in store", () => {
        // Mock store to have matching item
        const matchingItem = {
          id: "stored-item",
          durationMs: 5002,
          downloadUrl: "https://example.com/matched.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
        };
        mockVoiceMessagesStore.items.set("stored-item", matchingItem);
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(matchingItem);

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
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Ready to download voice message",
        });
      });

      it("should handle right-click without download URL and fallback to iteration", () => {
        // Mock findItemByDuration to return null, but add matching item to store
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(null);
        const matchingItem = {
          id: "iteration-match",
          durationMs: 5003, // Within 5ms tolerance
          downloadUrl: "https://example.com/iteration.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("iteration-match", matchingItem);

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

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/iteration.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
        });
      });

      it("should handle right-click without tab ID", () => {
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

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: null,
          tabId: undefined,
          durationMs: 5000,
        });
      });

      it("should record right-click info even without valid download URL", () => {
        const message = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        // No matching items in store
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(null);

        const result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Right-click info recorded, but download URL not found",
        });
      });
    });

    describe("Duration Matching Logic", () => {
      it("should match items within 5ms tolerance boundary", () => {
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(null);

        // Add item exactly 5ms different (boundary case)
        const boundaryItem = {
          id: "boundary-item",
          durationMs: 5005, // Exactly 5ms difference
          downloadUrl: "https://example.com/boundary.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("boundary-item", boundaryItem);

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

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/boundary.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
        });
      });

      it("should not match items outside 5ms tolerance", () => {
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(null);

        // Add item outside tolerance (6ms difference)
        const outsideToleranceItem = {
          id: "outside-item",
          durationMs: 5006, // 6ms difference, outside tolerance
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

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Right-click info recorded, but download URL not found",
        });
      });

      it("should not match items without download URL", () => {
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(null);

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

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Right-click info recorded, but download URL not found",
        });
      });

      it("should not match items without durationMs", () => {
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(null);

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

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Right-click info recorded, but download URL not found",
        });
      });

      it("should return first matching item when multiple matches exist", () => {
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(null);

        // Add multiple matching items
        const firstMatch = {
          id: "first-match",
          durationMs: 5002,
          downloadUrl: "https://example.com/first.mp3",
          lastModified: null,
        };
        const secondMatch = {
          id: "second-match",
          durationMs: 5001,
          downloadUrl: "https://example.com/second.mp3",
          lastModified: null,
        };

        mockVoiceMessagesStore.items.set("first-match", firstMatch);
        mockVoiceMessagesStore.items.set("second-match", secondMatch);

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

        expect(result).toBe(true);
        // Should match the first one in iteration order
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/first.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
        });
      });
    });

    describe("Store Method Fallback", () => {
      it("should fallback to iteration when findItemByDuration is not available", () => {
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

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/iteration-only.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
        });
      });

      it("should try both methods when findItemByDuration returns null", () => {
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(null);

        const iterationMatch = {
          id: "iteration-match",
          durationMs: 5001,
          downloadUrl: "https://example.com/iteration-match.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("iteration-match", iterationMatch);

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

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.findItemByDuration).toHaveBeenCalledWith(
          5000
        );
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/iteration-match.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
        });
      });
    });

    describe("Validation and Error Handling", () => {
      it("should handle null voiceMessagesStore", () => {
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

      it("should handle message without durationMs when searching store", () => {
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

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          tabId: 123,
          durationMs: undefined,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Right-click info recorded, but download URL not found",
        });
      });

      it("should handle empty elementId", () => {
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

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "",
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: null,
          tabId: 123,
          durationMs: 5000,
        });
      });
    });

    describe("Integration Tests", () => {
      it("should work with realistic right-click workflow", () => {
        // Step 1: Right-click without URL, no match in store
        const message1 = {
          elementId: "element-123",
          downloadUrl: null,
          lastModified: null,
          durationMs: 5000,
        };

        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(null);

        let result = rightClickHandler.handleRightClick(
          mockVoiceMessagesStore,
          message1,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenLastCalledWith({
          success: true,
          message: "Right-click info recorded, but download URL not found",
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
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(matchingItem);

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

        expect(result).toBe(true);
        expect(mockSetLastRightClickedInfo).toHaveBeenLastCalledWith({
          elementId: "element-456",
          downloadUrl: "https://example.com/late-arrival.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          tabId: 123,
          durationMs: 5000,
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Ready to download voice message",
        });
      });

      it("should prefer provided download URL over store lookup", () => {
        // Add matching item to store
        const storeItem = {
          id: "store-item",
          durationMs: 5000,
          downloadUrl: "https://example.com/from-store.mp3",
          lastModified: null,
        };
        mockVoiceMessagesStore.items.set("store-item", storeItem);
        mockVoiceMessagesStore.findItemByDuration.mockReturnValue(storeItem);

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

        expect(result).toBe(true);
        // Should use URL from message, not from store
        expect(mockSetLastRightClickedInfo).toHaveBeenCalledWith({
          elementId: "element-123",
          downloadUrl: "https://example.com/from-message.mp3",
          lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
          tabId: 123,
          durationMs: 5000,
        });
        // Should not call store lookup methods
        expect(
          mockVoiceMessagesStore.findItemByDuration
        ).not.toHaveBeenCalled();
      });
    });
  });
});
