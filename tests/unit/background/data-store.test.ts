/// <reference types="jest" />

import {
  createDataStore,
  isDurationMatch,
  registerDownloadUrl,
  findPendingItemByDuration,
  findItemByDuration,
  getDownloadUrlForElement,
  cleanupOldItems,
} from "../../../extension/scripts/background/data-store";
import type {
  VoiceMessageStore,
  VoiceMessageItem,
} from "../../../extension/scripts/types/voice-message";

// Helper to reset singleton instance via module scope manipulation
function resetDataStoreSingleton() {
  // Access the module's singleton instance and reset it
  const dataStoreModule = require("../../../extension/scripts/background/data-store");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (dataStoreModule as any).voiceMessagesInstance = null;
}

// Mock dependencies
jest.mock("../../../extension/scripts/utils/id-generator", () => ({
  generateVoiceMessageId: jest.fn(() => "voice-msg-1710859680000-abcd1234"),
}));

jest.mock("../../../extension/scripts/utils/time-utils", () => ({
  secondsToMilliseconds: jest.fn((seconds: number) =>
    Math.round(seconds * 1000)
  ),
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
  MODULE_NAMES: {
    DATA_STORE: "data-store",
  },
  MATCHING_TOLERANCE: 5,
  TIME_CONSTANTS: {
    DATA_RETENTION_PERIOD: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Helper function to create a mock element
function createMockElement(id?: string, ariaValuemax?: string): Element {
  const element = {
    getAttribute: jest.fn((attr: string) => {
      if (attr === "data-voice-message-id") {
        return id || null;
      }
      if (attr === "aria-valuemax") {
        return ariaValuemax || null;
      }
      return null;
    }),
    hasAttribute: jest.fn((attr: string) => {
      if (attr === "aria-valuemax") {
        return !!ariaValuemax;
      }
      return false;
    }),
  } as unknown as Element;
  return element;
}

describe("data-store.ts", () => {
  let mockStore: VoiceMessageStore;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    resetDataStoreSingleton();
    // Create a fresh store instance
    mockStore = createDataStore();
    mockStore.items.clear();
  });

  describe("createDataStore", () => {
    it("should create a singleton data store instance", () => {
      const store1 = createDataStore();
      const store2 = createDataStore();

      expect(store1).toBe(store2);
      expect(store1).toHaveProperty("items");
      expect(store1.items).toBeInstanceOf(Map);
    });

    it("should have all required methods", () => {
      const store = createDataStore();

      expect(typeof store.isDurationMatch).toBe("function");
      expect(typeof store.registerDownloadUrl).toBe("function");
      expect(typeof store.findPendingItemByDuration).toBe("function");
      expect(typeof store.findItemByDuration).toBe("function");
      expect(typeof store.getDownloadUrlForElement).toBe("function");
    });

    it("should initialize with empty items map", () => {
      const store = createDataStore();

      expect(store.items.size).toBe(0);
    });
  });

  describe("isDurationMatch", () => {
    describe("Normal Cases", () => {
      it("should return true for exact duration match", () => {
        expect(isDurationMatch(1000, 1000)).toBe(true);
        expect(isDurationMatch(5000, 5000)).toBe(true);
        expect(isDurationMatch(0, 0)).toBe(true);
      });

      it("should return true for durations within default tolerance", () => {
        expect(isDurationMatch(1000, 1005)).toBe(true); // +5ms
        expect(isDurationMatch(1000, 995)).toBe(true); // -5ms
        expect(isDurationMatch(1000, 1003)).toBe(true); // +3ms
        expect(isDurationMatch(1000, 997)).toBe(true); // -3ms
      });

      it("should return false for durations outside default tolerance", () => {
        expect(isDurationMatch(1000, 1006)).toBe(false); // +6ms
        expect(isDurationMatch(1000, 994)).toBe(false); // -6ms
        expect(isDurationMatch(1000, 1010)).toBe(false); // +10ms
        expect(isDurationMatch(1000, 990)).toBe(false); // -10ms
      });

      it("should respect custom tolerance values", () => {
        expect(isDurationMatch(1000, 1010, 10)).toBe(true); // Within 10ms
        expect(isDurationMatch(1000, 990, 10)).toBe(true); // Within 10ms
        expect(isDurationMatch(1000, 1011, 10)).toBe(false); // Outside 10ms
        expect(isDurationMatch(1000, 989, 10)).toBe(false); // Outside 10ms
      });
    });

    describe("Boundary Conditions", () => {
      it("should handle zero values", () => {
        expect(isDurationMatch(0, 0)).toBe(true);
        expect(isDurationMatch(0, 5)).toBe(true); // Within tolerance
        expect(isDurationMatch(0, 6)).toBe(false); // Outside tolerance
        expect(isDurationMatch(5, 0)).toBe(true); // Within tolerance
      });

      it("should handle negative numbers", () => {
        expect(isDurationMatch(-1000, -1000)).toBe(true);
        expect(isDurationMatch(-1000, -1005)).toBe(true);
        expect(isDurationMatch(-1000, -1006)).toBe(false);
      });

      it("should handle large numbers", () => {
        const largeNum = Number.MAX_SAFE_INTEGER - 10;
        expect(isDurationMatch(largeNum, largeNum)).toBe(true);
        expect(isDurationMatch(largeNum, largeNum + 5)).toBe(true);
        expect(isDurationMatch(largeNum, largeNum + 6)).toBe(false);
      });

      it("should handle zero tolerance", () => {
        expect(isDurationMatch(1000, 1000, 0)).toBe(true);
        expect(isDurationMatch(1000, 1001, 0)).toBe(false);
      });
    });

    describe("Error Handling", () => {
      it("should return false for non-numeric inputs", () => {
        expect(isDurationMatch("1000" as any, 1000)).toBe(false);
        expect(isDurationMatch(1000, "1000" as any)).toBe(false);
        expect(isDurationMatch("1000" as any, "1000" as any)).toBe(false);
        expect(isDurationMatch(null as any, 1000)).toBe(false);
        expect(isDurationMatch(1000, null as any)).toBe(false);
        expect(isDurationMatch(undefined as any, 1000)).toBe(false);
        expect(isDurationMatch(1000, undefined as any)).toBe(false);
      });

      it("should handle NaN values", () => {
        expect(isDurationMatch(NaN, 1000)).toBe(false);
        expect(isDurationMatch(1000, NaN)).toBe(false);
        expect(isDurationMatch(NaN, NaN)).toBe(false);
      });

      it("should handle Infinity values", () => {
        // Math.abs(Infinity - Infinity) = NaN, which is not <= toleranceMs
        expect(isDurationMatch(Infinity, Infinity)).toBe(false);
        expect(isDurationMatch(-Infinity, -Infinity)).toBe(false);
        expect(isDurationMatch(Infinity, -Infinity)).toBe(false);
        expect(isDurationMatch(1000, Infinity)).toBe(false);
      });
    });
  });

  describe("registerDownloadUrl", () => {
    beforeEach(() => {
      const {
        generateVoiceMessageId,
      } = require("../../../extension/scripts/utils/id-generator");
      generateVoiceMessageId.mockReturnValue(
        "voice-msg-1710859680000-abcd1234"
      );
    });

    describe("Normal Cases", () => {
      it("should create new item when no existing item matches", () => {
        const id = registerDownloadUrl(
          mockStore,
          5000,
          "https://example.com/audio.mp3",
          "Wed, 19 Mar 2025 14:04:40 GMT",
          "audio/mpeg",
          1024000
        );

        expect(id).toBe("voice-msg-1710859680000-abcd1234");
        expect(mockStore.items.size).toBe(1);

        const item = mockStore.items.get(id);
        expect(item).toBeDefined();
        expect(item?.durationMs).toBe(5000);
        expect(item?.downloadUrl).toBe("https://example.com/audio.mp3");
        expect(item?.lastModified).toBe("Wed, 19 Mar 2025 14:04:40 GMT");
        expect(item?.blobType).toBe("audio/mpeg");
        expect(item?.blobSize).toBe(1024000);
        expect(item?.isPending).toBe(true);
        expect(item?.element).toBeNull();
      });

      it("should update existing item when duration matches", () => {
        // First create an item with a different URL
        const existingItem: VoiceMessageItem = {
          id: "existing-id",
          element: null,
          durationMs: 5000,
          downloadUrl: "https://old-url.com/audio.mp3",
          timestamp: Date.now(),
          isPending: true,
        };
        mockStore.items.set("existing-id", existingItem);

        const id = registerDownloadUrl(
          mockStore,
          5003, // Within tolerance of 5000
          "https://new-url.com/audio.mp3",
          "Wed, 19 Mar 2025 14:04:40 GMT",
          "audio/wav",
          2048000
        );

        expect(id).toBe("existing-id");
        expect(mockStore.items.size).toBe(1);

        const updatedItem = mockStore.items.get("existing-id");
        expect(updatedItem?.downloadUrl).toBe("https://new-url.com/audio.mp3");
        expect(updatedItem?.lastModified).toBe("Wed, 19 Mar 2025 14:04:40 GMT");
        expect(updatedItem?.blobType).toBe("audio/wav");
        expect(updatedItem?.blobSize).toBe(2048000);
      });

      it("should handle optional parameters", () => {
        const id = registerDownloadUrl(
          mockStore,
          3000,
          "https://example.com/audio.mp3"
        );

        const item = mockStore.items.get(id);
        expect(item?.durationMs).toBe(3000);
        expect(item?.downloadUrl).toBe("https://example.com/audio.mp3");
        expect(item?.lastModified).toBeNull();
        expect(item?.blobType).toBeNull();
        expect(item?.blobSize).toBeNull();
      });
    });

    describe("Boundary Conditions", () => {
      it("should handle zero duration", () => {
        const id = registerDownloadUrl(
          mockStore,
          0,
          "https://example.com/audio.mp3"
        );

        const item = mockStore.items.get(id);
        expect(item?.durationMs).toBe(0);
      });

      it("should handle very long URLs", () => {
        const longUrl = "https://example.com/" + "a".repeat(1000) + ".mp3";
        const id = registerDownloadUrl(mockStore, 1000, longUrl);

        const item = mockStore.items.get(id);
        expect(item?.downloadUrl).toBe(longUrl);
      });

      it("should handle empty string parameters", () => {
        const id = registerDownloadUrl(mockStore, 1000, "", "", "", null);

        const item = mockStore.items.get(id);
        expect(item?.downloadUrl).toBe("");
        expect(item?.lastModified).toBe("");
        expect(item?.blobType).toBe("");
        expect(item?.blobSize).toBeNull();
      });
    });

    describe("Duration Matching Logic", () => {
      it("should update item when durations match within tolerance", () => {
        const existingItem: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 1000,
          downloadUrl: "old-url",
          timestamp: Date.now(),
          isPending: true,
        };
        mockStore.items.set("test-id", existingItem);

        // Test various durations within tolerance
        const testCases = [995, 997, 1000, 1003, 1005];

        testCases.forEach((duration, index) => {
          const newUrl = `new-url-${index}`;
          const id = registerDownloadUrl(mockStore, duration, newUrl);

          expect(id).toBe("test-id");
          expect(mockStore.items.get("test-id")?.downloadUrl).toBe(newUrl);
        });
      });

      it("should create new item when duration is outside tolerance", () => {
        const existingItem: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 1000,
          downloadUrl: "old-url",
          timestamp: Date.now(),
          isPending: true,
        };
        mockStore.items.set("test-id", existingItem);

        const id = registerDownloadUrl(mockStore, 1010, "new-url"); // Outside tolerance

        expect(id).not.toBe("test-id");
        expect(mockStore.items.size).toBe(2);
      });
    });
  });

  describe("findPendingItemByDuration", () => {
    beforeEach(() => {
      // Add test items
      const pendingItem: VoiceMessageItem = {
        id: "pending-1",
        element: null,
        durationMs: 5000,
        downloadUrl: "url1",
        timestamp: Date.now(),
        isPending: true,
      };

      const processedItem: VoiceMessageItem = {
        id: "processed-1",
        element: createMockElement(),
        durationMs: 3000,
        downloadUrl: "url2",
        timestamp: Date.now(),
        isPending: false,
      };

      mockStore.items.set("pending-1", pendingItem);
      mockStore.items.set("processed-1", processedItem);
    });

    describe("Normal Cases", () => {
      it("should find pending item by exact duration", () => {
        const item = findPendingItemByDuration(mockStore, 5000);

        expect(item).toBeDefined();
        expect(item?.id).toBe("pending-1");
        expect(item?.isPending).toBe(true);
      });

      it("should find pending item within tolerance", () => {
        const item = findPendingItemByDuration(mockStore, 5003);

        expect(item).toBeDefined();
        expect(item?.id).toBe("pending-1");
      });

      it("should not find processed items", () => {
        const item = findPendingItemByDuration(mockStore, 3000);

        expect(item).toBeNull();
      });

      it("should return null when no matching pending item exists", () => {
        const item = findPendingItemByDuration(mockStore, 8000);

        expect(item).toBeNull();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty store", () => {
        mockStore.items.clear();
        const item = findPendingItemByDuration(mockStore, 5000);

        expect(item).toBeNull();
      });

      it("should handle multiple pending items and return first match", () => {
        const pendingItem2: VoiceMessageItem = {
          id: "pending-2",
          element: null,
          durationMs: 5002, // Within tolerance of 5000
          downloadUrl: "url3",
          timestamp: Date.now(),
          isPending: true,
        };
        mockStore.items.set("pending-2", pendingItem2);

        const item = findPendingItemByDuration(mockStore, 5000);

        expect(item).toBeDefined();
        // Should return one of the matching items
        expect(["pending-1", "pending-2"]).toContain(item?.id);
      });
    });
  });

  describe("findItemByDuration", () => {
    beforeEach(() => {
      const item1: VoiceMessageItem = {
        id: "item-1",
        element: null,
        durationMs: 5000,
        downloadUrl: "url1",
        timestamp: Date.now(),
        isPending: true,
      };

      const item2: VoiceMessageItem = {
        id: "item-2",
        element: createMockElement(),
        durationMs: 3000,
        downloadUrl: "url2",
        timestamp: Date.now(),
        isPending: false,
      };

      mockStore.items.set("item-1", item1);
      mockStore.items.set("item-2", item2);
    });

    describe("Normal Cases", () => {
      it("should find item by exact duration regardless of pending status", () => {
        const pendingItem = findItemByDuration(mockStore, 5000);
        const processedItem = findItemByDuration(mockStore, 3000);

        expect(pendingItem?.id).toBe("item-1");
        expect(processedItem?.id).toBe("item-2");
      });

      it("should find item within tolerance", () => {
        const item = findItemByDuration(mockStore, 5003);

        expect(item?.id).toBe("item-1");
      });

      it("should return null when no matching item exists", () => {
        const item = findItemByDuration(mockStore, 8000);

        expect(item).toBeNull();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty store", () => {
        mockStore.items.clear();
        const item = findItemByDuration(mockStore, 5000);

        expect(item).toBeNull();
      });

      it("should return first matching item when multiple exist", () => {
        const item3: VoiceMessageItem = {
          id: "item-3",
          element: null,
          durationMs: 5002, // Within tolerance
          downloadUrl: "url3",
          timestamp: Date.now(),
          isPending: false,
        };
        mockStore.items.set("item-3", item3);

        const item = findItemByDuration(mockStore, 5000);

        expect(["item-1", "item-3"]).toContain(item?.id);
      });
    });
  });

  describe("getDownloadUrlForElement", () => {
    beforeEach(() => {
      const {
        secondsToMilliseconds,
      } = require("../../../extension/scripts/utils/time-utils");
      secondsToMilliseconds.mockImplementation((seconds: number) =>
        Math.round(seconds * 1000)
      );
    });

    describe("Normal Cases", () => {
      it("should find URL by element ID", () => {
        const item: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 5000,
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
          timestamp: Date.now(),
          isPending: false,
        };
        mockStore.items.set("test-id", item);

        const element = createMockElement("test-id");
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result).toEqual({
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        });
      });

      it("should find URL by aria-valuemax duration", () => {
        const item: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 5000,
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
          timestamp: Date.now(),
          isPending: false,
        };
        mockStore.items.set("test-id", item);

        const element = createMockElement(undefined, "5.0"); // 5 seconds
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result).toEqual({
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: "Wed, 19 Mar 2025 14:04:40 GMT",
        });
      });

      it("should handle missing lastModified", () => {
        const item: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 5000,
          downloadUrl: "https://example.com/audio.mp3",
          timestamp: Date.now(),
          isPending: false,
        };
        mockStore.items.set("test-id", item);

        const element = createMockElement("test-id");
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result).toEqual({
          downloadUrl: "https://example.com/audio.mp3",
          lastModified: null,
        });
      });
    });

    describe("Boundary Conditions", () => {
      it("should return null for null element", () => {
        const result = getDownloadUrlForElement(mockStore, null as any);

        expect(result).toBeNull();
      });

      it("should return null when element ID not found in store", () => {
        const element = createMockElement("non-existent-id");
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result).toBeNull();
      });

      it("should return null when no aria-valuemax attribute", () => {
        const element = createMockElement(); // No ID, no aria-valuemax
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result).toBeNull();
      });

      it("should handle invalid aria-valuemax values", () => {
        const element = createMockElement(undefined, "invalid");
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result).toBeNull();
      });

      it("should return null when duration matches but no downloadUrl", () => {
        const item: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 5000,
          downloadUrl: null,
          timestamp: Date.now(),
          isPending: true,
        };
        mockStore.items.set("test-id", item);

        const element = createMockElement(undefined, "5.0");
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result).toBeNull();
      });
    });

    describe("Duration Matching", () => {
      it("should find item by duration within tolerance", () => {
        const item: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 5000,
          downloadUrl: "https://example.com/audio.mp3",
          timestamp: Date.now(),
          isPending: false,
        };
        mockStore.items.set("test-id", item);

        // Test duration within tolerance (5.003 seconds = 5003ms, within 5ms tolerance of 5000ms)
        const element = createMockElement(undefined, "5.003");
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result?.downloadUrl).toBe("https://example.com/audio.mp3");
      });

      it("should not find item when duration is outside tolerance", () => {
        const item: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 5000,
          downloadUrl: "https://example.com/audio.mp3",
          timestamp: Date.now(),
          isPending: false,
        };
        mockStore.items.set("test-id", item);

        // Duration outside tolerance (5.01 seconds = 5010ms, outside 5ms tolerance)
        const element = createMockElement(undefined, "5.01");
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result).toBeNull();
      });
    });

    describe("Edge Cases", () => {
      it("should handle zero duration", () => {
        const item: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 0,
          downloadUrl: "https://example.com/audio.mp3",
          timestamp: Date.now(),
          isPending: false,
        };
        mockStore.items.set("test-id", item);

        const element = createMockElement(undefined, "0");
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result?.downloadUrl).toBe("https://example.com/audio.mp3");
      });

      it("should handle very small durations", () => {
        const item: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 100,
          downloadUrl: "https://example.com/audio.mp3",
          timestamp: Date.now(),
          isPending: false,
        };
        mockStore.items.set("test-id", item);

        const element = createMockElement(undefined, "0.1");
        const result = getDownloadUrlForElement(mockStore, element);

        expect(result?.downloadUrl).toBe("https://example.com/audio.mp3");
      });
    });
  });

  describe("cleanupOldItems", () => {
    beforeEach(() => {
      const now = Date.now();

      // Add items with different ages
      const recentItem: VoiceMessageItem = {
        id: "recent",
        element: null,
        durationMs: 1000,
        downloadUrl: "url1",
        timestamp: now - 1000, // 1 second ago
        isPending: true,
      };

      const oldItem: VoiceMessageItem = {
        id: "old",
        element: null,
        durationMs: 2000,
        downloadUrl: "url2",
        timestamp: now - 7200000, // 2 hours ago
        isPending: false,
      };

      const veryOldItem: VoiceMessageItem = {
        id: "very-old",
        element: null,
        durationMs: 3000,
        downloadUrl: "url3",
        timestamp: now - 86400000, // 24 hours ago
        isPending: true,
      };

      mockStore.items.set("recent", recentItem);
      mockStore.items.set("old", oldItem);
      mockStore.items.set("very-old", veryOldItem);
    });

    describe("Normal Cases", () => {
      it("should remove items older than default max age (7 days)", () => {
        expect(mockStore.items.size).toBe(3);

        cleanupOldItems(mockStore);

        // With 7-day retention, all test items should remain (most recent item is only 24 hours old)
        expect(mockStore.items.size).toBe(3);
        expect(mockStore.items.has("recent")).toBe(true);
        expect(mockStore.items.has("old")).toBe(true);
        expect(mockStore.items.has("very-old")).toBe(true);
      });

      it("should respect custom max age", () => {
        expect(mockStore.items.size).toBe(3);

        // Use 30 minutes as max age
        cleanupOldItems(mockStore, 30 * 60 * 1000);

        expect(mockStore.items.size).toBe(1);
        expect(mockStore.items.has("recent")).toBe(true);
      });

      it("should keep all items when max age is very large", () => {
        expect(mockStore.items.size).toBe(3);

        // Use 7 days as max age
        cleanupOldItems(mockStore, 7 * 24 * 60 * 60 * 1000);

        expect(mockStore.items.size).toBe(3);
      });

      it("should remove items older than 7 days with default retention period", () => {
        const currentNow = Date.now();
        // Add an item older than 7 days
        const veryOldItem: VoiceMessageItem = {
          id: "very-very-old",
          element: null,
          durationMs: 4000,
          downloadUrl: "url4",
          timestamp: currentNow - 8 * 24 * 60 * 60 * 1000, // 8 days ago
          isPending: false,
        };
        mockStore.items.set("very-very-old", veryOldItem);

        expect(mockStore.items.size).toBe(4);

        cleanupOldItems(mockStore);

        // Should remove only the 8-day-old item
        expect(mockStore.items.size).toBe(3);
        expect(mockStore.items.has("recent")).toBe(true);
        expect(mockStore.items.has("old")).toBe(true);
        expect(mockStore.items.has("very-old")).toBe(true);
        expect(mockStore.items.has("very-very-old")).toBe(false);
      });
    });

    describe("Boundary Conditions", () => {
      it("should handle empty store", () => {
        mockStore.items.clear();
        expect(mockStore.items.size).toBe(0);

        cleanupOldItems(mockStore);

        expect(mockStore.items.size).toBe(0);
      });

      it("should handle zero max age", () => {
        expect(mockStore.items.size).toBe(3);

        cleanupOldItems(mockStore, 0);

        expect(mockStore.items.size).toBe(0);
      });

      it("should handle items with exactly max age", () => {
        const now = Date.now();
        const exactAgeItem: VoiceMessageItem = {
          id: "exact-age",
          element: null,
          durationMs: 1000,
          downloadUrl: "url",
          timestamp: now - 3600000, // Exactly 1 hour ago
          isPending: true,
        };

        mockStore.items.clear();
        mockStore.items.set("exact-age", exactAgeItem);

        cleanupOldItems(mockStore, 3600000); // 1 hour

        expect(mockStore.items.size).toBe(1); // Should be kept (equals maxAge, condition is >)
      });
    });

    describe("Edge Cases", () => {
      it("should handle items with future timestamps", () => {
        const futureItem: VoiceMessageItem = {
          id: "future",
          element: null,
          durationMs: 1000,
          downloadUrl: "url",
          timestamp: Date.now() + 1000, // 1 second in future
          isPending: true,
        };

        mockStore.items.clear();
        mockStore.items.set("future", futureItem);

        cleanupOldItems(mockStore);

        expect(mockStore.items.size).toBe(1); // Should keep future items
      });

      it("should handle negative max age", () => {
        expect(mockStore.items.size).toBe(3);

        cleanupOldItems(mockStore, -1000);

        expect(mockStore.items.size).toBe(0); // Should remove all items
      });
    });
  });

  describe("Integration Tests", () => {
    it("should work with realistic workflow", async () => {
      // Ensure we start with clean store
      mockStore.items.clear();

      // 1. Register a download URL (creates pending item)
      const id1 = registerDownloadUrl(
        mockStore,
        5000,
        "https://example.com/audio1.mp3"
      );
      expect(mockStore.items.size).toBe(1);
      expect(mockStore.items.get(id1)?.isPending).toBe(true);

      // 2. Register element with matching duration (should update existing item)
      const pendingItem = findPendingItemByDuration(mockStore, 5003); // Within tolerance
      expect(pendingItem?.id).toBe(id1);

      // 3. Get download URL for element
      const element = createMockElement(id1);
      const result = getDownloadUrlForElement(mockStore, element);
      expect(result?.downloadUrl).toBe("https://example.com/audio1.mp3");

      // 4. Register another URL with different duration
      const {
        generateVoiceMessageId,
      } = require("../../../extension/scripts/utils/id-generator");
      generateVoiceMessageId.mockReturnValueOnce(
        "voice-msg-1710859680000-efgh5678"
      );

      registerDownloadUrl(mockStore, 8000, "https://example.com/audio2.mp3");
      expect(mockStore.items.size).toBe(2);

      // 5. Cleanup old items (add delay to ensure age > 0)
      await new Promise((resolve) => setTimeout(resolve, 10));
      cleanupOldItems(mockStore, 0); // Remove all items
      expect(mockStore.items.size).toBe(0);
    });

    it("should handle concurrent registrations with same duration", () => {
      const id1 = registerDownloadUrl(mockStore, 5000, "url1");
      const id2 = registerDownloadUrl(mockStore, 5003, "url2"); // Within tolerance

      // Should update the same item, not create new one
      expect(id1).toBe(id2);
      expect(mockStore.items.size).toBe(1);
      expect(mockStore.items.get(id1)?.downloadUrl).toBe("url2");
    });
  });
});
