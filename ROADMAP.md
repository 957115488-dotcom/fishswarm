# 🗺️ FishSwarm Roadmap

> This document outlines the development direction for FishSwarm. For feature requests and discussion, see [GitHub Issues](https://github.com/FishSwarm/fishswarm/issues).

## ✅ Completed

- **Core**: Stable Windows & macOS installers with build verification
- **Security**: Full filesystem sandboxing + path traversal / zip-slip hardening
- **VM Sandbox**: WSL2 (Windows) and Lima (macOS) VM-level isolation
- **Skills**: PPTX, DOCX, PDF, XLSX support + custom skill management + hot-reload
- **MCP Connectors**: Custom connector support (stdio / SSE / Streamable HTTP)
- **Rich Input**: File upload and image input in chat
- **Multi-Model**: Claude, GPT, Gemini, DeepSeek, Qwen, GLM, Kimi, Grok, MiniMax, Ollama
- **UI/UX**: Enhanced interface with English/Chinese localization
- **Remote Control**: Feishu (Lark) bot integration with pairing mode + approval panel
- **CI/CD**: Automated builds, smoke tests, Codex-powered PR review bot
- **Model Presets**: Up-to-date model catalogs for all major providers
- **Dependency Policy**: Tiered management strategy with Dependabot grouping
- **Memory System Foundation**: Unified storage with core/experience memory and source-aware retrieval workflow (PR #138)
- **Low-code Assets Integration Foundation**: Read-only Assets library, Lowcode sub-asset adapters, safe task references, provider configuration handoff, patch review UI, export dry-run/package workflow, and release notes.

## 🚧 In Progress

- **Role Runtime UX**: Make role selection, role handbook mounting, acceptance logs, and review handoffs visible and configurable in the app.
- **Browser Skill Runtime**: Continue hardening browser execution, screenshots, page state capture, and GStack Browse compatibility.
- **Context Guardrails**: Polish Context Save / Restore, Freeze / Guard, prompt-injection controls, and decision-store feedback loops.
- **Planning Governance Hardening**: Continue moving policy/audit/approval logic from feature services toward a reusable governance layer.
- **Agent Workboard Lite**: Connect assets, roles, structured development artifacts, and approval references into visible task-board status cards.

## 📋 Planned

### Near-term (v3.4.0)

- **Sandbox Hardening**: Deep research and improvement of VM sandbox reliability, startup performance, and cross-platform consistency (Lima on macOS, WSL2 on Windows)
- **App Slimming**: Reduce installer size with optional Python/Node.js bundles, lazy-loaded remote-control dependencies, and stripped unused files.
- **Code Cleanup**: Split large modules (index.ts ~3091 lines, gui-operate-server.ts ~6890 lines, software-dev-server-example.ts ~3341 lines, agent-runner.ts ~3392 lines), lazy imports, dead code removal
- **Naming Standardization**: Keep FishSwarm as the canonical brand and `FISHSWARM_*` as the canonical env prefix; retain `COWORK_*` / `OPEN_COWORK_*` only as compatibility aliases.
- **Role Orchestration**: Promote multi-role methodology into first-class planner / executor / reviewer flows with role manuals and acceptance summaries.
- **Tool Completeness**: Improve browser, file search, web fetch/search, and MCP tool coverage for API-key users.
- **Memory System Enhancements**: Improve prompt injection controls, cross-session retrieval UX, memory source inspection, and source-aware reranking quality
- **Scheduled Tasks**: Cron-like task scheduling with UI management and persistent execution
- **Log Management**: Structured logging with rotation, size limits, and user-accessible log viewer improvements
- **Installation Experience**: Smoother first-run — auto-detect system dependencies, clearer error messages, one-click setup
- **Linux Support**: First-class Linux builds (currently build-from-source only)

### Mid-term (v3.5.0+)

- **Plugin System**: Extensible architecture for community-built integrations
- **Multi-Agent**: Orchestrate multiple agents for complex workflows
- **Workspace Templates**: Pre-configured environments for common use cases (coding, writing, research)
- **Low-code Advanced Authoring**: richer LogicFlow and component blueprint previews, reusable template chips, and deeper role-generated artifact timelines.

### Long-term

- **Computer Use (CUA)**: GUI automation via screen capture and mouse/keyboard control
- **Collaborative Mode**: Multiple users sharing a workspace
- **Mobile Companion**: Lightweight mobile app for monitoring and quick interactions

---

_Last updated: 2026-06-25_
_Want to contribute? Check our [Contributing Guide](CONTRIBUTING.md) and pick an issue labeled `good first issue`._
