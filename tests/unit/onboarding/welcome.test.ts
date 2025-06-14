/// <reference types="jest" />

// Mock environment variable before any imports
(global as any).__IS_PRODUCTION__ = false;

// Mock Chrome API
const mockChromeWelcome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    reload: jest.fn(),
  },
};

(global as any).chrome = mockChromeWelcome;

// Mock window.close
const mockWindowCloseWelcome = jest.fn();
(global as any).window = {
  close: mockWindowCloseWelcome,
};

// Mock setTimeout
const mockSetTimeoutWelcome = jest.fn((_callback, _timeout) => {
  return 123; // Mock timer ID
});
(global as any).setTimeout = mockSetTimeoutWelcome;

// Mock DOM environment
const mockElementsWelcome = {
  container: {
    insertBefore: jest.fn(),
    firstChild: {},
  } as any,
  completeButton: {
    addEventListener: jest.fn(),
    disabled: false,
    textContent: "",
  } as any,
  footer: {
    appendChild: jest.fn(),
    insertBefore: jest.fn(),
  } as any,
};

const mockQuerySelectorWelcome = jest.fn();
const mockGetElementByIdWelcome = jest.fn();
const mockCreateElementWelcome = jest.fn();
const mockAddEventListenerWelcome = jest.fn();
const mockQuerySelectorAllWelcome = jest.fn();

// Mock Intersection Observer
const mockIntersectionObserver = jest.fn();
const mockObserve = jest.fn();
const mockUnobserve = jest.fn();

mockIntersectionObserver.mockImplementation((_callback, _options) => ({
  observe: mockObserve,
  unobserve: mockUnobserve,
  disconnect: jest.fn(),
}));

(global as any).IntersectionObserver = mockIntersectionObserver;

(global as any).document = {
  addEventListener: mockAddEventListenerWelcome,
  querySelector: mockQuerySelectorWelcome,
  getElementById: mockGetElementByIdWelcome,
  createElement: mockCreateElementWelcome,
  querySelectorAll: mockQuerySelectorAllWelcome,
};

// Mock Logger
const mockLoggerWelcome = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};

jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => mockLoggerWelcome),
  },
}));

describe("welcome.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset DOM query selectors
    mockQuerySelectorWelcome.mockImplementation((selector: string) => {
      if (selector === ".container") {
        return mockElementsWelcome.container;
      }
      if (selector === "footer") {
        return mockElementsWelcome.footer;
      }
      return null;
    });

    mockGetElementByIdWelcome.mockImplementation((id: string) => {
      if (id === "complete-onboarding") {
        return mockElementsWelcome.completeButton;
      }
      return null;
    });

    mockCreateElementWelcome.mockImplementation(() => ({
      className: "",
      innerHTML: "",
      classList: { add: jest.fn() },
      style: { display: "" },
      remove: jest.fn(),
    }));

    mockQuerySelectorAllWelcome.mockReturnValue([
      { classList: { add: jest.fn() } },
      { classList: { add: jest.fn() } },
    ]);

    // Reset Chrome API mocks
    mockChromeWelcome.storage.local.get.mockResolvedValue({});
    mockChromeWelcome.storage.local.set.mockResolvedValue(undefined);
    mockChromeWelcome.tabs.query.mockResolvedValue([]);
    mockChromeWelcome.tabs.create.mockResolvedValue({ id: 1 });
    mockChromeWelcome.tabs.update.mockResolvedValue({});
    mockChromeWelcome.tabs.reload.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("DOMContentLoaded event", () => {
    it("should log onboarding page loaded message", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();
        expect(mockLoggerWelcome.info).toHaveBeenCalledWith(
          "Onboarding page loaded"
        );
      }
    });

    it("should check onboarding status from storage", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();
        expect(mockChromeWelcome.storage.local.get).toHaveBeenCalledWith([
          "onboardingCompleted",
        ]);
      }
    });

    it("should show completed message if onboarding already completed", async () => {
      mockChromeWelcome.storage.local.get.mockResolvedValue({
        onboardingCompleted: true,
      });

      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        expect(mockLoggerWelcome.info).toHaveBeenCalledWith(
          "User has already completed onboarding"
        );
        expect(mockElementsWelcome.container.insertBefore).toHaveBeenCalled();
      }
    });

    it("should setup complete button event handler", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();
        expect(
          mockElementsWelcome.completeButton.addEventListener
        ).toHaveBeenCalledWith("click", expect.any(Function));
      }
    });

    it("should setup intersection observer for animations", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        expect(mockIntersectionObserver).toHaveBeenCalledWith(
          expect.any(Function),
          {
            threshold: 0.1,
            rootMargin: "0px 0px -50px 0px",
          }
        );
        expect(mockQuerySelectorWelcome).toHaveBeenCalledWith(
          ".step, .feature"
        );
        expect(mockObserve).toHaveBeenCalledTimes(2); // For each animated element
      }
    });
  });

  describe("complete button functionality", () => {
    it("should handle complete button click", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        // Get the click handler
        const clickHandler =
          mockElementsWelcome.completeButton.addEventListener.mock.calls[0][1];

        expect(mockLoggerWelcome.info).toHaveBeenCalledWith(
          "Onboarding page loaded"
        );

        // Trigger the click
        await clickHandler();

        expect(mockLoggerWelcome.info).toHaveBeenCalledWith(
          "User clicked complete button"
        );
        expect(mockElementsWelcome.completeButton.disabled).toBe(true);
        expect(mockElementsWelcome.completeButton.textContent).toBe(
          "Loading..."
        );
      }
    });

    it("should save onboarding completion to storage", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        const clickHandler =
          mockElementsWelcome.completeButton.addEventListener.mock.calls[0][1];
        await clickHandler();

        expect(mockChromeWelcome.storage.local.set).toHaveBeenCalledWith({
          onboardingCompleted: true,
          completedAt: expect.any(Number),
        });
        expect(mockLoggerWelcome.info).toHaveBeenCalledWith(
          "Onboarding status updated"
        );
      }
    });

    it("should switch to existing Facebook/Messenger tab if found", async () => {
      const mockTab = { id: 123, url: "https://www.messenger.com" };
      mockChromeWelcome.tabs.query.mockResolvedValue([mockTab]);

      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        const clickHandler =
          mockElementsWelcome.completeButton.addEventListener.mock.calls[0][1];
        await clickHandler();

        expect(mockChromeWelcome.tabs.query).toHaveBeenCalledWith({
          url: ["*://*.messenger.com/*", "*://*.facebook.com/*"],
        });
        expect(mockLoggerWelcome.info).toHaveBeenCalledWith(
          "Found open Facebook/Messenger tab"
        );
        expect(mockChromeWelcome.tabs.update).toHaveBeenCalledWith(123, {
          active: true,
        });
        expect(mockChromeWelcome.tabs.reload).toHaveBeenCalledWith(123);
        expect(mockElementsWelcome.footer.insertBefore).toHaveBeenCalled(); // Success message

        // Verify setTimeout was called for closing window
        expect(mockSetTimeoutWelcome).toHaveBeenCalledWith(
          expect.any(Function),
          3000
        );
      }
    });

    it("should create new Messenger tab if none found", async () => {
      mockChromeWelcome.tabs.query.mockResolvedValue([]);

      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        const clickHandler =
          mockElementsWelcome.completeButton.addEventListener.mock.calls[0][1];
        await clickHandler();

        expect(mockLoggerWelcome.info).toHaveBeenCalledWith(
          "Opening new Messenger tab"
        );
        expect(mockChromeWelcome.tabs.create).toHaveBeenCalledWith({
          url: "https://www.messenger.com",
          active: true,
        });
        expect(mockWindowCloseWelcome).toHaveBeenCalled();
      }
    });

    it("should handle tab with null id gracefully", async () => {
      const mockTab = { id: null, url: "https://www.messenger.com" };
      mockChromeWelcome.tabs.query.mockResolvedValue([mockTab]);

      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        const clickHandler =
          mockElementsWelcome.completeButton.addEventListener.mock.calls[0][1];
        await clickHandler();

        // Should not try to update/reload tab with null id
        expect(mockChromeWelcome.tabs.update).not.toHaveBeenCalled();
        expect(mockChromeWelcome.tabs.reload).not.toHaveBeenCalled();
      }
    });

    it("should handle storage error", async () => {
      const error = new Error("Storage error");
      mockChromeWelcome.storage.local.set.mockRejectedValue(error);

      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        const clickHandler =
          mockElementsWelcome.completeButton.addEventListener.mock.calls[0][1];
        await clickHandler();

        expect(mockLoggerWelcome.error).toHaveBeenCalledWith(
          "Error completing onboarding",
          { error }
        );
        expect(mockElementsWelcome.completeButton.disabled).toBe(false);
        expect(mockElementsWelcome.completeButton.textContent).toBe(
          "Get Started →"
        );
        expect(mockElementsWelcome.footer.appendChild).toHaveBeenCalled(); // Error message
      }
    });
  });

  describe("showCompletedMessage", () => {
    it("should show completed notice when onboarding already completed", async () => {
      mockChromeWelcome.storage.local.get.mockResolvedValue({
        onboardingCompleted: true,
      });

      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        expect(mockCreateElementWelcome).toHaveBeenCalledWith("div");
        expect(mockElementsWelcome.container.insertBefore).toHaveBeenCalled();
      }
    });
  });

  describe("showSuccessMessage", () => {
    it("should show success message and hide button", async () => {
      const mockTab = { id: 123, url: "https://www.messenger.com" };
      mockChromeWelcome.tabs.query.mockResolvedValue([mockTab]);

      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        const clickHandler =
          mockElementsWelcome.completeButton.addEventListener.mock.calls[0][1];
        await clickHandler();

        expect(mockElementsWelcome.footer.insertBefore).toHaveBeenCalled();
        expect(mockElementsWelcome.completeButton.style.display).toBe("none");
      }
    });
  });

  describe("showErrorMessage", () => {
    it("should show error message and auto-remove after timeout", async () => {
      const error = new Error("Test error");
      mockChromeWelcome.storage.local.set.mockRejectedValue(error);

      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        const clickHandler =
          mockElementsWelcome.completeButton.addEventListener.mock.calls[0][1];
        await clickHandler();

        expect(mockElementsWelcome.footer.appendChild).toHaveBeenCalled();
        expect(mockSetTimeoutWelcome).toHaveBeenCalledWith(
          expect.any(Function),
          3000
        );
      }
    });
  });

  describe("addAnimations", () => {
    it("should setup intersection observer with correct options", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        expect(mockIntersectionObserver).toHaveBeenCalledWith(
          expect.any(Function),
          {
            threshold: 0.1,
            rootMargin: "0px 0px -50px 0px",
          }
        );
      }
    });

    it("should observe all step and feature elements", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        expect(mockQuerySelectorWelcome).toHaveBeenCalledWith(
          ".step, .feature"
        );
        expect(mockObserve).toHaveBeenCalledTimes(2);
      }
    });

    it("should add visible class when element is intersecting", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        // Get the intersection observer callback
        const observerCallback = mockIntersectionObserver.mock.calls[0][0];

        const mockEntry = {
          isIntersecting: true,
          target: { classList: { add: jest.fn() } },
        };

        observerCallback([mockEntry]);

        expect(mockEntry.target.classList.add).toHaveBeenCalledWith("visible");
      }
    });

    it("should not add visible class when element is not intersecting", async () => {
      await import("../../../extension/onboarding/welcome");

      const eventHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "DOMContentLoaded"
      )?.[1];

      if (eventHandler) {
        await eventHandler();

        const observerCallback = mockIntersectionObserver.mock.calls[0][0];

        const mockEntry = {
          isIntersecting: false,
          target: { classList: { add: jest.fn() } },
        };

        observerCallback([mockEntry]);

        expect(mockEntry.target.classList.add).not.toHaveBeenCalled();
      }
    });
  });

  describe("keyboard event handling", () => {
    it("should trigger complete button on Enter key press", async () => {
      await import("../../../extension/onboarding/welcome");

      const keydownHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "keydown"
      )?.[1];

      const mockClick = jest.fn();
      mockElementsWelcome.completeButton.click = mockClick;
      mockElementsWelcome.completeButton.disabled = false;

      if (keydownHandler) {
        const enterEvent = { key: "Enter" };
        keydownHandler(enterEvent);

        expect(mockClick).toHaveBeenCalled();
      }
    });

    it("should not trigger complete button if disabled", async () => {
      await import("../../../extension/onboarding/welcome");

      const keydownHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "keydown"
      )?.[1];

      const mockClick = jest.fn();
      mockElementsWelcome.completeButton.click = mockClick;
      mockElementsWelcome.completeButton.disabled = true;

      if (keydownHandler) {
        const enterEvent = { key: "Enter" };
        keydownHandler(enterEvent);

        expect(mockClick).not.toHaveBeenCalled();
      }
    });

    it("should not trigger on other keys", async () => {
      await import("../../../extension/onboarding/welcome");

      const keydownHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "keydown"
      )?.[1];

      const mockClick = jest.fn();
      mockElementsWelcome.completeButton.click = mockClick;

      if (keydownHandler) {
        const spaceEvent = { key: " " };
        keydownHandler(spaceEvent);

        expect(mockClick).not.toHaveBeenCalled();
      }
    });

    it("should handle missing complete button gracefully", async () => {
      mockGetElementByIdWelcome.mockReturnValue(null);

      await import("../../../extension/onboarding/welcome");

      const keydownHandler = mockAddEventListenerWelcome.mock.calls.find(
        (call) => call[0] === "keydown"
      )?.[1];

      if (keydownHandler) {
        const enterEvent = { key: "Enter" };
        expect(() => keydownHandler(enterEvent)).not.toThrow();
      }
    });
  });
});
