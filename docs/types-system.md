# TypeScript 類型系統指南

此目錄包含整個 VoiLoad Chrome 擴充功能的共享類型定義系統。

## 📁 目錄結構

```
types/
├── index.ts                    # 統一導出檔案
├── messages.ts                 # 所有訊息介面
├── voice-message.ts           # 語音訊息核心資料結構
├── chrome-extension.ts        # Chrome Extension API 擴展
├── audio.ts                   # 音訊分析類型
├── download.ts                # 下載相關類型
├── dom.ts                     # DOM 操作類型
├── utils.ts                   # 工具類型
└── README.md                  # 本文檔
```

## 🎯 設計原則

### 1. 統一性

- 所有類型定義集中在 `types/` 目錄
- 避免重複定義相同的介面
- 使用一致的命名慣例

### 2. 模組化

- 按功能分組類型定義
- 每個檔案專注於特定領域
- 清晰的依賴關係

### 3. 向後相容性

- 原始模組重新導出類型以保持相容性
- 漸進式遷移策略
- 保持現有 API 不變

## 📋 類型分類

### 核心資料模型 (`voice-message.ts`)

- `VoiceMessageItem` - 語音訊息項目
- `VoiceMessageStore` - 語音訊息存儲介面
- `DownloadUrlResult` - 下載結果

### 訊息系統 (`messages.ts`)

- `BaseMessage` - 所有訊息的基礎介面
- `RightClickMessage` - 右鍵點擊訊息
- `ElementRegistrationMessage` - 元素註冊訊息
- `AudioUrlRegistrationMessage` - 音訊 URL 註冊
- `BlobUrlMessage` - Blob URL 相關訊息
- `BlobContentMessage` - Blob 內容訊息
- `AudioDurationMessage` - 音訊持續時間請求

### Chrome 擴展 API (`chrome-extension.ts`)

- `ExtensionMessageEvent<T>` - 通用事件介面
- `PageContextMessageEvent` - 頁面上下文事件
- `BackgroundScriptMessageEvent` - 背景腳本事件
- `Window` - 全域介面擴展

### 音訊處理 (`audio.ts`)

- `RequestMetadata` - 請求元數據
- 相關類型位於 `utils.ts` 中的音訊類型

### 下載功能 (`download.ts`)

- `RightClickInfo` - 右鍵點擊資訊
- `DownloadMessage` - Blob 內容下載訊息

### DOM 操作 (`dom.ts`)

- `VoiceMessageElementResult` - 語音訊息元素查找結果

### 工具類型 (`utils.ts`)

- `LogLevel` - 日誌級別
- `ModuleName` - 模組名稱
- `LoggerConfig` - Logger 配置
- `ModuleLogger` - 模組 Logger 介面
- `AudioContentType` - 音訊內容類型

## 📖 使用指南

### 導入類型

**推薦方式：從統一入口導入**

```typescript
import type { VoiceMessageItem, RightClickMessage } from "../types";
```

**特定模組導入**

```typescript
import type { VoiceMessageItem } from "../types/voice-message";
import type { RightClickMessage } from "../types/messages";
```

### 擴展現有類型

**繼承基礎訊息**

```typescript
import type { BaseMessage } from "../types/messages";

interface CustomMessage extends BaseMessage {
  customField: string;
  // action 和 timestamp 已繼承
}
```

**使用泛型事件**

```typescript
import type { ExtensionMessageEvent } from "../types/chrome-extension";

interface MyCustomData {
  value: string;
}

type MyMessageEvent = ExtensionMessageEvent<MyCustomData>;
```

### 類型安全的訊息處理

```typescript
import type { RightClickMessage } from "../types/messages";

function handleRightClick(
  message: RightClickMessage,
  sendResponse: (response?: any) => void
): boolean {
  const { elementId, downloadUrl, durationMs } = message;
  // TypeScript 會確保所有欄位類型正確

  sendResponse({ success: true });
  return true;
}
```

## 🔧 維護指南

### 添加新類型

1. **確定分類**：新類型屬於哪個功能領域？
2. **檢查重複**：是否已存在相似的類型？
3. **選擇檔案**：添加到對應的類型檔案中
4. **更新導出**：在 `index.ts` 中添加導出
5. **更新文檔**：更新此 README

### 修改現有類型

1. **評估影響**：變更會影響哪些模組？
2. **向後相容**：是否破壞現有 API？
3. **漸進遷移**：如需破壞性變更，提供遷移路徑
4. **測試驗證**：確保類型檢查通過

### 重構類型

1. **保持向後相容**：使用 `export type` 重新導出
2. **更新文檔**：說明棄用和新推薦方式
3. **逐步遷移**：分階段更新使用者

## 🏗️ 架構模式

### 基礎訊息模式

所有訊息類型都繼承自 `BaseMessage`：

```typescript
interface BaseMessage {
  action?: string;
  timestamp?: number | string;
}

interface SpecificMessage extends BaseMessage {
  specificField: string;
}
```

### 泛型事件模式

使用泛型來處理不同類型的事件負載：

```typescript
interface ExtensionMessageEvent<T = any> extends MessageEvent {
  data: {
    type: string;
    message: T;
  };
}
```

### 可選欄位模式

使用可選欄位來保持向後相容性：

```typescript
interface RightClickMessage {
  action?: string; // 可選，以相容不同用法
  elementId: string | null;
  downloadUrl: string | null;
  durationMs?: number;
}
```

## 📊 類型統計

- **總計類型檔案**: 7 個
- **統一的訊息介面**: 12+ 個
- **核心資料結構**: 3 個
- **工具類型**: 8+ 個
- **消除的重複定義**: 15+ 處

## 🔍 故障排除

### 常見錯誤

**類型導入錯誤**

```typescript
// ❌ 錯誤
import { VoiceMessageItem } from "../types/voice-message";

// ✅ 正確
import type { VoiceMessageItem } from "../types/voice-message";
```

**循環依賴**

- 確保類型檔案之間的依賴是單向的
- 使用 `import type` 避免運行時依賴

**介面衝突**

- 檢查是否有重複的介面名稱
- 使用命名空間或更具體的名稱

---

本類型系統由 TypeScript 遷移專案建立，旨在提供一個統一、類型安全的開發環境。
