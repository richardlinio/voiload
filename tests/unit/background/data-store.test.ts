/// <reference types="jest" />

import {
  createDataStore,
  isDurationMatch,
  registerDownloadUrl,
  findItemByDuration,
  cleanupOldItems,
  resetHydrationState,
} from "../../../extension/scripts/background/data-store";
import type {
  VoiceMessageStore,
  VoiceMessageItem,
} from "../../../extension/scripts/types/voice-message";

// Mock dependencies
jest.mock("../../../extension/scripts/utils/id-generator", () => ({
  generateVoiceMessageId: jest.fn(() => "voice-msg-1710859680000-abcd1234"),
}));

jest.mock("../../../extension/scripts/utils/time-utils", () => ({
  secondsToMilliseconds: jest.fn((seconds: number) =>
    Math.round(seconds * 1000)
  ),
  domDurationToMilliseconds: jest.fn((value: number) =>
    value > 1200 ? Math.round(value) : Math.round(value * 1000)
  ),
}));

// Shared logger instance (created inside the factory because jest.mock is
// hoisted above imports) so tests can assert on warnings (e.g. ambiguous matches)
jest.mock("../../../extension/scripts/utils/logger", () => {
  const sharedLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  return {
    Logger: {
      createModuleLogger: jest.fn(() => sharedLogger),
    },
  };
});

const mockDataStoreLogger =
  require("../../../extension/scripts/utils/logger").Logger.createModuleLogger();

jest.mock("../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    DATA_STORE: "data-store",
  },
  // Mirror production values (pinned in constants.test.ts)
  MATCHING_TOLERANCE: 1000,
  EXACT_MATCHING_TOLERANCE: 5,
  TIME_CONSTANTS: {
    DATA_RETENTION_PERIOD: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  STORAGE_KEYS: {
    VOICE_MESSAGES: "voiceMessages",
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
    // Discard both the module singleton and session storage, so each test starts
    // from a cold service worker with an empty backing store
    resetHydrationState();
    (global as any).__resetSessionStorage();
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

      expect(typeof store.registerDownloadUrl).toBe("function");
      expect(typeof store.findItemByDuration).toBe("function");
      expect(typeof store.getAllItems).toBe("function");
      expect(typeof store.updateItem).toBe("function");
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
        expect(isDurationMatch(1000, 1999)).toBe(true); // +999ms
        expect(isDurationMatch(1000, 2000)).toBe(true); // +1000ms (boundary)
      });

      it("should return false for durations outside default tolerance", () => {
        expect(isDurationMatch(1000, 2001)).toBe(false); // +1001ms
        expect(isDurationMatch(2001, 1000)).toBe(false); // -1001ms
        expect(isDurationMatch(1000, 5000)).toBe(false); // +4000ms
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
        expect(isDurationMatch(0, 1000)).toBe(true); // Within tolerance
        expect(isDurationMatch(0, 1001)).toBe(false); // Outside tolerance
        expect(isDurationMatch(1000, 0)).toBe(true); // Within tolerance
      });

      it("should handle negative numbers", () => {
        expect(isDurationMatch(-1000, -1000)).toBe(true);
        expect(isDurationMatch(-1000, -2000)).toBe(true);
        expect(isDurationMatch(-1000, -2001)).toBe(false);
      });

      it("should handle large numbers", () => {
        const largeNum = Number.MAX_SAFE_INTEGER - 2000;
        expect(isDurationMatch(largeNum, largeNum)).toBe(true);
        expect(isDurationMatch(largeNum, largeNum + 1000)).toBe(true);
        expect(isDurationMatch(largeNum, largeNum + 1001)).toBe(false);
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
      it("should create new item when no existing item matches", async () => {
        const id = await registerDownloadUrl(
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

      it("should update existing item when duration matches", async () => {
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

        const id = await registerDownloadUrl(
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

      it("should handle optional parameters", async () => {
        const id = await registerDownloadUrl(
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

    describe("WAV re-encoding", () => {
      it("should store wavUrl on a newly created item", async () => {
        const id = await registerDownloadUrl(
          mockStore,
          5000,
          "https://example.com/audio.ogg",
          "Wed, 19 Mar 2025 14:04:40 GMT",
          "audio/ogg",
          1024000,
          "blob:https://example.com/audio-reencoded.wav"
        );

        const item = mockStore.items.get(id);
        expect(item?.wavUrl).toBe("blob:https://example.com/audio-reencoded.wav");
      });

      it("should update wavUrl on a matched item", async () => {
        const existingItem: VoiceMessageItem = {
          id: "existing-id",
          element: null,
          durationMs: 5000,
          downloadUrl: "https://old-url.com/audio.ogg",
          wavUrl: null,
          timestamp: Date.now(),
          isPending: true,
        };
        mockStore.items.set("existing-id", existingItem);

        const id = await registerDownloadUrl(
          mockStore,
          5003, // Within tolerance of 5000
          "https://new-url.com/audio.ogg",
          null,
          null,
          null,
          "blob:https://example.com/new-reencoded.wav"
        );

        expect(id).toBe("existing-id");
        const updatedItem = mockStore.items.get("existing-id");
        expect(updatedItem?.wavUrl).toBe("blob:https://example.com/new-reencoded.wav");
      });

      it("should leave an existing wavUrl untouched when called with wavUrl = null", async () => {
        const existingItem: VoiceMessageItem = {
          id: "existing-id",
          element: null,
          durationMs: 5000,
          downloadUrl: "https://old-url.com/audio.ogg",
          wavUrl: "blob:https://example.com/original-reencoded.wav",
          timestamp: Date.now(),
          isPending: true,
        };
        mockStore.items.set("existing-id", existingItem);

        const id = await registerDownloadUrl(
          mockStore,
          5003, // Within tolerance of 5000
          "https://new-url.com/audio.ogg",
          null,
          null,
          null,
          null
        );

        expect(id).toBe("existing-id");
        const updatedItem = mockStore.items.get("existing-id");
        expect(updatedItem?.wavUrl).toBe(
          "blob:https://example.com/original-reencoded.wav"
        );
      });
    });

    describe("Boundary Conditions", () => {
      it("should handle zero duration", async () => {
        const id = await registerDownloadUrl(
          mockStore,
          0,
          "https://example.com/audio.mp3"
        );

        const item = mockStore.items.get(id);
        expect(item?.durationMs).toBe(0);
      });

      it("should handle very long URLs", async () => {
        const longUrl = "https://example.com/" + "a".repeat(1000) + ".mp3";
        const id = await registerDownloadUrl(mockStore, 1000, longUrl);

        const item = mockStore.items.get(id);
        expect(item?.downloadUrl).toBe(longUrl);
      });

      it("should handle empty string parameters", async () => {
        const id = await registerDownloadUrl(mockStore, 1000, "", "", "", null);

        const item = mockStore.items.get(id);
        expect(item?.downloadUrl).toBe("");
        expect(item?.lastModified).toBe("");
        expect(item?.blobType).toBe("");
        expect(item?.blobSize).toBeNull();
      });
    });

    describe("Duration Matching Logic", () => {
      it("should update item when durations match within tolerance", async () => {
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

        for (const [index, duration] of testCases.entries()) {
          const newUrl = `new-url-${index}`;
          const id = await registerDownloadUrl(mockStore, duration, newUrl);

          expect(id).toBe("test-id");
          expect(mockStore.items.get("test-id")?.downloadUrl).toBe(newUrl);
        }
      });

      it("should create new item when duration is outside tolerance", async () => {
        const existingItem: VoiceMessageItem = {
          id: "test-id",
          element: null,
          durationMs: 1000,
          downloadUrl: "old-url",
          timestamp: Date.now(),
          isPending: true,
        };
        mockStore.items.set("test-id", existingItem);

        const id = await registerDownloadUrl(mockStore, 1010, "new-url"); // Outside tolerance

        expect(id).not.toBe("test-id");
        expect(mockStore.items.size).toBe(2);
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
      it("should find item by exact duration regardless of pending status", async () => {
        const pendingItem = await findItemByDuration(mockStore, 5000);
        const processedItem = await findItemByDuration(mockStore, 3000);

        expect(pendingItem?.id).toBe("item-1");
        expect(processedItem?.id).toBe("item-2");
      });

      it("should find item within tolerance", async () => {
        const item = await findItemByDuration(mockStore, 5003);

        expect(item?.id).toBe("item-1");
      });

      it("should return null when no matching item exists", async () => {
        const item = await findItemByDuration(mockStore, 8000);

        expect(item).toBeNull();
      });
    });

    describe("Edge Cases", () => {
      it("should handle empty store", async () => {
        mockStore.items.clear();
        const item = await findItemByDuration(mockStore, 5000);

        expect(item).toBeNull();
      });

      it("should return first matching item when multiple exist", async () => {
        const item3: VoiceMessageItem = {
          id: "item-3",
          element: null,
          durationMs: 5002, // Within tolerance
          downloadUrl: "url3",
          timestamp: Date.now(),
          isPending: false,
        };
        mockStore.items.set("item-3", item3);

        const item = await findItemByDuration(mockStore, 5000);

        expect(["item-1", "item-3"]).toContain(item?.id);
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
      it("should remove items older than default max age (7 days)", async () => {
        expect(mockStore.items.size).toBe(3);

        await cleanupOldItems(mockStore);

        // With 7-day retention, all test items should remain (most recent item is only 24 hours old)
        expect(mockStore.items.size).toBe(3);
        expect(mockStore.items.has("recent")).toBe(true);
        expect(mockStore.items.has("old")).toBe(true);
        expect(mockStore.items.has("very-old")).toBe(true);
      });

      it("should respect custom max age", async () => {
        expect(mockStore.items.size).toBe(3);

        // Use 30 minutes as max age
        await cleanupOldItems(mockStore, 30 * 60 * 1000);

        expect(mockStore.items.size).toBe(1);
        expect(mockStore.items.has("recent")).toBe(true);
      });

      it("should keep all items when max age is very large", async () => {
        expect(mockStore.items.size).toBe(3);

        // Use 7 days as max age
        await cleanupOldItems(mockStore, 7 * 24 * 60 * 60 * 1000);

        expect(mockStore.items.size).toBe(3);
      });

      it("should remove items older than 7 days with default retention period", async () => {
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

        await cleanupOldItems(mockStore);

        // Should remove only the 8-day-old item
        expect(mockStore.items.size).toBe(3);
        expect(mockStore.items.has("recent")).toBe(true);
        expect(mockStore.items.has("old")).toBe(true);
        expect(mockStore.items.has("very-old")).toBe(true);
        expect(mockStore.items.has("very-very-old")).toBe(false);
      });
    });

    describe("Boundary Conditions", () => {
      it("should handle empty store", async () => {
        mockStore.items.clear();
        expect(mockStore.items.size).toBe(0);

        await cleanupOldItems(mockStore);

        expect(mockStore.items.size).toBe(0);
      });

      it("should handle zero max age", async () => {
        expect(mockStore.items.size).toBe(3);

        await cleanupOldItems(mockStore, 0);

        expect(mockStore.items.size).toBe(0);
      });

      it("should handle items with exactly max age", async () => {
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

        await cleanupOldItems(mockStore, 3600000); // 1 hour

        expect(mockStore.items.size).toBe(1); // Should be kept (equals maxAge, condition is >)
      });
    });

    describe("Edge Cases", () => {
      it("should handle items with future timestamps", async () => {
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

        await cleanupOldItems(mockStore);

        expect(mockStore.items.size).toBe(1); // Should keep future items
      });

      it("should handle negative max age", async () => {
        expect(mockStore.items.size).toBe(3);

        await cleanupOldItems(mockStore, -1000);

        expect(mockStore.items.size).toBe(0); // Should remove all items
      });
    });
  });

  // Real runtime fixtures measured on messenger.com (2026-07-09): aria-valuemax
  // is integer seconds while decoded blob durations are fractional ms
  describe("Integer-second aria-valuemax matching (real runtime fixtures)", () => {
    const measuredCases = [
      { blobMs: 60547, domMs: 61000 }, // 1:01 message, valuemax=61
      { blobMs: 2767, domMs: 3000 }, // 0:03 message, valuemax=3
      { blobMs: 6980, domMs: 7000 }, // 0:07 message, valuemax=7
    ];

    it.each(measuredCases)(
      "should match blob duration $blobMs ms when queried with DOM duration $domMs ms",
      async ({ blobMs, domMs }) => {
        await registerDownloadUrl(mockStore, blobMs, "https://example.com/audio.mp3");

        const item = await findItemByDuration(mockStore, domMs);

        expect(item?.durationMs).toBe(blobMs);
        expect(item?.downloadUrl).toBe("https://example.com/audio.mp3");
      }
    );

    it("should pick the nearest and warn when two messages share the same integer second", async () => {
      const itemA: VoiceMessageItem = {
        id: "item-a",
        element: null,
        durationMs: 2767, // Displays as 0:03
        downloadUrl: "url-a",
        timestamp: Date.now(),
        isPending: false,
      };
      const itemB: VoiceMessageItem = {
        id: "item-b",
        element: null,
        durationMs: 2900, // Also displays as 0:03
        downloadUrl: "url-b",
        timestamp: Date.now(),
        isPending: false,
      };
      mockStore.items.set("item-a", itemA);
      mockStore.items.set("item-b", itemB);

      const item = await findItemByDuration(mockStore, 3000);

      expect(item?.id).toBe("item-b"); // |2900-3000| = 100 < |2767-3000| = 233
      expect(mockDataStoreLogger.warn).toHaveBeenCalledWith(
        "Multiple items within matching tolerance, choosing the nearest",
        expect.objectContaining({ durationMs: 3000 })
      );
    });

    it("should refuse to guess and warn when candidates are equally distant", async () => {
      const itemA: VoiceMessageItem = {
        id: "item-a",
        element: null,
        durationMs: 2900,
        downloadUrl: "url-a",
        timestamp: Date.now(),
        isPending: false,
      };
      const itemB: VoiceMessageItem = {
        id: "item-b",
        element: null,
        durationMs: 3100,
        downloadUrl: "url-b",
        timestamp: Date.now(),
        isPending: false,
      };
      mockStore.items.set("item-a", itemA);
      mockStore.items.set("item-b", itemB);

      const item = await findItemByDuration(mockStore, 3000);

      expect(item).toBeNull();
      expect(mockDataStoreLogger.warn).toHaveBeenCalledWith(
        "Ambiguous duration match: nearest candidates are equally distant, refusing to guess",
        expect.objectContaining({ durationMs: 3000 })
      );
    });

    it("should not clobber another message's URL when registering a nearby blob", async () => {
      // Two distinct short messages whose precise durations are within 1s of
      // each other must remain separate items
      await registerDownloadUrl(mockStore, 2767, "url-a");
      const {
        generateVoiceMessageId,
      } = require("../../../extension/scripts/utils/id-generator");
      generateVoiceMessageId.mockReturnValueOnce(
        "voice-msg-1710859680000-efgh5678"
      );

      await registerDownloadUrl(mockStore, 2900, "url-b");

      expect(mockStore.items.size).toBe(2);
      const urls = Array.from(mockStore.items.values()).map(
        (item) => item.downloadUrl
      );
      expect(urls).toEqual(expect.arrayContaining(["url-a", "url-b"]));
    });
  });

  describe("Integration Tests", () => {
    it("should work with realistic workflow", async () => {
      // Ensure we start with clean store
      mockStore.items.clear();

      // 1. Register a download URL (creates pending item)
      const id1 = await registerDownloadUrl(
        mockStore,
        5000,
        "https://example.com/audio1.mp3"
      );
      expect(mockStore.items.size).toBe(1);
      expect(mockStore.items.get(id1)?.isPending).toBe(true);

      // 2. A right-click on the matching element resolves the item by duration
      const matched = await findItemByDuration(mockStore, 5003); // Within tolerance
      expect(matched?.id).toBe(id1);
      expect(matched?.downloadUrl).toBe("https://example.com/audio1.mp3");

      // 4. Register another URL with different duration
      const {
        generateVoiceMessageId,
      } = require("../../../extension/scripts/utils/id-generator");
      generateVoiceMessageId.mockReturnValueOnce(
        "voice-msg-1710859680000-efgh5678"
      );

      await registerDownloadUrl(mockStore, 8000, "https://example.com/audio2.mp3");
      expect(mockStore.items.size).toBe(2);

      // 5. Cleanup old items (add delay to ensure age > 0)
      await new Promise((resolve) => setTimeout(resolve, 10));
      await cleanupOldItems(mockStore, 0); // Remove all items
      expect(mockStore.items.size).toBe(0);
    });

    it("should handle concurrent registrations with same duration", async () => {
      const id1 = await registerDownloadUrl(mockStore, 5000, "url1");
      const id2 = await registerDownloadUrl(mockStore, 5003, "url2"); // Within tolerance

      // Should update the same item, not create new one
      expect(id1).toBe(id2);
      expect(mockStore.items.size).toBe(1);
      expect(mockStore.items.get(id1)?.downloadUrl).toBe("url2");
    });
  });

  // An MV3 service worker is evicted after ~30s idle, taking every module-scope
  // variable with it. Session storage is what survives, so these cases simulate
  // a restart by discarding the module state while the backing store persists.
  describe("Persistence across service-worker restarts", () => {
    /** Simulate Chrome killing and re-spawning the service worker. */
    function restartServiceWorker(): VoiceMessageStore {
      resetHydrationState();
      return createDataStore();
    }

    it("should recover a registered download URL after a restart", async () => {
      const id = await registerDownloadUrl(
        mockStore,
        6980,
        "blob:https://messenger.com/abc",
        "Wed, 19 Mar 2025 14:04:40 GMT",
        "audio/ogg",
        3323
      );

      const revivedStore = restartServiceWorker();
      expect(revivedStore.items.size).toBe(0); // cache starts cold

      const item = await revivedStore.findItemByDuration(7000); // aria-valuemax=7

      expect(item?.id).toBe(id);
      expect(item?.downloadUrl).toBe("blob:https://messenger.com/abc");
      expect(item?.lastModified).toBe("Wed, 19 Mar 2025 14:04:40 GMT");
      expect(item?.blobType).toBe("audio/ogg");
      expect(item?.blobSize).toBe(3323);
    });

    it("should recover a right-click lookup by duration after a restart", async () => {
      await registerDownloadUrl(mockStore, 60547, "blob:https://messenger.com/xyz");

      const revivedStore = restartServiceWorker();
      // A 1:01 message: the DOM reports integer seconds, the blob decoded to 60547ms
      const item = await revivedStore.findItemByDuration(61000);

      expect(item?.downloadUrl).toBe("blob:https://messenger.com/xyz");
    });

    it("should persist every item so download-all survives a restart", async () => {
      const {
        generateVoiceMessageId,
      } = require("../../../extension/scripts/utils/id-generator");
      generateVoiceMessageId.mockReturnValueOnce("id-a");
      await registerDownloadUrl(mockStore, 2767, "url-a");
      generateVoiceMessageId.mockReturnValueOnce("id-b");
      await registerDownloadUrl(mockStore, 6980, "url-b");

      const revivedStore = restartServiceWorker();
      const items = await revivedStore.getAllItems();

      expect(items).toHaveLength(2);
      expect(items.map((item) => item.downloadUrl).sort()).toEqual([
        "url-a",
        "url-b",
      ]);
    });

    it("should persist a cleanup so expired items stay gone after a restart", async () => {
      await registerDownloadUrl(mockStore, 5000, "url1");
      await cleanupOldItems(mockStore, -1000); // Expire everything
      expect(mockStore.items.size).toBe(0);

      const revivedStore = restartServiceWorker();

      expect(await revivedStore.getAllItems()).toEqual([]);
    });

    it("should hydrate only once even under concurrent access", async () => {
      await registerDownloadUrl(mockStore, 5000, "url1");
      const sessionGet = (global as any).chrome.storage.session.get as jest.Mock;

      const revivedStore = restartServiceWorker();
      sessionGet.mockClear();

      await Promise.all([
        revivedStore.findItemByDuration(5000),
        revivedStore.findItemByDuration(5000),
        revivedStore.getAllItems(),
      ]);

      expect(sessionGet).toHaveBeenCalledTimes(1);
    });

    it("should start empty when session storage was never written", async () => {
      const revivedStore = restartServiceWorker();

      expect(await revivedStore.getAllItems()).toEqual([]);
    });

    it("should degrade to an empty cache when session storage read fails", async () => {
      const sessionGet = (global as any).chrome.storage.session.get as jest.Mock;
      sessionGet.mockRejectedValueOnce(new Error("storage unavailable"));

      const revivedStore = restartServiceWorker();

      expect(await revivedStore.getAllItems()).toEqual([]);
      expect(mockDataStoreLogger.error).toHaveBeenCalledWith(
        "Failed to hydrate voice messages from session storage",
        expect.objectContaining({ error: "storage unavailable" })
      );
    });

    it("should keep serving the request when a persist write fails", async () => {
      const sessionSet = (global as any).chrome.storage.session.set as jest.Mock;
      sessionSet.mockRejectedValueOnce(new Error("quota exceeded"));

      const id = await registerDownloadUrl(mockStore, 5000, "url1");

      expect(id).toBeTruthy();
      expect(mockStore.items.get(id)?.downloadUrl).toBe("url1");
      expect(mockDataStoreLogger.error).toHaveBeenCalledWith(
        "Failed to persist voice messages to session storage",
        expect.objectContaining({ error: "quota exceeded" })
      );
    });
  });
});
