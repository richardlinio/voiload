/**
 * logger.ts
 * Provides a unified logging system for the extension
 */

import type { LoggerConfig, ModuleLogger } from "../types/utils";

import { LOG_LEVELS, type LogLevel, type ModuleName } from "./constants";

// Declare build-time injected environment variable
declare const __IS_PRODUCTION__: boolean;

// Set default log level based on environment
const defaultLogLevel = __IS_PRODUCTION__ ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;

// Default configuration
let config: LoggerConfig = {
  // Current log level, auto-adjusted by environment
  level: defaultLogLevel,

  // Whether to show timestamp
  showTimestamp: true,

  // Whether to show log level
  showLevel: true,

  // Whether to show module name
  showModule: true,

  // Whether to output to developer console
  consoleOutput: true,

  // Per-module log level control
  moduleConfig: {
    // Set different log levels for specific modules
    // 'MODULE_NAME': LogLevel.XXX
  },
};

/**
 * Format log message
 */
function formatLogMessage(
  level: string,
  module: string | null,
  message: string
): string {
  const parts: string[] = [];

  // Add timestamp
  if (config.showTimestamp) {
    const now = new Date();
    const timeStr = now.toISOString().slice(11, 23); // Format: HH:MM:SS.sss
    parts.push(`[${timeStr}]`);
  }

  // Add log level
  if (config.showLevel) {
    parts.push(`[${level}]`);
  }

  // Add module name
  if (config.showModule && module) {
    parts.push(`[${module}]`);
  }

  // Combine base message
  const result = parts.join(" ") + " " + message;

  return result;
}

/**
 * Get log level for a module
 */
function getModuleLogLevel(module: string | null): LogLevel {
  if (module && config.moduleConfig[module] !== undefined) {
    return config.moduleConfig[module];
  }
  return config.level;
}

/**
 * Output log
 */
function log(
  level: string,
  levelValue: LogLevel,
  module: string | null,
  message: string,
  data?: any
): void {
  // Check if this log should be recorded
  const moduleLevel = getModuleLogLevel(module);
  if (levelValue < moduleLevel) {
    return;
  }

  // Format log message
  const formattedMessage = formatLogMessage(level, module, message);

  // Output to console
  if (config.consoleOutput) {
    switch (levelValue) {
      case LOG_LEVELS.DEBUG:
        if (data !== undefined) {
          console.debug(formattedMessage, data);
        } else {
          console.debug(formattedMessage);
        }
        break;
      case LOG_LEVELS.INFO:
        if (data !== undefined) {
          console.info(formattedMessage, data);
        } else {
          console.info(formattedMessage);
        }
        break;
      case LOG_LEVELS.WARN:
        if (data !== undefined) {
          console.warn(formattedMessage, data);
        } else {
          console.warn(formattedMessage);
        }
        break;
      case LOG_LEVELS.ERROR:
        if (data !== undefined) {
          console.error(formattedMessage, data);
        } else {
          console.error(formattedMessage);
        }
        break;
    }
  }
}

/**
 * Create a module-specific logger
 */
function createModuleLogger(module: ModuleName | string): ModuleLogger {
  return {
    /**
     * Log debug level message
     */
    debug: (message: string, data?: any) => {
      log("DEBUG", LOG_LEVELS.DEBUG, module, message, data);
    },

    /**
     * Log info level message
     */
    info: (message: string, data?: any) => {
      log("INFO", LOG_LEVELS.INFO, module, message, data);
    },

    /**
     * Log warning level message
     */
    warn: (message: string, data?: any) => {
      log("WARN", LOG_LEVELS.WARN, module, message, data);
    },

    /**
     * Log error level message
     */
    error: (message: string, data?: any) => {
      log("ERROR", LOG_LEVELS.ERROR, module, message, data);
    },
  };
}

/**
 * Configure the logging system
 */
function configure(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };

  // If user only provides partial moduleConfig, merge instead of replace
  if (newConfig.moduleConfig) {
    config.moduleConfig = { ...config.moduleConfig, ...newConfig.moduleConfig };
  }
}

/**
 * Set global log level
 */
function setLevel(level: LogLevel): void {
  config.level = level;
}

/**
 * Set log level for a specific module
 */
function setModuleLevel(module: string, level: LogLevel): void {
  if (!config.moduleConfig) {
    config.moduleConfig = {};
  }
  config.moduleConfig[module] = level;
}

// Export the logging system
export const Logger = {
  LogLevel: LOG_LEVELS,
  createModuleLogger,
  configure,
  setLevel,
  setModuleLevel,

  // Global log methods
  debug: (message: string, data?: any) =>
    log("DEBUG", LOG_LEVELS.DEBUG, null, message, data),
  info: (message: string, data?: any) =>
    log("INFO", LOG_LEVELS.INFO, null, message, data),
  warn: (message: string, data?: any) =>
    log("WARN", LOG_LEVELS.WARN, null, message, data),
  error: (message: string, data?: any) =>
    log("ERROR", LOG_LEVELS.ERROR, null, message, data),
};

// For convenience, provide default export
export default Logger;
