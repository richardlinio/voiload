/**
 * onboarding-utils.ts
 * Provides helper functions related to onboarding
 */

import { Logger } from "../utils/logger";

// ================================================
// Type Definitions
// ================================================

/**
 * Onboarding status interface
 */
export interface OnboardingStatus {
  completed: boolean;
  shown: boolean;
  installTime: number | null;
  completedAt: number | null;
}

// Create a module-specific logger
const logger = Logger.createModuleLogger("onboarding-utils");

/**
 * Check onboarding status
 * @returns An object containing the onboarding status
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

    logger.debug("Onboarding status", status);
    return status;
  } catch (error) {
    logger.error("Error checking onboarding status", { error });
    return {
      completed: false,
      shown: false,
      installTime: null,
      completedAt: null,
    } as OnboardingStatus;
  }
}

/**
 * Reset onboarding status (for testing)
 */
export async function resetOnboarding(): Promise<void> {
  try {
    await chrome.storage.local.remove([
      "onboardingCompleted",
      "onboardingShown",
      "installTime",
      "completedAt",
    ]);
    logger.info("Onboarding status has been reset");
  } catch (error) {
    logger.error("Error resetting onboarding status", { error });
  }
}

/**
 * Mark onboarding as shown
 */
export async function markOnboardingShown(): Promise<void> {
  try {
    await chrome.storage.local.set({
      onboardingShown: true,
      shownAt: Date.now(),
    });
    logger.info("Onboarding marked as shown");
  } catch (error) {
    logger.error("Error marking onboarding as shown", { error });
  }
}

/**
 * Mark onboarding as completed
 */
export async function markOnboardingCompleted(): Promise<void> {
  try {
    await chrome.storage.local.set({
      onboardingCompleted: true,
      completedAt: Date.now(),
    });
    logger.info("Onboarding marked as completed");
  } catch (error) {
    logger.error("Error marking onboarding as completed", { error });
  }
}

/**
 * Determine whether onboarding should be shown
 */
export async function shouldShowOnboarding(): Promise<boolean> {
  const status = await checkOnboardingStatus();

  // If already completed, do not show
  if (status.completed) {
    return false;
  }

  // If never shown, should show
  if (!status.shown) {
    return true;
  }

  // If shown but not completed, consider reminding again
  // Here you can add a time check, e.g., remind again if not completed after a week
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const timeSinceInstall = Date.now() - (status.installTime || 0);

  if (timeSinceInstall > oneWeek) {
    return true;
  }

  return false;
}
