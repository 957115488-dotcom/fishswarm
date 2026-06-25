# Low-code Assets Integration Release Notes

Date: 2026-06-25
Branch: `codex/lowcode-fishswarm-comprehensive-integration`
Scope: low-code concept integration, Asset Center, structured development artifacts, LogicFlow preview, controlled actions, auditable export packages, documentation, and security hardening.

## 1. Summary

This release upgrades FishSwarm into a Lowcode-informed AI Agent development workbench while preserving the existing app layout. The integration adds a unified resource library in Settings, structured development artifacts for reviewable agent output, LogicFlow preview/compile support, policy and audit foundations, controlled task/configuration/export actions, and auditable ZIP export packages.

The implementation intentionally does **not** turn FishSwarm into a low-code IDE clone. Instead, low-code assets become discoverable, reusable references that feed FishSwarm's existing agent workflow, human review, rollback, QA, and release paths.

## 2. User-facing changes

### Resource Library / Assets

A new read-oriented resource library is available under Settings:

```text
Settings -> 资源库 / Assets
```

Users can now browse and filter:

- low-code concepts
- domain skills and built-in skills
- roles
- MCP connector presets
- plugins
- AI providers / model presets / provider setup recipes
- LogicFlow workflow templates
- low-code component blueprints and example workflow templates
- workflow artifacts
- export package assets

The page keeps the existing Settings layout: grouped asset cards on the left, detail panel on the right.

### Controlled asset actions

The first controlled actions are available without exposing direct execution:

- `useInTask`: inserts a structured asset reference into the task composer for manual review before sending.
- `configure`: opens existing provider settings using provider/setup references only; no API key is carried inside asset payloads.
- `dryRunExport` and `createPackage`: drive the controlled export workflow for `export.package:*` assets.

### Export package workflow

Export package assets provide a settings-side workflow:

1. Run dry-run.
2. Review blockers, warnings, redaction findings, file count, and total size.
3. If no blockers exist, manually approve package creation.
4. Create ZIP through the main process only.
5. View package path, checksum path, SHA summary, dry-run hash, and policy decision.

## 3. Architecture highlights

### Asset Center

Implemented as a read-only aggregation layer, not a new database. Source adapters normalize existing project/runtime data into `AssetCenterItem` envelopes.

Primary files:

- `src/main/asset-center/asset-center-types.ts`
- `src/main/asset-center/asset-center-service.ts`
- `src/main/asset-center/lowcode-concepts.ts`
- `src/main/asset-center/lowcode-builder-asset-index.ts`
- `src/main/asset-center/domain-skill-asset-index.ts`
- `src/main/asset-center/built-in-skill-asset-index.ts`
- `src/main/asset-center/logic-flow-template-asset-index.ts`
- `src/main/asset-center/provider-asset-index.ts`
- `src/main/asset-center/mcp-asset-index.ts`
- `src/main/asset-center/plugin-asset-index.ts`
- `src/main/asset-center/role-asset-index.ts`
- `src/main/asset-center/workflow-artifact-asset-index.ts`
- `src/main/asset-center/asset-export-asset-index.ts`

### Renderer UI

Primary files:

- `src/renderer/components/settings/SettingsAssets.tsx`
- `src/renderer/components/presets/AssetCard.tsx`
- `src/renderer/components/presets/AssetStatusPill.tsx`
- `src/renderer/components/presets/SectionCard.tsx`
- `src/renderer/components/presets/EmptyState.tsx`
- `src/renderer/utils/asset-center-view-model.ts`

### Structured development artifacts

Structured artifact kinds now cover feature blueprints, data model drafts, component tree drafts, LogicFlow drafts, API contract drafts, implementation plan DSL, patch proposals, human review gates, apply results, QA results, rollback checkpoints, and concept application maps.

Primary files:

- `src/shared/development-artifact-types.ts`
- `src/main/planning/patch-proposal-service.ts`
- `src/main/planning/human-review-gate-service.ts`
- `src/main/planning/rollback-checkpoint-service.ts`
- `src/main/planning/approved-patch-apply-service.ts`

### LogicFlow preview

LogicFlow support is intentionally preview/compile only. There is no direct run/execute entry point.

Primary files:

- `src/shared/logic-flow-types.ts`
- `src/main/logic-flow/logic-flow-schema.ts`
- `src/main/logic-flow/logic-flow-compiler.ts`
- `src/main/asset-center/logic-flow-template-asset-index.ts`

### Policy and audit foundation

Primary files:

- `src/main/asset-center/asset-policy-types.ts`
- `src/main/asset-center/asset-policy-service.ts`
- `src/main/asset-center/asset-audit-types.ts`

MVP behavior:

- read-only asset inspection is allowed;
- `secret.export` is denied;
- install/run/export/apply style actions require explicit human approval or remain deferred by UI.

### Auditable export package

Primary files:

- `src/main/release/asset-export-types.ts`
- `src/main/release/asset-export-rules.ts`
- `src/main/release/asset-export-dry-run.ts`
- `src/main/release/asset-export-package.ts`
- `src/renderer/components/release/AssetExportDryRunPanel.tsx`
- `src/renderer/components/release/AssetExportResultPanel.tsx`
- `src/renderer/utils/asset-export-view-model.ts`

ZIP contents:

```text
fishswarm-export-manifest.json
fishswarm-redaction-report.json
files/<relative candidate path>
```

Sidecar:

```text
<package>.zip.sha256
```

## 4. Security posture

Key protections included in this release:

- Renderer resource library uses allowlisted IPC, not direct filesystem or shell access.
- No `assetCenter.install`, `assetCenter.run`, `assetCenter.export`, `assetCenter.apply`, generic `command.exec`, or generic `network.fetch` bridge is exposed.
- BrowserWindow remains hardened with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.
- Provider assets use `credentialRefs` and setup references, not API key values.
- MCP assets expose required env names and credential references, not env values.
- LogicFlow templates are preview-only and explicitly not executed directly.
- Patch apply requires human review gate bound to exact diff hash.
- Rollback checkpoints are created before approved patch apply.
- Export dry-run blocks `.env`, `.git`, `node_modules`, build outputs, private keys, token/cookie-like paths, and SQLite-style local user data.
- Export package creation re-runs dry-run, validates snapshot hash, checks blockers again, validates candidate hashes, and rejects unsafe ZIP paths.

Security regression tests:

- `src/tests/security/lowcode-integration-security.test.ts`
- `src/tests/security/security-guards.test.ts`

## 5. Documentation added

- `docs/assets/asset-center.md`
- `docs/assets/structured-artifacts.md`
- `docs/assets/export-package.md`

These documents cover user-facing behavior, developer adapter contracts, structured artifact lineage, review gates, rollback checkpoints, export package format, security model, known limitations, and verification commands.

## 6. Verification matrix

Final validation commands for this release:

```powershell
npx vitest run src/tests/asset-center src/tests/logic-flow src/tests/planning src/tests/release
npx vitest run src/tests/security src/tests/renderer/asset-export-view-model.test.ts src/tests/renderer/patch-review-view-model.test.ts src/tests/renderer/asset-center-view-model.test.ts src/tests/renderer/asset-task-reference.test.ts src/tests/renderer/asset-provider-configure.test.ts
npm run typecheck
```

Plan-specified validation areas:

- Asset Center tests
- LogicFlow tests
- Planning / patch / review / rollback tests
- Release export tests
- Security regression tests
- Renderer view-model tests
- TypeScript typecheck

## 7. Known limitations

- Asset Center is still read-only aggregation, not a persistent user asset database.
- Favorites, custom ordering, and user enable/disable state are not persisted in Asset Center yet.
- Export package destination is currently controlled by main process staging under app user data.
- Export redaction is pattern-based and should be paired with human review.
- Audit event types exist, but a fully persisted audit timeline for export events can still be expanded.
- LogicFlow preview compiles to planning artifacts but does not run workflows directly.
- Full one-click rollback restore remains a future controlled action and should require policy plus human approval.

## 8. Rollback guidance

Each milestone was implemented as a small commit on `codex/lowcode-fishswarm-comprehensive-integration` and can be reverted independently.

Recommended rollback approach:

```powershell
git revert <commit>
```

Avoid resetting shared branches after push. Prefer revert commits so the remote branch history remains auditable.

## 9. Acceptance checklist

- [x] Asset Center core and adapters implemented.
- [x] Settings-based Resource Library UI implemented without changing the overall app layout.
- [x] Provider configure and use-in-task actions remain controlled.
- [x] Structured artifact schemas implemented.
- [x] Patch proposal, human review gate, rollback checkpoint, and approved apply services implemented.
- [x] LogicFlow preview/compile support implemented without direct execution.
- [x] Policy and audit foundations implemented.
- [x] Export dry-run and package creation implemented.
- [x] Export UI implemented in Settings detail panel.
- [x] Security regression tests added.
- [x] User/developer documentation added.
- [x] Final release note added.
