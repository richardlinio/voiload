# GEMINI.md

This file provides guidance to gemini when working with code in this repository.

## Project Overview

This is a Chrome browser extension called "VoiLoad" that enables downloading voice messages from Facebook Messenger and Facebook. The extension monitors audio blob URLs, identifies voice message elements in the DOM, and provides right-click download functionality.

## Development Commands

### Build & Development

- `pnpm dev` - Start development build with file watching
- `pnpm build` - Create production build
- `pnpm package` - Package the extension for distribution

### Quality Assurance & Testing

- `pnpm test` - Run Jest tests in silent mode (shows only failures)
- `pnpm fix` - Run ESLint auto-fix with visible output
- `pnpm quality` - Run TypeScript check + ESLint in silent mode
- `pnpm check` - Run both test and quality checks (ideal for CI)
- `pnpm quality-strict` - Run quality checks with full output (shows all warnings)
- `pnpm typecheck` - Run standalone TypeScript type checking
- `pnpm lint` - Run standalone ESLint in quiet mode

**IMPORTANT**: After making any code changes, always run `pnpm test` and `pnpm quality` to ensure code quality and prevent regressions. These commands are optimized for silent output to save LLM token usage while maintaining comprehensive error reporting.

## Architecture Overview

The extension uses a multi-layer architecture:

### Background Scripts (`extension/scripts/background/`)

- **background.ts** - Main coordinator that initializes all background modules
- **data-store.ts** - Manages voice message data storage and cleanup
- **download-manager.ts** - Handles audio file downloads
- **menu-manager.ts** - Manages right-click context menus
- **message-handler.ts** - Processes messages from content scripts
- **web-request-interceptor.ts** - Monitors network requests for audio
- **onboarding-utils.ts** - Manages user onboarding workflow and Chrome storage
- **handlers/** - Message processing handlers
  - **audio-url-registration-handler.ts** - Handles audio URL registration
  - **blob-handler.ts** - Processes blob URL registration and downloads
  - **element-registration-handler.ts** - Manages voice message element registration
  - **right-click-handler.ts** - Handles right-click context menu interactions

### Content Scripts (`extension/scripts/content/`)

- **content.ts** - Bridge between page and background scripts, injects page context
- **message-handler.ts** - Handles communication between layers
- **context-menu-handler.ts** - Processes right-click menu interactions
- **dom-utils.ts** - DOM manipulation utilities

### Page Context Scripts (`extension/scripts/page-context/`)

- **page-context.ts** - Main module that runs in page environment
- **blob-monitor.ts** - Monitors blob URL creation to capture audio
- **audio-analyzer.ts** - Analyzes audio characteristics and duration
- **blob-analyzer.ts** - Processes blob data for voice message detection

### Utilities (`extension/scripts/utils/`)

- **logger.ts** - Centralized logging system with module-specific loggers
- **constants.ts** - Application constants and configuration
- **id-generator.ts** - Generates unique identifiers
- **time-utils.ts** - Time-related utility functions

### TypeScript Types (`extension/scripts/types/`)

- **index.ts** - Unified type exports
- **messages.ts** - All message interface definitions
- **voice-message.ts** - Core voice message data structures
- **chrome-extension.ts** - Chrome Extension API extensions
- **audio.ts** - Audio analysis types
- **download.ts** - Download-related types
- **dom.ts** - DOM operation types
- **utils.ts** - Utility types (Logger, constants)

## Key Technical Concepts

### Communication Flow

1. Page context intercepts `URL.createObjectURL` calls to capture audio blobs
2. Content script acts as bridge between page and background
3. Background script processes download requests and manages extension state
4. Uses `window.postMessage` for page↔content and `chrome.runtime.sendMessage` for content↔background

### Voice Message Detection

- Monitors blob URL creation for audio types
- Uses Web Audio API to calculate duration
- Associates DOM elements with blob URLs
- Filters based on size and duration heuristics

### File Structure Pattern

- Each layer has its own directory with index file and sub-modules
- Handlers are grouped in `/handlers/` subdirectories
- Utilities are shared across all layers
- ES6 modules with explicit imports/exports

## Browser Extension Specifics

### Manifest v3 Configuration

- Service worker background script (not persistent)
- Content scripts inject into facebook.com and messenger.com
- Requires permissions: activeTab, contextMenus, downloads, webRequest, storage
- Host permissions for Facebook domains and CDNs

### Build Process

- Webpack processes and bundles JavaScript modules
- CopyPlugin handles static assets (HTML, CSS, manifest)
- Output goes to `dist/` directory
- Babel transpiles modern JavaScript for compatibility

## Common Development Patterns

### Module Organization

- Each module exports initialization functions (e.g., `initMenuManager`)
- Main scripts import and coordinate sub-modules
- Logger instances are module-specific using `Logger.createModuleLogger`

### Error Handling

- Comprehensive try-catch blocks with logger.error
- Graceful degradation when APIs fail
- Regular cleanup of stored data to prevent memory leaks

### Data Management

- Voice messages stored with metadata: blobUrl, type, size, duration, timestamp
- Automatic cleanup of expired items every 30 minutes
- Uses WeakMap and Set for memory-efficient tracking

## Development Guidelines

### Code Style

- Use ES6+ features and modules
- Descriptive variable and function names
- Consistent error handling with logger
- Modular architecture with clear responsibilities

### Testing Approach

- Jest with jsdom environment for DOM testing
- Setup file configures test environment at `tests/setup.ts`
- Test files follow `*.test.{js,ts}` pattern in `tests/unit/` directory
- **Test Structure**: Organized to mirror the `/extension` directory structure
  - `tests/unit/background/` - Background script tests
  - `tests/unit/background/handlers/` - Message handler tests
  - `tests/unit/utils/` - Utility function tests
- **Test Coverage**: 368 comprehensive unit tests across 14 test suites
- **Chrome API Mocking**: Comprehensive mocks for chrome.storage, chrome.downloads, chrome.tabs, chrome.contextMenus, chrome.webRequest
- **Key Testing Patterns**:
  - Module isolation with jest.mock()
  - Chrome API simulation and error handling
  - Async function testing with proper cleanup
  - Edge case and integration testing

### Extension Development

- Load unpacked extension from `dist/` directory for testing
- Use Chrome Developer Tools for debugging content and background scripts
- Monitor console logs from different contexts (page, content, background)

## Claude Memory

- Use ripgrep (rg) when you need grep
- **Referenced Project**: @/Users/linporu/Documents/world-of-code/evoprompt/test-god.md
