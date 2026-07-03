# Structured Development Artifacts

本文档说明 low-code workflow × FishSwarm 融合后的结构化开发交付物：它们如何记录来源、如何进入人工审查、如何应用 patch、如何创建 rollback checkpoint，以及为什么 LogicFlow 只能预览/编译不能直接运行。

## 1. 目标定位

结构化开发交付物的目标是把“Agent 直接改代码”的过程拆成可审计阶段：

```text
Asset reference
-> structured draft artifact
-> LogicFlow preview / plan artifact
-> Patch proposal
-> Human review gate
-> Approved apply
-> Rollback checkpoint
-> QA result
-> Release / export
```

这符合综合计划的核心原则：Agent 先生成结构化方案和 diff proposal；真正写入和执行必须经过 main process、policy、人工 gate 和审计记录。

## 2. Artifact kind

结构化 artifact kind 定义在：

- `src/shared/development-artifact-types.ts`
- `src/shared/ipc-types.ts` 的 `WorkflowArtifactKind`

当前结构化 kind：

- `feature_blueprint`
- `data_model_draft`
- `component_tree_draft`
- `logic_flow_draft`
- `api_contract_draft`
- `implementation_plan_dsl`
- `patch_proposal`
- `diff_review`
- `human_review_gate`
- `apply_result`
- `qa_result`
- `rollback_checkpoint`
- `concept_application_map`

通用 envelope 来自 workflow artifact store：

```ts
interface WorkflowArtifactEnvelope<T = unknown> {
  id: string;
  kind: WorkflowArtifactKind;
  ts: string;
  workspaceKey: string;
  cwd?: string;
  title: string;
  status: WorkflowArtifactStatus;
  artifact: T;
}
```

## 3. Lineage contract

每个结构化开发 artifact 都应携带 lineage：

```ts
interface ArtifactLineage {
  schemaVersion: 1;
  parentArtifactIds: string[];
  sourceRefs: ArtifactSourceRef[];
  roleRefs: string[];
  conceptRefs: string[];
  sessionId?: string;
  createdBy: 'user' | 'agent' | 'system' | string;
  createdAt: string;
  contentSha256: string;
  allowedPaths: string[];
  deniedPaths: string[];
  reviewState: ArtifactReviewState;
}
```

Lineage 用于回答：

- 这个交付物由哪个 role / session / asset 产生？
- 它是否从 low-code concept 或 LogicFlow 模板派生？
- 它允许影响哪些路径？拒绝哪些路径？
- 内容 hash 是什么？后续审批是否仍绑定同一份内容？

## 4. Patch proposal

服务：

- `src/main/planning/patch-proposal-service.ts`

职责：

1. 接收 unified diff。
2. 计算 `diffSha256`。
3. 从 diff 中提取文件路径。
4. 校验 `allowedPaths` / `deniedPaths`。
5. 扫描 secret-like 内容。
6. 保存 `patch_proposal` workflow artifact。

关键安全规则：

- diff 不能为空。
- `baseCommit` 必填。
- diff path 不允许绝对路径、盘符路径、空路径、`..` escape。
- 命中 denied path 直接拒绝创建 proposal。
- 命中 blocker 级 secret scan 时 artifact 状态为 `blocked`，不能审批。

Secret scan 覆盖：

- private key
- OpenAI-style `sk-*`
- Google `AIza*`
- GitHub token
- Slack token
- Bearer token
- credential-like assignment warning

## 5. Human review gate

服务：

- `src/main/planning/human-review-gate-service.ts`

职责：

1. 读取指定 `patch_proposal`。
2. 审批或拒绝。
3. 审批绑定 `patchProposalId` 与 `diffSha256`。
4. 支持过期时间。
5. 如果 proposal secret scan 为 blocked，则禁止审批。

验证函数：

```ts
validateHumanReviewGateForPatch({ gate, proposal, patchProposalId, now })
```

只有以下条件全部成立，gate 才有效：

- `decision === 'approved'`
- gate 绑定的 `patchProposalId` 与当前 proposal 一致
- `approvedDiffSha256 === proposal.diffSha256`
- `expiresAt` 未过期

这保证“被 apply 的 diff 就是用户批准的 diff”。

## 6. Rollback checkpoint

服务：

- `src/main/planning/rollback-checkpoint-service.ts`

职责：

1. 在 apply 前记录当前 git HEAD。
2. 记录 dirty diff hash。
3. 记录 untracked file manifest。
4. 记录目标文件 hash。
5. 将 checkpoint 文件写入 workspace timeline 下的 rollback checkpoint 目录。
6. 保存 `rollback_checkpoint` artifact。

安全规则：

- `cwd` 必须存在且是目录。
- `targetFiles` 必须非空。
- target path 不允许绝对路径、盘符路径或 `..` escape。
- resolved path 必须在 workspace root 内。
- checkpoint 默认 denied paths 包含 `.env`、`.git/**`、`node_modules/**`。

## 7. Approved patch apply

服务：

- `src/main/planning/approved-patch-apply-service.ts`

职责：

1. 读取 patch proposal。
2. 读取 human review gate。
3. 校验 gate 有效且 hash 匹配。
4. apply 前创建 rollback checkpoint。
5. 先执行 dry-run apply check。
6. apply 成功或失败都写入 `apply_result` artifact。

使用约束：

- Renderer 不直接调用 `git apply`。
- 没有有效 human gate 不能 apply。
- diff 修改后旧审批失效。
- apply 前必须有 rollback checkpoint。

## 8. LogicFlow preview

相关文件：

- `src/shared/logic-flow-types.ts`
- `src/main/logic-flow/logic-flow-schema.ts`
- `src/main/logic-flow/logic-flow-compiler.ts`
- `src/main/asset-center/logic-flow-template-asset-index.ts`

原则来自 `ADR-002`：LogicFlow 只做 validate / preview / compile to plan artifact，不直接执行。

允许：

- list built-ins
- validate LogicFlow document
- preview LogicFlow document
- create plan artifact from LogicFlow

禁止：

- `runLogicFlow`
- `executeLogicFlow`
- 通过 LogicFlow 直接调工具、写文件或调用 shell

LogicFlow draft artifact 中 `executable: false` 是刻意设计，用于防止把可视流程误认为运行时执行图。

## 9. UI

Patch review UI：

- `src/renderer/components/planning/PatchReviewPanel.tsx`
- `src/renderer/components/planning/RollbackCheckpointCard.tsx`
- `src/renderer/utils/patch-review-view-model.ts`

UI 展示：

- patch files
- diff hash short value
- secret scan status
- gate status
- approve/reject action
- apply eligibility
- rollback checkpoint summary

Apply eligibility 由 view model 计算，只在 gate hash 匹配、未过期、secret scan 通过时允许进入 apply。

## 10. 测试矩阵

主要测试：

- `src/tests/workflows/development-artifact-types.test.ts`
- `src/tests/planning/patch-proposal-service.test.ts`
- `src/tests/planning/human-review-gate-service.test.ts`
- `src/tests/planning/rollback-checkpoint-service.test.ts`
- `src/tests/planning/approved-patch-apply-service.test.ts`
- `src/tests/logic-flow/logic-flow-types.test.ts`
- `src/tests/logic-flow/logic-flow-schema.test.ts`
- `src/tests/logic-flow/logic-flow-compiler.test.ts`
- `src/tests/renderer/patch-review-view-model.test.ts`

推荐验证：

```powershell
npx vitest run src/tests/workflows src/tests/planning src/tests/logic-flow src/tests/renderer/patch-review-view-model.test.ts
npm run typecheck
```

## 11. 已知限制

- 当前 artifact store 仍是 workflow artifact 文件存储，不是专门的结构化 artifact 数据库。
- Human review gate 默认 approver 是字符串标识，后续可接入更正式的用户身份。
- Apply service 基于本地 git / patch 语义，未来需要更完整的 UI 权限确认和审计 timeline。
- Rollback checkpoint 当前记录恢复所需证据；完整一键 restore 仍应继续通过 policy 和人工确认。
- LogicFlow preview 不等于工作流运行时，真正执行仍应走现有 agent runner / workflow runner 安全边界。
