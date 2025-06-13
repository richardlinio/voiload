// Mock Chrome API
(global as any).chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    lastError: undefined as any,
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
  } as any,
  downloads: {
    download: jest.fn(),
  } as any,
  tabs: {
    sendMessage: jest.fn(),
    query: jest.fn(),
  } as any,
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
    },
  } as any,
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onHeadersReceived: {
      addListener: jest.fn(),
    },
    onCompleted: {
      addListener: jest.fn(),
    },
  } as any,
};

// Mock DOM environment
(global as any).document = {
  addEventListener: jest.fn(),
  querySelectorAll: jest.fn(() => []),
};

// Type declarations are handled by existing declarations in the project

// Clear all mock function call records
// Jest globals are automatically available in test environment
