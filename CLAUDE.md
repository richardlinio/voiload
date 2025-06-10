# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome browser extension called "VoiLoad" that enables downloading voice messages from Facebook Messenger and Facebook. The extension monitors audio blob URLs, identifies voice message elements in the DOM, and provides right-click download functionality.

## Development Commands

### Build & Development
- `pnpm dev` - Start development build with file watching
- `pnpm build` - Create production build 
- `pnpm package` - Package the extension for distribution

### Testing
- `pnpm test` - Run Jest tests
- Tests are located in `tests/` directory with setup in `tests/setup.js`
- Test environment is configured for jsdom

## Architecture Overview

The extension uses a multi-layer architecture:

### Background Scripts (`extension/scripts/background/`)
- **background.js** - Main coordinator that initializes all background modules
- **data-store.js** - Manages voice message data storage and cleanup
- **download-manager.js** - Handles audio file downloads
- **menu-manager.js** - Manages right-click context menus
- **message-handler.js** - Processes messages from content scripts
- **web-request-interceptor.js** - Monitors network requests for audio

### Content Scripts (`extension/scripts/content/`)
- **content.js** - Bridge between page and background scripts, injects page context
- **message-handler.js** - Handles communication between layers
- **context-menu-handler.js** - Processes right-click menu interactions

### Page Context Scripts (`extension/scripts/page-context/`)
- **page-context.js** - Main module that runs in page environment
- **blob-monitor.js** - Monitors blob URL creation to capture audio
- **audio-analyzer.js** - Analyzes audio characteristics and duration
- **blob-analyzer.js** - Processes blob data for voice message detection

### Utilities (`extension/scripts/utils/`)
- **logger.js** - Centralized logging system with module-specific loggers
- **constants.js** - Application constants and configuration
- **id-generator.js** - Generates unique identifiers
- **time-utils.js** - Time-related utility functions

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
- Setup file configures test environment
- Test files follow `*.test.js` pattern in `tests/` directory

### Extension Development
- Load unpacked extension from `dist/` directory for testing
- Use Chrome Developer Tools for debugging content and background scripts
- Monitor console logs from different contexts (page, content, background)