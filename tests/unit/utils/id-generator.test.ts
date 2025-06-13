/// <reference types="jest" />

import {
  generateVoiceMessageId,
  isVoiceMessageId,
  extractTimestampFromId,
} from "../../../extension/scripts/utils/id-generator";

// Mock Logger to avoid side effects
jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock constants to have control over test environment
jest.mock("../../../extension/scripts/utils/constants", () => ({
  ID_CONSTANTS: {
    VOICE_MESSAGE_ID_PREFIX: "voice-msg-",
  },
}));

// Mock Date.now for consistent testing
const mockTimestamp = 1710859680000; // Fixed timestamp for testing
const originalDateNow = Date.now;

describe("generateVoiceMessageId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Date.now = jest.fn(() => mockTimestamp);
    // Mock Math.random for predictable testing
    jest.spyOn(Math, "random").mockReturnValue(0.123456789);
  });

  afterEach(() => {
    Date.now = originalDateNow;
    jest.restoreAllMocks();
  });

  describe("Normal Cases", () => {
    it("should generate ID with correct format", () => {
      const id = generateVoiceMessageId();
      expect(id).toMatch(/^voice-msg-\d+-[a-z0-9]{8}$/);
    });

    it("should include timestamp in generated ID", () => {
      const id = generateVoiceMessageId();
      expect(id).toContain(mockTimestamp.toString());
    });

    it("should generate unique IDs on multiple calls", () => {
      // Reset mock to return different random values
      jest
        .spyOn(Math, "random")
        .mockReturnValueOnce(0.123456789)
        .mockReturnValueOnce(0.987654321);

      const id1 = generateVoiceMessageId();
      const id2 = generateVoiceMessageId();

      expect(id1).not.toBe(id2);
    });

    it("should start with correct prefix", () => {
      const id = generateVoiceMessageId();
      expect(id.startsWith("voice-msg-")).toBe(true);
    });

    it("should include 8-character random string", () => {
      const id = generateVoiceMessageId();
      const parts = id.split("-");
      expect(parts[3]).toHaveLength(8);
      expect(parts[3]).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe("Edge Cases", () => {
    it("should handle different timestamps", () => {
      const differentTimestamp = 9999999999999;
      Date.now = jest.fn(() => differentTimestamp);

      const id = generateVoiceMessageId();
      expect(id).toContain(differentTimestamp.toString());
    });

    it("should handle extreme random values", () => {
      jest.spyOn(Math, "random").mockReturnValue(0.999999999);

      const id = generateVoiceMessageId();
      expect(id).toMatch(/^voice-msg-\d+-[a-z0-9]{8}$/);
    });

    it("should handle minimum random values", () => {
      jest.spyOn(Math, "random").mockReturnValue(0.000000001);

      const id = generateVoiceMessageId();
      expect(id).toMatch(/^voice-msg-\d+-[a-z0-9]{8}$/);
    });
  });
});

describe("isVoiceMessageId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Normal Cases", () => {
    it("should return true for valid voice message ID", () => {
      const validId = "voice-msg-1710859680000-abcd1234";
      expect(isVoiceMessageId(validId)).toBe(true);
    });

    it("should return false for non-voice message ID", () => {
      const invalidId = "some-other-id-123";
      expect(isVoiceMessageId(invalidId)).toBe(false);
    });

    it("should return true for generated ID", () => {
      Date.now = jest.fn(() => mockTimestamp);
      jest.spyOn(Math, "random").mockReturnValue(0.123456789);

      const generatedId = generateVoiceMessageId();
      expect(isVoiceMessageId(generatedId)).toBe(true);
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle empty string", () => {
      expect(isVoiceMessageId("")).toBe(false);
    });

    it("should handle partial prefix match", () => {
      expect(isVoiceMessageId("voice-msg")).toBe(false);
      expect(isVoiceMessageId("voice-ms")).toBe(false);
      expect(isVoiceMessageId("voice")).toBe(false);
    });

    it("should handle prefix at end of string", () => {
      expect(isVoiceMessageId("test-voice-msg-")).toBe(false);
    });

    it("should be case sensitive", () => {
      expect(isVoiceMessageId("VOICE-MSG-123-abc")).toBe(false);
      expect(isVoiceMessageId("Voice-Msg-123-abc")).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle null input", () => {
      expect(isVoiceMessageId(null as any)).toBe(false);
    });

    it("should handle undefined input", () => {
      expect(isVoiceMessageId(undefined as any)).toBe(false);
    });

    it("should handle non-string input", () => {
      expect(isVoiceMessageId(123 as any)).toBe(false);
      expect(isVoiceMessageId({} as any)).toBe(false);
      expect(isVoiceMessageId([] as any)).toBe(false);
      expect(isVoiceMessageId(true as any)).toBe(false);
    });
  });
});

describe("extractTimestampFromId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Normal Cases", () => {
    it("should extract timestamp from valid ID", () => {
      const validId = "voice-msg-1710859680000-abcd1234";
      const timestamp = extractTimestampFromId(validId);
      expect(timestamp).toBe(1710859680000);
    });

    it("should extract timestamp from generated ID", () => {
      Date.now = jest.fn(() => mockTimestamp);
      jest.spyOn(Math, "random").mockReturnValue(0.123456789);

      const generatedId = generateVoiceMessageId();
      const extractedTimestamp = extractTimestampFromId(generatedId);
      expect(extractedTimestamp).toBe(mockTimestamp);
    });

    it("should handle different valid timestamps", () => {
      const testCases = [
        { id: "voice-msg-1000000000000-abcd1234", expected: 1000000000000 },
        { id: "voice-msg-9999999999999-abcd1234", expected: 9999999999999 },
        { id: "voice-msg-0-abcd1234", expected: 0 },
        { id: "voice-msg-123456-abcd1234", expected: 123456 },
      ];

      testCases.forEach(({ id, expected }) => {
        expect(extractTimestampFromId(id)).toBe(expected);
      });
    });
  });

  describe("Boundary Conditions", () => {
    it("should return null for non-voice message ID", () => {
      const invalidId = "some-other-id-123";
      expect(extractTimestampFromId(invalidId)).toBeNull();
    });

    it("should return null for malformed voice message ID", () => {
      const malformedIds = [
        "voice-msg-", // Missing timestamp and random string
        "voice-msg-abc-def", // Non-numeric timestamp (abc parses to NaN)
        "voice-msg", // Incomplete ID
      ];

      malformedIds.forEach((id) => {
        expect(extractTimestampFromId(id)).toBeNull();
      });
    });

    it("should handle ID with extra dashes", () => {
      const idWithExtraDashes = "voice-msg-1710859680000-abcd-1234-extra";
      expect(extractTimestampFromId(idWithExtraDashes)).toBe(1710859680000);
    });

    it("should return null for empty timestamp part", () => {
      const emptyTimestampId = "voice-msg--abcd1234";
      expect(extractTimestampFromId(emptyTimestampId)).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle null input", () => {
      expect(extractTimestampFromId(null as any)).toBeNull();
    });

    it("should handle undefined input", () => {
      expect(extractTimestampFromId(undefined as any)).toBeNull();
    });

    it("should handle non-string input", () => {
      expect(extractTimestampFromId(123 as any)).toBeNull();
      expect(extractTimestampFromId({} as any)).toBeNull();
      expect(extractTimestampFromId([] as any)).toBeNull();
    });

    it("should handle empty string", () => {
      expect(extractTimestampFromId("")).toBeNull();
    });

    it("should return null for NaN timestamp", () => {
      const nanTimestampId = "voice-msg-notanumber-abcd1234";
      expect(extractTimestampFromId(nanTimestampId)).toBeNull();
    });

    it("should extract numeric prefix from mixed alphanumeric timestamp", () => {
      // parseInt("123abc456", 10) returns 123, not NaN
      const mixedTimestampId = "voice-msg-123abc456-abcd1234";
      expect(extractTimestampFromId(mixedTimestampId)).toBe(123);
    });
  });

  describe("Integration with isVoiceMessageId", () => {
    it("should only process IDs that pass isVoiceMessageId check", () => {
      const invalidIds = [
        "not-a-voice-message-123-abc",
        "voice-message-123-abc", // Wrong prefix
        "",
        "voice-msg", // Incomplete
      ];

      invalidIds.forEach((id) => {
        expect(isVoiceMessageId(id)).toBe(false);
        expect(extractTimestampFromId(id)).toBeNull();
      });
    });
  });
});
