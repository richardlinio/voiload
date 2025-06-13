/**
 * onboarding-utils.test.ts
 * Unit tests for onboarding-utils module
 */

// Chrome APIs are already mocked in setup.js

// Mock modules
jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

// Set up global chrome mock
// global.chrome is already set in setup.js

describe("onboarding-utils.ts", () => {
  let mockLogger: any;
  let onboardingUtils: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset chrome API to normal state
    // global.chrome is already set in setup.js

    // Reset chrome API mocks
    (global.chrome as any).storage.local.get.mockClear();
    (global.chrome as any).storage.local.set.mockClear();
    (global.chrome as any).storage.local.remove.mockClear();

    // Create fresh mock logger for each test
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    // Set up mocks
    const { Logger } = require("../../../extension/scripts/utils/logger");
    Logger.createModuleLogger.mockReturnValue(mockLogger);

    // Import after mocks are set up
    onboardingUtils = require("../../../extension/scripts/background/onboarding-utils");
  });

  describe("checkOnboardingStatus", () => {
    describe("Normal Cases", () => {
      it("should return status with completed and shown true", async () => {
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: true,
          onboardingShown: true,
          installTime: 1234567890000,
          completedAt: 1234567890000,
        });

        const status = await onboardingUtils.checkOnboardingStatus();

        expect(status).toEqual({
          completed: true,
          shown: true,
          installTime: 1234567890000,
          completedAt: 1234567890000,
        });
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Onboarding status",
          status
        );
      });

      it("should return default values when storage is empty", async () => {
        (global.chrome as any).storage.local.get.mockResolvedValue({});

        const status = await onboardingUtils.checkOnboardingStatus();

        expect(status).toEqual({
          completed: false,
          shown: false,
          installTime: null,
          completedAt: null,
        });
      });

      it("should handle partial data from storage", async () => {
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: true,
          installTime: 1234567890000,
        });

        const status = await onboardingUtils.checkOnboardingStatus();

        expect(status).toEqual({
          completed: true,
          shown: false,
          installTime: 1234567890000,
          completedAt: null,
        });
      });
    });

    describe("Error Handling", () => {
      it("should handle storage access error", async () => {
        const mockError = new Error("Storage access denied");
        (global.chrome as any).storage.local.get.mockRejectedValue(mockError);

        const status = await onboardingUtils.checkOnboardingStatus();

        expect(status).toEqual({
          completed: false,
          shown: false,
          installTime: null,
          completedAt: null,
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error checking onboarding status",
          { error: mockError }
        );
      });

      it("should handle chrome.storage API unavailable", async () => {
        // Temporarily remove chrome.storage
        const originalChrome = global.chrome;
        global.chrome = {} as any;

        const status = await onboardingUtils.checkOnboardingStatus();

        expect(status).toEqual({
          completed: false,
          shown: false,
          installTime: null,
          completedAt: null,
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error checking onboarding status",
          { error: expect.any(Error) }
        );

        // Restore chrome
        global.chrome = originalChrome;
      });
    });
  });

  describe("resetOnboarding", () => {
    describe("Normal Cases", () => {
      it("should remove all onboarding keys from storage", async () => {
        (global.chrome as any).storage.local.remove.mockResolvedValue(
          undefined
        );

        await onboardingUtils.resetOnboarding();

        expect(
          (global.chrome as any).storage.local.remove
        ).toHaveBeenCalledWith([
          "onboardingCompleted",
          "onboardingShown",
          "installTime",
          "completedAt",
        ]);
        expect(mockLogger.info).toHaveBeenCalledWith(
          "Onboarding status has been reset"
        );
      });
    });

    describe("Error Handling", () => {
      it("should handle storage removal error", async () => {
        const mockError = new Error("Storage removal failed");
        (global.chrome as any).storage.local.remove.mockRejectedValue(
          mockError
        );

        await onboardingUtils.resetOnboarding();

        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error resetting onboarding status",
          { error: mockError }
        );
      });
    });
  });

  describe("markOnboardingShown", () => {
    describe("Normal Cases", () => {
      it("should set onboarding as shown with timestamp", async () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, "now").mockReturnValue(mockTimestamp);
        (global.chrome as any).storage.local.set.mockResolvedValue(undefined);

        await onboardingUtils.markOnboardingShown();

        expect((global.chrome as any).storage.local.set).toHaveBeenCalledWith({
          onboardingShown: true,
          shownAt: mockTimestamp,
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          "Onboarding marked as shown"
        );

        jest.restoreAllMocks();
      });
    });

    describe("Error Handling", () => {
      it("should handle storage set error", async () => {
        const mockError = new Error("Storage set failed");
        (global.chrome as any).storage.local.set.mockRejectedValue(mockError);

        await onboardingUtils.markOnboardingShown();

        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error marking onboarding as shown",
          { error: mockError }
        );
      });
    });
  });

  describe("markOnboardingCompleted", () => {
    describe("Normal Cases", () => {
      it("should set onboarding as completed with timestamp", async () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, "now").mockReturnValue(mockTimestamp);
        (global.chrome as any).storage.local.set.mockResolvedValue(undefined);

        await onboardingUtils.markOnboardingCompleted();

        expect((global.chrome as any).storage.local.set).toHaveBeenCalledWith({
          onboardingCompleted: true,
          completedAt: mockTimestamp,
        });
        expect(mockLogger.info).toHaveBeenCalledWith(
          "Onboarding marked as completed"
        );

        jest.restoreAllMocks();
      });
    });

    describe("Error Handling", () => {
      it("should handle storage set error", async () => {
        const mockError = new Error("Storage set failed");
        (global.chrome as any).storage.local.set.mockRejectedValue(mockError);

        await onboardingUtils.markOnboardingCompleted();

        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error marking onboarding as completed",
          { error: mockError }
        );
      });
    });
  });

  describe("shouldShowOnboarding", () => {
    describe("Normal Cases", () => {
      it("should return false if onboarding is already completed", async () => {
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: true,
          onboardingShown: true,
        });

        const result = await onboardingUtils.shouldShowOnboarding();

        expect(result).toBe(false);
      });

      it("should return true if onboarding has never been shown", async () => {
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: false,
          onboardingShown: false,
        });

        const result = await onboardingUtils.shouldShowOnboarding();

        expect(result).toBe(true);
      });

      it("should return false if shown recently (within one week)", async () => {
        const now = Date.now();
        const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

        jest.spyOn(Date, "now").mockReturnValue(now);
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: false,
          onboardingShown: true,
          installTime: threeDaysAgo,
        });

        const result = await onboardingUtils.shouldShowOnboarding();

        expect(result).toBe(false);
        jest.restoreAllMocks();
      });

      it("should return true if shown but more than one week passed", async () => {
        const now = Date.now();
        const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

        jest.spyOn(Date, "now").mockReturnValue(now);
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: false,
          onboardingShown: true,
          installTime: twoWeeksAgo,
        });

        const result = await onboardingUtils.shouldShowOnboarding();

        expect(result).toBe(true);
        jest.restoreAllMocks();
      });

      it("should handle null installTime", async () => {
        const now = Date.now();

        jest.spyOn(Date, "now").mockReturnValue(now);
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: false,
          onboardingShown: true,
          installTime: null,
        });

        const result = await onboardingUtils.shouldShowOnboarding();

        expect(result).toBe(true); // Since installTime is null, timeSinceInstall will be very large
        jest.restoreAllMocks();
      });
    });

    describe("Edge Cases", () => {
      it("should handle exactly one week boundary", async () => {
        const now = Date.now();
        const exactlyOneWeek = now - 7 * 24 * 60 * 60 * 1000;

        jest.spyOn(Date, "now").mockReturnValue(now);
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: false,
          onboardingShown: true,
          installTime: exactlyOneWeek,
        });

        const result = await onboardingUtils.shouldShowOnboarding();

        expect(result).toBe(false); // Should be false since it's exactly one week (not greater than)
        jest.restoreAllMocks();
      });

      it("should handle future installTime", async () => {
        const now = Date.now();
        const future = now + 24 * 60 * 60 * 1000; // 1 day in future

        jest.spyOn(Date, "now").mockReturnValue(now);
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: false,
          onboardingShown: true,
          installTime: future,
        });

        const result = await onboardingUtils.shouldShowOnboarding();

        expect(result).toBe(false); // timeSinceInstall would be negative
        jest.restoreAllMocks();
      });
    });

    describe("Integration Tests", () => {
      it("should work correctly with realistic onboarding flow", async () => {
        // Step 1: Fresh install - should show onboarding
        (global.chrome as any).storage.local.get.mockResolvedValue({});

        let result = await onboardingUtils.shouldShowOnboarding();
        expect(result).toBe(true);

        // Step 2: Mark as shown
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, "now").mockReturnValue(mockTimestamp);
        (global.chrome as any).storage.local.set.mockResolvedValue(undefined);

        await onboardingUtils.markOnboardingShown();

        // Step 3: Check again - should not show (within one week)
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: false,
          onboardingShown: true,
          installTime: mockTimestamp,
        });

        result = await onboardingUtils.shouldShowOnboarding();
        expect(result).toBe(false);

        // Step 4: Mark as completed
        await onboardingUtils.markOnboardingCompleted();

        // Step 5: Check again - should never show once completed
        (global.chrome as any).storage.local.get.mockResolvedValue({
          onboardingCompleted: true,
          onboardingShown: true,
          installTime: mockTimestamp,
          completedAt: mockTimestamp,
        });

        result = await onboardingUtils.shouldShowOnboarding();
        expect(result).toBe(false);

        jest.restoreAllMocks();
      });
    });
  });

  describe("OnboardingStatus Interface", () => {
    it("should have correct type structure", async () => {
      (global.chrome as any).storage.local.get.mockResolvedValue({
        onboardingCompleted: true,
        onboardingShown: true,
        installTime: 1234567890000,
        completedAt: 1234567890000,
      });

      const status = await onboardingUtils.checkOnboardingStatus();

      expect(typeof status.completed).toBe("boolean");
      expect(typeof status.shown).toBe("boolean");
      expect(typeof status.installTime).toBe("number");
      expect(typeof status.completedAt).toBe("number");
    });

    it("should handle null values correctly", async () => {
      (global.chrome as any).storage.local.get.mockResolvedValue({});

      const status = await onboardingUtils.checkOnboardingStatus();

      expect(status.installTime).toBeNull();
      expect(status.completedAt).toBeNull();
    });
  });
});
