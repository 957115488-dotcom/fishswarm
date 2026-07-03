<p align="center">
  <img src="resources/logo.png" alt="FishSwarm Logo" width="240" />
</p>

<h1 align="center">FishSwarm</h1>

<p align="center">
  Local-first AI agent desktop workspace for multi-model, multi-role, auditable automation.
</p>

<p align="center">
  <a href="./README_zh.md">??</a> ?
  <a href="#what-is-fishswarm">Overview</a> ?
  <a href="#features">Features</a> ?
  <a href="#quick-start">Quick Start</a> ?
  <a href="#development">Development</a> ?
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-blue" alt="Platform: Windows and macOS" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-brightgreen" alt="Node.js >= 22" />
  <img src="https://img.shields.io/badge/Electron-React%20%2B%20TypeScript-47848F" alt="Electron, React, TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

> This README has been cleaned up to reflect the current project direction. Outdated community links, stale demo links, and old model/version claims have been removed.

## What is FishSwarm?

FishSwarm is an open-source desktop application for running AI agents inside a controlled local workspace. It combines model-provider configuration, MCP connectors, reusable Skills, workspace/sandbox guardrails, memory, roles, and asset-driven workflows into one Electron app.

The project is aimed at people who want an AI assistant that can work with real project files while keeping execution visible, reviewable, and scoped to the workspace you choose.

## Features

| Area                          | Current focus                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Desktop agent workspace       | Chat-driven local workspace with visible tool calls, file context, and project sessions.                                 |
| Model providers               | Configurable API providers and OpenAI-compatible endpoints; secrets stay in provider settings, not in prompts.           |
| Skills                        | Reusable workflows for documents, spreadsheets, PDFs, screenshots, browser/tool operations, and custom capability packs. |
| MCP connectors                | Connect external tools through Model Context Protocol configurations.                                                    |
| Workspace safety              | Path restrictions, permission rules, review flows, and optional VM isolation with WSL2/Lima where available.             |
| Roles and workboards          | Role routing, role artifacts, Agent Workboard Lite, and review handoff foundations.                                      |
| Assets / low-code integration | Read-only asset library, provider setup references, safe task references, patch review, and export package workflows.    |
| Remote control                | Feishu/Lark and Slack integration code exists as optional/beta infrastructure; configure only if you need it.            |

## Current status

FishSwarm is under active development. Treat advanced automation features as review-first workflows:

- **Stable core direction:** local desktop app, workspace-scoped agent execution, model settings, skills, MCP, and sandbox foundations.
- **Beta foundations:** Assets, low-code workflow style structured artifacts, Agent Workboard Lite, controlled patch review, and export packages.
- **Source builds:** supported with Node.js 22+.
- **Installers:** if this repository publishes prebuilt packages, use the repository's [Releases](https://github.com/957115488-dotcom/fishswarm/releases) page. Otherwise build from source.

## Quick start

### Requirements

- Node.js **22 or newer**
- npm
- Git
- Optional: WSL2 on Windows or Lima on macOS for stronger command isolation

### Run from source

```bash
git clone https://github.com/957115488-dotcom/fishswarm.git
cd fishswarm
npm install
npm run dev
```

### Build a desktop package

```bash
npm run build
```

Generated installers are written to the local `release/` directory when the build completes.

## First-use checklist

1. Open FishSwarm.
2. Choose a workspace folder. Agent file operations should stay inside this workspace.
3. Open settings and configure your model provider/API key.
4. Add MCP connectors or Skills only when you need them.
5. Start with small, reversible tasks and review any file modifications before applying them.

Example prompt:

```text
Read the markdown files in this workspace and draft a concise project summary. Do not modify files until I approve the plan.
```

## Safety and privacy

FishSwarm is local-first, but it is still an AI automation tool. Review actions before approving file changes, command execution, patch application, or export packaging.

- Your workspace files remain local unless you explicitly send content to a configured model provider or external connector.
- API keys, tokens, and credentials should live in settings or credential stores, not in prompts or project files.
- Workspace path restrictions reduce risk, but they are not a replacement for human review.
- Optional VM isolation uses WSL2 on Windows and Lima on macOS when configured and available.

## Project layout

```text
fishswarm/
??? src/
?   ??? main/          # Electron main process, agent runtime, sandbox, MCP, assets, roles
?   ??? preload/       # Secure bridge between renderer and main process
?   ??? renderer/      # React UI, settings, chat, assets, workboard views
?   ??? shared/        # Shared types and utilities
?   ??? tests/         # Test helpers and runtime-facing tests
??? docs/              # User docs, developer docs, plans, demos, release notes
??? resources/         # Icons and static app assets
??? scripts/           # Build, bundle, diagnostics, and packaging scripts
??? website/           # Project website sources
??? package.json       # Scripts, dependencies, and app metadata
```

## Development

Common commands:

```bash
npm run dev          # start the desktop app in development mode
npm run build        # build the app and package installers
npm test             # run the Vitest suite through the native rebuild wrapper
npm run lint         # lint TypeScript/React sources
npm run typecheck    # run TypeScript without emitting files
npm run clean        # remove generated build artifacts
```

Useful focused checks for recent work:

```bash
npx vitest run src/tests/asset-center src/tests/agent-workboard src/tests/renderer
npx vitest run src/tests/security src/tests/release src/tests/workflows
```

## Documentation

- [User docs](docs/user/)
- [Developer testing notes](docs/developer/testing.md)
- [Assets documentation](docs/assets/)
- [low-code assets integration release notes](docs/release-notes/lowcode-assets-integration.md)
- [Roadmap](ROADMAP.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Community and support

There is currently no external chat group advertised in this README. Please use repository-native channels so issues stay searchable and actionable:

- Report bugs through [GitHub Issues](https://github.com/957115488-dotcom/fishswarm/issues).
- Open pull requests for fixes and documentation improvements.
- Keep discussions tied to reproducible steps, logs, screenshots, or affected files when possible.

## License

FishSwarm is released under the [MIT License](LICENSE).
