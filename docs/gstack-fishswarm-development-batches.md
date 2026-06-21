# GStack FishSwarm Development Batches

本文件把 `docs/gstack-fishswarm-integration-audit.md` 中的迁移建议拆成四批开发执行线。原则是先补 FishSwarm 已有底座最容易承接的连接层，再进入更重的角色编排、发布门禁和外围工程闭环。

## Batch 1: Knowledge Governance And Safety Foundation

目标：先把已有的 timeline、learnings、guard、decision store 变成可治理底座。

- Project learning governance: search、stats、markdown export、maintenance report、safe prune。
- Guard/freeze/careful productization: warn/block mode、GuardDecision artifact、renderer status。
- Decision audit baseline: 让后续 autoplan/review/ship 能引用 durable decision。

首个开发切片：

- 新增 `src/main/observability/project-learning-service.ts`。
- 扩展 `ProjectLearning` 支持 `files`、`tags`、`supersedesLearningId`。
- 新增 `learnings.search`、`learnings.stats`、`learnings.maintenanceReport`、`learnings.exportMarkdown`、`learnings.prune` IPC。
- 补充 observability 单测。

项目级验证阻塞项：

- `better-sqlite3.node` 当前在 Windows 上被进程锁住，导致 `npm test -- --run src/tests/observability/observability-services.test.ts` 卡在 native rebuild，尚未进入 Vitest 测试阶段。影响：会阻塞依赖 rebuild 的本地测试、打包或 CI 路径。建议处理：关闭占用 Electron/Node/测试进程后重跑 `npm test`。
- `src/main/db/*` 存在既有 TypeScript 错误，导致 `npx tsc --noEmit` 不能全量通过。影响：会阻塞项目级类型全绿和正式 build。建议处理：单独开一轮修复 db 类型导出、unused import、`Database` type namespace、Promise 返回类型等问题。

## Batch 2: Spec, Investigation, And Code Health

目标：把开工前规格化、根因调查和代码健康状态接入 workflow/artifact/timeline。

- Backlog-ready spec workflow。
- Root-cause investigation workflow。
- Code quality health dashboard 与 health history。
- Document release coverage matrix。

首个开发切片：

- 新增 `src/main/workflows/workflow-artifact-store.ts`，把 workflow artifact 统一存入 workspace timeline 目录，并写入 `workflow` timeline event。
- 新增 `src/main/planning/spec-workflow.ts`，支持 backlog-ready spec artifact、readiness score、redaction 状态、ready spec durable decision。
- 新增 `src/main/debug/investigation-workflow.ts`，支持 investigation artifact、三假设阻断规则、root cause learning 沉淀。
- 新增 `src/main/observability/code-health-service.ts`，支持只读 code health 快照、脚本发现、建议命令和 health artifact。
- 新增 `src/main/documentation/document-release-service.ts`，支持文档覆盖矩阵、required docs 缺口和 document release artifact。
- 新增 IPC：`workflowArtifacts.list`、`spec.createArtifact`、`investigation.createArtifact`、`codeHealth.snapshot`、`documentRelease.coverage`。
- 补充 `src/tests/workflows/workflow-artifacts.test.ts`。

验证状态：

- `npx vitest run src/tests/workflows/workflow-artifacts.test.ts --reporter=verbose --pool=forks` 通过，4 个测试全绿。
- `npx vitest run src/tests/workflows/workflow-artifacts.test.ts src/tests/observability/observability-services.test.ts --pool=forks` 通过，9 个测试全绿。
- 针对第二批改动文件的 `npx eslint ...` 通过。
- `npx tsc --noEmit --pretty false` 仍被既有 `src/main/db/*` TypeScript 错误阻塞；过滤新增文件没有命中错误。

## Batch 3: Role Review And Release Gates

目标：把多角色意见收口成可复查、可阻断的发布控制。

- Autoplan sequential phase gate。
- Review / CSO / adversarial review gate。
- Implementation tasks aggregator。
- Release summary / PR body renderer。
- Ship gate 与 fresh verification。

首个开发切片：

- 扩展 workflow artifact kind：`review_gate`、`implementation_tasks`、`release_summary`、`ship_gate`。
- 新增 `src/main/shipping/release-gate-service.ts`，支持角色评审门禁、implementation task 聚合、release summary / PR body markdown、ship gate freshness 检查。
- 新增 IPC：`reviewGate.createArtifact`、`implementationTasks.aggregate`、`releaseSummary.createArtifact`、`shipGate.evaluate`。
- 补充 `src/tests/workflows/release-gates.test.ts`。

验证状态：

- `npx vitest run src/tests/workflows/release-gates.test.ts src/tests/workflows/workflow-artifacts.test.ts src/tests/observability/observability-services.test.ts --pool=forks` 通过，12 个测试全绿。
- 针对第三批改动文件的 `npx eslint ...` 通过。
- `npx tsc --noEmit --pretty false` 仍被既有 `src/main/db/*` TypeScript 错误阻塞；过滤第三批新增/改动文件没有命中错误。

## Batch 4: Visual QA, Browser Workflows, And Advanced Automation

目标：补齐更重的视觉证据、浏览器技能化、DX/benchmark/outside model 等增强链路。

- Browser QA fix loop、design review、canary monitor。
- Browser skillify from successful scrape/run。
- DevEx live audit and TTHW scorecard。
- Benchmark and model comparison。
- Visible browser / cookie import privacy UX。

首个开发切片：

- 扩展 workflow artifact kind：`visual_qa`、`canary_monitor`、`browser_skill_evidence`、`devex_audit`、`benchmark_run`、`browser_auth_import`。
- 新增 `src/main/advanced-qa/advanced-qa-service.ts`，支持视觉 QA 证据、canary monitor、browser skill evidence、DevEx audit、benchmark run、cookie import 隐私摘要。
- 新增 IPC：`visualQa.createArtifact`、`canaryMonitor.createArtifact`、`browserSkillEvidence.createArtifact`、`devexAudit.createArtifact`、`benchmarkRun.createArtifact`、`browserAuthImport.createSummary`。
- 补充 `src/tests/workflows/advanced-qa.test.ts`。

验证状态：

- `npx vitest run src/tests/workflows/advanced-qa.test.ts src/tests/workflows/release-gates.test.ts src/tests/workflows/workflow-artifacts.test.ts src/tests/observability/observability-services.test.ts --pool=forks` 通过，15 个测试全绿。
- 针对第四批改动文件的 `npx eslint ...` 通过。
- `npx tsc --noEmit --pretty false` 仍被既有 `src/main/db/*` TypeScript 错误阻塞；过滤第四批新增/改动文件没有命中错误。
- 沙箱内直接运行 Vitest/Prettier 曾因 Vite 写 `node_modules/.vite-temp` 或源码写回权限遇到 `EPERM`，已通过提升权限复跑并验证通过。
