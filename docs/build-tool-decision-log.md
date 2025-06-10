# 建構工具決策記錄

## 決策時間線

### 第一階段：Webpack → Vite 遷移
**時間**: 初始遷移
**原因**: 
- 解決 Chrome Extension chunk 分割問題
- 提升開發體驗和建構速度
- 採用現代工具鏈

**結果**: 成功實現，使用 Vite Library Mode + 自定義建構腳本

### 第二階段：重新評估決策
**時間**: 專案穩定後
**考量因素**:
1. 專案已完成核心功能，不會大幅擴展
2. 未來重點：TypeScript、環境偵測、測試撰寫
3. 維護性和簡單性優先於開發速度

## 最終決策：回到 Webpack

### 決策原因

#### 1. 專案穩定性優先
- 核心功能完成，不需要頻繁的快速開發
- 維護負擔最小化更重要
- 單一配置文件 vs 多文件配置

#### 2. 未來 Roadmap 匹配度
- **TypeScript**: Webpack 配置雖稍複雜但足夠成熟
- **Logger 環境偵測**: 兩者都能輕鬆實現
- **測試撰寫**: Webpack + Jest 整合度更高

#### 3. 技術複雜度考量
- Webpack 方案：一個配置文件
- Vite 方案：Vite 配置 + 自定義建構腳本 + 靜態文件處理

#### 4. Chrome Extension 特化
雖然 Vite 方案完美解決了 chunk 問題，但 Webpack 也有解決方案：
```javascript
optimization: {
  splitChunks: {
    chunks: 'async', // 避免靜態導入分割
  },
}
```

### Webpack 配置重點

#### 1. TypeScript 支援
```javascript
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
}
```

#### 2. 環境變數處理
```javascript
plugins: [
  new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    '__DEV__': process.env.NODE_ENV !== 'production'
  })
]
```

#### 3. Chrome Extension 最佳化
```javascript
optimization: {
  splitChunks: false, // 完全禁用 chunk 分割
}
```

## 學習成果

這次 Webpack → Vite → Webpack 的過程帶來的價值：

1. **技術驗證**: 證明了 Vite Library Mode 可以解決 Chrome Extension 建構問題
2. **深度理解**: 更深入理解兩種工具的優缺點和適用場景
3. **決策框架**: 建立了基於專案階段和需求的技術選型思路
4. **應急方案**: 未來如果需要，我們知道如何快速切換到 Vite

## 決策原則總結

技術選型應該考慮：

1. **專案階段**: 快速開發期 vs 穩定維護期
2. **團隊能力**: 工具熟悉度和學習成本
3. **未來規劃**: 功能擴展 vs 品質提升
4. **維護成本**: 配置複雜度和故障排除難度

**最重要的**: 沒有完美的技術方案，只有最適合當前情況的方案。隨著需求變化調整技術選型是正常且必要的。