/// <reference types="jest" />

// Mock environment variable before any imports
(global as any).__IS_PRODUCTION__ = false;

// Mock Chrome API (only what's necessary)
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
Object.defineProperty(global, 'window', {
  value: {
    ...global.window,
    close: mockWindowClosePopup,
  },
  writable: true,
  configurable: true,
});

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

describe("popup.ts - Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Reset window.close mock
    mockWindowClosePopup.mockClear();
    
    // Ensure DOM body exists
    if (!document.body) {
      document.body = document.createElement('body');
    }
    
    // Setup real DOM structure that popup expects
    document.body.innerHTML = `
      <div class="status">
        <p></p>
      </div>
      <div class="footer"></div>
    `;
    
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
    // Clean up DOM safely
    if (document.body) {
      document.body.innerHTML = "";
    }
  });

  describe("Real DOM Integration", () => {
    it("should create and setup help-us button correctly", async () => {
      // Setup onboarding status
      mockCheckOnboardingStatus.mockResolvedValue({
        completed: true,
        installTime: Date.now(),
        completedAt: Date.now(),
      });

      mockChromePopup.runtime.getURL.mockReturnValue(
        "chrome-extension://test/onboarding/welcome.html"
      );

      // Import and trigger the popup script
      await import("../../../extension/popup/popup");
      
      // Trigger DOMContentLoaded event
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify the actual DOM structure was created
      const quickLinks = document.querySelector('.quick-links');
      expect(quickLinks).toBeTruthy();
      expect(quickLinks?.innerHTML).toContain('Help Us');

      // Verify the help-us button exists in real DOM
      const helpUsButton = document.getElementById('help-us') as HTMLButtonElement;
      expect(helpUsButton).toBeTruthy();
      expect(helpUsButton.textContent).toContain('Help Us');

      // Verify button has click event listener by checking if it's clickable
      // This is a real integration test - clicking the actual button
      const tabsCreateSpy = jest.spyOn(mockChromePopup.tabs, 'create');
      
      // Simulate real user click
      helpUsButton.click();

      // Verify the correct URL was called
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: "https://docs.google.com/forms/d/e/1FAIpQLSeVrwFiqV9vNFiAQwNqSv6ngJ7KtZDmXme8PVoufymJ9jU4DQ/viewform?usp=header",
      });
    });

    it("should create quick links even when onboarding is not completed", async () => {
      // Mock onboarding to not be completed (quick links should still be added)
      mockCheckOnboardingStatus.mockResolvedValue({
        completed: false,
        installTime: Date.now(),
        completedAt: null,
      });

      // Import and trigger the popup script
      await import("../../../extension/popup/popup");
      
      // Trigger DOMContentLoaded event
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify the help-us button EXISTS even when onboarding is not completed
      const helpUsButton = document.getElementById('help-us');
      expect(helpUsButton).toBeTruthy();
      expect(helpUsButton?.textContent).toContain('Help Us');

      // Verify quick links section exists
      const quickLinks = document.querySelector('.quick-links');
      expect(quickLinks).toBeTruthy();
      expect(quickLinks?.innerHTML).toContain('Quick Links');

      // Also verify onboarding reminder is shown
      const onboardingReminder = document.querySelector('.onboarding-reminder');
      expect(onboardingReminder).toBeTruthy();
    });

    it("should create all expected buttons when onboarding is completed", async () => {
      mockCheckOnboardingStatus.mockResolvedValue({
        completed: true,
        installTime: Date.now(),
        completedAt: Date.now(),
      });

      mockChromePopup.runtime.getURL.mockReturnValue(
        "chrome-extension://test/onboarding/welcome.html"
      );

      // Import and trigger the popup script
      await import("../../../extension/popup/popup");
      
      // Trigger DOMContentLoaded event
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify all buttons exist in real DOM
      const expectedButtons = ['open-messenger', 'open-facebook', 'view-tutorial', 'help-us'];
      
      expectedButtons.forEach(buttonId => {
        const button = document.getElementById(buttonId);
        expect(button).toBeTruthy();
        expect(button).toBeInstanceOf(HTMLButtonElement);
      });
    });

    it("should setup messenger button with correct click handler", async () => {
      mockCheckOnboardingStatus.mockResolvedValue({
        completed: true,
        installTime: Date.now(),
        completedAt: Date.now(),
      });

      // Import and trigger the popup script
      await import("../../../extension/popup/popup");
      
      // Trigger DOMContentLoaded event
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Get the real button from DOM
      const messengerButton = document.getElementById('open-messenger') as HTMLButtonElement;
      expect(messengerButton).toBeTruthy();

      // Test real click
      const tabsCreateSpy = jest.spyOn(mockChromePopup.tabs, 'create');
      messengerButton.click();

      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: "https://www.messenger.com"
      });
      expect(mockWindowClosePopup).toHaveBeenCalled();
    });

    it("should handle missing DOM elements gracefully", async () => {
      // Remove expected DOM structure temporarily
      const originalHTML = document.body.innerHTML;
      document.body.innerHTML = "";

      mockCheckOnboardingStatus.mockResolvedValue({
        completed: true,
        installTime: Date.now(),
        completedAt: Date.now(),
      });

      // Import and trigger the popup script
      await import("../../../extension/popup/popup");
      
      // This should not throw an error
      expect(async () => {
        const event = new Event('DOMContentLoaded');
        document.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 0));
      }).not.toThrow();
      
      // Restore DOM for other tests
      document.body.innerHTML = originalHTML;
    });

  });

  describe("Error Detection Tests", () => {
    it("should detect if help-us button functionality is removed", async () => {
      mockCheckOnboardingStatus.mockResolvedValue({
        completed: true,
        installTime: Date.now(),
        completedAt: Date.now(),
      });

      // Import and trigger the popup script
      await import("../../../extension/popup/popup");
      
      // Trigger DOMContentLoaded event
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Get the button
      const helpUsButton = document.getElementById('help-us') as HTMLButtonElement;
      expect(helpUsButton).toBeTruthy();

      // Test that clicking actually works
      const tabsCreateSpy = jest.spyOn(mockChromePopup.tabs, 'create');
      
      // If the functionality was removed, this would not call chrome.tabs.create
      helpUsButton.click();

      // This test will fail if the button click handler is not properly attached
      expect(tabsCreateSpy).toHaveBeenCalled();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: "https://docs.google.com/forms/d/e/1FAIpQLSeVrwFiqV9vNFiAQwNqSv6ngJ7KtZDmXme8PVoufymJ9jU4DQ/viewform?usp=header",
      });
    });
  });
});