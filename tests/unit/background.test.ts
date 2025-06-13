/**
 * @jest-environment jsdom
 */
/// <reference types="jest" />

// Mock all the modules before importing the background script
jest.mock("../../extension/scripts/background/menu-manager");
jest.mock("../../extension/scripts/background/download-manager");
jest.mock("../../extension/scripts/background/message-handler");
jest.mock("../../extension/scripts/background/web-request-interceptor");
jest.mock("../../extension/scripts/background/data-store");
jest.mock("../../extension/scripts/background/onboarding-utils");
jest.mock("../../extension/scripts/utils/logger");

describe("background.ts", () => {
  let mockInitMenuManager: jest.Mock;
  let mockInitDownloadManager: jest.Mock;
  let mockInitMessageHandler: jest.Mock;
  let mockInitWebRequestInterceptor: jest.Mock;
  let mockCreateDataStore: jest.Mock;
  let mockCleanupOldItems: jest.Mock;
  let mockCheckOnboardingStatus: jest.Mock;
  let mockMarkOnboardingShown: jest.Mock;
  let mockLogger: any;
  let mockChrome: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Setup chrome mock
    mockChrome = {
      runtime: {
        onInstalled: {
          addListener: jest.fn(),
        },
        getURL: jest.fn(),
        getManifest: jest.fn(() => ({
          version: "1.0.0",
        })),
        sendMessage: jest.fn(),
      },
      action: {
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn(),
      },
      storage: {
        local: {
          set: jest.fn(),
          get: jest.fn(),
        },
      },
      tabs: {
        create: jest.fn(),
      },
    };

    (global as any).chrome = mockChrome;

    // Setup module mocks
    mockInitMenuManager = jest.fn();
    mockInitDownloadManager = jest.fn();
    mockInitMessageHandler = jest.fn();
    mockInitWebRequestInterceptor = jest.fn();
    mockCreateDataStore = jest.fn(() => new Map());
    mockCleanupOldItems = jest.fn();
    mockCheckOnboardingStatus = jest.fn();
    mockMarkOnboardingShown = jest.fn();

    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    const mockLoggerModule = {
      Logger: {
        createModuleLogger: jest.fn(() => mockLogger),
      },
    };

    // Setup module mocks
    (jest.doMock as any)(
      "../../extension/scripts/background/menu-manager",
      () => ({
        initMenuManager: mockInitMenuManager,
      })
    );

    (jest.doMock as any)(
      "../../extension/scripts/background/download-manager",
      () => ({
        initDownloadManager: mockInitDownloadManager,
      })
    );

    (jest.doMock as any)(
      "../../extension/scripts/background/message-handler",
      () => ({
        initMessageHandler: mockInitMessageHandler,
      })
    );

    (jest.doMock as any)(
      "../../extension/scripts/background/web-request-interceptor",
      () => ({
        initWebRequestInterceptor: mockInitWebRequestInterceptor,
      })
    );

    (jest.doMock as any)(
      "../../extension/scripts/background/data-store",
      () => ({
        createDataStore: mockCreateDataStore,
        cleanupOldItems: mockCleanupOldItems,
      })
    );

    (jest.doMock as any)(
      "../../extension/scripts/background/onboarding-utils",
      () => ({
        checkOnboardingStatus: mockCheckOnboardingStatus,
        markOnboardingShown: mockMarkOnboardingShown,
      })
    );

    (jest.doMock as any)(
      "../../extension/scripts/utils/logger",
      () => mockLoggerModule
    );

    // Mock constants
    (jest.doMock as any)("../../extension/scripts/utils/constants", () => ({
      UI_CONSTANTS: {
        BADGE_TEXT: "VL",
        BADGE_COLOR: "#4285f4",
      },
      TIME_CONSTANTS: {
        CLEANUP_INTERVAL: 1800000, // 30 minutes
      },
      MODULE_NAMES: {
        BACKGROUND: "background",
      },
    }));

    // Mock setInterval
    jest.spyOn(global, "setInterval").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  describe("Module Loading", () => {
    it("should load without errors", async () => {
      expect(() => {
        require("../../extension/scripts/background");
      }).not.toThrow();
    });

    it("should create module logger with correct name", async () => {
      require("../../extension/scripts/background");

      const mockLoggerModule = require("../../extension/scripts/utils/logger");
      expect(mockLoggerModule.Logger.createModuleLogger).toHaveBeenCalledWith(
        "background"
      );
    });

    it("should log chrome API availability", async () => {
      require("../../extension/scripts/background");

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Chrome API availability",
        expect.objectContaining({
          chrome: true,
          webRequest: expect.any(Boolean),
          contextMenus: expect.any(Boolean),
          downloads: expect.any(Boolean),
        })
      );
    });
  });

  describe("Initialization", () => {
    it("should initialize all modules successfully", async () => {
      require("../../extension/scripts/background");

      expect(mockCreateDataStore).toHaveBeenCalled();
      expect(mockInitMenuManager).toHaveBeenCalled();
      expect(mockInitDownloadManager).toHaveBeenCalled();
      expect(mockInitMessageHandler).toHaveBeenCalledWith(expect.any(Map));
      expect(mockInitWebRequestInterceptor).toHaveBeenCalledWith(
        expect.any(Map)
      );
    });

    it("should set up periodic cleanup", async () => {
      require("../../extension/scripts/background");

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1800000);
    });

    it("should log successful initialization", async () => {
      require("../../extension/scripts/background");

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Initializing background script"
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Background script initialization complete"
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle initialization errors gracefully", async () => {
      const error = new Error("Initialization failed");
      mockCreateDataStore.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        require("../../extension/scripts/background");
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error during execution of initialization function",
        {
          message: error.message,
          stack: error.stack,
        }
      );
    });

    it("should log errors during module initialization", async () => {
      const error = new Error("Module init failed");
      mockInitMenuManager.mockImplementation(() => {
        throw error;
      });

      require("../../extension/scripts/background");

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error during initialization",
        { error }
      );
    });
  });

  describe("Chrome Extension Events", () => {
    let onInstalledListener: (details: chrome.runtime.InstalledDetails) => void;

    beforeEach(() => {
      require("../../extension/scripts/background");
      onInstalledListener =
        mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
    });

    it("should register onInstalled listener", () => {
      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    describe("onInstalled event handler", () => {
      it("should set badge text and color on install", async () => {
        const details = {
          reason: "install" as chrome.runtime.OnInstalledReason,
        };

        mockChrome.storage.local.set.mockResolvedValue(undefined);
        mockCheckOnboardingStatus.mockResolvedValue({ completed: false });
        mockChrome.runtime.getURL.mockReturnValue(
          "chrome-extension://id/onboarding/welcome.html"
        );

        await onInstalledListener(details);

        expect(mockChrome.action.setBadgeText).toHaveBeenCalledWith({
          text: "VL",
        });
        expect(mockChrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
          color: "#4285f4",
        });
      });

      it("should handle first installation correctly", async () => {
        const details = {
          reason: "install" as chrome.runtime.OnInstalledReason,
        };

        mockChrome.storage.local.set.mockResolvedValue(undefined);
        mockCheckOnboardingStatus.mockResolvedValue({ completed: false });
        mockChrome.runtime.getURL.mockReturnValue(
          "chrome-extension://id/onboarding/welcome.html"
        );

        await onInstalledListener(details);

        expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
          installTime: expect.any(Number),
        });
        expect(mockCheckOnboardingStatus).toHaveBeenCalled();
        expect(mockChrome.tabs.create).toHaveBeenCalledWith({
          url: "chrome-extension://id/onboarding/welcome.html",
          active: true,
        });
        expect(mockMarkOnboardingShown).toHaveBeenCalled();
      });

      it("should skip onboarding if already completed", async () => {
        const details = {
          reason: "install" as chrome.runtime.OnInstalledReason,
        };

        mockChrome.storage.local.set.mockResolvedValue(undefined);
        mockCheckOnboardingStatus.mockResolvedValue({ completed: true });

        await onInstalledListener(details);

        expect(mockChrome.tabs.create).not.toHaveBeenCalled();
        expect(mockMarkOnboardingShown).not.toHaveBeenCalled();
      });

      it("should handle update installation", async () => {
        const details = {
          reason: "update" as chrome.runtime.OnInstalledReason,
          previousVersion: "0.9.0",
        };

        await onInstalledListener(details);

        expect(mockLogger.info).toHaveBeenCalledWith(
          "Extension has been updated",
          {
            fromVersion: "0.9.0",
            toVersion: "1.0.0",
          }
        );
      });

      it("should handle errors during first installation", async () => {
        const details = {
          reason: "install" as chrome.runtime.OnInstalledReason,
        };
        const error = new Error("Storage error");

        mockChrome.storage.local.set.mockRejectedValue(error);

        await onInstalledListener(details);

        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error during first installation handling",
          { error }
        );
      });
    });
  });

  describe("Cleanup Interval", () => {
    it("should call cleanup function when interval triggers", async () => {
      require("../../extension/scripts/background");

      const intervalCallback = (setInterval as jest.Mock).mock.calls[0][0];
      intervalCallback();

      expect(mockCleanupOldItems).toHaveBeenCalledWith(expect.any(Map));
    });
  });
});
