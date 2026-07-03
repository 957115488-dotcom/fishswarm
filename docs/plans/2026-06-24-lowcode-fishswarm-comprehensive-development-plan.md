# low-code workflow × FishSwarm Comprehensive Development Plan

> For Claude: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

Goal: 将 low-code workflow 的资产中心、组件蓝图、流程设计、数据建模、接口集成、源码导出能力，完整、安全、渐进地融合进 FishSwarm，最终形成一个“资源库 / Assets + Agent 工作流 + 结构化开发 Artifact + 人审 Diff + QA + 回滚 + 可审计导出”的 AI Agent 桌面开发工作台。

Architecture: 采用“只读资产索引 -> 资源库 UI -> 结构化开发 Artifact -> LogicFlow 预览 -> Policy/Audit -> Export Dry Run -> 受控执行”的分层架构。Asset Center 是统一资产索引与 source adapter 聚合层，初期不作为主存储；所有写入、安装、运行、导出能力都必须经过 main process、权限策略、人审 gate 与审计记录，不允许 renderer 直接执行命令、读写任意文件或泛化网络访问。

Tech Stack: Electron, TypeScript, React, Vite, Vitest, Node fs/path/crypto, existing FishSwarm role runtime, skills manager, MCP config, workflow artifact store, config store, permission rules, i18n, Tailwind/CSS tokens.

---

## 0. 文档定位

这是一份总纲级开发计划，不是单个 feature 的短计划。它的目标是让后续实现者即使不了解当前上下文，也能按阶段、按测试、按文件路径推进 low-code workflow 与 FishSwarm 的融合。

当前基线：

- Repo: D:\myProject\FishSwarm
- Current branch: master
- Current baseline commit: 5347de5 feat: 第二版多角色的初步实现
- Existing concept plan: D:\myProject\FishSwarm\docs\plans\2026-06-24-lowcode-concept-integration-multiagent-plan.md
- Existing short implementation plan: D:\myProject\FishSwarm\docs\plans\2026-06-24-lowcode-fishswarm-assets-implementation-plan.md
- This comprehensive plan: D:\myProject\FishSwarm\docs\plans\2026-06-24-lowcode-fishswarm-comprehensive-development-plan.md

Recommended implementation branch:

~~~powershell
git switch -c codex/lowcode-fishswarm-comprehensive-integration
~~~

重要说明：当前 docs 目录可能被 .gitignore 忽略。如需把本计划上传 GitHub，必须使用 git add -f。

---

## 1. 最终产品效果

最终 FishSwarm 不应该变成 low-code workflow 的低代码 IDE clone，而应该升级为一个 AI Agent 资源化开发工作台。

用户可以：

1. 在资源库中查看所有可复用资产。
2. 从模板、组件蓝图、Role、Skill、MCP Connector、Model Provider、Workflow Template 开始任务。
3. 让多角色 Agent 先生成结构化开发 Artifact，而不是直接改代码。
4. 预览方案、数据模型、组件树、LogicFlow、Patch Proposal。
5. 对 Diff 进行人审，批准后才允许 Apply。
6. Apply 前自动创建 Rollback Checkpoint。
7. Apply 后自动生成 QA Result 与 Release Summary。
8. 最终导出带 manifest、checksum、redaction report、artifact provenance 的审计包。

最终用户入口：

~~~text
资源库 / Assets
├── 创作起点
│   ├── 任务模板 / Templates
│   ├── 组件与蓝图 / Components & Blueprints
│   ├── 工作流模板 / Workflow Templates
│   └── 业务数据模型 / Domain Data Models
├── 能力与连接
│   ├── Skills
│   ├── Domain Skills
│   ├── Roles
│   ├── MCP Connectors
│   ├── Plugins
│   └── AI 模型提供商 / Model Providers
└── 交付与审计
    ├── Patch Proposals
    ├── Review Gates
    ├── QA Results
    ├── Rollback Checkpoints
    └── Export Packages
~~~

首版只能读。中期允许 use in task、insert prompt、preview、configure。后期才允许 install、enable、run、apply、export。

---

## 2. low-code workflow 概念融合映射

| low-code workflow 内容 | FishSwarm 融合方式 | 决策 | 说明 |
|---|---|---|---|
| 资产中心 | 资源库 / Assets | Adopt | 统一发现、复用、管理入口 |
| 页面设计 / 组件库 | 组件蓝图、UI blocks、promptable presets | Adapt | 不做完整低代码页面运行时 |
| 逻辑设计 | logic_flow_draft / workflow artifact | Adapt | 只做 validate/preview/compile，不直接执行 |
| 流程设计 | Agent workflow template | Adapt | 编译成现有 workflow artifact |
| 数据模型 | 业务数据模型草稿 | Adapt | 避免和 AI model provider 混淆 |
| 接口集成 | MCP/API/provider/plugin contracts | Adapt | 统一配置、权限、凭据引用 |
| 源码导出 | Auditable export package | Adapt | manifest + checksum + redaction + provenance |

不允许直接移植：

- 全量低代码 IDE runtime
- broad webviewTag
- renderer command bridge
- generic fetch bridge
- arbitrary preload injection
- password capture
- certificate-error disabling
- 带密钥的导出配置
- 无人审自动写代码

FishSwarm 的正确路径是：

~~~text
选择资源 -> Agent 生成结构化方案 -> 预览与人审 -> 受控执行 -> QA -> 回滚/发布/导出
~~~

---

## 3. 非功能要求

### 3.1 安全

- Renderer 不拥有直接文件写入、shell、网络泛访问能力。
- Asset content 不得包含真实 API key、token、cookie、私钥。
- Export package 默认排除 .env, .git, node_modules, dist, release, cookie, token, SQLite 用户库、证书、私钥。
- 所有 install/run/export/apply 行为必须有 policy decision。
- 所有写操作必须可审计。
- 所有 patch apply 必须可回滚。
- LogicFlow 不允许直接执行。

### 3.2 性能

- Asset snapshot 初版 p95 小于 500ms，按 100 个 domain skills 估算。
- 资源库 UI 首屏 p95 小于 1s。
- 本地搜索筛选 p95 小于 100ms。
- Export dry-run 在 1000 文件以内 p95 小于 3s。

### 3.3 稳定性

- 单个 source adapter 失败不导致整个 snapshot 失败。
- Asset indexing failure 不阻塞应用启动。
- IPC snapshot 失败时 UI 显示降级状态。
- Dry-run 出现 blocker 时不得创建 zip。

### 3.4 可维护性

- 每类资产有统一 envelope。
- 每个 source adapter 独立测试。
- Renderer 使用 view model DTO，不直接消费 main 内部结构。
- 每个 milestone 单独提交，便于 revert。

---

## 4. 高层架构

~~~mermaid
flowchart TD
  CW[low-code workflow Concepts] --> AC[Asset Center Core]
  AC --> CM[Concept Map Adapter]
  AC --> DS[Domain Skills Adapter]
  AC --> SK[Built-in Skills Adapter]
  AC --> PL[Plugin Adapter]
  AC --> MCP[MCP Adapter]
  AC --> RO[Role Adapter]
  AC --> PR[Provider Adapter]
  AC --> WF[Workflow Artifact Adapter]
  AC --> SNAP[AssetCenterSnapshot]
  SNAP --> IPC[Read-only IPC]
  IPC --> UI[Resource Library UI]
  UI --> ART[Structured Development Artifacts]
  ART --> LF[LogicFlow Preview Compiler]
  ART --> PATCH[Patch Proposal]
  PATCH --> REVIEW[Human Review Gate]
  REVIEW --> APPLY[Approved Patch Apply Service]
  APPLY --> QA[QA Result]
  APPLY --> RB[Rollback Checkpoint]
  REVIEW --> POL[Policy Engine]
  APPLY --> POL
  POL --> AUD[Audit Timeline]
  ART --> EXP[Export Dry Run]
  QA --> EXP
  RB --> EXP
  EXP --> ZIP[Auditable Export Package]
~~~

---

## 5. 关键 ADR

### ADR-001: Asset Center 首版是只读聚合索引，不是新数据库

Status: Accepted

Context: FishSwarm 已经有 SQLite、encrypted config store、workflow artifact file store、skills manager、plugin manager、MCP config、role runtime。如果 Asset Center 一开始新建数据库，会重复 source of truth，扩大迁移风险。

Decision: Milestone 1-3 只做 read-only scanner + source adapter + normalized snapshot。用户自建资产、启停状态、安装历史、导出历史后续再决定是否落库。

Positive:

- 最小化脏工作树冲突。
- 不影响现有启动路径。
- 易测试、易回滚。

Negative:

- 初期不能持久化用户收藏、排序、启停状态。
- 部分状态只能显示 derived / best effort。

### ADR-002: LogicFlow 只做预览和编译，不直接执行

Status: Accepted

Context: FishSwarm 现有 agent-runner 已负责模型调用、工具权限、session guard、角色运行与安全边界。直接引入 LogicFlow.run 会绕开这些边界。

Decision: MVP 只允许 list、validate、preview、createPlanArtifact。执行仍由现有 runner/workflow 在已审批上下文中完成。

### ADR-003: API key 永不进入 asset content

Status: Accepted

Context: Provider preset、apiConfigSet 与 export package 都可能涉及密钥。若资产内容包含 apiKey，导出和分享会产生泄漏风险。

Decision: 资产只保存 credentialRef、hasCredential、redacted 等引用和状态。真实密钥只存在 secret/encrypted config store，运行时 hydration 才解析。

### ADR-004: Patch apply 必须绑定 human_review_gate 与 diff hash

Status: Accepted

Context: 现有工具权限拦截 write/edit/bash，但不能证明“被执行的 diff 就是用户审批的 diff”。

Decision: 结构化开发模式中，真正 apply 只能走 approvedPatch.apply，参数绑定 patchProposalId 与 approvedHash。diff 变化则审批失效。

---

## 6. 模块边界

### 6.1 src/main/asset-center

职责：

- 定义资产类型。
- 扫描资产来源。
- 聚合 snapshot。
- 标准化状态与 warnings。
- 提供 source adapter contract。

不负责：

- UI。
- IPC 注册。
- 数据库写入。
- 安装、运行、导出。
- 读取真实密钥。

### 6.2 src/renderer/components/settings/SettingsAssets.tsx

职责：

- 展示资源库。
- 搜索、筛选、分组。
- 显示详情、来源、warnings。
- 首版只读。

不负责：

- install。
- run。
- export。
- direct file write。

### 6.3 src/main/logic-flow

职责：

- LogicFlow JSON schema。
- validate。
- preview。
- compile to plan artifact。

不负责：

- 直接执行节点。
- 调用工具。
- 写代码。

### 6.4 src/main/planning

职责：

- feature blueprint。
- patch proposal。
- human review gate。
- rollback checkpoint。
- approved patch apply。
- apply result。
- QA result。

### 6.5 src/main/release 或 src/main/export

职责：

- export dry-run。
- manifest preview。
- checksum。
- redaction report。
- 后期 createPackage。

---

## 7. 核心数据契约

### 7.1 Asset envelope

AssetCenterItem 字段：

- id: stable id, for example domain-skill:lowcode-builder。
- kind: asset kind。
- source: built-in, project, user, plugin, session, generated。
- scope: app, workspace, session, remote。
- status: available, installed, enabled, disabled, needsSetup, requiresCredential, requiresConnector, unavailable, unknown。
- title。
- summary。
- tags。
- sourceRef。
- schemaVersion。
- updatedAt。
- contentHash。
- credentialRefs。
- policyRefs。
- lineageRefs。
- actions。
- warnings。

### 7.2 Asset actions

首版允许：

- viewDetails。
- openSource。
- preview。

后续允许：

- useInTask。
- insertPrompt。
- configure。
- testConnection。
- dryRunExport。

最终受控允许：

- install。
- enable。
- run。
- apply。
- createPackage。

### 7.3 Development artifact lineage

所有结构化开发 artifact 都必须有：

- schemaVersion。
- parentArtifactIds。
- sourceRefs。
- roleRefs。
- conceptRefs。
- sessionId。
- createdBy。
- contentSha256。
- allowedPaths。
- deniedPaths。
- reviewState。

### 7.4 Patch proposal

必须记录：

- baseCommit。
- baseDirtyHash。
- diff。
- diffSha256。
- files。
- allowedPaths。
- deniedPaths。
- secretScan。
- risk summary。

### 7.5 Human review gate

必须记录：

- patchProposalId。
- approvedDiffSha256。
- approver。
- approvedAt。
- expiresAt。
- allowedPaths。
- allowedActions。
- decision。
- reason。

### 7.6 Export manifest

必须记录：

- schemaVersion。
- packageId。
- mode: audit-source or deployable-source。
- createdAt。
- fishSwarmVersion。
- git commit, branch, dirty。
- includeRules。
- excludeRules。
- files with size and sha256。
- artifactRefs。
- warnings。
- blockers。

---

## 8. UI / UX 计划

### 8.1 页面结构

~~~text
SettingsAssets
├── Header
│   ├── Title: 资源库 / Assets
│   ├── Subtitle
│   └── Refresh snapshot
├── Search and filters
│   ├── keyword
│   ├── group
│   ├── kind
│   ├── source
│   └── status
├── Navigation groups
│   ├── 创作起点
│   ├── 能力与连接
│   └── 交付与审计
├── Asset grid/list
│   └── AssetCard
└── Asset detail drawer
    ├── metadata
    ├── source
    ├── warnings
    ├── actions
    └── provenance
~~~

### 8.2 卡片字段

每个卡片显示：

- 类型图标。
- 标题。
- 一句话摘要。
- tags。
- 来源。
- 作用域。
- 状态。
- 风险提示。
- 主动作。

### 8.3 动作矩阵

| Asset kind | 首版动作 | 后续动作 |
|---|---|---|
| concept.lowcode | viewDetails | apply concept to plan |
| skill.domain | viewDetails, openSource | install, enable |
| skill.builtIn | viewDetails | enable/disable |
| role | viewDetails | use in task |
| mcp.server | viewDetails | configure, testConnection |
| mcp.tool | viewDetails | use in workflow |
| ai.provider | viewDetails | configure, setDefault |
| component.blueprint | preview | copy blueprint, generate component draft |
| workflow.template | preview | create plan artifact |
| export.package | viewDetails | dryRunExport, createPackage |

---

## 9. 安全策略

### 9.1 Renderer 边界

Renderer 只能通过 preload 调用白名单 IPC。

首版只允许：

- assetCenter.getSnapshot。

首版禁止：

- assetCenter.install。
- assetCenter.run。
- assetCenter.export。
- assetCenter.openArbitraryPath。
- command.exec。
- network.fetch。

### 9.2 Policy actions

后续 policy 类型要覆盖：

- asset.view。
- asset.install。
- asset.enable。
- asset.run。
- asset.export。
- command.preview。
- command.exec.approved。
- network.http.fetch。
- network.websocket。
- secret.read。
- secret.write。
- secret.export。
- browser.navigate。
- browser.injectScript。
- file.openSource。
- patch.apply。
- rollback.restore。

### 9.3 Audit event fields

- eventId。
- requestId。
- subject。
- action。
- resource。
- result。
- reason。
- policyId。
- policyVersion。
- sessionId。
- assetId。
- approvalId。
- timestamp。
- contentHash。

---

# 10. 开发路线总览

## Milestone 0: 项目整理与基线保护

目标：确认当前仓库干净、创建分支、保留当前已推送版本作为回滚点。

## Milestone 1: Asset Center 只读核心

目标：实现资产类型、low-code concept map、domain-skill scanner、snapshot service。

## Milestone 2: Source Adapter 扩展

目标：skills、roles、MCP、plugins、providers、workflow artifacts 逐步接入，只读。

## Milestone 3: Resource Library UI 只读

目标：资源库页面可浏览所有资产，不提供执行类动作。

## Milestone 4: Structured Development Artifacts

目标：新增 feature_blueprint、patch_proposal、人审 gate、rollback checkpoint 等 artifact 类型和服务。

## Milestone 5: LogicFlow Preview

目标：支持 LogicFlow JSON 校验、预览、生成 plan artifact，不直接执行。

## Milestone 6: Policy and Audit Foundation

目标：定义 asset policy 与 audit model，接入 install/run/export/apply 前置判断。

## Milestone 7: Export Dry Run

目标：生成 manifest preview、checksum preview、redaction report，不创建 zip。

## Milestone 8: Controlled Actions

目标：启用 use in task、insert prompt、configure、test connection、approved patch apply。

## Milestone 9: Export Package Creation

目标：在 dry-run + human approval + policy 通过后创建 zip。

## Milestone 10: Hardening, Docs, Release

目标：全量测试、文档、演示流、回滚测试、发布说明。

---

# 11. 详细任务计划

## Milestone 0: 项目整理与基线保护

### Task 0.1: 创建开发分支

Files: 无代码文件。

Steps:

1. Run: git status --short --branch。
2. Run: git log -1 --oneline。
3. Expected latest commit: 5347de5 feat: 第二版多角色的初步实现。
4. Run: git switch -c codex/lowcode-fishswarm-comprehensive-integration。
5. Optional push with proxy: git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 push -u origin codex/lowcode-fishswarm-comprehensive-integration。

Commit: none.

### Task 0.2: 强制纳入计划文档

Files:

- Add: D:\myProject\FishSwarm\docs\plans\2026-06-24-lowcode-fishswarm-comprehensive-development-plan.md。

Steps:

1. Run: git status --short --ignored -- docs/plans/2026-06-24-lowcode-fishswarm-comprehensive-development-plan.md。
2. Expected: ignored marker may appear。
3. Run: git add -f docs/plans/2026-06-24-lowcode-fishswarm-comprehensive-development-plan.md。
4. Run: git commit -m "docs: add comprehensive lowcode fishswarm development plan"。

---

## Milestone 1: Asset Center 只读核心

### Task 1.1: 创建 Asset Center 目录结构

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\README.md。
- Create: D:\myProject\FishSwarm\src\main\asset-center\index.ts。
- Create: D:\myProject\FishSwarm\src\tests\asset-center\README.md。

Steps:

1. Create directories。
2. README states MVP responsibilities and non-goals。
3. index.ts exports future modules。
4. Run: npm run typecheck。
5. Commit: git commit -m "chore: scaffold asset center module"。

### Task 1.2: 定义 Asset Center 类型契约

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\asset-center-types.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\asset-center-types.test.ts。

Test cases:

1. AssetCenterItem can represent domain skill。
2. Actions do not include run/install in read-only MVP。
3. AssetKind includes concept, skill, role, MCP, provider, workflow, component, export package。
4. AssetSource and AssetScope compile correctly。

Commands:

1. npx vitest run src/tests/asset-center/asset-center-types.test.ts。
2. npm run typecheck。

Commit:

- git add src/main/asset-center/asset-center-types.ts src/tests/asset-center/asset-center-types.test.ts。
- git commit -m "feat: add asset center type contract"。

### Task 1.3: low-code workflow 概念映射

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\lowcode-concepts.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\lowcode-concepts.test.ts。

Test cases:

1. Covers asset-center, page-design, logic-design, process-design, data-model, interface-integration, source-export。
2. Every concept maps to concept.lowcode asset。
3. page-design decision is adapt, not adopt as runtime。
4. source-export maps to auditable export package。
5. Output order is deterministic。

Commit:

- git commit -m "feat: add lowcode concept asset mapping"。

### Task 1.4: Domain Skill 只读扫描器

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\domain-skill-asset-index.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\domain-skill-asset-index.test.ts。

Test cases:

1. root missing returns warning, not throw。
2. empty root returns empty items。
3. two skills sorted by directory name。
4. SKILL.md frontmatter name and description parsed。
5. directory without SKILL.md returns warning。
6. actions only viewDetails and openSource。
7. no install/run/configure/export actions。
8. path containment blocks escaped paths。

Commit:

- git commit -m "feat: index bundled domain skills as assets"。

### Task 1.5: Asset Center Snapshot Service

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\asset-center-service.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\asset-center-service.test.ts。

Responsibilities:

- call concept adapter。
- call domain skill adapter。
- merge warnings。
- sort by id。
- build stats。
- never throw for scanner warning。

Commands:

- npx vitest run src/tests/asset-center/*.test.ts。
- npm run typecheck。

Commit:

- git commit -m "feat: build asset center snapshot service"。

---

## Milestone 2: Source Adapter 扩展

### Task 2.1: Source Adapter Contract

Files:

- Modify: D:\myProject\FishSwarm\src\main\asset-center\asset-center-types.ts。
- Modify: D:\myProject\FishSwarm\src\main\asset-center\asset-center-service.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\asset-center-service.test.ts。

Requirements:

- buildAssetCenterSnapshot accepts adapters。
- adapter exceptions convert to warnings。
- duplicate IDs produce warning。
- deterministic merge。

Commit: git commit -m "feat: add asset source adapter contract"。

### Task 2.2: Built-in Skills Adapter

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\built-in-skill-asset-index.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\built-in-skill-asset-index.test.ts。

Rules:

- Read existing skill metadata safely。
- Do not mutate enabled state。
- Do not install skills。
- Do not write DB。

Commit: git commit -m "feat: index built-in skills as assets"。

### Task 2.3: Role Adapter

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\role-asset-index.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\role-asset-index.test.ts。

Rules:

- Read built-in role metadata。
- No role runtime sessions created。
- Localized names optional in first pass。
- Missing locale does not fail。

Commit: git commit -m "feat: index roles as assets"。

### Task 2.4: MCP Adapter

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\mcp-asset-index.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\mcp-asset-index.test.ts。

Rules:

- server assets and tool assets separate。
- requiresEnv maps to requiresCredential or warning。
- no env value included。
- server/tool relation via lineageRefs。

Commit: git commit -m "feat: index mcp connectors as assets"。

### Task 2.5: Model Provider Adapter

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\provider-asset-index.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\provider-asset-index.test.ts。

Rules:

- Read existing API provider presets and provider guidance。
- Map provider, modelPreset, providerSetup。
- Never include apiKey。
- Output JSON string must not contain apiKey, sk-, AIza, Bearer。

Commit: git commit -m "feat: index model providers as assets"。

### Task 2.6: Plugin Adapter

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\plugin-asset-index.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\plugin-asset-index.test.ts。

Rules:

- installed plugin vs marketplace candidate distinguishable。
- component counts optional。
- source/runtime paths normalized。
- no code execution。

Commit: git commit -m "feat: index plugins as assets"。

### Task 2.7: Workflow Artifact Adapter

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\workflow-artifact-asset-index.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\workflow-artifact-asset-index.test.ts。

Rules:

- existing workflow artifacts become workflow.artifact。
- cwd/path should be redacted or relative where possible。
- stale/missing artifact does not crash indexing。

Commit: git commit -m "feat: index workflow artifacts as assets"。

---

## Milestone 3: Resource Library UI 只读

### Task 3.1: Read-only IPC Contract

Files:

- Modify: D:\myProject\FishSwarm\src\shared\ipc-types.ts。
- Modify: D:\myProject\FishSwarm\src\main\index.ts。
- Modify: D:\myProject\FishSwarm\src\preload\index.ts。
- Modify: D:\myProject\FishSwarm\src\renderer\hooks\useIPC.ts。

API:

- assetCenter.getSnapshot returns AssetCenterSnapshot。

Forbidden:

- install。
- run。
- export。
- arbitrary path open。
- command exec。

Commit: git commit -m "feat: expose read-only asset center ipc"。

### Task 3.2: Asset UI DTO and grouping

Files:

- Create: D:\myProject\FishSwarm\src\renderer\types\asset-center.ts。
- Create: D:\myProject\FishSwarm\src\renderer\utils\asset-center-view-model.ts。
- Test: D:\myProject\FishSwarm\src\tests\renderer\asset-center-view-model.test.ts。

Groups:

- 创作起点。
- 能力与连接。
- 交付与审计。

Commit: git commit -m "feat: add asset center view model"。

### Task 3.3: Preset UI Components

Files:

- Create: D:\myProject\FishSwarm\src\renderer\components\presets\AssetStatusPill.tsx。
- Create: D:\myProject\FishSwarm\src\renderer\components\presets\SectionCard.tsx。
- Create: D:\myProject\FishSwarm\src\renderer\components\presets\EmptyState.tsx。
- Create: D:\myProject\FishSwarm\src\renderer\components\presets\AssetCard.tsx。

Rules:

- pure presentational。
- no IPC inside components。
- use existing Tailwind/CSS tokens。

Commit: git commit -m "feat: add reusable asset library UI presets"。

### Task 3.4: SettingsAssets Page

Files:

- Create: D:\myProject\FishSwarm\src\renderer\components\settings\SettingsAssets.tsx。
- Modify settings tab registration file after locating exact structure。
- Modify: D:\myProject\FishSwarm\src\renderer\i18n\locales\zh.json。
- Modify: D:\myProject\FishSwarm\src\renderer\i18n\locales\en.json。

Features:

- loading state。
- error state。
- empty state。
- search。
- group filter。
- kind filter。
- asset cards。
- detail drawer/panel。

Forbidden:

- install。
- enable。
- run。
- export。

Commit: git commit -m "feat: add read-only assets settings page"。

---

## Milestone 4: Structured Development Artifacts

### Task 4.1: Extend WorkflowArtifactKind

Files:

- Modify: D:\myProject\FishSwarm\src\main\workflows\workflow-artifact-store.ts。
- Modify: D:\myProject\FishSwarm\src\shared\ipc-types.ts。

Add kinds:

- feature_blueprint。
- data_model_draft。
- component_tree_draft。
- logic_flow_draft。
- api_contract_draft。
- implementation_plan_dsl。
- patch_proposal。
- diff_review。
- human_review_gate。
- apply_result。
- qa_result。
- rollback_checkpoint。
- concept_application_map。

Commit: git commit -m "feat: add structured development artifact kinds"。

### Task 4.2: Artifact Lineage Schema

Files:

- Create: D:\myProject\FishSwarm\src\shared\development-artifact-types.ts。
- Test: D:\myProject\FishSwarm\src\tests\workflows\development-artifact-types.test.ts。

Types:

- ArtifactLineage。
- FeatureBlueprintArtifact。
- DataModelDraftArtifact。
- ComponentTreeDraftArtifact。
- LogicFlowDraftArtifact。
- PatchProposalArtifact。
- HumanReviewGateArtifact。
- ApplyResultArtifact。
- QaResultArtifact。
- RollbackCheckpointArtifact。

Commit: git commit -m "feat: define structured development artifact schemas"。

### Task 4.3: Patch Proposal Service

Files:

- Create: D:\myProject\FishSwarm\src\main\planning\patch-proposal-service.ts。
- Test: D:\myProject\FishSwarm\src\tests\planning\patch-proposal-service.test.ts。

Responsibilities:

- accept diff text。
- compute sha256。
- extract file paths。
- validate allowed/denied paths。
- run token-like secret scan。
- save workflow artifact。

Commit: git commit -m "feat: add patch proposal service"。

### Task 4.4: Human Review Gate Service

Files:

- Create: D:\myProject\FishSwarm\src\main\planning\human-review-gate-service.ts。
- Test: D:\myProject\FishSwarm\src\tests\planning\human-review-gate-service.test.ts。

Responsibilities:

- approve or reject exact patch proposal。
- bind approval to patchProposalId and diffSha256。
- support expiry。
- invalidate if diff changed。

Commit: git commit -m "feat: bind human review gates to patch hashes"。

### Task 4.5: Rollback Checkpoint Service

Files:

- Create: D:\myProject\FishSwarm\src\main\planning\rollback-checkpoint-service.ts。
- Test: D:\myProject\FishSwarm\src\tests\planning\rollback-checkpoint-service.test.ts。

Must capture before apply:

- base HEAD。
- dirty diff。
- untracked manifest。
- target file hashes。
- reverse patch or backup ref。

Commit: git commit -m "feat: create pre-apply rollback checkpoints"。

### Task 4.6: Approved Patch Apply Service

Files:

- Create: D:\myProject\FishSwarm\src\main\planning\approved-patch-apply-service.ts。
- Test: D:\myProject\FishSwarm\src\tests\planning\approved-patch-apply-service.test.ts。

Rules:

- only apply if human gate approved。
- check approved diff hash。
- create rollback checkpoint first。
- run dry-run apply check。
- write apply_result artifact。
- no direct renderer access。

Commit: git commit -m "feat: apply only approved patch proposals"。

---

## Milestone 5: LogicFlow Preview

### Task 5.1: LogicFlow Types

Files:

- Create: D:\myProject\FishSwarm\src\shared\logic-flow-types.ts。
- Test: D:\myProject\FishSwarm\src\tests\logic-flow\logic-flow-types.test.ts。

Types:

- LogicFlowDocument。
- LogicFlowNode。
- LogicFlowEdge。
- LogicFlowDiagnostic。
- LogicFlowPreview。

Commit: git commit -m "feat: define logic flow document types"。

### Task 5.2: LogicFlow Validator

Files:

- Create: D:\myProject\FishSwarm\src\main\logic-flow\logic-flow-schema.ts。
- Test: D:\myProject\FishSwarm\src\tests\logic-flow\logic-flow-schema.test.ts。

Validate:

- version present。
- nodes unique。
- edges reference existing nodes。
- no cycles if template disallows cycles。
- role refs valid format。
- allowed/denied paths valid format。

Commit: git commit -m "feat: validate logic flow drafts"。

### Task 5.3: LogicFlow Compiler

Files:

- Create: D:\myProject\FishSwarm\src\main\logic-flow\logic-flow-compiler.ts。
- Test: D:\myProject\FishSwarm\src\tests\logic-flow\logic-flow-compiler.test.ts。

Allowed methods:

- listBuiltins。
- validateLogicFlow。
- previewLogicFlow。
- createPlanArtifactFromLogicFlow。

Forbidden methods:

- runLogicFlow。
- executeLogicFlow。

Commit: git commit -m "feat: compile logic flows into plan artifacts"。

---

## Milestone 6: Policy and Audit Foundation

### Task 6.1: Policy Model

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\asset-policy-types.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\asset-policy-types.test.ts。

Actions:

- asset.view。
- asset.install。
- asset.enable。
- asset.run。
- asset.export。
- command.preview。
- command.exec.approved。
- network.http.fetch。
- network.websocket。
- secret.read。
- secret.write。
- secret.export。
- browser.navigate。
- browser.injectScript。
- file.openSource。
- patch.apply。
- rollback.restore。

Commit: git commit -m "feat: define asset policy actions"。

### Task 6.2: Audit Model

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\asset-audit-types.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\asset-audit-types.test.ts。

Fields:

- eventId。
- requestId。
- subject。
- action。
- resource。
- result。
- reason。
- policyId。
- policyVersion。
- sessionId。
- assetId。
- approvalId。
- timestamp。
- contentHash。

Commit: git commit -m "feat: define asset audit event model"。

### Task 6.3: Policy Decision Stub

Files:

- Create: D:\myProject\FishSwarm\src\main\asset-center\asset-policy-service.ts。
- Test: D:\myProject\FishSwarm\src\tests\asset-center\asset-policy-service.test.ts。

MVP behavior:

- allow asset.view。
- deny secret.export。
- prompt required for install/run/export/apply。
- return structured decision, not boolean。

Commit: git commit -m "feat: add asset policy decision service"。

---

## Milestone 7: Export Dry Run

### Task 7.1: Export Types

Files:

- Create: D:\myProject\FishSwarm\src\main\release\asset-export-types.ts。
- Test: D:\myProject\FishSwarm\src\tests\release\asset-export-types.test.ts。

Types:

- ExportPackageManifest。
- ExportDryRunInput。
- ExportDryRunResult。
- ExportFileCandidate。
- ExportBlocker。
- RedactionFinding。

Commit: git commit -m "feat: define asset export manifest types"。

### Task 7.2: Export Denylist and Redaction Rules

Files:

- Create: D:\myProject\FishSwarm\src\main\release\asset-export-rules.ts。
- Test: D:\myProject\FishSwarm\src\tests\release\asset-export-rules.test.ts。

Denylist:

- .env。
- .git。
- node_modules。
- dist。
- dist-electron。
- release。
- pem/key files。
- cookies。
- auth/token stores。
- SQLite user data。

Commit: git commit -m "feat: add asset export denylist rules"。

### Task 7.3: Export Dry-run Service

Files:

- Create: D:\myProject\FishSwarm\src\main\release\asset-export-dry-run.ts。
- Test: D:\myProject\FishSwarm\src\tests\release\asset-export-dry-run.test.ts。

Rules:

- no zip creation。
- path containment。
- symlink escape blocked。
- denylist before include。
- final candidate list sorted。
- manifest preview generated。

Commit: git commit -m "feat: add asset export dry run service"。

---

## Milestone 8: Controlled Actions

### Task 8.1: Use in Task Action

Files:

- Modify: D:\myProject\FishSwarm\src\renderer\components\settings\SettingsAssets.tsx。
- Modify relevant composer/store file after locating current prompt composer flow。
- Test focused renderer/store test。

Behavior:

- for template/workflow/role assets。
- inserts structured prompt reference。
- no automatic execution。

Commit: git commit -m "feat: use selected assets in new tasks"。

### Task 8.2: Configure Provider Action

Rules:

- asset passes providerId/setupId。
- UI opens existing provider settings。
- no key in asset payload。

Commit: git commit -m "feat: configure provider assets through existing settings"。

### Task 8.3: Approved Patch Apply UI

Files:

- Create: D:\myProject\FishSwarm\src\renderer\components\planning\PatchReviewPanel.tsx。
- Create: D:\myProject\FishSwarm\src\renderer\components\planning\RollbackCheckpointCard.tsx。

Behavior:

- show patch files。
- show diff hash。
- show secret scan result。
- approve/reject。
- apply only after approval。

Commit: git commit -m "feat: add patch review and approval UI"。

---

## Milestone 9: Export Package Creation

### Task 9.1: Create Package From Dry-run Snapshot

Files:

- Create: D:\myProject\FishSwarm\src\main\release\asset-export-package.ts。
- Test: D:\myProject\FishSwarm\src\tests\release\asset-export-package.test.ts。

Rules:

- requires dry-run snapshot hash or re-runs dry-run。
- checks blockers again。
- writes final bytes to staging。
- computes sha256 on final bytes。
- uses Node APIs, no shell zip。
- no path traversal entries。

Commit: git commit -m "feat: create auditable asset export packages"。

### Task 9.2: Export UI

Files:

- Create: D:\myProject\FishSwarm\src\renderer\components\release\AssetExportDryRunPanel.tsx。
- Create: D:\myProject\FishSwarm\src\renderer\components\release\AssetExportResultPanel.tsx。
- Modify SettingsAssets action matrix。

Behavior:

- run dry-run。
- show blockers。
- show warnings。
- show redaction report。
- create package only if no blockers and approved。

Commit: git commit -m "feat: add asset export workflow UI"。

---

## Milestone 10: Hardening and Release

### Task 10.1: Full Security Regression Tests

Files:

- Create or extend security tests under D:\myProject\FishSwarm\src\tests\security。

Must assert:

- no renderer command bridge。
- no generic fetch bridge。
- no new webviewTag enablement。
- no certificate error bypass。
- no asset export of .env。
- no provider API key in asset snapshot。

Commit: git commit -m "test: add lowcode integration security regressions"。

### Task 10.2: Documentation

Files:

- Create: D:\myProject\FishSwarm\docs\assets\asset-center.md。
- Create: D:\myProject\FishSwarm\docs\assets\structured-artifacts.md。
- Create: D:\myProject\FishSwarm\docs\assets\export-package.md。

Docs must cover:

- user-facing resource library。
- developer adapter contract。
- security model。
- export package format。
- known limitations。

Commit: git commit -m "docs: document asset center integration"。

### Task 10.3: Final Validation and Release Note

Commands:

- npx vitest run src/tests/asset-center/*.test.ts。
- npx vitest run src/tests/logic-flow/*.test.ts。
- npx vitest run src/tests/planning/*.test.ts。
- npx vitest run src/tests/release/*.test.ts。
- npm run typecheck。

Files:

- Create: D:\myProject\FishSwarm\docs\release-notes\lowcode-assets-integration.md。

Commit: git commit -m "docs: add lowcode assets integration release notes"。

---

## 12. 测试矩阵

| Area | Unit | Integration | Security | UI |
|---|---|---|---|---|
| Asset types | yes | no | no | no |
| low-code concepts | yes | snapshot | no | display |
| Domain skills | yes | snapshot | path containment | card |
| Provider assets | yes | config compatibility | no secrets | settings link |
| MCP assets | yes | mcp config | no env values | card |
| Roles | yes | runtime no-op | no side effects | card |
| Workflow artifacts | yes | artifact store | redaction | detail |
| LogicFlow | yes | create artifact | no execute | preview |
| Patch proposal | yes | artifact store | secret scan | review |
| Human gate | yes | apply service | approval hash | approval UI |
| Rollback | yes | temp repo | path safety | checkpoint card |
| Export dry-run | yes | temp workspace | denylist | dry-run panel |
| Export package | yes | staging zip | no traversal | result panel |

---

## 13. 验收标准

### MVP 验收

- Asset Center core tests pass。
- Snapshot includes low-code concepts and bundled domain skills。
- Snapshot contains no API key/token/private key。
- No UI/IPC touched in Milestone 1。
- Typecheck passes。

### Read-only UI 验收

- 资源库页面可打开。
- 可以搜索、筛选、查看详情。
- 不存在 install/run/export 按钮。
- 错误 adapter 不导致页面崩溃。

### Structured Artifact 验收

- patch proposal 有 diff hash。
- human review gate 绑定 exact diff hash。
- diff 改变后审批失效。
- apply 前创建 rollback checkpoint。

### Export 验收

- dry-run 无副作用。
- .env 被 blocker 拦截。
- symlink escape 被拦截。
- manifest 文件列表按确定顺序。
- createPackage 只基于通过 dry-run 的内容。

---

## 14. 风险与缓解

| Risk | Impact | Mitigation |
|---|---|---|
| Asset Center 变成新 source of truth | 数据重复、迁移风险 | 前三阶段只读聚合 |
| UI 过早接 install/run | 安全风险 | 动作矩阵分阶段开放 |
| Provider asset 泄露 key | 严重安全事故 | credentialRef + secret scan |
| LogicFlow 绕过 agent-runner | 权限绕过 | 禁止 run/execute |
| Export 导出隐私数据 | 严重安全事故 | denylist + redaction + dry-run + human gate |
| 当前脏工作树冲突 | 开发阻塞 | 独立分支、小提交、分阶段 |
| 类型变更影响现有 IPC | 编译失败 | UI/IPC 推迟到 Milestone 3 |
| 大量 domain-skills 降低性能 | UI 卡顿 | snapshot cache 后续可加 |

---

## 15. 回滚策略

Per-task rollback:

- 每个 task 单独 commit。
- 使用 git revert commitHash 回滚单个任务。

Milestone rollback:

- 每个 milestone 完成后打 tag，例如 lowcode-assets-m1。
- 已推送共享分支优先使用 revert，不用 reset。

Runtime rollback:

- assetCenter.enabled。
- assetCenter.ui.enabled。
- structuredArtifacts.enabled。
- logicFlowPreview.enabled。
- assetExport.enabled。

---

## 16. 发布策略

Alpha:

- Asset Center core。
- low-code concept assets。
- domain-skill assets。
- read-only snapshot tests。

Beta:

- read-only UI。
- provider/role/MCP/plugin adapters。
- search/filter/detail。

RC:

- structured artifact schemas。
- patch proposal。
- human review gate。
- rollback checkpoint。
- LogicFlow preview。

Stable:

- policy/audit。
- export dry-run。
- approved patch apply。
- export package creation。
- docs。

---

## 17. Definition of Done

- 所有新增模块有单元测试。
- 所有安全边界有回归测试。
- Asset snapshot 不包含密钥。
- Renderer 没有新增 shell/fetch 泛桥接。
- LogicFlow 无直接执行入口。
- Patch apply 绑定 approval + hash。
- Apply 前生成 rollback checkpoint。
- Export dry-run 拦截敏感文件。
- Export package manifest/checksum 稳定。
- UI 文案中“业务数据模型”与“AI 模型提供商”不混淆。
- 文档覆盖开发者与用户视角。
- 每个 milestone 可单独回滚。

---

## 18. 推荐立即执行顺序

1. 创建开发分支。
2. 强制提交本计划文档。
3. 执行 Milestone 1 的 5 个任务。
4. 运行 npx vitest run src/tests/asset-center/*.test.ts。
5. 运行 npm run typecheck。
6. 推送分支。
7. 再决定是否进入 Milestone 2。

---

## 19. 执行选项

Option A: Subagent-Driven。

- 本会话继续。
- 每个 task 派发独立子智能体实现。
- 我做 review 和集成。
- 推荐先用这个方式完成 Milestone 1。

Option B: Parallel Session。

- 开新会话。
- 使用 executing-plans。
- 按本文档 task-by-task 执行。
- 适合长周期。

推荐：先用 Option A 完成 Milestone 1，再决定是否切到 Option B。
