# Developer Architecture

low-code integration follows five layers: shared contracts, main-domain services, governance, preload IPC, and renderer view models. Renderer code displays and drafts only; file writes, export packages, patch apply, and shell-like operations stay in main process services with policy and audit boundaries.
