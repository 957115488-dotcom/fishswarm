# GStack Browse Binary

FishSwarm's `GStack_Browse` MCP adapter looks here for a compiled gstack browse
executable after project-local environment overrides.

Expected layout:

```text
resources/gstack-browse/
  win32-x64/browse.exe
  darwin-arm64/browse
  linux-x64/browse
```

For local development, you can also set `GSTACK_BROWSE_BIN` to an absolute path.

This directory is intentionally owned by FishSwarm so the repository does not
depend on a checked-out `gstack-main` reference folder.

