/**
 * welcome.ts
 * 處理 onboarding 頁面的邏輯
 */

import { Logger } from "../scripts/utils/logger";
import { MODULE_NAMES } from "../scripts/utils/constants";

// ================================================
// 類型定義
// ================================================

/**
 * Chrome Storage 本地存儲數據介面
 */
interface OnboardingStorageData {
  onboardingCompleted?: boolean;
  completedAt?: number;
}

// 創建模組特定的日誌記錄器
const logger = Logger.createModuleLogger("onboarding");

// 頁面載入時執行
document.addEventListener("DOMContentLoaded", async (): Promise<void> => {
  logger.info("Onboarding page loaded");

  // 檢查是否已經完成過 onboarding
  const result: OnboardingStorageData = await chrome.storage.local.get([
    "onboardingCompleted",
  ]);

  if (result.onboardingCompleted) {
    logger.info("User has already completed onboarding");
    // 可以顯示不同的內容或添加"已完成"標記
    showCompletedMessage();
  }

  // 設置完成按鈕事件
  setupCompleteButton();

  // 添加動畫效果
  addAnimations();
});

/**
 * 設置完成按鈕的事件處理
 */
function setupCompleteButton(): void {
  const completeButton = document.getElementById(
    "complete-onboarding"
  ) as HTMLButtonElement;

  if (completeButton) {
    completeButton.addEventListener("click", async (): Promise<void> => {
      logger.info("User clicked complete button");

      // 添加載入狀態
      completeButton.disabled = true;
      completeButton.textContent = "Loading...";

      try {
        // 標記 onboarding 已完成
        await chrome.storage.local.set({
          onboardingCompleted: true,
          completedAt: Date.now(),
        });

        logger.info("Onboarding status updated");

        // 檢查是否有已開啟的 Messenger 標籤
        const tabs: chrome.tabs.Tab[] = await chrome.tabs.query({
          url: ["*://*.messenger.com/*", "*://*.facebook.com/*"],
        });

        if (tabs.length > 0) {
          // 如果有已開啟的標籤，切換到第一個並重新整理
          logger.info("Found open Facebook/Messenger tab");
          const firstTab = tabs[0];

          if (firstTab && firstTab.id) {
            await chrome.tabs.update(firstTab.id, { active: true });
            await chrome.tabs.reload(firstTab.id);
          }

          // 顯示成功訊息
          showSuccessMessage();

          // 3秒後關閉 onboarding 頁面
          setTimeout(() => {
            window.close();
          }, 3000);
        } else {
          // 如果沒有，開啟新的 Messenger 標籤
          logger.info("Opening new Messenger tab");
          await chrome.tabs.create({
            url: "https://www.messenger.com",
            active: true,
          });

          // 關閉 onboarding 頁面
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
 * 顯示已完成訊息
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
 * 顯示成功訊息
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
 * 顯示錯誤訊息
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

    // 3秒後移除錯誤訊息
    setTimeout(() => {
      errorMsg.remove();
    }, 3000);
  }
}

/**
 * 添加動畫效果
 */
function addAnimations(): void {
  // 當元素進入視窗時觸發動畫
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

  // 觀察所有動畫元素
  const animatedElements: NodeListOf<Element> =
    document.querySelectorAll(".step, .feature");
  animatedElements.forEach((el: Element) => {
    observer.observe(el);
  });
}

// 監聽鍵盤事件
document.addEventListener("keydown", (event: KeyboardEvent): void => {
  // 按下 Enter 鍵時觸發完成按鈕
  if (event.key === "Enter") {
    const completeButton = document.getElementById(
      "complete-onboarding"
    ) as HTMLButtonElement;
    if (completeButton && !completeButton.disabled) {
      completeButton.click();
    }
  }
});
