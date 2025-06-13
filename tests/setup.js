// Mock Chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  contextMenus: {
    create: jest.fn(),
    update: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
    },
    onHidden: {
      addListener: jest.fn(),
    },
  },
  downloads: {
    download: jest.fn(),
  },
  tabs: {
    sendMessage: jest.fn(),
  },
};

// Mock DOM environment
global.document = {
  addEventListener: jest.fn(),
  querySelectorAll: jest.fn(() => []),
};

// Clear all mock function call records
// Jest globals are automatically available in test environment
