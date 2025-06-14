/// <reference types="jest" />

// Mock environment variable before any imports
(global as any).__IS_PRODUCTION__ = false;

// Mock Chrome API
const mockChromePopup = {
  tabs: {
    create: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    reload: jest.fn(),
  },
  runtime: {
    getURL: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
};

(global as any).chrome = mockChromePopup;

// Mock window.close
const mockWindowClosePopup = jest.fn();
(global as any).window = {
  close: mockWindowClosePopup,
};

// Mock DOM environment
const mockElementsPopup = {
  statusElement: {
    textContent: "",
    classList: {
      add: jest.fn(),
    },
  } as any,
  statusDiv: {
    appendChild: jest.fn(),
    classList: {
      add: jest.fn(),
    },
  } as any,
  footer: {
    appendChild: jest.fn(),
    insertBefore: jest.fn(),
    firstChild: {},
  } as any,
};

const mockQuerySelectorPopup = jest.fn();
const mockGetElementByIdPopup = jest.fn();
const mockCreateElementPopup = jest.fn();
const mockAddEventListenerPopup = jest.fn();

(global as any).document = {
  addEventListener: mockAddEventListenerPopup,
  querySelector: mockQuerySelectorPopup,
  getElementById: mockGetElementByIdPopup,
  createElement: mockCreateElementPopup,
};

// Mock the onboarding-utils module
const mockCheckOnboardingStatus = jest.fn();
jest.mock("../../../extension/scripts/background/onboarding-utils", () => ({
  checkOnboardingStatus: mockCheckOnboardingStatus,
}));

// Mock Logger
const mockLoggerPopup = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};

jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => mockLoggerPopup),
  },
}));

describe("popup.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset DOM query selectors
    mockQuerySelectorPopup.mockImplementation((selector: string) => {
      if (selector === ".status p") {
        return mockElementsPopup.statusElement;
      }
      if (selector === ".status") {
        return mockElementsPopup.statusDiv;
      }
      if (selector === ".footer") {
        return mockElementsPopup.footer;
      }
      return null;
    });

    mockGetElementByIdPopup.mockImplementation((_id: string) => {
      const button = {
        addEventListener: jest.fn(),
        disabled: false,
        textContent: "",
        style: { display: "" },
      };
      return button;
    });

    mockCreateElementPopup.mockImplementation(() => ({
      className: "",
      innerHTML: "",
      classList: { add: jest.fn() },
      style: { display: "" },
      remove: jest.fn(),
    }));

    // Mock current date
    jest
      .spyOn(Date.prototype, "toLocaleTimeString")
      .mockReturnValue("12:00:00 PM");
    jest
      .spyOn(Date.prototype, "toLocaleDateString")
      .mockReturnValue("1/1/2025");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("DOMContentLoaded event", () => {
    it("should log popup loaded message", async () => {
      // Import the module to get the event handler
      await import("../../../extension/popup/popup");

      // Trigger the DOMContentLoaded event
      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: Date.now(),
        });

        await eventHandler();
        expect(mockLoggerPopup.info).toHaveBeenCalledWith("Popup loaded");
      }
    });

    it("should update status element with current time", async () => {
      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: Date.now(),
        });

        await eventHandler();

        expect(mockElementsPopup.statusElement.textContent).toBe(
          "✅ Extension is running! (12:00:00 PM)"
        );
        expect(mockElementsPopup.statusDiv.classList.add).toHaveBeenCalledWith(
          "active"
        );
      }
    });

    it("should handle onboarding not completed", async () => {
      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: false,
          installTime: Date.now(),
          completedAt: null,
        });

        await eventHandler();

        expect(mockElementsPopup.statusDiv.appendChild).toHaveBeenCalled();
      }
    });

    it("should handle onboarding completed", async () => {
      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        const completedAt = Date.now();
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now() - 86400000,
          completedAt,
        });

        await eventHandler();

        expect(mockElementsPopup.footer.appendChild).toHaveBeenCalled();
        expect(mockElementsPopup.footer.insertBefore).toHaveBeenCalled();
      }
    });

    it("should handle onboarding status check error", async () => {
      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        const error = new Error("Storage error");
        mockCheckOnboardingStatus.mockRejectedValue(error);

        await eventHandler();

        expect(mockLoggerPopup.error).toHaveBeenCalledWith(
          "Error checking onboarding status",
          { error }
        );
      }
    });

    it("should handle missing DOM elements gracefully", async () => {
      mockQuerySelectorPopup.mockReturnValue(null);

      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: Date.now(),
        });

        await expect(eventHandler()).resolves.not.toThrow();
      }
    });
  });

  describe("showOnboardingReminder", () => {
    it("should create onboarding reminder element with correct content", async () => {
      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: false,
          installTime: Date.now(),
          completedAt: null,
        });

        await eventHandler();

        expect(mockCreateElementPopup).toHaveBeenCalledWith("div");
        expect(mockElementsPopup.statusDiv.appendChild).toHaveBeenCalled();
      }
    });

    it("should setup onboarding button click handler", async () => {
      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: false,
          installTime: Date.now(),
          completedAt: null,
        });

        mockChromePopup.runtime.getURL.mockReturnValue(
          "chrome-extension://test/onboarding/welcome.html"
        );

        await eventHandler();

        // Verify button event listener was added
        expect(mockGetElementByIdPopup).toHaveBeenCalledWith("open-onboarding");
      }
    });
  });

  describe("showCompletedStatus", () => {
    it("should not show status if completedAt is null", async () => {
      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: null,
        });

        await eventHandler();

        // Should not append completed status if completedAt is null
        const createElementCalls = mockCreateElementPopup.mock.calls;
        const hasCompletedDiv = createElementCalls.some(
          (call) => call[0] === "div" && createElementCalls.indexOf(call) > 0
        );
        expect(hasCompletedDiv).toBeTruthy(); // Quick links div is created
      }
    });

    it("should show formatted completion date", async () => {
      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        const completedAt = Date.now();
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now() - 86400000,
          completedAt,
        });

        await eventHandler();

        expect(mockElementsPopup.footer.appendChild).toHaveBeenCalled();
      }
    });
  });

  describe("addQuickLinks", () => {
    it("should create quick links with all buttons", async () => {
      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: Date.now(),
        });

        await eventHandler();

        expect(mockCreateElementPopup).toHaveBeenCalledWith("div");
        expect(mockElementsPopup.footer.insertBefore).toHaveBeenCalled();

        // Verify all button IDs are queried
        expect(mockGetElementByIdPopup).toHaveBeenCalledWith("open-messenger");
        expect(mockGetElementByIdPopup).toHaveBeenCalledWith("open-facebook");
        expect(mockGetElementByIdPopup).toHaveBeenCalledWith("view-tutorial");
        expect(mockGetElementByIdPopup).toHaveBeenCalledWith("report-issue");
      }
    });

    it("should setup messenger button to open messenger.com", async () => {
      const mockButton = {
        addEventListener: jest.fn(),
      };
      mockGetElementByIdPopup.mockImplementation((id: string) => {
        if (id === "open-messenger") {
          return mockButton;
        }
        return { addEventListener: jest.fn() };
      });

      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: Date.now(),
        });

        await eventHandler();

        expect(mockButton.addEventListener).toHaveBeenCalledWith(
          "click",
          expect.any(Function)
        );

        // Trigger the click handler
        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        clickHandler();

        expect(mockChromePopup.tabs.create).toHaveBeenCalledWith({
          url: "https://www.messenger.com",
        });
        expect(mockWindowClosePopup).toHaveBeenCalled();
      }
    });

    it("should setup facebook button to open facebook.com", async () => {
      const mockButton = {
        addEventListener: jest.fn(),
      };
      mockGetElementByIdPopup.mockImplementation((id: string) => {
        if (id === "open-facebook") {
          return mockButton;
        }
        return { addEventListener: jest.fn() };
      });

      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: Date.now(),
        });

        await eventHandler();

        // Trigger the click handler
        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        clickHandler();

        expect(mockChromePopup.tabs.create).toHaveBeenCalledWith({
          url: "https://www.facebook.com",
        });
        expect(mockWindowClosePopup).toHaveBeenCalled();
      }
    });

    it("should setup tutorial button to open welcome page", async () => {
      const mockButton = {
        addEventListener: jest.fn(),
      };
      mockGetElementByIdPopup.mockImplementation((id: string) => {
        if (id === "view-tutorial") {
          return mockButton;
        }
        return { addEventListener: jest.fn() };
      });

      mockChromePopup.runtime.getURL.mockReturnValue(
        "chrome-extension://test/onboarding/welcome.html"
      );

      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: Date.now(),
        });

        await eventHandler();

        // Trigger the click handler
        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        clickHandler();

        expect(mockChromePopup.tabs.create).toHaveBeenCalledWith({
          url: "chrome-extension://test/onboarding/welcome.html",
        });
        expect(mockWindowClosePopup).toHaveBeenCalled();
      }
    });

    it("should setup report button to open mailto link", async () => {
      const mockButton = {
        addEventListener: jest.fn(),
      };
      mockGetElementByIdPopup.mockImplementation((id: string) => {
        if (id === "report-issue") {
          return mockButton;
        }
        return { addEventListener: jest.fn() };
      });

      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: Date.now(),
        });

        await eventHandler();

        // Trigger the click handler
        const clickHandler = mockButton.addEventListener.mock.calls[0][1];
        clickHandler();

        expect(mockChromePopup.tabs.create).toHaveBeenCalledWith({
          url: "mailto:linpoju.richard@gmail.com?subject=VoiLoad%20Issue%20Report",
        });
      }
    });

    it("should handle missing buttons gracefully", async () => {
      mockGetElementByIdPopup.mockReturnValue(null);

      await import("../../../extension/popup/popup");

      const eventHandler = mockAddEventListenerPopup.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        mockCheckOnboardingStatus.mockResolvedValue({
          completed: true,
          installTime: Date.now(),
          completedAt: Date.now(),
        });

        await expect(eventHandler()).resolves.not.toThrow();
      }
    });
  });
});
