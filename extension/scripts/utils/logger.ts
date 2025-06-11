/**
 * logger.ts
 * 提供擴充功能的統一日誌記錄系統
 */

import { LOG_LEVELS, type LogLevel, type ModuleName } from "./constants";

// 類型定義
interface LoggerConfig {
  level: LogLevel;
  showTimestamp: boolean;
  showLevel: boolean;
  showModule: boolean;
  consoleOutput: boolean;
  moduleConfig: Record<string, LogLevel>;
}

interface ModuleLogger {
  debug: (message: string, data?: any) => void;
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
}

// 預設配置
let config: LoggerConfig = {
  // 當前日誌級別，可透過設置調整
  level: LOG_LEVELS.DEBUG,

  // 是否顯示時間戳
  showTimestamp: true,

  // 是否顯示日誌級別
  showLevel: true,

  // 是否顯示日誌模組
  showModule: true,

  // 是否顯示在開發人員控制台
  consoleOutput: true,

  // 模組級別的日誌控制
  moduleConfig: {
    // 為特定模組設置不同的日誌級別
    // 'MODULE_NAME': LogLevel.XXX
  },
};

/**
 * 格式化日誌訊息
 */
function formatLogMessage(
  level: string,
  module: string | null,
  message: string
): string {
  const parts: string[] = [];

  // 添加時間戳
  if (config.showTimestamp) {
    const now = new Date();
    const timeStr = now.toISOString().slice(11, 23); // 格式：HH:MM:SS.sss
    parts.push(`[${timeStr}]`);
  }

  // 添加日誌級別
  if (config.showLevel) {
    parts.push(`[${level}]`);
  }

  // 添加模組名稱
  if (config.showModule && module) {
    parts.push(`[${module}]`);
  }

  // 組合基本訊息
  const result = parts.join(" ") + " " + message;

  return result;
}

/**
 * 獲取模組的日誌級別
 */
function getModuleLogLevel(module: string | null): LogLevel {
  if (module && config.moduleConfig[module] !== undefined) {
    return config.moduleConfig[module];
  }
  return config.level;
}

/**
 * 輸出日誌
 */
function log(
  level: string,
  levelValue: LogLevel,
  module: string | null,
  message: string,
  data?: any
): void {
  // 檢查是否應該記錄此日誌
  const moduleLevel = getModuleLogLevel(module);
  if (levelValue < moduleLevel) {
    return;
  }

  // 格式化日誌訊息
  const formattedMessage = formatLogMessage(level, module, message);

  // 輸出到控制台
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
 * 創建模組特定的日誌記錄器
 */
function createModuleLogger(module: ModuleName | string): ModuleLogger {
  return {
    /**
     * 記錄調試級別日誌
     */
    debug: (message: string, data?: any) => {
      log("DEBUG", LOG_LEVELS.DEBUG, module, message, data);
    },

    /**
     * 記錄信息級別日誌
     */
    info: (message: string, data?: any) => {
      log("INFO", LOG_LEVELS.INFO, module, message, data);
    },

    /**
     * 記錄警告級別日誌
     */
    warn: (message: string, data?: any) => {
      log("WARN", LOG_LEVELS.WARN, module, message, data);
    },

    /**
     * 記錄錯誤級別日誌
     */
    error: (message: string, data?: any) => {
      log("ERROR", LOG_LEVELS.ERROR, module, message, data);
    },
  };
}

/**
 * 配置日誌系統
 */
function configure(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };

  // 如果用戶只提供了部分moduleConfig，則合併而不是替換
  if (newConfig.moduleConfig) {
    config.moduleConfig = { ...config.moduleConfig, ...newConfig.moduleConfig };
  }
}

/**
 * 設置全局日誌級別
 */
function setLevel(level: LogLevel): void {
  config.level = level;
}

/**
 * 設置特定模組的日誌級別
 */
function setModuleLevel(module: string, level: LogLevel): void {
  if (!config.moduleConfig) {
    config.moduleConfig = {};
  }
  config.moduleConfig[module] = level;
}

// 導出日誌系統
export const Logger = {
  LogLevel: LOG_LEVELS,
  createModuleLogger,
  configure,
  setLevel,
  setModuleLevel,

  // 全局日誌方法
  debug: (message: string, data?: any) => log("DEBUG", LOG_LEVELS.DEBUG, null, message, data),
  info: (message: string, data?: any) => log("INFO", LOG_LEVELS.INFO, null, message, data),
  warn: (message: string, data?: any) => log("WARN", LOG_LEVELS.WARN, null, message, data),
  error: (message: string, data?: any) => log("ERROR", LOG_LEVELS.ERROR, null, message, data),
};

// 為了方便使用，提供預設導出
export default Logger;