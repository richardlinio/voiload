/**
 * onboarding-utils.ts
 * 提供 onboarding 相關的輔助功能
 */

import { Logger } from "../utils/logger";
import { MODULE_NAMES } from "../utils/constants";

// ================================================
// 類型定義
// ================================================

/**
 * Onboarding 狀態介面
 */
export interface OnboardingStatus {
  completed: boolean;
  shown: boolean;
  installTime: number | null;
  completedAt: number | null;
}

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("onboarding-utils");

/**
 * 檢查 onboarding 狀態
 * @returns 包含 onboarding 狀態的物件
 */
export async function checkOnboardingStatus(): Promise<OnboardingStatus> {
  try {
    const result = await chrome.storage.local.get([
      "onboardingCompleted",
      "onboardingShown",
      "installTime",
      "completedAt",
    ]);

    const status: OnboardingStatus = {
      completed: result.onboardingCompleted || false,
      shown: result.onboardingShown || false,
      installTime: result.installTime || null,
      completedAt: result.completedAt || null,
    };

    logger.debug("Onboarding 狀態", status);
    return status;
  } catch (error) {
    logger.error("檢查 onboarding 狀態時發生錯誤", { error });
    return {
      completed: false,
      shown: false,
      installTime: null,
      completedAt: null,
    } as OnboardingStatus;
  }
}

/**
 * 重置 onboarding 狀態（用於測試）
 */
export async function resetOnboarding(): Promise<void> {
  try {
    await chrome.storage.local.remove([
      "onboardingCompleted",
      "onboardingShown",
      "installTime",
      "completedAt",
    ]);
    logger.info("Onboarding 狀態已重置");
  } catch (error) {
    logger.error("重置 onboarding 狀態時發生錯誤", { error });
  }
}

/**
 * 標記 onboarding 已顯示
 */
export async function markOnboardingShown(): Promise<void> {
  try {
    await chrome.storage.local.set({
      onboardingShown: true,
      shownAt: Date.now(),
    });
    logger.info("已標記 onboarding 已顯示");
  } catch (error) {
    logger.error("標記 onboarding 已顯示時發生錯誤", { error });
  }
}

/**
 * 標記 onboarding 已完成
 */
export async function markOnboardingCompleted(): Promise<void> {
  try {
    await chrome.storage.local.set({
      onboardingCompleted: true,
      completedAt: Date.now(),
    });
    logger.info("已標記 onboarding 已完成");
  } catch (error) {
    logger.error("標記 onboarding 已完成時發生錯誤", { error });
  }
}

/**
 * 判斷是否應該顯示 onboarding
 */
export async function shouldShowOnboarding(): Promise<boolean> {
  const status = await checkOnboardingStatus();

  // 如果已完成，不再顯示
  if (status.completed) {
    return false;
  }

  // 如果從未顯示過，應該顯示
  if (!status.shown) {
    return true;
  }

  // 如果已顯示但未完成，可以考慮是否要再次提醒
  // 這裡可以加入時間判斷，例如超過一週未完成就再次提醒
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const timeSinceInstall = Date.now() - status.installTime;

  if (timeSinceInstall > oneWeek) {
    return true;
  }

  return false;
}
