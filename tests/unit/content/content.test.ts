/**
 * working-content.test.ts
 * Working unit tests for content module functionality
 */

// Mock all dependencies before any imports
jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    CONTENT_MESSAGE_HANDLER: "content-message-handler",
    CONTEXT_MENU: "context-menu",
    CONTENT_SCRIPT: "content-script",
    AUDIO_ANALYZER: "audio-analyzer",
  },
  DOM_CONSTANTS: {
    VOICE_MESSAGE_SLIDER_ARIA_LABEL: [
      "Voice message",
      "Audio message",
      "Voice recording",
    ],
  },
  MESSAGE_SOURCES: {
    PAGE_CONTEXT: "PAGE_CONTEXT",
    BACKGROUND_SCRIPT: "BACKGROUND_SCRIPT",
  },
  MESSAGE_ACTIONS: {
    RIGHT_CLICK: "RIGHT_CLICK",
    REGISTER_BLOB_URL: "REGISTER_BLOB_URL",
    BLOB_DETECTED: "BLOB_DETECTED",
    GET_AUDIO_DURATION: "GET_AUDIO_DURATION",
    REGISTER_AUDIO_URL: "REGISTER_AUDIO_URL",
  },
  SUPPORTED_SITES: {
    DOMAINS: ["facebook.com", "messenger.com"],
    PATTERNS: ["https://*.facebook.com/*", "https://*.messenger.com/*"],
  },
}));

jest.mock("../../../extension/scripts/utils/time-utils", () => ({
  secondsToMilliseconds: jest.fn((seconds) => seconds * 1000),
  domDurationToMilliseconds: jest.fn((value) =>
    value > 1200 ? Math.round(value) : Math.round(value * 1000)
  ),
}));

jest.mock("../../../extension/scripts/page-context/audio-analyzer", () => ({
  handleGetAudioDurationRequest: jest.fn(),
}));

jest.mock("../../../extension/scripts/page-context/blob-monitor", () => ({
  handleExtractBlobRequest: jest.fn(),
}));

// Mock DOM environment
(global as any).Node = {
  ELEMENT_NODE: 1,
};

describe("Content Module Functionality", () => {
  describe("DOM Utils", () => {
    let domUtils: any;

    beforeEach(() => {
      jest.clearAllMocks();
      domUtils = require("../../../extension/scripts/content/dom-utils");
    });

    it("should correctly identify voice message sliders", () => {
      const mockElement = {
        nodeType: 1,
        getAttribute: jest.fn((attr) => {
          if (attr === "role") {return "slider";}
          if (attr === "aria-label") {return "Voice message";}
          return null;
        }),
      };

      const result = domUtils.isVoiceMessageSlider(mockElement);
      expect(result).toBe(true);
    });

    it("should extract duration from valid sliders", () => {
      const mockElement = {
        nodeType: 1,
        tagName: "DIV",
        getAttribute: jest.fn((attr) => {
          if (attr === "role") {return "slider";}
          if (attr === "aria-label") {return "Voice message";}
          if (attr === "aria-valuemax") {return "15.5";}
          return null;
        }),
      };

      const result = domUtils.getDurationFromSlider(mockElement);
      expect(result).toBe(15.5);
    });

    it("should handle null elements", () => {
      expect(domUtils.isVoiceMessageSlider(null)).toBe(false);
      expect(domUtils.findVoiceMessageElement(null)).toBe(null);
      expect(domUtils.isPotentialVoiceMessageContainer(null)).toBe(false);
    });

    it("should reject non-slider elements", () => {
      const mockElement = {
        nodeType: 1,
        getAttribute: jest.fn((attr) => {
          if (attr === "role") {return "button";}
          if (attr === "aria-label") {return "Voice message";}
          return null;
        }),
      };

      expect(domUtils.isVoiceMessageSlider(mockElement)).toBe(false);
    });

    it("should handle invalid duration values", () => {
      const mockElement = {
        nodeType: 1,
        tagName: "DIV",
        getAttribute: jest.fn((attr) => {
          if (attr === "role") {return "slider";}
          if (attr === "aria-label") {return "Voice message";}
          if (attr === "aria-valuemax") {return "invalid";}
          return null;
        }),
      };

      const result = domUtils.getDurationFromSlider(mockElement);
      expect(result).toBe(null);
    });

    it("should find voice message elements in containers", () => {
      const mockSlider = {
        nodeType: 1,
        tagName: "DIV",
        getAttribute: jest.fn((attr) => {
          if (attr === "role") {return "slider";}
          if (attr === "aria-label") {return "Voice message";}
          return null;
        }),
      };

      const mockContainer = {
        nodeType: 1,
        tagName: "DIV",
        getAttribute: jest.fn(() => null),
        querySelector: jest.fn((selector) => {
          if (selector === '[role="slider"][aria-label="Voice message"]') {
            return mockSlider;
          }
          return null;
        }),
      };

      const result = domUtils.findVoiceMessageElement(mockContainer);
      expect(result).toEqual({ element: mockSlider, type: "slider" });
    });

    it("should detect voice message containers", () => {
      const mockElement = {
        nodeType: 1,
        querySelector: jest.fn((selector) => {
          if (selector === '[role="slider"][aria-label="Voice message"]') {
            return { tagName: "DIV" };
          }
          return null;
        }),
      };

      const result = domUtils.isPotentialVoiceMessageContainer(mockElement);
      expect(result).toBe(true);
    });
  });

  describe("Module Exports", () => {
    it("should export DOM utility functions", () => {
      const domUtils = require("../../../extension/scripts/content/dom-utils");

      expect(typeof domUtils.isVoiceMessageSlider).toBe("function");
      expect(typeof domUtils.getDurationFromSlider).toBe("function");
      expect(typeof domUtils.isPotentialVoiceMessageContainer).toBe("function");
      expect(typeof domUtils.findVoiceMessageElement).toBe("function");
    });

    it("should export context menu handler functions", () => {
      const contextMenuHandler = require("../../../extension/scripts/content/context-menu-handler");
      expect(typeof contextMenuHandler.initContextMenuHandler).toBe("function");
    });

    it("should export message handler functions", () => {
      const messageHandler = require("../../../extension/scripts/content/message-handler");
      expect(typeof messageHandler.initMessageHandler).toBe("function");
    });
  });

  describe("Edge Cases", () => {
    let domUtils: any;

    beforeEach(() => {
      jest.clearAllMocks();
      domUtils = require("../../../extension/scripts/content/dom-utils");
    });

    it("should handle non-element nodes", () => {
      const mockTextNode = {
        nodeType: 3, // TEXT_NODE
      };

      expect(domUtils.isVoiceMessageSlider(mockTextNode)).toBe(false);
      expect(domUtils.isPotentialVoiceMessageContainer(mockTextNode)).toBe(
        false
      );
    });

    it("should handle elements without required attributes", () => {
      const mockElement = {
        nodeType: 1,
        getAttribute: jest.fn(() => null), // No attributes
      };

      expect(domUtils.isVoiceMessageSlider(mockElement)).toBe(false);
    });

    it("should handle elements with empty aria-label", () => {
      const mockElement = {
        nodeType: 1,
        getAttribute: jest.fn((attr) => {
          if (attr === "role") {return "slider";}
          if (attr === "aria-label") {return "";}
          return null;
        }),
      };

      expect(domUtils.isVoiceMessageSlider(mockElement)).toBe(false);
    });

    it("should support all configured aria-labels", () => {
      const supportedLabels = [
        "Voice message",
        "Audio message",
        "Voice recording",
      ];

      supportedLabels.forEach((label) => {
        const mockElement = {
          nodeType: 1,
          getAttribute: jest.fn((attr) => {
            if (attr === "role") {return "slider";}
            if (attr === "aria-label") {return label;}
            return null;
          }),
        };

        expect(domUtils.isVoiceMessageSlider(mockElement)).toBe(true);
      });
    });
  });

  describe("Duration Processing", () => {
    let domUtils: any;

    beforeEach(() => {
      jest.clearAllMocks();
      domUtils = require("../../../extension/scripts/content/dom-utils");
    });

    it("should parse integer durations", () => {
      const mockElement = {
        nodeType: 1,
        tagName: "DIV",
        getAttribute: jest.fn((attr) => {
          if (attr === "role") {return "slider";}
          if (attr === "aria-label") {return "Voice message";}
          if (attr === "aria-valuemax") {return "45";}
          return null;
        }),
      };

      expect(domUtils.getDurationFromSlider(mockElement)).toBe(45);
    });

    it("should parse float durations", () => {
      const mockElement = {
        nodeType: 1,
        tagName: "DIV",
        getAttribute: jest.fn((attr) => {
          if (attr === "role") {return "slider";}
          if (attr === "aria-label") {return "Voice message";}
          if (attr === "aria-valuemax") {return "12.75";}
          return null;
        }),
      };

      expect(domUtils.getDurationFromSlider(mockElement)).toBe(12.75);
    });

    it("should handle zero duration", () => {
      const mockElement = {
        nodeType: 1,
        tagName: "DIV",
        getAttribute: jest.fn((attr) => {
          if (attr === "role") {return "slider";}
          if (attr === "aria-label") {return "Voice message";}
          if (attr === "aria-valuemax") {return "0";}
          return null;
        }),
      };

      expect(domUtils.getDurationFromSlider(mockElement)).toBe(0);
    });
  });
});
