/**
 * menu-manager.test.ts
 * Unit tests for menu-manager module
 */

// Mock the chrome API before importing
const menuManagerMockChrome: any = {
  contextMenus: {
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    lastError: null,
  },
};

// Mock modules
jest.mock("../../../extension/scripts/utils/constants", () => ({
  UI_CONSTANTS: {
    CONTEXT_MENU_ID: "downloadVoiceMessage",
    CONTEXT_MENU_TITLE: "Download Voice Message",
  },
}));

jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => ({
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

// Set up global chrome mock
(global as any).chrome = menuManagerMockChrome;

describe("MenuManager", () => {
  let initMenuManager: any;
  let mockLogger: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset chrome API mocks
    menuManagerMockChrome.runtime.lastError = null;
    menuManagerMockChrome.contextMenus.create.mockClear();
    menuManagerMockChrome.contextMenus.onClicked.addListener.mockClear();

    // Create fresh mock logger for each test
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    // Mock Logger.createModuleLogger to return our mock
    const { Logger } = require("../../../extension/scripts/utils/logger");
    Logger.createModuleLogger.mockReturnValue(mockLogger);

    // Import after mocks are set up
    const menuManager = require("../../../extension/scripts/background/menu-manager");
    initMenuManager = menuManager.initMenuManager;
  });

  describe("initMenuManager", () => {
    it("should correctly initialize the menu manager and log the initialization message", () => {
      initMenuManager();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Initializing context menu manager"
      );
    });

    it("should correctly create the context menu", () => {
      initMenuManager();

      expect(menuManagerMockChrome.contextMenus.create).toHaveBeenCalledWith(
        {
          id: "downloadVoiceMessage",
          title: "Download Voice Message",
          contexts: ["all"],
          documentUrlPatterns: [
            "*://*.facebook.com/*",
            "*://*.messenger.com/*",
          ],
        },
        expect.any(Function)
      );
    });

    it("should log a success message when the context menu is created successfully", () => {
      initMenuManager();

      // Get the callback passed to create
      const createCallback = menuManagerMockChrome.contextMenus.create.mock.calls[0][1];

      // Simulate success (no error)
      menuManagerMockChrome.runtime.lastError = null;
      createCallback();

      expect(mockLogger.info).toHaveBeenCalledWith(
        "Context menu created successfully"
      );
    });

    it("should log an error message when the context menu creation fails", () => {
      initMenuManager();

      // Get the callback passed to create
      const createCallback = menuManagerMockChrome.contextMenus.create.mock.calls[0][1];

      // Simulate error condition
      const mockError = { message: "Failed to create menu" };
      (menuManagerMockChrome.runtime as any).lastError = mockError;
      createCallback();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to create context menu",
        mockError
      );
    });

    it("should register the context menu click event listener", () => {
      initMenuManager();

      expect(
        menuManagerMockChrome.contextMenus.onClicked.addListener
      ).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("context menu click handling", () => {
    let clickHandler: any;

    beforeEach(() => {
      initMenuManager();

      // Get the registered click handler
      clickHandler =
        menuManagerMockChrome.contextMenus.onClicked.addListener.mock.calls[0][0];
    });

    it("should log basic information about the click event", () => {
      const mockInfo = { menuItemId: "downloadVoiceMessage" };
      const mockTab = {
        url: "https://www.facebook.com/messages/some-long-url-that-should-be-truncated",
      };

      clickHandler(mockInfo, mockTab);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Context menu click event",
        {
          menuItemId: "downloadVoiceMessage",
          pageUrl: "https://www.facebook.com/messages/some-long-url-th...",
        }
      );
    });

    it("should handle the correct menu item ID", () => {
      const mockInfo = { menuItemId: "downloadVoiceMessage", frameId: 0 };
      const mockTab = { url: "https://www.facebook.com/messages" };

      clickHandler(mockInfo, mockTab);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Calling handleMenuClick function"
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Context menu click details",
        {
          menuItemId: "downloadVoiceMessage",
          frameId: 0,
          pageUrl: "https://www.facebook.com/messages...",
        }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Context menu click handling complete"
      );
    });

    it("should ignore incorrect menu item IDs", () => {
      const mockInfo = { menuItemId: "otherMenuItem" };
      const mockTab = { url: "https://www.facebook.com/messages" };

      clickHandler(mockInfo, mockTab);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Not the target menu item",
        {
          menuItemId: "otherMenuItem",
        }
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        "Calling handleMenuClick function"
      );
    });

    it("should correctly handle the case with no tab information", () => {
      const mockInfo = { menuItemId: "downloadVoiceMessage" };
      const mockTab = undefined;

      clickHandler(mockInfo, mockTab);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Context menu click event",
        {
          menuItemId: "downloadVoiceMessage",
          pageUrl: "undefined...",
        }
      );
    });

    it("should correctly handle short URLs", () => {
      const mockInfo = { menuItemId: "downloadVoiceMessage" };
      const mockTab = { url: "https://fb.com" };

      clickHandler(mockInfo, mockTab);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Context menu click event",
        {
          menuItemId: "downloadVoiceMessage",
          pageUrl: "https://fb.com...",
        }
      );
    });
  });
});
