/**
 * welcome.ts
 * Handles onboarding page logic
 */

import { Logger } from "../scripts/utils/logger";

// ================================================
// Type Definitions
// ================================================

/**
 * Chrome Storage local data interface
 */
interface OnboardingStorageData {
  onboardingCompleted?: boolean;
  completedAt?: number;
}

// Create a module-specific logger
const logger = Logger.createModuleLogger("onboarding");

// Execute when the page loads
document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
  logger.info("Onboarding page loaded");

  // Check if onboarding has already been completed
  const result: OnboardingStorageData = await chrome.storage.local.get([
    "onboardingCompleted",
  ]);

  if (result.onboardingCompleted) {
    logger.info("User has already completed onboarding");
    // You can show different content or add a "completed" mark
    showCompletedMessage();
  }

  // Set up the complete button event
  setupCompleteButton();

  // Add animation effects
  addAnimations();
});

/**
 * Set up the complete button event handler
 */
function setupCompleteButton(): void {
  const completeButton = document.getElementById(
    "complete-onboarding"
  ) as HTMLButtonElement;

  if (completeButton) {
    completeButton.addEventListener("click", async (): Promise<void> => {
      logger.info("User clicked complete button");

      // Add loading state
      completeButton.disabled = true;
      completeButton.textContent = "Loading...";

      try {
        // Mark onboarding as completed
        await chrome.storage.local.set({
          onboardingCompleted: true,
          completedAt: Date.now(),
        });

        logger.info("Onboarding status updated");

        // Check if there are any open Messenger tabs
        const tabs: chrome.tabs.Tab[] = await chrome.tabs.query({
          url: ["*://*.messenger.com/*", "*://*.facebook.com/*"],
        });

        if (tabs.length > 0) {
          // If there are open tabs, switch to the first one and reload it
          logger.info("Found open Facebook/Messenger tab");
          const firstTab = tabs[0];

          if (firstTab && firstTab.id) {
            await chrome.tabs.update(firstTab.id, { active: true });
            await chrome.tabs.reload(firstTab.id);
          }

          // Show success message
          showSuccessMessage();

          // Close onboarding page after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
        } else {
          // If not, open a new Messenger tab
          logger.info("Opening new Messenger tab");
          await chrome.tabs.create({
            url: "https://www.messenger.com",
            active: true,
          });

          // Close onboarding page
          window.close();
        }
      } catch (error: any) {
        logger.error("Error completing onboarding", { error });
        completeButton.disabled = false;
        completeButton.textContent = "Get Started →";
        showErrorMessage();
      }
    });
  }
}

/**
 * Show completed message
 */
function showCompletedMessage(): void {
  const container = document.querySelector(".container") as HTMLElement;

  if (container) {
    const notice = document.createElement("div");
    notice.className = "completed-notice";
    notice.innerHTML = `
          <div class="notice-content">
              <span class="notice-icon">✅</span>
              <span>You have already completed the setup and can use the extension directly!</span>
          </div>
      `;
    container.insertBefore(notice, container.firstChild);
  }
}

/**
 * Show success message
 */
function showSuccessMessage(): void {
  const button = document.getElementById(
    "complete-onboarding"
  ) as HTMLButtonElement;
  const footer = document.querySelector("footer") as HTMLElement;

  if (footer) {
    const successMsg = document.createElement("div");
    successMsg.className = "success-message";
    successMsg.innerHTML = `
          <span class="success-icon">✅</span>
          <p>Setup complete! Refreshing the page for you...</p>
      `;

    footer.insertBefore(successMsg, button);

    if (button) {
      button.style.display = "none";
    }
  }
}

/**
 * Show error message
 */
function showErrorMessage(): void {
  const footer = document.querySelector("footer") as HTMLElement;

  if (footer) {
    const errorMsg = document.createElement("div");
    errorMsg.className = "error-message";
    errorMsg.innerHTML = `
          <span class="error-icon">❌</span>
          <p>An error occurred, please try again</p>
      `;

    footer.appendChild(errorMsg);

    // Remove error message after 3 seconds
    setTimeout(() => {
      errorMsg.remove();
    }, 3000);
  }
}

/**
 * Add animation effects
 */
function addAnimations(): void {
  // Trigger animation when elements enter the viewport
  const observerOptions: IntersectionObserverInit = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry: IntersectionObserverEntry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    observerOptions
  );

  // Observe all animated elements
  const animatedElements: NodeListOf<Element> =
    document.querySelectorAll(".step, .feature");
  animatedElements.forEach((el: Element) => {
    observer.observe(el);
  });
}

// Listen for keyboard events
document.addEventListener("keydown", (event: KeyboardEvent): void => {
  // Trigger the complete button when Enter is pressed
  if (event.key === "Enter") {
    const completeButton = document.getElementById(
      "complete-onboarding"
    ) as HTMLButtonElement;
    if (completeButton && !completeButton.disabled) {
      completeButton.click();
    }
  }
});
