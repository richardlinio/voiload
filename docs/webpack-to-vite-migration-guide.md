# Webpack 到 Vite 遷移指南：Chrome 擴充功能特化解決方案

## 概述

本文檔詳細說明如何將 Chrome 擴充功能從 Webpack 遷移到 Vite，特別是解決多入口點自包含建構的挑戰。

## 問題背景

### Chrome 擴充功能的特殊需求

Chrome 擴充功能有以下特殊要求：

1. **自包含腳本**: 每個腳本必須完全獨立，不能依賴外部 chunk 檔案
2. **Manifest 限制**: 只有在 `manifest.json` 中明確定義的檔案才會被載入
3. **多個入口點**: 背景腳本、內容腳本、頁面腳本都是獨立的入口點
4. **ES 模組支援**: Manifest V3 支援 ES 模組，但仍需要自包含

### 原始 Webpack 配置的工作方式

```javascript
// webpack.config.js (原始配置)
module.exports = {
  entry: {
    "scripts/background": "./extension/scripts/background.js",
    "scripts/content": "./extension/scripts/content.js",
    "scripts/page-context": "./extension/scripts/page-context.js",
    "onboarding/welcome": "./extension/onboarding/welcome.js",
    "popup/popup": "./extension/popup/popup.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js", // 維持目錄結構
    clean: true,
  },
  // ... 其他配置
}
```

Webpack 預設會為每個入口點產生獨立的檔案，不會建立共享的 chunks（除非特別配置）。

## Vite 的挑戰

### 為什麼直接遷移會失敗？

Vite 預設會進行**程式碼分割（Code Splitting）**，這對一般網頁應用很好，但對 Chrome 擴充功能是致命的：

```javascript
// 初始嘗試的 vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        'scripts/background': resolve(__dirname, 'extension/scripts/background.js'),
        'scripts/content': resolve(__dirname, 'extension/scripts/content.js'),
        // ... 其他入口點
      },
    },
  },
})
```

**結果**：產生了額外的 chunk 檔案（如 `logger.js`、`time-utils.js`），這些檔案不在 manifest.json 中，Chrome 無法載入。

### Vite/Rollup 的程式碼分割邏輯

Vite 使用 Rollup 作為建構工具，Rollup 會：

1. **分析依賴關係**: 找出多個入口點共享的模組
2. **建立共享 chunks**: 將共享模組提取到獨立檔案
3. **最佳化載入**: 減少重複程式碼，提升載入效能

這對網頁應用是好的，但對 Chrome 擴充功能是問題。

## 解決方案演進

### 第一階段：嘗試禁用程式碼分割

```javascript
// 嘗試 1: 使用 manualChunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: () => null, // 嘗試禁用 chunks
      },
    },
  },
})
```

**結果**：仍然產生共享 chunks，因為 Rollup 認為這是最佳化。

```javascript
// 嘗試 2: 使用 inlineDynamicImports
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        inlineDynamicImports: true, // 內聯所有動態匯入
      },
    },
  },
})
```

**結果**：錯誤！`inlineDynamicImports` 不支援多個入口點。

### 第二階段：理解根本問題

問題的核心是：**Vite 的多入口點建構設計是為了網頁應用，不是為了 Chrome 擴充功能**。

我們需要的是：**每個入口點都是完全獨立的建構單位**。

## 最終解決方案：自定義建構腳本

### 核心概念

使用 **Vite 的 Library Mode** 來分別建構每個入口點，每次建構都是一個獨立的 library。

### 自定義建構腳本架構

```javascript
// scripts/build-extension.js
import { build } from 'vite'

// 入口點配置
const entries = [
  {
    input: 'extension/scripts/background.js',
    output: 'scripts/background.js'
  },
  // ... 其他入口點
]

async function buildEntry(entry, isFirst = false) {
  await build({
    build: {
      outDir: 'dist',
      emptyOutDir: isFirst, // 只在第一次清空
      lib: {
        entry: resolve(rootDir, entry.input),
        name: entry.output.replace(/[\/\-\.]/g, '_'),
        fileName: () => entry.output,
        formats: ['es'] // 使用 ES 模組格式
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true, // 單一入口點可以使用！
        },
        external: [], // 不將任何模組視為外部
      },
    },
  })
}
```

### 為什麼這個方案有效？

1. **Library Mode**: Vite 的 library mode 專為建構獨立的程式庫設計
2. **單一入口點**: 每次建構只有一個入口點，可以使用 `inlineDynamicImports`
3. **完全內聯**: 所有依賴都會內聯到單一檔案中
4. **ES 模組格式**: 支援 Chrome 擴充功能的 Manifest V3

### 建構流程詳解

```javascript
async function main() {
  // 1. 分別建構每個入口點
  for (let i = 0; i < entries.length; i++) {
    await buildEntry(entries[i], i === 0) // 第一次清空 dist
  }
  
  // 2. 複製靜態檔案
  await copyStaticFiles()
}
```

每次 `buildEntry` 調用都是一個完全獨立的 Vite 建構過程：

1. **讀取入口點**: 載入指定的 JS 檔案
2. **解析依賴**: 分析所有 import 語句
3. **內聯依賴**: 將所有依賴直接寫入輸出檔案
4. **產生 Source Map**: 用於除錯

## 配置細節解析

### Vite 配置簡化

```javascript
// vite.config.js (簡化版本，主要用於開發模式)
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    target: 'es2020',
  },
  resolve: {
    extensions: ['.js', '.mjs'],
  },
})
```

這個配置只用於開發模式和基本設定，實際建構使用自定義腳本。

### Package.json 調整

```json
{
  "type": "module", // 重要！啟用 ES 模組
  "scripts": {
    "build": "node scripts/build-extension.js", // 使用自定義腳本
    "build:vite": "vite build --mode production", // 保留原始 Vite 建構
  }
}
```

## 建構結果對比

### 使用原始 Vite 配置

```
dist/
├── scripts/
│   ├── background.js (31KB - 引用其他 chunks)
│   ├── content.js (10KB - 引用其他 chunks)
│   └── page-context.js (1.5KB - 引用其他 chunks)
├── logger.js (7KB - 共享 chunk)
├── time-utils.js (1.5KB - 共享 chunk)
├── audio-analyzer.js (2.6KB - 共享 chunk)
└── ... 其他共享 chunks
```

**問題**: Chrome 無法載入 `logger.js` 等檔案，因為它們不在 manifest.json 中。

### 使用自定義建構腳本

```
dist/
├── scripts/
│   ├── background.js (40KB - 完全自包含)
│   ├── content.js (19KB - 完全自包含)
│   └── page-context.js (10KB - 完全自包含)
├── onboarding/
│   └── welcome.js (8KB - 完全自包含)
└── popup/
    └── popup.js (8KB - 完全自包含)
```

**優勢**: 
- 每個檔案都是完全獨立的
- 沒有外部依賴
- Chrome 可以正常載入所有腳本

## 效能考量

### 檔案大小對比

| 方法 | 總大小 | 單檔案大小 | 重複程式碼 |
|------|--------|------------|------------|
| 原始 Vite | ~51KB | 較小 | 無 |
| 自定義腳本 | ~85KB | 較大 | 有 |

### 為什麼接受檔案大小增加？

1. **Chrome 擴充功能的載入模式**: 不是傳統的網頁載入，重複程式碼的影響較小
2. **功能正確性**: 能正常運作比檔案大小更重要
3. **開發維護性**: 單一檔案除錯更容易

## 開發工作流程

### 開發階段

```bash
# 開發模式 (快速建構，用於測試)
pnpm dev
```

使用標準 Vite 建構，雖然會產生 chunks，但在開發階段可以快速測試。

### 生產建構

```bash
# 生產建構 (使用自定義腳本)
pnpm build
```

使用自定義腳本，確保產生的檔案可以在 Chrome 中正常載入。

### 除錯建議

1. **Source Maps**: 自定義腳本會產生 source maps，支援原始碼除錯
2. **分層測試**: 先用 `pnpm dev` 快速測試邏輯，再用 `pnpm build` 測試最終檔案
3. **Chrome DevTools**: 在 Chrome 擴充功能頁面載入 `dist` 資料夾測試

## 擴展性考慮

### 添加新的入口點

```javascript
// 在 scripts/build-extension.js 中添加
const entries = [
  // ... 現有入口點
  {
    input: 'extension/options/options.js',
    output: 'options/options.js'
  }
]
```

### 處理更複雜的依賴

如果需要外部依賴（如 npm 套件），在 `rollupOptions.external` 中配置：

```javascript
rollupOptions: {
  external: ['chrome'], // Chrome API 不需要打包
  output: {
    globals: {
      chrome: 'chrome'
    }
  }
}
```

## 總結

這個解決方案的核心是**理解工具的設計目標**：

- **Vite**: 為現代網頁應用設計，專注於開發體驗和載入效能
- **Chrome 擴充功能**: 有特殊的檔案載入限制，需要自包含的腳本

通過使用 Vite 的 Library Mode 和自定義建構腳本，我們將**網頁應用建構工具適配到 Chrome 擴充功能的需求**，既保留了 Vite 的開發體驗，又滿足了 Chrome 擴充功能的技術限制。

這個方案展示了一個重要的工程原則：**當現有工具不完全符合需求時，不要強迫使用，而是理解其原理並創建適配方案**。