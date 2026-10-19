# Facebook live smoke test

在本機用真實登入的 Facebook 對話驗證 VoiLoad 仍可運作。這是發布驗收與使用者回報時的排查工具，不是排程監控。

自動化部分由 `scripts/live-smoke.mjs` 執行：載入 `dist/` extension 到獨立的 Chromium profile，開啟固定測試對話，檢查偵測、音訊捕捉與右鍵下載產出的 WAV。

## 安全邊界

- 只在本機執行；不在 CI、GitHub Actions、雲端 runner 或背景排程執行。
- 登入 session 只存在 `~/.voiload-smoke/profile`（repo 外、權限 700）。不匯出 storageState／cookie，也不讀取 profile 內容。
- 測試對話 URL 存在 `~/.voiload-smoke/thread-url`（權限 600），不印到輸出、不 commit。
- 不錄製 trace、HAR、video、screenshot；報告只含數量、介面 label、時長與 WAV header。
- 只把去識別、最小化的 DOM 片段帶回 fixture；移除姓名、帳號、訊息與 URL。

## 執行時機

- 每次發布前。
- 超過一個月沒有發布時，每月一次。
- 收到「無法辨識／無法下載」的使用者回報時。

## 首次設定與 session 過期時

1. `pnpm smoke:login`：開啟 Chromium（已載入 extension）。
2. 登入 Facebook，開啟固定測試對話（需有短語音、長語音；最好再有一段影片）。
3. Cmd+Q 結束 Chromium。腳本會存下最後開啟的對話 URL。

Facebook 若要求驗證，直接在同一視窗完成。

## 執行

```bash
pnpm smoke:live   # production build + 跑測試對話，輸出 JSON 報告
```

`verdict: "pass"` 且 exit code 0 才算通過。檢查項目：

| 檢查 | 失敗時代表 |
|---|---|
| `signed in (c_user cookie present)` | session 過期，重跑 `pnpm smoke:login` |
| `voice slider selector matches` | Facebook 改了 slider markup（或對話沒有語音） |
| `container guard recognises voice messages` | 容器結構改變，`content/dom-utils.ts` 的 guard 拒絕 slider |
| `audio captured into background store` | page-context 的 blob 捕捉或 page→content→background 管線壞掉 |
| `right-click download: matched (not batch fallback)` | duration 配對失敗，退回 Download All |
| `right-click download: is WAV` / `duration matches` | WAV 重新編碼失敗或時長錯誤 |

`ariaLabels[].inDictionary: false` 不算失敗（偵測不依賴字典），但應以去識別文字更新字典 fixture。

## 仍需人工確認

自動化無法涵蓋以下項目，發布前在同一 Chromium（`pnpm smoke:login`）手動補驗：

1. 原生右鍵選單出現「Download Voice Message」，實際存檔可播放（腳本模擬選單點擊且不寫檔）。
2. Download All：只下載目前頁籤捕捉到的語音，不含影片或其他頁籤資料。
3. 對影片與非語音 slider 操作：不得被辨識為語音訊息（測試對話沒有影片時腳本只會回報 `rejectedWithVideo: 0`）。

## 發現 Facebook DOM drift 時

1. 在 DevTools 只複製 voice-message container 的最小 DOM。
2. 去除姓名、訊息文字、帳號／thread ID、URL 與 React/internal data。
3. 更新 `tests/e2e/fixtures/voice-message-fixture.ts` 與相關 contract tests。
4. 用 `pnpm check`、`pnpm build`、`pnpm test:e2e` 證明新 fixture 會守住修正，再用 `pnpm smoke:live` 確認真實頁面。
