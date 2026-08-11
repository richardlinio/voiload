# Facebook live smoke test

用正常 Chrome profile 人工驗證 VoiLoad 在真實 Facebook／Messenger 上仍可運作。這是發布驗收，不是排程監控。

## 安全邊界

- 不用 Playwright、storageState、cookie export 或 headless browser 登入真實帳號。
- 不在 CI、GitHub Actions、雲端 runner 或背景排程執行。
- 不錄製或上傳 trace、HAR、video、screenshot；它們可能包含 session cookie、私人 thread URL 與訊息內容。
- 只把去識別、最小化的 DOM 片段帶回 fixture；移除姓名、帳號、訊息與 URL。

## 執行時機

- 每次發布前。
- 超過一個月沒有發布時，每月一次。
- 收到「無法辨識／無法下載」的使用者回報時。

## 準備

1. 執行 `pnpm build`。
2. 在正常使用的 Chrome profile 載入 `dist/` unpacked extension。
3. 使用固定測試對話，準備短語音、長語音與一段影片。

## 驗收

1. 在 `facebook.com` 或 `messenger.com` 開啟測試對話。
2. 短、長語音各下載一則：檔案為 WAV、可播放、長度合理。
3. 執行 Download All：只下載目前頁籤可見／捕捉到的語音，不含影片或其他頁籤資料。
4. 對影片與非語音 slider 操作：不得被辨識為語音訊息。
5. 開啟 extension log：若出現 `unrecognised aria-label`，確認下載仍成功，再以去識別文字更新字典 fixture。

## 發現 Facebook DOM drift 時

1. 在 DevTools 只複製 voice-message container 的最小 DOM。
2. 去除姓名、訊息文字、帳號／thread ID、URL 與 React/internal data。
3. 更新 `tests/e2e/fixtures/voice-message-fixture.ts` 與相關 contract tests。
4. 用 `pnpm check`、`pnpm build`、`pnpm test:e2e` 證明新 fixture 會守住修正。
