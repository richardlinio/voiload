/// <reference types="jest" />

// Mock environment variable before any imports
(global as any).__IS_PRODUCTION__ = false;

// Mock IntersectionObserver globally
const mockObserve = jest.fn();
const mockUnobserve = jest.fn();
const mockDisconnect = jest.fn();
const mockIntersectionObserver = jest
  .fn()
  .mockImplementation((_callback, _options) => ({
    observe: mockObserve,
    unobserve: mockUnobserve,
    disconnect: mockDisconnect,
  }));

(global as any).IntersectionObserver = mockIntersectionObserver;

// Mock Chrome API (only what's necessary)
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
Object.defineProperty(global, "window", {
  value: {
    ...global.window,
    close: mockWindowCloseWelcome,
  },
  writable: true,
  configurable: true,
});

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

describe("welcome.ts - Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset window.close mock
    mockWindowCloseWelcome.mockClear();

    // Reset IntersectionObserver mocks
    mockObserve.mockClear();
    mockUnobserve.mockClear();
    mockDisconnect.mockClear();
    mockIntersectionObserver.mockClear();

    // Ensure DOM body exists
    if (!document.body) {
      document.body = document.createElement("body");
    }

    // Setup real DOM structure that welcome page expects
    document.body.innerHTML = `
      <div class="container">
        <h1>Welcome</h1>
      </div>
      <footer>
        <button id="complete-onboarding" class="complete-btn">Get Started →</button>
      </footer>
      <div class="step">Step 1</div>
      <div class="feature">Feature 1</div>
    `;

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
    // Clean up DOM safely
    if (document.body) {
      document.body.innerHTML = "";
    }
  });

  describe("Real DOM Integration", () => {
    it("should setup complete button with real event listener", async () => {
      // Import and trigger the welcome script
      await import("../../../extension/onboarding/welcome");

      // Trigger DOMContentLoaded event
      const event = new Event("DOMContentLoaded");
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify the actual DOM button exists
      const completeButton = document.getElementById(
        "complete-onboarding"
      ) as HTMLButtonElement;
      expect(completeButton).toBeTruthy();
      expect(completeButton.textContent).toBe("Get Started →");

      // Test real button click
      const storageSetSpy = jest.spyOn(mockChromeWelcome.storage.local, "set");
      const tabsQuerySpy = jest.spyOn(mockChromeWelcome.tabs, "query");

      // Simulate real user click
      completeButton.click();

      // Wait for async click handler
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify storage was called
      expect(storageSetSpy).toHaveBeenCalledWith({
        onboardingCompleted: true,
        completedAt: expect.any(Number),
      });

      // Verify tabs were queried
      expect(tabsQuerySpy).toHaveBeenCalledWith({
        url: ["*://*.messenger.com/*", "*://*.facebook.com/*"],
      });
    });

    it("should create new messenger tab when no existing tabs found", async () => {
      mockChromeWelcome.tabs.query.mockResolvedValue([]);

      // Import and trigger the welcome script
      await import("../../../extension/onboarding/welcome");

      // Trigger DOMContentLoaded event
      const event = new Event("DOMContentLoaded");
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Get the real button and click it
      const completeButton = document.getElementById(
        "complete-onboarding"
      ) as HTMLButtonElement;
      expect(completeButton).toBeTruthy();

      const tabsCreateSpy = jest.spyOn(mockChromeWelcome.tabs, "create");

      // Click the real button
      completeButton.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify new tab was created
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: "https://www.messenger.com",
        active: true,
      });

      // Verify window.close was called
      expect(mockWindowCloseWelcome).toHaveBeenCalled();
    });

    it("should switch to existing messenger tab when found", async () => {
      const mockTab = { id: 123, url: "https://www.messenger.com" };
      mockChromeWelcome.tabs.query.mockResolvedValue([mockTab]);

      // Import and trigger the welcome script
      await import("../../../extension/onboarding/welcome");

      // Trigger DOMContentLoaded event
      const event = new Event("DOMContentLoaded");
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Get and click the real button
      const completeButton = document.getElementById(
        "complete-onboarding"
      ) as HTMLButtonElement;
      const tabsUpdateSpy = jest.spyOn(mockChromeWelcome.tabs, "update");
      const tabsReloadSpy = jest.spyOn(mockChromeWelcome.tabs, "reload");

      completeButton.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify tab was switched and reloaded
      expect(tabsUpdateSpy).toHaveBeenCalledWith(123, { active: true });
      expect(tabsReloadSpy).toHaveBeenCalledWith(123);

      // Verify success message was added to real DOM
      const successMessage = document.querySelector(".success-message");
      expect(successMessage).toBeTruthy();
      expect(successMessage?.innerHTML).toContain("Setup complete!");
    });

    it("should show completed notice when onboarding already completed", async () => {
      mockChromeWelcome.storage.local.get.mockResolvedValue({
        onboardingCompleted: true,
      });

      // Import and trigger the welcome script
      await import("../../../extension/onboarding/welcome");

      // Trigger DOMContentLoaded event
      const event = new Event("DOMContentLoaded");
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify completed notice was added to real DOM
      const completedNotice = document.querySelector(".completed-notice");
      expect(completedNotice).toBeTruthy();
      expect(completedNotice?.innerHTML).toContain("✅");
      expect(completedNotice?.innerHTML).toContain("already completed");
    });

    it("should handle Enter key press to trigger complete button", async () => {
      // Import and trigger the welcome script
      await import("../../../extension/onboarding/welcome");

      // Get the real button
      const completeButton = document.getElementById(
        "complete-onboarding"
      ) as HTMLButtonElement;
      expect(completeButton).toBeTruthy();

      const buttonClickSpy = jest.spyOn(completeButton, "click");

      // Simulate Enter key press
      const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
      document.dispatchEvent(enterEvent);

      // Verify button click was triggered
      expect(buttonClickSpy).toHaveBeenCalled();
    });

    it("should setup intersection observer for animations", async () => {
      // Clear the mock before this specific test
      mockObserve.mockClear();
      mockIntersectionObserver.mockClear();

      // Import and trigger the welcome script
      await import("../../../extension/onboarding/welcome");

      // Trigger DOMContentLoaded event
      const event = new Event("DOMContentLoaded");
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify IntersectionObserver was created with correct options
      expect(mockIntersectionObserver).toHaveBeenCalledWith(
        expect.any(Function),
        {
          threshold: 0.1,
          rootMargin: "0px 0px -50px 0px",
        }
      );

      // Verify animated elements are observed (at least 2 calls expected)
      expect(mockObserve).toHaveBeenCalledWith(expect.any(Element));
      expect(mockObserve.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Error Detection Tests", () => {
    it("should detect if complete button functionality is removed", async () => {
      // Import and trigger the welcome script
      await import("../../../extension/onboarding/welcome");

      // Trigger DOMContentLoaded event
      const event = new Event("DOMContentLoaded");
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Get the button
      const completeButton = document.getElementById(
        "complete-onboarding"
      ) as HTMLButtonElement;
      expect(completeButton).toBeTruthy();

      // Test that clicking actually works
      const storageSetSpy = jest.spyOn(mockChromeWelcome.storage.local, "set");

      // If the functionality was removed, this would not call chrome.storage.local.set
      completeButton.click();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // This test will fail if the button click handler is not properly attached
      expect(storageSetSpy).toHaveBeenCalled();
      expect(storageSetSpy).toHaveBeenCalledWith({
        onboardingCompleted: true,
        completedAt: expect.any(Number),
      });
    });

    it("should handle storage errors gracefully", async () => {
      const error = new Error("Storage error");
      mockChromeWelcome.storage.local.set.mockRejectedValue(error);

      // Import and trigger the welcome script
      await import("../../../extension/onboarding/welcome");

      // Trigger DOMContentLoaded event
      const event = new Event("DOMContentLoaded");
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Get and click the real button
      const completeButton = document.getElementById(
        "complete-onboarding"
      ) as HTMLButtonElement;
      completeButton.click();

      // Wait for async error handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify error message was added to real DOM
      const errorMessage = document.querySelector(".error-message");
      expect(errorMessage).toBeTruthy();
      expect(errorMessage?.innerHTML).toContain("❌");
      expect(errorMessage?.innerHTML).toContain("error occurred");

      // Verify button state was restored
      expect(completeButton.disabled).toBe(false);
      expect(completeButton.textContent).toBe("Get Started →");
    });
  });
});
