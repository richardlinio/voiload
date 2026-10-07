# AGENTS.md

Guidance for coding agents working in this repository. Deeper reference lives in
[docs/architecture.md](docs/architecture.md), [docs/types-system.md](docs/types-system.md) and
[docs/prd.md](docs/prd.md); this file is the short list of things an agent needs before editing.

## Agent Configuration

- `AGENTS.md` is the single source of truth for agent instructions. `CLAUDE.md` is a
  compatibility symlink to it; edit only `AGENTS.md`.
- Provider-native configuration stays in that provider's namespace:
  - `.claude/settings.json` — shared Claude Code project permissions (tracked).
  - `.claude/settings.local.json` — per-machine overrides (gitignored, never committed).

## Project Overview

**VoiLoad** is a Chrome extension (Manifest V3) that downloads voice messages from Facebook
Messenger and Facebook. It captures audio blob URLs in the page, matches them to voice-message
DOM elements, and offers right-click and "Download All" downloads as WAV files.

## Development Commands

pnpm only (version pinned by `packageManager` in `package.json`, Node by `.nvmrc`). Use `pnpm` /
`pnpm exec` — never `npm`, `npx` or `yarn`, which would bypass `pnpm-lock.yaml`.

```bash
pnpm dev             # webpack --watch (development build into dist/)
pnpm build           # production build into dist/
pnpm package         # production build + zip for distribution
pnpm test            # Jest unit tests, silent (only failures shown)
pnpm quality         # tsc --noEmit + ESLint, quiet
pnpm check           # test + quality — the CI gate
pnpm test:e2e        # production build + Playwright E2E (needs Chromium)
pnpm fix             # ESLint auto-fix
pnpm quality-strict  # tsc + ESLint with all warnings
```

**Verification**: after any code change run `pnpm check` (CI runs `pnpm check` then `pnpm build`).
Run `pnpm test:e2e` when touching detection, blob capture or download flow. Changes that depend on
live Facebook DOM also need the manual release check in
[docs/manual-facebook-smoke-test.md](docs/manual-facebook-smoke-test.md) — never automate a logged-in
Facebook session (no Playwright login, cookie export, trace or HAR capture).

## Architecture

Three execution contexts, each with an entry file in `extension/scripts/` and sub-modules in the
same-named directory:

| Context | Entry | Sub-modules | Role |
|---|---|---|---|
| Background (service worker) | `background.ts` | `background/`, `background/handlers/` | Data store, context menus, downloads, webRequest interception, onboarding, message routing |
| Content script | `content.ts` | `content/` | Bridge between page and background; injects the page-context script; right-click target tracking; WAV request relay |
| Page context | `page-context.ts` | `page-context/` | Runs in the page: hooks `URL.createObjectURL`, analyzes blobs/duration, re-encodes opus/ogg to WAV (`wav-encoder.ts`) |

Shared code: `extension/scripts/utils/` (logger, constants, ID/time helpers, `download-url.ts`)
and `extension/scripts/types/` (all message and data interfaces, re-exported from `types/index.ts`).
UI lives in `extension/popup/` and `extension/onboarding/`.

### Communication Flow

1. Page context intercepts `URL.createObjectURL` to capture audio blobs.
2. Page ↔ content uses `window.postMessage`; content ↔ background uses `chrome.runtime.sendMessage`.
3. Background stores voice-message metadata and performs downloads; before download, content asks
   the page context to re-encode the blob as WAV (`content/wav-request.ts`).

### Non-obvious Constraints

- **Service worker eviction**: MV3 evicts the worker after ~30s idle. `background/data-store.ts`
  keeps an in-memory Map only as a cache in front of `chrome.storage.session` — every mutation
  writes through and every read hydrates first. Never keep download-critical state only in module scope.
- **Detection is language-agnostic**: `content/dom-utils.ts` matches voice-message sliders and play
  controls by role and structure (e.g. numeric `aria-valuemax`); the localized `aria-label`
  dictionary in `utils/constants.ts` is only a hint. Unrecognised labels are logged and must not
  block downloads (covered by `tests/e2e/language-matrix.spec.ts`).
- Stored items expire after `TIME_CONSTANTS.DATA_RETENTION_PERIOD`; constants live in
  `utils/constants.ts` — reference them instead of hard-coding intervals.

### Module Conventions

- Each module exports an `init*` function (e.g. `initMenuManager`); entry files wire them together.
- Use a module-specific logger: `Logger.createModuleLogger(MODULE_NAMES.X)`.
- Wrap Chrome API calls in try/catch with `logger.error` and degrade gracefully.

## Build

Webpack bundles each entry with `babel-loader` (`@babel/preset-env` + `@babel/preset-typescript`);
CopyPlugin copies manifest, HTML, CSS and icons. Output goes to `dist/` — load it as an unpacked
extension for manual testing.

## Testing

- Jest + jsdom; setup in `tests/setup.ts`. Unit tests live in `tests/unit/` and mirror the
  `extension/scripts/` tree (`*.test.ts`).
- Chrome APIs (`storage`, `downloads`, `tabs`, `contextMenus`, `webRequest`, `runtime`) are mocked;
  isolate modules with `jest.mock()`.
- E2E: Playwright specs in `tests/e2e/` load the built extension against de-identified DOM fixtures
  (`tests/e2e/fixtures/`). Fixtures must stay free of names, message text, account/thread IDs and URLs.
