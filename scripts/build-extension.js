#!/usr/bin/env node

/**
 * 自定義建構腳本 - 分別建構每個入口點以避免 chunk 分割
 */

import { build } from 'vite'
import { resolve } from 'path'
import { cpSync } from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const rootDir = resolve(__dirname, '..')

// 入口點配置
const entries = [
  {
    input: 'extension/scripts/background.js',
    output: 'scripts/background.js'
  },
  {
    input: 'extension/scripts/content.js',
    output: 'scripts/content.js'
  },
  {
    input: 'extension/scripts/page-context.js',
    output: 'scripts/page-context.js'
  },
  {
    input: 'extension/onboarding/welcome.js',
    output: 'onboarding/welcome.js'
  },
  {
    input: 'extension/popup/popup.js',
    output: 'popup/popup.js'
  }
]

async function buildEntry(entry, isFirst = false) {
  console.log(`🔨 建構 ${entry.output}...`)
  
  try {
    await build({
      root: rootDir,
      build: {
        outDir: 'dist',
        emptyOutDir: isFirst, // 只在第一次建構時清空
        minify: false,
        sourcemap: true,
        target: 'es2020',
        lib: {
          entry: resolve(rootDir, entry.input),
          name: entry.output.replace(/[\/\-\.]/g, '_'),
          fileName: () => entry.output,
          formats: ['es']
        },
        rollupOptions: {
          output: {
            inlineDynamicImports: true, // 單一入口點可以使用
          },
          external: [],
        },
      },
    })
    console.log(`✅ ${entry.output} 建構完成`)
  } catch (error) {
    console.error(`❌ ${entry.output} 建構失敗:`, error)
    throw error
  }
}

async function copyStaticFiles() {
  console.log('📁 複製靜態檔案...')
  
  try {
    // 複製 manifest.json
    cpSync('extension/manifest.json', 'dist/manifest.json')
    
    // 複製其他靜態文件
    cpSync('extension/assets', 'dist/assets', { recursive: true })
    cpSync('extension/onboarding/welcome.html', 'dist/onboarding/welcome.html')
    cpSync('extension/onboarding/welcome.css', 'dist/onboarding/welcome.css')
    cpSync('extension/popup/popup.html', 'dist/popup/popup.html')
    cpSync('extension/popup/popup.css', 'dist/popup/popup.css')
    
    console.log('✅ 靜態檔案複製完成')
  } catch (error) {
    console.error('❌ 複製靜態檔案失敗:', error)
    throw error
  }
}

async function main() {
  console.log('🚀 開始建構 Chrome 擴充功能...')
  
  try {
    // 分別建構每個入口點
    for (let i = 0; i < entries.length; i++) {
      await buildEntry(entries[i], i === 0)
    }
    
    // 複製靜態檔案
    await copyStaticFiles()
    
    console.log('🎉 所有檔案建構完成！')
  } catch (error) {
    console.error('💥 建構失敗:', error)
    process.exit(1)
  }
}

main()