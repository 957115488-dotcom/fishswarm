# Asset Center

Read-only asset indexing core for FishSwarm.

MVP responsibilities:

- Normalize low-code concept mappings into FishSwarm asset metadata.
- Index bundled domain skills without installing or executing them.
- Build deterministic `AssetCenterSnapshot` values for future UI/IPC consumption.

MVP non-goals:

- No UI.
- No IPC.
- No database writes.
- No install, enable, run, export, or configure actions.
- No secrets in asset content.
