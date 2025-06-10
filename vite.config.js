import { defineConfig } from 'vite'

// 這個檔案主要用於開發模式，正式建構使用 scripts/build-extension.js
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    target: 'es2020',
  },
  // 開發模式配置
  server: {
    // 不開啟開發伺服器，因為這是 browser extension
    open: false,
  },
  // 解析配置
  resolve: {
    extensions: ['.js', '.mjs'],
  },
  // 定義全域變數（如果需要）
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
})