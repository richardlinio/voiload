/**
 * popup.js
 * 處理擴充功能彈出視窗的邏輯
 */

import { checkOnboardingStatus } from "../scripts/background/onboarding-utils";
import { Logger } from "../scripts/utils/logger";

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("popup");

document.addEventListener("DOMContentLoaded", async function () {
  logger.info("Popup loaded");

  // 顯示基本狀態
  const statusElement = document.querySelector(".status p");
  const statusDiv = document.querySelector(".status");
  const now = new Date();
  statusElement.textContent = `✅ Extension is running! (${now.toLocaleTimeString()})`;
  statusDiv.classList.add("active");

  // 檢查 onboarding 狀態
  try {
    const { completed, installTime, completedAt } =
      await checkOnboardingStatus();
    logger.debug("Onboarding status", { completed, installTime, completedAt });

    if (!completed) {
      // 如果未完成 onboarding，顯示提醒
      showOnboardingReminder();
    } else {
      // 如果已完成，可以顯示一些統計資訊
      showCompletedStatus(completedAt);
    }

    // 添加快速連結
    addQuickLinks();
  } catch (error) {
    logger.error("Error checking onboarding status", { error });
  }
});

/**
 * 顯示 onboarding 提醒
 */
function showOnboardingReminder() {
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

  const statusDiv = document.querySelector(".status");
  statusDiv.appendChild(reminderDiv);

  // 添加按鈕事件
  document.getElementById("open-onboarding").addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("onboarding/welcome.html"),
    });
    window.close();
  });
}

/**
 * 顯示已完成狀態
 */
function showCompletedStatus(completedAt) {
  if (!completedAt) return;

  const completedDate = new Date(completedAt);
  const formattedDate = completedDate.toLocaleDateString("en-US");

  const completedDiv = document.createElement("div");
  completedDiv.className = "completed-status";
  completedDiv.innerHTML = `
    <p class="completed-text">✨ Setup completed on ${formattedDate}</p>
  `;

  const footer = document.querySelector(".footer");
  footer.appendChild(completedDiv);
}

/**
 * 添加快速連結
 */
function addQuickLinks() {
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

  const footer = document.querySelector(".footer");
  footer.insertBefore(linksDiv, footer.firstChild);

  // 添加按鈕事件
  document.getElementById("open-messenger").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.messenger.com" });
    window.close();
  });

  document.getElementById("open-facebook").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.facebook.com" });
    window.close();
  });

  document.getElementById("view-tutorial").addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("onboarding/welcome.html"),
    });
    window.close();
  });

  document.getElementById("report-issue").addEventListener("click", () => {
    // You can link to GitHub issues or other report pages here
    chrome.tabs.create({
      url: "mailto:linpoju.richard@gmail.com?subject=VoiLoad%20Issue%20Report",
    });
  });
}
