/**
 * popup.ts
 * Handles the logic for the extension popup window
 */

import {
  checkOnboardingStatus,
  type OnboardingStatus,
} from "../scripts/background/onboarding-utils";
import { Logger } from "../scripts/utils/logger";

// Create a module-specific logger
const logger = Logger.createModuleLogger("popup");

document.addEventListener("DOMContentLoaded", async function (): Promise<void> {
  logger.info("Popup loaded");

  // Show basic status
  const statusElement = document.querySelector(
    ".status p"
  ) as HTMLParagraphElement;
  const statusDiv = document.querySelector(".status") as HTMLDivElement;

  if (statusElement && statusDiv) {
    const now = new Date();
    statusElement.textContent = `✅ Extension is running! (${now.toLocaleTimeString()})`;
    statusDiv.classList.add("active");
  }

  // Check onboarding status
  try {
    const { completed, installTime, completedAt }: OnboardingStatus =
      await checkOnboardingStatus();
    logger.debug("Onboarding status", { completed, installTime, completedAt });

    if (!completed) {
      // If onboarding is not completed, show reminder
      showOnboardingReminder();
    } else {
      // If completed, show some stats/info
      showCompletedStatus(completedAt);
    }

    // Add quick links
    addQuickLinks();
  } catch (error: any) {
    logger.error("Error checking onboarding status", { error });
  }
});

/**
 * Show onboarding reminder
 */
function showOnboardingReminder(): void {
  const reminderDiv = document.createElement("div");
  reminderDiv.className = "onboarding-reminder";
  reminderDiv.innerHTML = `
    <div class="reminder-content">
      <span class="reminder-icon">⚠️</span>
      <div class="reminder-text">
        <p>Please complete initial setup first</p>
        <button id="open-onboarding" class="small-button">Start Setup</button>
      </div>
    </div>
  `;

  const statusDiv = document.querySelector(".status") as HTMLDivElement;
  if (statusDiv) {
    statusDiv.appendChild(reminderDiv);
  }

  // Add button event
  const onboardingButton = document.getElementById(
    "open-onboarding"
  ) as HTMLButtonElement;
  if (onboardingButton) {
    onboardingButton.addEventListener("click", () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL("onboarding/welcome.html"),
      });
      window.close();
    });
  }
}

/**
 * Show completed status
 */
function showCompletedStatus(completedAt: number | null): void {
  if (!completedAt) {
    return;
  }

  const completedDate = new Date(completedAt);
  const formattedDate = completedDate.toLocaleDateString("en-US");

  const completedDiv = document.createElement("div");
  completedDiv.className = "completed-status";
  completedDiv.innerHTML = `
    <p class="completed-text">✨ Setup completed on ${formattedDate}</p>
  `;

  const footer = document.querySelector(".footer") as HTMLElement;
  if (footer) {
    footer.appendChild(completedDiv);
  }
}

/**
 * Add quick links
 */
function addQuickLinks(): void {
  const linksDiv = document.createElement("div");
  linksDiv.className = "quick-links";
  linksDiv.innerHTML = `
    <h3>Quick Links</h3>
    <div class="links-grid">
      <button id="open-messenger" class="link-button">
        <span class="icon">💬</span>
        <span>Open Messenger</span>
      </button>
      <button id="open-facebook" class="link-button">
        <span class="icon">📘</span>
        <span>Open Facebook</span>
      </button>
      <button id="view-tutorial" class="link-button">
        <span class="icon">📖</span>
        <span>View Tutorial</span>
      </button>
      <button id="report-issue" class="link-button">
        <span class="icon">🐛</span>
        <span>Report Issue</span>
      </button>
    </div>
  `;

  const footer = document.querySelector(".footer") as HTMLElement;
  if (footer) {
    footer.insertBefore(linksDiv, footer.firstChild);
  }

  // Add button events
  const messengerButton = document.getElementById(
    "open-messenger"
  ) as HTMLButtonElement;
  if (messengerButton) {
    messengerButton.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://www.messenger.com" });
      window.close();
    });
  }

  const facebookButton = document.getElementById(
    "open-facebook"
  ) as HTMLButtonElement;
  if (facebookButton) {
    facebookButton.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://www.facebook.com" });
      window.close();
    });
  }

  const tutorialButton = document.getElementById(
    "view-tutorial"
  ) as HTMLButtonElement;
  if (tutorialButton) {
    tutorialButton.addEventListener("click", () => {
      chrome.tabs.create({
        url: chrome.runtime.getURL("onboarding/welcome.html"),
      });
      window.close();
    });
  }

  const reportButton = document.getElementById(
    "report-issue"
  ) as HTMLButtonElement;
  if (reportButton) {
    reportButton.addEventListener("click", () => {
      // You can link to GitHub issues or other report pages here
      chrome.tabs.create({
        url: "mailto:linpoju.richard@gmail.com?subject=VoiLoad%20Issue%20Report",
      });
    });
  }
}
