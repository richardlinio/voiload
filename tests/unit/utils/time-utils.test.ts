/// <reference types="jest" />

import {
  parseLastModifiedHeader,
  formatDateForFilename,
  generateVoiceMessageFilename,
  millisecondsToSeconds,
  secondsToMilliseconds,
  domDurationToMilliseconds,
} from "../../../extension/scripts/utils/time-utils";

// Mock Logger to avoid side effects
jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    error: jest.fn(),
  },
}));

describe("parseLastModifiedHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Normal Cases", () => {
    it("should correctly parse standard HTTP date format", () => {
      const result = parseLastModifiedHeader("Wed, 19 Mar 2025 14:04:40 GMT");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(2); // March is 2 (0-based)
      expect(result?.getDate()).toBe(19);
    });

    it("should correctly parse ISO 8601 format", () => {
      const result = parseLastModifiedHeader("2025-03-19T14:04:40.000Z");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle empty string", () => {
      const result = parseLastModifiedHeader("");
      expect(result).toBeNull();
    });

    it("should handle null input", () => {
      const result = parseLastModifiedHeader(null as any);
      expect(result).toBeNull();
    });

    it("should handle undefined input", () => {
      const result = parseLastModifiedHeader(undefined as any);
      expect(result).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid date format", () => {
      const result = parseLastModifiedHeader("invalid-date-format");
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result?.getTime() as number)).toBe(true);
    });

    it("should handle malformed date string", () => {
      const result = parseLastModifiedHeader("2025-13-40T99:99:99.000Z");
      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result?.getTime() as number)).toBe(true);
    });
  });
});

describe("formatDateForFilename", () => {
  describe("Normal Cases", () => {
    it("should correctly format date for filename", () => {
      const date = new Date("2025-03-19T14:04:40.000");
      const result = formatDateForFilename(date);
      expect(result).toBe("2025-03-19-14-04-40-000");
    });

    it("should correctly handle zero padding", () => {
      const date = new Date("2025-01-01T01:01:01.000");
      const result = formatDateForFilename(date);
      expect(result).toBe("2025-01-01-01-01-01-000");
    });

    it("should handle end of year date", () => {
      const date = new Date("2025-12-31T23:59:59.000");
      const result = formatDateForFilename(date);
      expect(result).toBe("2025-12-31-23-59-59-000");
    });
  });

  describe("Boundary Conditions and Error Handling", () => {
    it("should handle invalid date object", () => {
      const invalidDate = new Date("invalid");
      const result = formatDateForFilename(invalidDate);
      // Should return current time format (we can't predict exact time, so check format)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}$/);
    });

    it("should handle null input", () => {
      const result = formatDateForFilename(null as any);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}$/);
    });

    it("should handle undefined input", () => {
      const result = formatDateForFilename(undefined as any);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}$/);
    });

    it("should handle non-date object input", () => {
      const result = formatDateForFilename("not-a-date" as any);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}$/);
    });
  });
});

describe("generateVoiceMessageFilename", () => {
  describe("Normal Cases", () => {
    it("should generate filename using lastModified parameter", () => {
      const result = generateVoiceMessageFilename(
        "Wed, 19 Mar 2025 14:04:40 GMT"
      );
      expect(result).toMatch(/^voice-message-2025-03-19-\d{2}-04-40-\d{3}$/);
    });

    it("should use current time when lastModified is not provided", () => {
      const result = generateVoiceMessageFilename();
      expect(result).toMatch(
        /^voice-message-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}$/
      );
    });

    it("should use current time when lastModified is an empty string", () => {
      const result = generateVoiceMessageFilename("");
      expect(result).toMatch(
        /^voice-message-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}$/
      );
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle invalid lastModified format", () => {
      const result = generateVoiceMessageFilename("invalid-date");
      expect(result).toMatch(
        /^voice-message-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}$/
      );
    });

    it("should handle null lastModified", () => {
      const result = generateVoiceMessageFilename(null as any);
      expect(result).toMatch(
        /^voice-message-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}$/
      );
    });
  });
});

describe("millisecondsToSeconds", () => {
  describe("Normal Cases", () => {
    it("should correctly convert milliseconds to seconds", () => {
      expect(millisecondsToSeconds(1000)).toBe(1.0);
      expect(millisecondsToSeconds(1500)).toBe(1.5);
      expect(millisecondsToSeconds(2750)).toBe(2.8);
    });

    it("should correctly handle decimal places", () => {
      expect(millisecondsToSeconds(1234, 0)).toBe(1);
      expect(millisecondsToSeconds(1234, 1)).toBe(1.2);
      expect(millisecondsToSeconds(1234, 2)).toBe(1.23);
      expect(millisecondsToSeconds(1234, 3)).toBe(1.234);
    });

    it("should handle zero value", () => {
      expect(millisecondsToSeconds(0)).toBe(0);
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle negative numbers", () => {
      expect(millisecondsToSeconds(-1000)).toBe(-1.0);
      expect(millisecondsToSeconds(-1500, 2)).toBe(-1.5);
    });

    it("should handle very large values", () => {
      expect(millisecondsToSeconds(Number.MAX_SAFE_INTEGER)).toBe(
        Number((Number.MAX_SAFE_INTEGER / 1000).toFixed(1))
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle NaN input", () => {
      expect(millisecondsToSeconds(NaN)).toBe(0);
    });

    it("should handle non-numeric input", () => {
      expect(millisecondsToSeconds("not-a-number" as any)).toBe(0);
      expect(millisecondsToSeconds(null as any)).toBe(0);
      expect(millisecondsToSeconds(undefined as any)).toBe(0);
    });

    it("should handle Infinity", () => {
      expect(millisecondsToSeconds(Infinity)).toBe(Infinity);
      expect(millisecondsToSeconds(-Infinity)).toBe(-Infinity);
    });
  });
});

describe("secondsToMilliseconds", () => {
  describe("Normal Cases", () => {
    it("should correctly convert seconds to milliseconds", () => {
      expect(secondsToMilliseconds(1)).toBe(1000);
      expect(secondsToMilliseconds(1.5)).toBe(1500);
      expect(secondsToMilliseconds(2.75)).toBe(2750);
    });

    it("should correctly round", () => {
      expect(secondsToMilliseconds(1.2345)).toBe(1235); // 1234.5 -> 1235
      expect(secondsToMilliseconds(1.2344)).toBe(1234); // 1234.4 -> 1234
    });

    it("should handle zero value", () => {
      expect(secondsToMilliseconds(0)).toBe(0);
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle negative numbers", () => {
      expect(secondsToMilliseconds(-1)).toBe(-1000);
      expect(secondsToMilliseconds(-1.5)).toBe(-1500);
    });

    it("should handle very small values", () => {
      expect(secondsToMilliseconds(0.001)).toBe(1);
      expect(secondsToMilliseconds(0.0005)).toBe(1); // 0.5 -> 1
      expect(secondsToMilliseconds(0.0004)).toBe(0); // 0.4 -> 0
    });
  });

  describe("Error Handling", () => {
    it("should handle NaN input", () => {
      expect(secondsToMilliseconds(NaN)).toBe(0);
    });

    it("should handle non-numeric input", () => {
      expect(secondsToMilliseconds("not-a-number" as any)).toBe(0);
      expect(secondsToMilliseconds(null as any)).toBe(0);
      expect(secondsToMilliseconds(undefined as any)).toBe(0);
    });

    it("should handle Infinity", () => {
      expect(secondsToMilliseconds(Infinity)).toBe(Infinity);
      expect(secondsToMilliseconds(-Infinity)).toBe(-Infinity);
    });
  });
});

describe("domDurationToMilliseconds", () => {
  describe("Normal Cases", () => {
    it("should treat plausible values as seconds", () => {
      expect(domDurationToMilliseconds(61)).toBe(61000); // Integer-second aria-valuemax
      expect(domDurationToMilliseconds(3)).toBe(3000);
      expect(domDurationToMilliseconds(12.75)).toBe(12750); // Fractional seconds (legacy surfaces)
      expect(domDurationToMilliseconds(0)).toBe(0);
    });

    it("should treat values above the 20-minute cap as already milliseconds", () => {
      expect(domDurationToMilliseconds(60547)).toBe(60547);
      expect(domDurationToMilliseconds(2767.4)).toBe(2767);
    });

    it("should handle the boundary value as seconds", () => {
      expect(domDurationToMilliseconds(1200)).toBe(1200000); // Exactly 20 minutes
      expect(domDurationToMilliseconds(1201)).toBe(1201); // Just above: must be ms
    });
  });

  describe("Error Handling", () => {
    it("should return 0 for invalid input", () => {
      expect(domDurationToMilliseconds(NaN)).toBe(0);
      expect(domDurationToMilliseconds("not-a-number" as any)).toBe(0);
      expect(domDurationToMilliseconds(null as any)).toBe(0);
      expect(domDurationToMilliseconds(undefined as any)).toBe(0);
    });
  });
});
