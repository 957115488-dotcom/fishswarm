# FishSwarm Role Orchestrator Runtime

最后更新：2026-06-21

## Role Gap Recovery + Candidate Role Incubation

当 FishSwarm 判断用户输入是需要执行的任务时，角色运行时不会只看“有没有路由到任意角色”，而是会进一步评估当前路由角色是否真的具备任务所需能力。

如果现有角色不足以胜任任务，运行时会进入角色缺口恢复流程：

1. 记录 `gap_detected` 生命周期事件，说明缺失的能力与已尝试角色。
2. 记录 `incubating_role` 生命周期事件，开始生成候选角色。
3. 通过受控研究/本地综合生成结构化 `RoleDefinition`。
4. 在任何候选角色手册挂载前，使用同一套角色定义校验器检查 schema、敏感信息、prompt injection 风险。
5. 低风险候选角色可以临时上线一次，状态会记录为 `candidate_ready`，正式执行时 metadata 会包含 `temporaryRole: true` 和 `candidateId`。
6. 中高风险候选角色不会自动上线，状态会记录为 `approval_required`，需要在 `设置 -> 角色管理 -> 候选角色` 中查看、编辑、保存或拒绝。
7. 被安全规则阻断的候选角色会记录为 `candidate_blocked`，不会挂载角色手册，也不会执行。

运行时现在返回 `RoleRuntimeExecutionResult`，其中包含：

- `results`：真实执行过的角色结果。
- `gap`：如果存在，记录本轮能力缺口。
- `assessment`：现有角色胜任度评分。
- `candidate`：候选角色记录。
- `incubationStatus`：`not_needed`、`candidate_used_once`、`approval_required`、`candidate_blocked` 等编排状态。
- `userVisibleSummary`：给主 AI 和聊天可见摘要使用的简短说明。

候选角色默认存放在独立的 `role-candidates.json`，不会污染正式角色库。只有用户明确保存后，才会通过 `saveRoleOverride` 写入正式角色注册表，并在后续任务中自动参与路由。

### Safety Rules

- 外部研究内容一律视为不可信数据。
- 搜索/研究查询只使用能力短语，不使用完整用户原句。
- 候选角色手册不得保存密钥、token、完整网页原文或未净化外部文本。
- 角色输出仍然只是建议，不能绕过工具权限、远程控制权限、Decision Store 用户确认、QA/验收或安全阻断。

### Manual Verification

1. 启动 FishSwarm，打开一个没有自定义数据库迁移角色的工作区。
2. 输入：`帮我写 API 文档规范和手册结构`。
3. 确认聊天中出现 `角色协作` 摘要，说明临时候选角色已上线处理。
4. 打开右侧 `角色协作`，确认出现 `发现缺口`、`孵化角色`、`候选可用`、候选角色上线/返回等生命周期。
5. 打开 `设置 -> 角色管理 -> 候选角色`，确认候选角色存在，能看到风险等级、缺失能力、来源摘要。
6. 点击 `查看/编辑`，确认候选角色加载进角色手册编辑器。
7. 点击 `保存为正式角色`，确认候选角色进入正式角色注册表。
8. 再次输入类似任务，确认 FishSwarm 直接使用已保存角色，而不是重复创建候选。
9. 输入：`帮我设计生产数据库迁移和回滚方案`。
10. 确认高风险候选角色不会自动执行，而是在角色协作中显示 `等待确认`，并出现在候选角色队列里。

## 这个功能是什么

Role Orchestrator Runtime 是 FishSwarm 的单模型多角色协作层。

它不会创建多个真实模型，也不会让角色绕过主 AI 的权限系统。它做的是：

- 在设置里管理角色与角色手册。
- 在用户发起任务时识别需求、风险、验收或决策意图。
- 根据意图和改动范围自动选择合适角色。
- 在角色上线前挂载对应角色手册。
- 生成可见的角色生命周期事件。
- 将角色运行结果保存为结构化 `RoleRunResult`。
- 将验收结果保存为结构化 `ValidationLog`。
- 在右侧面板显示角色协作与验收日志。
- 将角色事件写入 Project Timeline。

## 角色管理

入口位置：

`设置 -> 角色管理`

当前内置 6 个角色：

- Product Strategist
- Engineering Architect
- Product Designer
- Developer Experience
- Security Officer
- QA / Release Steward

每个角色都有完整手册：

- 身份定位
- 职责
- 能力边界
- 输入要求
- 输出格式
- 完成标准
- 验收标准
- 安全规则
- 决策权限

角色配置按工作区保存为 override。内置角色不会被直接改坏，可以通过“恢复内置”回到默认手册和触发设置。

## 自动路由如何工作

运行时先用规则识别用户文本：

- requirement
- risk
- validation
- decision
- question
- none

然后 Role Router 根据意图、scope 和关键词选择角色。例如：

- 需求类任务会进入 Product Strategist 和 Engineering Architect。
- UI/设置/页面相关任务会进入 Product Designer。
- MCP、配置、文档、错误路径会进入 Developer Experience。
- token、权限、远程控制、MCP 安全会进入 Security Officer。
- 测试、验收、高风险 scope 会进入 QA / Release Steward。

被停用的角色不会自动上线。

## 角色手册挂载

角色上线前会构造 mounted prompt，包含：

- taskId
- runId
- roleId
- roleName
- 当前任务
- 轻量上下文
- ROLE HANDBOOK
- JSON 输出契约
- 安全边界

角色输出必须是结构化 JSON。角色输出只是建议，不是可执行指令；主 AI 仍然负责综合、权限和最终动作。

## 右侧面板

右侧面板新增两块能力：

- `角色协作`：显示角色 queued、mounting_handbook、online、working、returned、failed 等生命周期。
- `验收`：优先显示结构化 ValidationLog；如果没有结构化日志，则保留旧的 Markdown Acceptance 提取逻辑。

## v1 不做什么

当前版本刻意不做这些事：

- 不让角色直接执行工具。
- 不让角色绕过权限弹窗。
- 不自动把角色 decision candidate 写入 Decision Store。
- 不默认开启真实子模型调用。
- 不把完整角色手册塞进每一次主模型请求。

未来可以增加 `roles.acceptDecisionCandidate`，由用户显式接受后再以 `source: 'user'` 写入决策库。

## 如何关闭

设置环境变量：

```bash
FISHSWARM_ROLE_RUNTIME=0
```

关闭后，Agent Runner 不会在对话 turn 中执行角色 dry-run，也不会向主模型注入 Role Orchestration 上下文。

## 如何验证

基础命令：

```bash
npm test -- src/tests/roles/role-registry.test.ts src/tests/roles/role-runtime.test.ts src/tests/store/session-state.test.ts src/tests/observability/observability-services.test.ts src/tests/work-habits/work-habits-services.test.ts
npm run typecheck
npm run build:mcp
```

手动验证：

1. 打开设置。
2. 确认 `角色管理` 位于 `工作习惯` 下方。
3. 打开 `角色管理`。
4. 确认 6 个内置角色都能看到。
5. 停用 Product Designer，保存并刷新，确认停用状态保留。
6. 恢复 Product Designer 内置配置，刷新确认恢复。
7. 开始或继续一个会话。
8. 输入：`检查 MCP 连接失败，看看 token scope 有没有风险，然后告诉我怎么验证。`
9. 确认右侧 `角色协作` 出现 Engineering、DX、Security、QA 等角色生命周期。
10. 确认至少出现 `mounting_handbook` 和 `online`。
11. 确认普通助手回复仍然正常流式输出。
12. 确认权限请求没有被角色系统绕过。
13. 如果助手回复包含 Acceptance 段落，右侧 `验收` 仍能显示旧 fallback。
14. 如果生成结构化 ValidationLog，右侧 `验收` 优先显示结构化日志。
15. 在健康/时间线里确认 role category 事件可以被记录和读取。
