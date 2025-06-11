module.exports = {
  // 測試環境
  testEnvironment: 'jsdom',
  
  // 測試檔案的模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.test.ts'
  ],
  
  // 在每個測試檔案之前運行的設置文件
  setupFiles: ['./tests/setup.js'],
  
  // 忽略的目錄
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  
  // TypeScript 支援
  preset: 'ts-jest/presets/js-with-babel',
  
  // 轉換設定
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  
  // 模組檔案擴展名
  moduleFileExtensions: ['js', 'ts', 'json'],
  
  // 顯示每個測試的詳細信息
  verbose: true
};
