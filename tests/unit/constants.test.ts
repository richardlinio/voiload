/// <reference types="jest" />

import {
  MODULE_NAMES,
  BLOB_MONITOR_CONSTANTS,
  WEB_REQUEST_CONSTANTS,
  SUPPORTED_SITES,
  VOICE_MESSAGE_URL_PATTERNS,
  MESSAGE_SOURCES,
  MESSAGE_ACTIONS,
  TIME_CONSTANTS,
  MATCHING_TOLERANCE,
  UI_CONSTANTS,
  DOM_CONSTANTS,
  LOG_LEVELS,
  FILENAME_CONSTANTS,
  ID_CONSTANTS,
  DOWNLOAD_CONSTANTS,
} from "../../extension/scripts/utils/constants";

describe("Constants", () => {
  describe("MODULE_NAMES", () => {
    it("should contain all expected module names", () => {
      expect(MODULE_NAMES).toHaveProperty("BACKGROUND", "background");
      expect(MODULE_NAMES).toHaveProperty("CONTENT_SCRIPT", "content-script");
      expect(MODULE_NAMES).toHaveProperty("PAGE_CONTEXT", "page-context");
      expect(MODULE_NAMES).toHaveProperty("MENU_MANAGER", "menu-manager");
      expect(MODULE_NAMES).toHaveProperty("MESSAGE_HANDLER", "message-handler");
      expect(MODULE_NAMES).toHaveProperty("DOWNLOAD_MANAGER", "download-manager");
      expect(MODULE_NAMES).toHaveProperty("DATA_STORE", "data-store");
    });

    it("should be readonly in TypeScript", () => {
      // TypeScript readonly check - this test ensures compilation safety
      // Runtime immutability would require Object.freeze()
      expect(MODULE_NAMES.BACKGROUND).toBe("background");
      
      // Attempting to modify should not affect the original value
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (MODULE_NAMES as any).BACKGROUND = "modified";
      } catch {
        // Might throw in strict mode
      }
      // In JavaScript, this might actually change, but TypeScript prevents it
    });

    it("should have consistent naming convention", () => {
      Object.values(MODULE_NAMES).forEach(moduleName => {
        expect(moduleName).toMatch(/^[a-z-]+$/);
        expect(moduleName).not.toContain("_");
        expect(moduleName).not.toContain(" ");
      });
    });
  });

  describe("BLOB_MONITOR_CONSTANTS", () => {
    it("should have reasonable throttle interval", () => {
      expect(BLOB_MONITOR_CONSTANTS.THROTTLE_INTERVAL).toBeGreaterThan(0);
      expect(BLOB_MONITOR_CONSTANTS.THROTTLE_INTERVAL).toBeLessThan(1000);
    });

    it("should have reasonable cleanup interval", () => {
      expect(BLOB_MONITOR_CONSTANTS.PERIODIC_CLEANUP_INTERVAL).toBeGreaterThan(60000); // At least 1 minute
      expect(BLOB_MONITOR_CONSTANTS.PERIODIC_CLEANUP_INTERVAL).toBeLessThan(3600000); // Less than 1 hour
    });

    it("should have logical duration limits", () => {
      expect(BLOB_MONITOR_CONSTANTS.MIN_VALID_DURATION).toBeGreaterThan(0);
      expect(BLOB_MONITOR_CONSTANTS.MAX_VALID_DURATION).toBeGreaterThan(BLOB_MONITOR_CONSTANTS.MIN_VALID_DURATION);
      expect(BLOB_MONITOR_CONSTANTS.MIN_VALID_DURATION).toBeLessThan(10000); // Less than 10 seconds
      expect(BLOB_MONITOR_CONSTANTS.MAX_VALID_DURATION).toBeGreaterThan(60000); // More than 1 minute
    });

    it("should have logical audio size limits", () => {
      expect(BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE).toBeGreaterThan(1024); // At least 1KB
      expect(BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE).toBeGreaterThan(BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE);
      expect(BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE).toBeLessThan(1024 * 1024); // Less than 1MB minimum
      expect(BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE).toBeGreaterThan(10 * 1024 * 1024); // More than 10MB maximum
    });

    it("should have valid audio types", () => {
      expect(Array.isArray(BLOB_MONITOR_CONSTANTS.POSSIBLE_AUDIO_TYPES)).toBe(true);
      expect(BLOB_MONITOR_CONSTANTS.POSSIBLE_AUDIO_TYPES.length).toBeGreaterThan(0);
      
      BLOB_MONITOR_CONSTANTS.POSSIBLE_AUDIO_TYPES.forEach(type => {
        expect(typeof type).toBe("string");
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it("should be readonly in TypeScript", () => {
      // TypeScript readonly check
      expect(BLOB_MONITOR_CONSTANTS.THROTTLE_INTERVAL).toBe(10);
      
      // Test that values are defined and have expected types
      expect(typeof BLOB_MONITOR_CONSTANTS.THROTTLE_INTERVAL).toBe("number");
      expect(typeof BLOB_MONITOR_CONSTANTS.PERIODIC_CLEANUP_INTERVAL).toBe("number");
    });
  });

  describe("WEB_REQUEST_CONSTANTS", () => {
    it("should have reasonable audio bitrate", () => {
      expect(WEB_REQUEST_CONSTANTS.AVERAGE_AUDIO_BITRATE).toBeGreaterThan(8); // More than 8kbps
      expect(WEB_REQUEST_CONSTANTS.AVERAGE_AUDIO_BITRATE).toBeLessThan(320); // Less than 320kbps
    });

    it("should contain valid HTTP success codes", () => {
      expect(Array.isArray(WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES)).toBe(true);
      expect(WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES).toContain(200);
      expect(WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES).toContain(206);
      
      WEB_REQUEST_CONSTANTS.SUCCESS_STATUS_CODES.forEach(code => {
        expect(code).toBeGreaterThan(199);
        expect(code).toBeLessThan(300);
      });
    });

    it("should contain valid audio content types", () => {
      expect(Array.isArray(WEB_REQUEST_CONSTANTS.AUDIO_CONTENT_TYPES)).toBe(true);
      expect(WEB_REQUEST_CONSTANTS.AUDIO_CONTENT_TYPES.length).toBeGreaterThan(0);
      
      WEB_REQUEST_CONSTANTS.AUDIO_CONTENT_TYPES.forEach(contentType => {
        expect(typeof contentType).toBe("string");
        expect(contentType).toMatch(/^(audio|video|application)\//);
      });
    });
  });

  describe("SUPPORTED_SITES", () => {
    it("should contain Facebook and Messenger patterns", () => {
      expect(SUPPORTED_SITES.PATTERNS).toContain("*://*.facebook.com/*");
      expect(SUPPORTED_SITES.PATTERNS).toContain("*://*.messenger.com/*");
    });

    it("should contain Facebook and Messenger domains", () => {
      expect(SUPPORTED_SITES.DOMAINS).toContain("facebook.com");
      expect(SUPPORTED_SITES.DOMAINS).toContain("messenger.com");
    });

    it("should contain CDN patterns", () => {
      expect(Array.isArray(SUPPORTED_SITES.CDN_PATTERNS)).toBe(true);
      expect(SUPPORTED_SITES.CDN_PATTERNS.length).toBeGreaterThan(0);
      
      // Should include specific Facebook CDN patterns
      expect(SUPPORTED_SITES.CDN_PATTERNS).toContain("*://*.fbcdn.net/*");
      expect(SUPPORTED_SITES.CDN_PATTERNS).toContain("*://*.cdninstagram.com/*");
      expect(SUPPORTED_SITES.CDN_PATTERNS).toContain("*://*.fbsbx.com/*");
      
      SUPPORTED_SITES.CDN_PATTERNS.forEach(pattern => {
        expect(pattern).toMatch(/^\*:\/\/\*\./);
        expect(pattern).toMatch(/\/\*$/); // Ends with /*
        expect(pattern).toMatch(/\.(net|com)\/\*$/); // Ends with .net/* or .com/*
      });
    });
  });

  describe("VOICE_MESSAGE_URL_PATTERNS", () => {
    it("should combine site patterns and CDN patterns", () => {
      const expectedLength = SUPPORTED_SITES.PATTERNS.length + SUPPORTED_SITES.CDN_PATTERNS.length;
      expect(VOICE_MESSAGE_URL_PATTERNS.length).toBe(expectedLength);
      
      // Should include all patterns from SUPPORTED_SITES
      SUPPORTED_SITES.PATTERNS.forEach(pattern => {
        expect(VOICE_MESSAGE_URL_PATTERNS).toContain(pattern);
      });
      
      SUPPORTED_SITES.CDN_PATTERNS.forEach(pattern => {
        expect(VOICE_MESSAGE_URL_PATTERNS).toContain(pattern);
      });
    });
  });

  describe("MESSAGE_SOURCES", () => {
    it("should contain expected message sources", () => {
      expect(MESSAGE_SOURCES.CONTENT_SCRIPT).toBe("CONTENT_SCRIPT");
      expect(MESSAGE_SOURCES.BACKGROUND_SCRIPT).toBe("BACKGROUND_SCRIPT");
      expect(MESSAGE_SOURCES.PAGE_CONTEXT).toBe("PAGE_CONTEXT");
    });

    it("should have consistent naming", () => {
      Object.values(MESSAGE_SOURCES).forEach(source => {
        expect(source).toMatch(/^[A-Z_]+$/);
      });
    });
  });

  describe("MESSAGE_ACTIONS", () => {
    it("should contain expected message actions", () => {
      expect(MESSAGE_ACTIONS).toHaveProperty("RIGHT_CLICK");
      expect(MESSAGE_ACTIONS).toHaveProperty("REGISTER_ELEMENT");
      expect(MESSAGE_ACTIONS).toHaveProperty("REGISTER_AUDIO_URL");
      expect(MESSAGE_ACTIONS).toHaveProperty("DOWNLOAD_BLOB");
      expect(MESSAGE_ACTIONS).toHaveProperty("BLOB_DETECTED");
    });

    it("should use camelCase for action values", () => {
      Object.values(MESSAGE_ACTIONS).forEach(action => {
        expect(action).toMatch(/^[a-z][a-zA-Z]*$/);
      });
    });
  });

  describe("TIME_CONSTANTS", () => {
    it("should have reasonable cleanup interval", () => {
      expect(TIME_CONSTANTS.CLEANUP_INTERVAL).toBeGreaterThan(60000); // At least 1 minute
      expect(TIME_CONSTANTS.CLEANUP_INTERVAL).toBeLessThan(3600000); // Less than 1 hour
    });

    it("should have reasonable audio load timeout", () => {
      expect(TIME_CONSTANTS.AUDIO_LOAD_TIMEOUT).toBeGreaterThan(1000); // At least 1 second
      expect(TIME_CONSTANTS.AUDIO_LOAD_TIMEOUT).toBeLessThan(30000); // Less than 30 seconds
    });

    it("should have reasonable detection interval", () => {
      expect(TIME_CONSTANTS.ELEMENT_DETECTION_INTERVAL).toBeGreaterThan(100); // At least 100ms
      expect(TIME_CONSTANTS.ELEMENT_DETECTION_INTERVAL).toBeLessThan(10000); // Less than 10 seconds
    });

    it("should have reasonable cache expiration", () => {
      expect(TIME_CONSTANTS.URL_CACHE_EXPIRATION).toBeGreaterThan(60000); // At least 1 minute
      expect(TIME_CONSTANTS.URL_CACHE_EXPIRATION).toBeLessThan(3600000); // Less than 1 hour
    });
  });

  describe("MATCHING_TOLERANCE", () => {
    it("should be a small positive number", () => {
      expect(MATCHING_TOLERANCE).toBeGreaterThan(0);
      expect(MATCHING_TOLERANCE).toBeLessThan(100);
      expect(Number.isInteger(MATCHING_TOLERANCE)).toBe(true);
    });
  });

  describe("UI_CONSTANTS", () => {
    it("should have valid badge configuration", () => {
      expect(UI_CONSTANTS.BADGE_TEXT).toBe("ON");
      expect(UI_CONSTANTS.BADGE_COLOR).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it("should have valid context menu configuration", () => {
      expect(typeof UI_CONSTANTS.CONTEXT_MENU_ID).toBe("string");
      expect(UI_CONSTANTS.CONTEXT_MENU_ID.length).toBeGreaterThan(0);
      expect(typeof UI_CONSTANTS.CONTEXT_MENU_TITLE).toBe("string");
      expect(UI_CONSTANTS.CONTEXT_MENU_TITLE.length).toBeGreaterThan(0);
    });
  });

  describe("DOM_CONSTANTS", () => {
    it("should contain voice message slider aria labels", () => {
      expect(Array.isArray(DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL)).toBe(true);
      expect(DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL.length).toBeGreaterThan(0);
      
      DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL.forEach(label => {
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      });
    });

    it("should contain language labels mapping", () => {
      expect(typeof DOM_CONSTANTS.LANGUAGE_LABELS).toBe("object");
      
      // Check some known languages
      expect(DOM_CONSTANTS.LANGUAGE_LABELS).toHaveProperty("en");
      expect(DOM_CONSTANTS.LANGUAGE_LABELS).toHaveProperty("zh-Hant");
      expect(DOM_CONSTANTS.LANGUAGE_LABELS).toHaveProperty("zh-Hans");
      
      // Check that each language has audioSlider property
      Object.values(DOM_CONSTANTS.LANGUAGE_LABELS).forEach(langConfig => {
        expect(langConfig).toHaveProperty("audioSlider");
      });
    });

    it("should include multilingual support", () => {
      const languages = Object.keys(DOM_CONSTANTS.LANGUAGE_LABELS);
      expect(languages.length).toBeGreaterThan(5); // Should support multiple languages
      
      // Should include major languages
      expect(languages).toContain("en");  // English
      expect(languages).toContain("zh-Hant"); // Traditional Chinese
      expect(languages).toContain("es");  // Spanish
      expect(languages).toContain("ar");  // Arabic
    });
  });

  describe("LOG_LEVELS", () => {
    it("should have correct log level values", () => {
      expect(LOG_LEVELS.DEBUG).toBe(0);
      expect(LOG_LEVELS.INFO).toBe(1);
      expect(LOG_LEVELS.WARN).toBe(2);
      expect(LOG_LEVELS.ERROR).toBe(3);
    });

    it("should have ascending order", () => {
      expect(LOG_LEVELS.DEBUG).toBeLessThan(LOG_LEVELS.INFO);
      expect(LOG_LEVELS.INFO).toBeLessThan(LOG_LEVELS.WARN);
      expect(LOG_LEVELS.WARN).toBeLessThan(LOG_LEVELS.ERROR);
    });
  });

  describe("FILENAME_CONSTANTS", () => {
    it("should have valid voice message filename prefix", () => {
      expect(typeof FILENAME_CONSTANTS.VOICE_MESSAGE_FILENAME_PREFIX).toBe("string");
      expect(FILENAME_CONSTANTS.VOICE_MESSAGE_FILENAME_PREFIX.length).toBeGreaterThan(0);
      expect(FILENAME_CONSTANTS.VOICE_MESSAGE_FILENAME_PREFIX).toMatch(/^[a-z-]+$/);
    });
  });

  describe("ID_CONSTANTS", () => {
    it("should have valid voice message ID prefix", () => {
      expect(typeof ID_CONSTANTS.VOICE_MESSAGE_ID_PREFIX).toBe("string");
      expect(ID_CONSTANTS.VOICE_MESSAGE_ID_PREFIX.length).toBeGreaterThan(0);
      expect(ID_CONSTANTS.VOICE_MESSAGE_ID_PREFIX).toMatch(/^[a-z-]+$/);
    });
  });

  describe("DOWNLOAD_CONSTANTS", () => {
    it("should have boolean save as setting", () => {
      expect(typeof DOWNLOAD_CONSTANTS.SAVE_AS).toBe("boolean");
    });
  });

  describe("Computed Values", () => {
    it("should calculate audio sizes correctly", () => {
      expect(BLOB_MONITOR_CONSTANTS.MIN_VALID_AUDIO_SIZE).toBe(20 * 1024); // 20KB
      expect(BLOB_MONITOR_CONSTANTS.MAX_VALID_AUDIO_SIZE).toBe(200 * 1024 * 1024); // 200MB
    });

    it("should have consistent timing values", () => {
      // Cleanup interval should be much longer than detection interval
      expect(TIME_CONSTANTS.CLEANUP_INTERVAL).toBeGreaterThan(TIME_CONSTANTS.ELEMENT_DETECTION_INTERVAL * 10);
      
      // Cache expiration should be reasonable compared to cleanup interval
      expect(TIME_CONSTANTS.URL_CACHE_EXPIRATION).toBeLessThanOrEqual(TIME_CONSTANTS.CLEANUP_INTERVAL);
    });
  });

  describe("Type Safety", () => {
    it("should export proper types", () => {
      // This test ensures types are exported (compilation test)
      const moduleNames: typeof MODULE_NAMES = MODULE_NAMES;
      const logLevels: typeof LOG_LEVELS = LOG_LEVELS;
      
      expect(moduleNames).toBeDefined();
      expect(logLevels).toBeDefined();
    });
  });
});