/**
 * background.ts
 * Main background script responsible for initializing and coordinating background modules
 */

// Use import statements
import { initMenuManager } from "./background/menu-manager";
import { initDownloadManager } from "./background/download-manager";
import { initMessageHandler } from "./background/message-handler";
import { initWebRequestInterceptor } from "./background/web-request-interceptor";
import {
  createDataStore,
  cleanupOldItems,
  type VoiceMessageStore,
} from "./background/data-store";
import { Logger } from "./utils/logger";
import { UI_CONSTANTS, TIME_CONSTANTS, MODULE_NAMES } from "./utils/constants";
import {
  checkOnboardingStatus,
  markOnboardingShown,
} from "./background/onboarding-utils";

// Create a module-specific logger
const logger = Logger.createModuleLogger(MODULE_NAMES.BACKGROUND);

// Add debug information
logger.debug("Background script is starting to load");
logger.debug("Modules imported successfully");

// Check if chrome API is available
logger.debug("Chrome API availability", {
  chrome: typeof chrome !== "undefined",
  webRequest:
    typeof chrome !== "undefined" && typeof chrome.webRequest !== "undefined",
  contextMenus:
    typeof chrome !== "undefined" && typeof chrome.contextMenus !== "undefined",
  downloads:
    typeof chrome !== "undefined" && typeof chrome.downloads !== "undefined",
});

/**
 * Main initialization function
 */
function initialize(): VoiceMessageStore {
  logger.info("Initializing background script");

  try {
    // Create voice message data store
    const voiceMessages = createDataStore();
    logger.debug("Voice message data store created");

    // Initialize context menu manager
    initMenuManager();
    logger.debug("Context menu manager initialized");

    // Initialize download manager
    initDownloadManager(voiceMessages);
    logger.debug("Download manager initialized");

    // Initialize message handler
    initMessageHandler(voiceMessages);
    logger.debug("Message handler initialized");

    // Initialize webRequest interceptor
    logger.debug("Preparing to initialize webRequest interceptor");
    initWebRequestInterceptor(voiceMessages);
    logger.debug("webRequest interceptor initialized");

    // Set up periodic cleanup of old items
    setInterval(() => {
      cleanupOldItems(voiceMessages);
    }, TIME_CONSTANTS.CLEANUP_INTERVAL); // Clean up every 30 minutes

    logger.info("Background script initialization complete");
    return voiceMessages; // Return voice message data store for use by other functions
  } catch (error: any) {
    logger.error("Error during initialization", { error });
    throw error; // Rethrow error for upper functions to catch
  }
}

// Execute when the extension is installed or updated
chrome.runtime.onInstalled.addListener(
  async (details: chrome.runtime.InstalledDetails) => {
    logger.info(
      "Facebook Messenger voice message downloader has been installed or updated",
      {
        reason: details.reason,
        previousVersion: details.previousVersion,
      }
    );

    // Initialize extension state
    chrome.action.setBadgeText({
      text: UI_CONSTANTS.BADGE_TEXT,
    });

    chrome.action.setBadgeBackgroundColor({
      color: UI_CONSTANTS.BADGE_COLOR,
    });

    // Handle first installation
    if (details.reason === "install") {
      logger.info(
        "First time installation of the extension, preparing to open onboarding"
      );

      try {
        // Record installation time
        await chrome.storage.local.set({
          installTime: Date.now(),
        });

        // Check onboarding status
        const status = await checkOnboardingStatus();

        if (!status.completed) {
          // Open onboarding page
          const onboardingUrl = chrome.runtime.getURL(
            "onboarding/welcome.html"
          );
          chrome.tabs.create({
            url: onboardingUrl,
            active: true,
          });

          // Mark onboarding as shown
          await markOnboardingShown();
          logger.info("Onboarding page opened");
        }
      } catch (error) {
        logger.error("Error during first installation handling", { error });
      }
    } else if (details.reason === "update") {
      logger.info("Extension has been updated", {
        fromVersion: details.previousVersion,
        toVersion: chrome.runtime.getManifest().version,
      });

      // Logic for version update notifications can be added here
    }
  }
);

// Execute initialization
try {
  logger.debug("Preparing to execute initialization function");
  initialize();
  logger.debug("Initialization function executed successfully");
} catch (error: any) {
  logger.error("Error during execution of initialization function", {
    message: error.message,
    stack: error.stack,
  });
}
