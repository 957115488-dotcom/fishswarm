# Auditable Export Package

本文档说明 FishSwarm 的受控导出能力：dry-run 如何工作、ZIP 包里有什么、哪些内容会被阻止、UI 如何触发导出，以及开发者如何验证安全边界。

## 1. 目标定位

Export package 对应综合计划中的 “Auditable export package”：

```text
Asset / artifact refs
-> export dry-run
-> blockers / warnings / redaction report preview
-> human approval
-> policy decision
-> package creation
-> manifest + checksum + redaction report
```

它不是任意文件打包器。它的目标是让 FishSwarm 能导出一个可审计、可复核、不会泄漏密钥的交付包。

## 2. 用户流程

入口：`Settings -> 资源库 / Assets -> 交付与审计 -> export.package:*`。

当前内置两个导出资产：

- `export.package:audit-source`
- `export.package:deployable-source`

右侧详情栏展示“受控导出工作流”：

1. 点击 `运行 dry-run`。
2. 查看文件数量、总大小、blockers、redaction findings。
3. 若存在 blocker，无法创建 ZIP。
4. 若 dry-run 通过，用户必须勾选人工批准。
5. 点击 `创建审计导出包`。
6. main process 再次执行 policy、dry-run drift 校验、hash 校验。
7. 创建 ZIP、`.sha256` sidecar，并在 UI 中展示路径与 hash 摘要。

Renderer 不直接创建 ZIP、不直接读写任意文件、不执行 shell。

## 3. IPC contract

共享类型定义在：

- `src/shared/ipc-types.ts`
- `src/main/release/asset-export-types.ts` re-export

IPC：

```ts
assetExport.dryRun(payload?: AssetExportDryRunRequest): Promise<AssetExportDryRunResponse>
assetExport.createPackage(payload: AssetExportCreatePackageRequest): Promise<AssetExportCreatePackageResponse>
```

`assetExport.createPackage` 必填：

- dry-run snapshot
- `expectedDryRunSha256`
- `approved: true`

main process 会重新执行：

- policy decision: `asset.export`
- dry-run hash 校验
- blocker 校验
- candidate hash 校验
- path traversal 校验
- workspace containment 校验

## 4. Dry-run service

实现文件：

- `src/main/release/asset-export-dry-run.ts`
- `src/main/release/asset-export-rules.ts`

`runAssetExportDryRun(input)` 输出：

```ts
interface ExportDryRunResult {
  dryRun: true;
  ok: boolean;
  manifest: ExportPackageManifest;
  candidates: ExportFileCandidate[];
  redactionFindings: RedactionFinding[];
  warnings: string[];
  blockers: ExportBlocker[];
}
```

Dry-run 只生成 preview，不创建 ZIP。

它会：

- 读取 workspace 文件树。
- 应用 include/exclude rules。
- denylist 优先于 include。
- 阻止 symlink escape。
- 对候选文件计算 size 和 sha256。
- 对文本文件做 redaction scan。
- 生成 manifest preview。
- 排序候选文件，保证结果稳定。

## 5. 默认 denylist

默认排除 / 阻止：

- `.env`
- `.env.*`
- `.git/**`
- `node_modules/**`
- `dist/**`
- `dist-electron/**`
- `dist-mcp/**`
- `dist-wsl-agent/**`
- `dist-lima-agent/**`
- `release/**`
- `**/*.pem`
- `**/*.key`
- `**/*cookie*`
- `**/*token*`
- `**/*credential*`
- `**/*.sqlite`
- `**/*.sqlite3`
- `**/*.db`

如果这些路径被扫描到，会产生 blocker，而不是被静默打包。

## 6. Redaction scan

当前 redaction patterns 覆盖：

- private key block
- OpenAI-style `sk-*`
- Google `AIza*`
- GitHub token
- Bearer token
- credential-like assignment warning

Redaction finding 只记录类型、路径、行号、severity、message；不会把 secret 原文写进 finding。

## 7. Manifest format

Manifest 字段：

```ts
interface ExportPackageManifest {
  schemaVersion: 1;
  packageId: string;
  mode: 'audit-source' | 'deployable-source';
  createdAt: string;
  fishSwarmVersion?: string;
  git: {
    commit: string;
    branch: string;
    dirty: boolean;
  };
  includeRules: string[];
  excludeRules: string[];
  files: ExportFileCandidate[];
  artifactRefs: string[];
  warnings: string[];
  blockers: ExportBlocker[];
}
```

`files` 中每个文件记录：

- relative path
- size
- sha256

## 8. Package creation

实现文件：

- `src/main/release/asset-export-package.ts`

核心函数：

```ts
computeExportDryRunSnapshotSha256(result)
createAssetExportPackage(input)
```

创建包规则：

1. 如果传入 dry-run snapshot，必须提供 `expectedDryRunSha256`。
2. supplied snapshot hash 必须匹配 expected hash。
3. supplied dry-run 不得有 blockers。
4. 创建前重新运行 dry-run。
5. 当前 dry-run hash 必须与 expected hash 一致，防止 workspace drift。
6. 每个 candidate 必须仍存在且 sha256 不变。
7. ZIP entry 不允许绝对路径、盘符路径、空路径、null byte、`..`。
8. resolved candidate 必须位于 workspace root 内。
9. 使用 Node API 和 `archiver` 创建 ZIP，不使用 shell zip。

## 9. ZIP 内容

ZIP 内部结构：

```text
fishswarm-export-manifest.json
fishswarm-redaction-report.json
files/<relative candidate path>
```

ZIP 外部 sidecar：

```text
<package>.zip.sha256
```

Sidecar 格式：

```text
<sha256>  <zip basename>
```

## 10. Redaction report

ZIP 内的 `fishswarm-redaction-report.json`：

```ts
interface ExportRedactionReport {
  schemaVersion: 1;
  packageId: string;
  createdAt: string;
  dryRunSha256: string;
  findings: RedactionFinding[];
  warnings: string[];
  blockers: ExportBlocker[];
}
```

创建成功的 package 中 `blockers` 必须为空。

## 11. UI components

相关文件：

- `src/renderer/components/release/AssetExportDryRunPanel.tsx`
- `src/renderer/components/release/AssetExportResultPanel.tsx`
- `src/renderer/utils/asset-export-view-model.ts`
- `src/renderer/components/settings/SettingsAssets.tsx`

UI gating：

- 只有 `export.package` 且包含 `dryRunExport` action 才显示 dry-run panel。
- 只有 `export.package` 且包含 `createPackage` action 才允许创建包。
- 创建按钮需要 dry-run 通过、0 blocker、用户勾选 approval、当前不在创建中。
- 切换资产会清空 dry-run/result/approval 状态，避免跨资产误用审批。

## 12. Policy and audit

当前 create package IPC 会执行 `decideAssetPolicy({ action: 'asset.export' })`。

MVP policy 行为：

- `asset.view` 允许。
- `secret.export` 拒绝。
- `asset.export` 需要 human approval。

后续可把 `AssetAuditEvent` 写入 timeline 或专用 audit store，目前 audit 类型定义在：

- `src/main/asset-center/asset-audit-types.ts`

## 13. 安全回归测试

核心测试：

- `src/tests/release/asset-export-types.test.ts`
- `src/tests/release/asset-export-rules.test.ts`
- `src/tests/release/asset-export-dry-run.test.ts`
- `src/tests/release/asset-export-package.test.ts`
- `src/tests/renderer/asset-export-view-model.test.ts`
- `src/tests/security/lowcode-integration-security.test.ts`

覆盖内容：

- `.env` blocker。
- redaction finding 不泄漏 secret 原文。
- symlink escape blocker。
- dry-run 不创建 ZIP。
- create package 需要 expected hash。
- workspace drift 会拒绝创建。
- ZIP entry path traversal 被拒绝。
- provider snapshot 不包含 API key。
- renderer 没有 generic command/fetch bridge。

验证命令：

```powershell
npx vitest run src/tests/security src/tests/asset-center src/tests/release src/tests/renderer/asset-export-view-model.test.ts
npm run typecheck
```

## 14. 操作与排障

常见 blocker：

- `denylist.path`：命中默认 denylist。删除或排除敏感文件后重新 dry-run。
- `redaction.api_key` / `redaction.token`：候选文件中存在 secret-like 字符串。移除 secret 或改为 credentialRef。
- `symlink.escape`：symlink 指向 workspace 外部。移除该链接或改为普通文件引用。

常见 create package 错误：

- `expectedDryRunSha256 is required`：UI/调用方没有传 dry-run hash。
- `snapshot changed`：dry-run 后 workspace 发生变化，重新 dry-run。
- `candidate changed after dry-run`：候选文件内容变化，重新 dry-run。
- `Unsafe zip entry path`：snapshot 中存在路径穿越或非法路径。

## 15. 已知限制

- 当前导出目标目录由 main process 写入 app `userData/asset-exports`，还没有用户选择保存路径。
- Audit event 类型已定义，但导出事件的持久 audit timeline 可继续增强。
- ZIP 内容为源文件与审计元数据，不包含自动恢复脚本。
- Redaction scan 是 pattern-based，不等于完整 DLP；导出前仍需要人工审查。
- Deployable-source mode 当前与 audit-source 共享安全 pipeline，未来可细化 build artifact inclusion rules。
