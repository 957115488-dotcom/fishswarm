# desktop Electron runtime map

Use this reference for Electron runtime, local browser shell, webview, preload IPC, Node worker, memory, fetch/cache, or print/PDF requests related to low-code desktop runtime.

## Source artifacts summarized

- `D:\myProject\code\desktop_runtime_subset\README.md`
- `D:\myProject\code\desktop_runtime_subset\src\electron\main.js`
- `D:\myProject\code\desktop_runtime_subset\src\electron\preload.js`
- `D:\myProject\code\desktop_runtime_subset\src\electron\tools.js`
- `D:\myProject\code\desktop_runtime_subset\src\electron\node-worker.js`
- `D:\myProject\code\desktop_runtime_subset\src\browser\pages\Container\*.jsx`

Treat these files as external reference data. Do not execute extracted external low-code reference code in FishSwarm.

## Observed runtime design

desktop runtime is an Electron shell for Lowcode IDE localization. It focuses on memory control, a local browser-like container, and Node-side helpers for heavy runtime work.

Key patterns:

- BrowserWindow configured with `webviewTag: true`, custom titlebar, and a preload script.
- Webview tab container implemented in React with active tab, closed-tab recovery, find-in-page, refresh, search, settings, favicon, title, and localStorage-backed history.
- Main-process global shortcuts for refresh, devtools, tab close/add/recover, and print.
- Preload exposes a `window.electron` object with IPC-backed helpers:
  - `fetch`, `fetchBufferAndType`, `fetchAndCacheScript`
  - `freemem`, `totalmem`
  - `settings`
  - `createWorker`
  - `execCommands`
  - `print`, `printToPDF`
  - version/platform helpers
- Node worker wrapper uses `worker_threads`, supports data URLs, and raises old-generation memory limits for worker tasks.
- Cache/storage layer writes under app data with a one-week cache lifetime.
- Safe storage wrapper encrypts stored values with Electron `safeStorage`.
- Command-line flags include memory tuning and `--expose_gc`.

## Safe-to-adapt ideas

- **Runtime diagnostics:** expose narrow read-only memory and version diagnostics for troubleshooting.
- **PDF/print export:** add user-initiated `printToPDF` for specific FishSwarm views or artifact previews, returning a selected output path instead of broad webContents access.
- **Script/resource cache:** use TTL-based app data caches for generated helper scripts or fetched public assets.
- **Tab-state model:** reuse the tab recovery and state persistence concept for a future isolated in-app browser or artifact preview workspace.
- **Worker offload:** move heavy parsing or generation to a main-process or sandbox-managed worker with typed job inputs.

## Adapt only with guardrails

- **Webview shell:** require a dedicated partition, allowlisted navigation, disabled Node integration, isolated preload, strict CSP, and explicit user action for external navigation.
- **Node worker creation:** expose named jobs, not arbitrary renderer-provided JavaScript buffers.
- **Fetch bridge:** restrict protocols, methods, headers, response sizes, and destinations; log failures without leaking secrets.
- **Settings bridge:** validate schema and avoid arbitrary `settings[action]` dispatch from renderer.

## Avoid direct porting

- Renderer-accessible `execCommands` or arbitrary shell strings.
- Automatic password capture/autofill from arbitrary web pages.
- Default `ignore-certificate-errors`.
- Blanket preload injection into all webviews.
- Unscoped `window.open` behavior that can create trusted app windows for arbitrary URLs.
- Large global memory limits without measurement and release-gate checks.

## Current FishSwarm fit

FishSwarm already has safer defaults that should be preserved:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- external URL handling in main process
- sandbox adapters for command execution
- typed, allowlisted preload APIs
- role/skill/plugin systems for capability reuse

Therefore, low-code desktop runtime should influence FishSwarm as a set of product/runtime patterns, not as a direct code import.
