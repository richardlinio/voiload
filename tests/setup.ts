// chrome.storage.session backed by a real object so round-trips work: tests
// simulate a service-worker restart by dropping the module cache while this
// survives, which is exactly the production lifetime of session storage.
const sessionStorageBacking: Record<string, unknown> = {};

const sessionStorageMock = {
  get: jest.fn(async (key?: string | string[] | null) => {
    if (key === undefined || key === null) {
      return { ...sessionStorageBacking };
    }
    const keys = Array.isArray(key) ? key : [key];
    const result: Record<string, unknown> = {};
    for (const k of keys) {
      if (k in sessionStorageBacking) {
        result[k] = sessionStorageBacking[k];
      }
    }
    return result;
  }),
  set: jest.fn(async (items: Record<string, unknown>) => {
    // Session storage is JSON-serialised, so a Map would land as {} in production.
    // Round-tripping through JSON here keeps the mock honest about that.
    Object.assign(sessionStorageBacking, JSON.parse(JSON.stringify(items)));
  }),
  remove: jest.fn(async (key: string | string[]) => {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) {
      delete sessionStorageBacking[k];
    }
  }),
  clear: jest.fn(async () => {
    for (const k of Object.keys(sessionStorageBacking)) {
      delete sessionStorageBacking[k];
    }
  }),
};

// Exposed so tests can wipe session storage between cases
(global as any).__resetSessionStorage = () => {
  for (const k of Object.keys(sessionStorageBacking)) {
    delete sessionStorageBacking[k];
  }
};

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
    session: sessionStorageMock,
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
