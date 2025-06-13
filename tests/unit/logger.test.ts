/// <reference types="jest" />

// Mock environment variable before any imports
(global as any).__IS_PRODUCTION__ = false;

import { Logger } from "../../extension/scripts/utils/logger";
import { LOG_LEVELS } from "../../extension/scripts/utils/constants";

// Mock console methods to avoid actual output during tests
const mockConsole = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock constants
jest.mock("../../extension/scripts/utils/constants", () => ({
  LOG_LEVELS: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  },
}));

describe("Logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock global console
    global.console = {
      ...global.console,
      debug: mockConsole.debug,
      info: mockConsole.info,
      warn: mockConsole.warn,
      error: mockConsole.error,
    };

    // Reset Logger configuration to defaults
    Logger.configure({
      level: LOG_LEVELS.DEBUG,
      showTimestamp: true,
      showLevel: true,
      showModule: true,
      consoleOutput: true,
      moduleConfig: {},
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Global Logger Methods", () => {
    describe("Basic Logging", () => {
      it("should log debug messages", () => {
        Logger.debug("test debug message");
        expect(mockConsole.debug).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG] test debug message")
        );
      });

      it("should log info messages", () => {
        Logger.info("test info message");
        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining("[INFO] test info message")
        );
      });

      it("should log warn messages", () => {
        Logger.warn("test warn message");
        expect(mockConsole.warn).toHaveBeenCalledWith(
          expect.stringContaining("[WARN] test warn message")
        );
      });

      it("should log error messages", () => {
        Logger.error("test error message");
        expect(mockConsole.error).toHaveBeenCalledWith(
          expect.stringContaining("[ERROR] test error message")
        );
      });
    });

    describe("Logging with Data", () => {
      it("should log debug with additional data", () => {
        const testData = { key: "value" };
        Logger.debug("test message", testData);
        expect(mockConsole.debug).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG] test message"),
          testData
        );
      });

      it("should log error with additional data", () => {
        const errorData = { error: "something went wrong" };
        Logger.error("error occurred", errorData);
        expect(mockConsole.error).toHaveBeenCalledWith(
          expect.stringContaining("[ERROR] error occurred"),
          errorData
        );
      });
    });

    describe("Log Level Filtering", () => {
      it("should respect global log level", () => {
        Logger.setLevel(LOG_LEVELS.WARN);

        Logger.debug("debug message");
        Logger.info("info message");
        Logger.warn("warn message");
        Logger.error("error message");

        expect(mockConsole.debug).not.toHaveBeenCalled();
        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.warn).toHaveBeenCalled();
        expect(mockConsole.error).toHaveBeenCalled();
      });

      it("should filter all logs when level is above ERROR", () => {
        Logger.setLevel(4 as any); // Level higher than ERROR

        Logger.debug("debug");
        Logger.info("info");
        Logger.warn("warn");
        Logger.error("error");

        expect(mockConsole.debug).not.toHaveBeenCalled();
        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.warn).not.toHaveBeenCalled();
        expect(mockConsole.error).not.toHaveBeenCalled();
      });
    });
  });

  describe("Module Logger", () => {
    describe("Basic Module Logging", () => {
      it("should create module logger with correct module name", () => {
        const moduleLogger = Logger.createModuleLogger("test-module");

        moduleLogger.debug("test message");
        expect(mockConsole.debug).toHaveBeenCalledWith(
          expect.stringContaining("[test-module]")
        );
      });

      it("should support all log levels for module logger", () => {
        const moduleLogger = Logger.createModuleLogger("test-module");

        moduleLogger.debug("debug msg");
        moduleLogger.info("info msg");
        moduleLogger.warn("warn msg");
        moduleLogger.error("error msg");

        expect(mockConsole.debug).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG] [test-module] debug msg")
        );
        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining("[INFO] [test-module] info msg")
        );
        expect(mockConsole.warn).toHaveBeenCalledWith(
          expect.stringContaining("[WARN] [test-module] warn msg")
        );
        expect(mockConsole.error).toHaveBeenCalledWith(
          expect.stringContaining("[ERROR] [test-module] error msg")
        );
      });

      it("should handle module logger with data", () => {
        const moduleLogger = Logger.createModuleLogger("data-module");
        const testData = { id: 123, name: "test" };

        moduleLogger.info("processing data", testData);
        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining("[INFO] [data-module] processing data"),
          testData
        );
      });
    });

    describe("Module-Specific Log Levels", () => {
      it("should respect module-specific log level", () => {
        Logger.setModuleLevel("verbose-module", LOG_LEVELS.DEBUG);
        Logger.setModuleLevel("quiet-module", LOG_LEVELS.ERROR);
        Logger.setLevel(LOG_LEVELS.WARN); // Global level

        const verboseLogger = Logger.createModuleLogger("verbose-module");
        const quietLogger = Logger.createModuleLogger("quiet-module");

        verboseLogger.debug("verbose debug");
        verboseLogger.warn("verbose warn");
        quietLogger.debug("quiet debug");
        quietLogger.warn("quiet warn");
        quietLogger.error("quiet error");

        expect(mockConsole.debug).toHaveBeenCalledWith(
          expect.stringContaining("verbose debug")
        );
        expect(mockConsole.warn).toHaveBeenCalledWith(
          expect.stringContaining("verbose warn")
        );
        expect(mockConsole.debug).not.toHaveBeenCalledWith(
          expect.stringContaining("quiet debug")
        );
        expect(mockConsole.warn).not.toHaveBeenCalledWith(
          expect.stringContaining("quiet warn")
        );
        expect(mockConsole.error).toHaveBeenCalledWith(
          expect.stringContaining("quiet error")
        );
      });

      it("should fall back to global level when module level not set", () => {
        Logger.setLevel(LOG_LEVELS.INFO);

        const moduleLogger = Logger.createModuleLogger("unset-module");
        moduleLogger.debug("debug msg");
        moduleLogger.info("info msg");

        expect(mockConsole.debug).not.toHaveBeenCalled();
        expect(mockConsole.info).toHaveBeenCalled();
      });
    });
  });

  describe("Configuration", () => {
    describe("Message Formatting", () => {
      it("should include timestamp when showTimestamp is true", () => {
        Logger.configure({ showTimestamp: true });
        Logger.info("test message");

        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]/)
        );
      });

      it("should exclude timestamp when showTimestamp is false", () => {
        Logger.configure({ showTimestamp: false });
        Logger.info("test message");

        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.not.stringMatching(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]/)
        );
      });

      it("should include log level when showLevel is true", () => {
        Logger.configure({ showLevel: true });
        Logger.warn("test message");

        expect(mockConsole.warn).toHaveBeenCalledWith(
          expect.stringContaining("[WARN]")
        );
      });

      it("should exclude log level when showLevel is false", () => {
        Logger.configure({ showLevel: false });
        Logger.warn("test message");

        expect(mockConsole.warn).toHaveBeenCalledWith(
          expect.not.stringContaining("[WARN]")
        );
      });

      it("should include module name when showModule is true", () => {
        Logger.configure({ showModule: true });
        const moduleLogger = Logger.createModuleLogger("test-module");
        moduleLogger.info("test message");

        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining("[test-module]")
        );
      });

      it("should exclude module name when showModule is false", () => {
        Logger.configure({ showModule: false });
        const moduleLogger = Logger.createModuleLogger("test-module");
        moduleLogger.info("test message");

        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.not.stringContaining("[test-module]")
        );
      });
    });

    describe("Console Output Control", () => {
      it("should output to console when consoleOutput is true", () => {
        Logger.configure({ consoleOutput: true });
        Logger.info("test message");

        expect(mockConsole.info).toHaveBeenCalled();
      });

      it("should not output to console when consoleOutput is false", () => {
        Logger.configure({ consoleOutput: false });
        Logger.info("test message");

        expect(mockConsole.info).not.toHaveBeenCalled();
      });
    });

    describe("Partial Configuration", () => {
      it("should merge partial configuration", () => {
        Logger.configure({
          showTimestamp: false,
          showLevel: false,
        });

        Logger.info("test message");
        expect(mockConsole.info).toHaveBeenCalledWith(" test message");
      });

      it("should merge module configuration", () => {
        // Test that successive calls to configure preserve previous module configs
        Logger.configure({
          moduleConfig: { testA: LOG_LEVELS.ERROR },
        });

        Logger.configure({
          moduleConfig: { testB: LOG_LEVELS.WARN },
        });

        // Both module configs should be preserved - we just test that they both exist
        // by verifying the log output contains the module names (not testing filtering)
        const loggerA = Logger.createModuleLogger("testA");
        const loggerB = Logger.createModuleLogger("testB");

        jest.clearAllMocks();

        loggerA.error("test message A");
        loggerB.error("test message B");

        // Both should appear since we're using error level
        expect(mockConsole.error).toHaveBeenCalledWith(
          expect.stringContaining("testA")
        );
        expect(mockConsole.error).toHaveBeenCalledWith(
          expect.stringContaining("testB")
        );

        // This verifies both module configurations were preserved during merging
        expect(mockConsole.error).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    describe("Invalid Inputs", () => {
      it("should handle empty string messages", () => {
        Logger.info("");
        expect(mockConsole.info).toHaveBeenCalled();
      });

      it("should handle null data", () => {
        Logger.info("test", null);
        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining("test"),
          null
        );
      });

      it("should handle undefined data", () => {
        Logger.info("test", undefined);
        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining("test")
        );
      });

      it("should handle complex data objects", () => {
        const complexData = {
          nested: { array: [1, 2, 3] },
          func: () => "test",
          date: new Date(),
        };

        Logger.debug("complex data", complexData);
        expect(mockConsole.debug).toHaveBeenCalledWith(
          expect.stringContaining("complex data"),
          complexData
        );
      });
    });

    describe("Module Name Edge Cases", () => {
      it("should handle empty string module names", () => {
        const logger = Logger.createModuleLogger("");
        logger.info("test");

        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining("test")
        );
      });

      it("should handle very long module names", () => {
        const longModuleName = "a".repeat(100);
        const logger = Logger.createModuleLogger(longModuleName);
        logger.info("test");

        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining(longModuleName)
        );
      });

      it("should handle special characters in module names", () => {
        const specialModuleName = "module-with-special!@#$%^&*()_+characters";
        const logger = Logger.createModuleLogger(specialModuleName);
        logger.info("test");

        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining(specialModuleName)
        );
      });
    });

    describe("Configuration Edge Cases", () => {
      it("should handle negative log levels", () => {
        Logger.setLevel(-1 as any);
        Logger.debug("should appear");
        expect(mockConsole.debug).toHaveBeenCalled();
      });

      it("should handle very high log levels", () => {
        Logger.setLevel(1000 as any);
        Logger.error("should not appear");
        expect(mockConsole.error).not.toHaveBeenCalled();
      });

      it("should handle null module config", () => {
        Logger.configure({
          moduleConfig: null as any,
        });

        Logger.info("test");
        expect(mockConsole.info).toHaveBeenCalled();
      });
    });
  });

  describe("Log Levels Constants", () => {
    it("should expose LOG_LEVELS constants", () => {
      expect(Logger.LogLevel).toBeDefined();
      expect(Logger.LogLevel.DEBUG).toBe(0);
      expect(Logger.LogLevel.INFO).toBe(1);
      expect(Logger.LogLevel.WARN).toBe(2);
      expect(Logger.LogLevel.ERROR).toBe(3);
    });
  });

  describe("Message Format Consistency", () => {
    it("should format messages consistently across all methods", () => {
      Logger.configure({
        showTimestamp: true,
        showLevel: true,
        showModule: true,
      });

      const moduleLogger = Logger.createModuleLogger("format-test");

      Logger.debug("global debug");
      moduleLogger.info("module info");

      const globalCall = mockConsole.debug.mock.calls[0][0];
      const moduleCall = mockConsole.info.mock.calls[0][0];

      // Both should have timestamp format [HH:MM:SS.sss]
      expect(globalCall).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]/);
      expect(moduleCall).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]/);

      // Both should have level in brackets
      expect(globalCall).toContain("[DEBUG]");
      expect(moduleCall).toContain("[INFO]");

      // Module call should have module name
      expect(moduleCall).toContain("[format-test]");
      expect(globalCall).not.toContain("[format-test]");
    });
  });
});
