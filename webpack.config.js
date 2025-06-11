const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development", // 開發模式，可以改為 'production' 用於生產環境

  entry: {
    // 背景腳本
    "scripts/background": "./extension/scripts/background.ts",

    // 內容腳本
    "scripts/content": "./extension/scripts/content.ts",

    // 頁面上下文腳本 (由內容腳本動態載入)
    "scripts/page-context": "./extension/scripts/page-context.ts",

    // onboarding 腳本
    "onboarding/welcome": "./extension/onboarding/welcome.js",

    // popup 腳本
    "popup/popup": "./extension/popup/popup.js",
  },

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js", // 這會維持目錄結構
    clean: true, // 在每次構建前清理 dist 文件夾
  },

  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-typescript"],
          },
        },
      },
    ],
  },

  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "extension",
          to: ".",
          globOptions: {
            ignore: [
              "**/scripts/**/*.js", // 忽略所有 JS 文件，因為它們會被 Webpack 處理
              "**/scripts/**/*.ts", // 忽略所有 TS 文件，因為它們會被 Webpack 處理
              "**/onboarding/**/*.js", // 忽略 onboarding JS 文件
              "**/onboarding/**/*.ts", // 忽略 onboarding TS 文件
              "**/popup/**/*.js", // 忽略 popup JS 文件
              "**/popup/**/*.ts", // 忽略 popup TS 文件
              "**/.DS_Store", // 忽略 macOS 系統文件
            ],
          },
        },
        // 直接複製 manifest.json，不需要修改路徑
        {
          from: "extension/manifest.json",
          to: "manifest.json",
        },
      ],
    }),
  ],

  // 解析模組的選項
  resolve: {
    extensions: [".js", ".ts"], // 自動解析的擴展名
  },
};
