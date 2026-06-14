# 06. 开发路线图

## 1. 开发策略

鱼群应采用“底座优先、模板验证、逐步自治”的开发策略。

不要一开始就追求复杂的 Agent 自主协作。第一版先把组织结构、任务状态、执行记录和产物链路打通。

## 2. Milestone 0：工程初始化

目标：建立可开发、可运行、可测试、可双击启动的桌面应用骨架。

任务：

1. 初始化 Electron 项目。
2. 配置 TypeScript。
3. 配置 React + Vite。
4. 配置 Tailwind CSS。
5. 配置本地 App Server。
6. 配置 SQLite。
7. 配置 Drizzle ORM 或 Prisma SQLite。
8. 配置基础 lint 和 format。
9. 建立基础目录结构。

验收：

1. 双击或运行命令后桌面窗口可启动。
2. 本地 App Server 可自动启动。
3. SQLite 数据库可自动初始化。
4. 首屏 Agent Operations Dashboard 壳可访问。

## 3. Milestone 0.5：Agent 状态总览

目标：先做出“打开窗口即可看到所有 Agent 工作情况”的核心体验。

任务：

1. 实现 Agent Operations Dashboard。
2. 实现 AgentStatus 聚合查询。
3. 实现 AgentRunTimeline。
4. 实现 PendingApprovalList。
5. 实现 RecentArtifactList。
6. 实现本地事件流 SSE 或 WebSocket。

验收：

1. 首屏展示 Agent 总数、运行任务数、阻塞任务数、待确认数。
2. 可以看到每个 Agent 的状态。
3. AgentRun 状态变化能实时刷新。

## 4. Milestone 1：核心数据模型

目标：落地鱼群的核心领域模型。

任务：

1. 实现 Workspace。
2. 实现 Factory。
3. 实现 AgentWorker。
4. 实现 FactoryAgent。
5. 实现 Project。
6. 实现 ProjectTeamMember。
7. 实现 Task。
8. 实现 AgentRun。
9. 实现 Artifact。
10. 实现 Review。
11. 实现 UserApproval。

验收：

1. Prisma schema 完成。
2. migration 成功。
3. seed 可生成两个内置工厂模板。
4. 数据库中能看到默认 Agent 员工。

## 5. Milestone 2：基础 CRUD 与工作台

目标：用户可以管理工厂、员工和项目。

任务：

1. Workspace API。
2. Factory API。
3. AgentWorker API。
4. Project API。
5. 工厂列表页。
6. 工厂详情页。
7. Agent 员工池。
8. Agent 入职页。
9. 项目列表页。
10. 项目创建页。

验收：

1. 用户可创建工厂。
2. 用户可创建 AgentWorker。
3. 用户可把 AgentWorker 加入 Factory。
4. 用户可创建 Project。

## 6. Milestone 3：组队与任务图

目标：项目可以从工厂生成团队，并生成任务图。

任务：

1. 实现 `buildProjectTeam`。
2. 实现 ProjectTeamMember 展示。
3. 实现管理 Agent 档案。
4. 实现 `generateTaskGraph`。
5. 实现 TaskGraph schema。
6. 实现 Task 创建。
7. 实现任务看板。
8. 实现任务图展示。

验收：

1. 项目可自动组队。
2. 项目可生成任务。
3. 任务有依赖关系。
4. 前端可展示任务看板和图谱。

## 7. Milestone 4：Agent Runtime

目标：系统可以真实运行一次 Agent 任务。

任务：

1. 实现 AgentRun 创建。
2. 实现 AgentRunContext 构造。
3. 实现模型调用适配器。
4. 实现输出解析。
5. 实现 schema 校验。
6. 实现 Artifact 创建。
7. 实现 AgentRun 详情页。

验收：

1. 用户可点击执行任务。
2. 系统创建 AgentRun。
3. Agent 输出被保存。
4. Artifact 被创建。
5. 前端可查看运行结果。
6. Agent Operations Dashboard 能同步更新状态。

## 8. Milestone 5：评审与返工

目标：任务产物可以被评审，并推动状态流转。

任务：

1. 实现 Review schema。
2. 实现 Review Agent 或规则评审。
3. 实现 `reviewTask`。
4. 实现 needs_rework 状态。
5. 实现返工任务创建。
6. 实现评审页面。

验收：

1. 任务执行后进入 reviewing。
2. 评审通过后任务进入 done。
3. 评审失败后任务进入 needs_rework。
4. 用户能看到评审原因。

## 9. Milestone 6：用户确认与安全边界

目标：高风险操作和关键节点可被用户确认。

任务：

1. 实现 UserApproval。
2. 实现 Approval API。
3. 实现确认事项面板。
4. 实现任务图确认。
5. 实现最终交付确认。
6. 为 Tool Gateway 预留确认机制。

验收：

1. 系统可创建 pending approval。
2. 用户可批准或拒绝。
3. 项目状态能进入 waiting_for_user。
4. 用户处理后项目能继续推进。

## 10. Milestone 7：交付摘要

目标：项目完成后生成结构化交付结果。

任务：

1. 实现 `generateHandoff`。
2. 汇总任务、运行、产物、评审。
3. 生成 Handoff Artifact。
4. 实现交付页。

验收：

1. 项目能生成交付摘要。
2. 摘要包含目标、团队、任务、产物、问题和下一步。
3. 用户可查看最终交付物。

## 11. Milestone 8：工具网关雏形

目标：为 Agent 使用工具建立安全通道。

任务：

1. 定义 Tool 接口。
2. 定义 ToolPermission。
3. 实现 Tool Gateway。
4. 实现 ArtifactWriteTool。
5. 实现 KnowledgeReadTool。
6. 记录 ToolCall。

验收：

1. Agent 只能使用授权工具。
2. 工具调用有日志。
3. 未授权调用会失败。

## 12. Milestone 9：桌面打包与本地数据

目标：让鱼群成为真正可安装、可双击使用的桌面应用。

任务：

1. 配置 electron-builder。
2. 配置 Windows 安装包。
3. 配置本地数据目录。
4. 配置应用图标。
5. 配置窗口标题和菜单。
6. 验证重启后数据保留。

验收：

1. 能生成 Windows 安装包。
2. 安装后可双击启动。
3. 本地 App Server 随应用启动。
4. SQLite 数据保存到用户数据目录。
5. 重启后项目、AgentRun 和 Artifact 仍可查看。

## 13. 测试策略

### 11.1 单元测试

重点：

1. 状态流转。
2. TaskGraph 校验。
3. Agent 输出 schema 校验。
4. 权限检查。

### 11.2 集成测试

重点：

1. 创建工厂。
2. 创建 Agent。
3. 创建项目。
4. 自动组队。
5. 生成任务图。
6. 执行任务。
7. 生成 Artifact。

### 11.3 端到端测试

第一条 E2E 路径：

1. 双击启动鱼群。
2. 打开 Agent Operations Dashboard。
3. 创建软件开发工厂或使用内置模板。
4. 创建 Agent。
5. 创建项目。
6. 自动组队。
7. 生成任务。
8. 执行任务。
9. 查看 Agent 状态实时变化。
10. 查看产物。
11. 重启应用后确认数据仍存在。

## 14. 第一版完成定义

第一版完成必须满足：

1. 可双击启动桌面应用。
2. 首屏是 Agent Operations Dashboard。
3. 数据模型覆盖核心实体。
4. 前端覆盖核心工作台。
5. 本地 API 覆盖主要操作。
6. Orchestrator 可完成组队、拆任务、执行和评审。
7. Agent Runtime 可真实运行至少一种任务。
8. Agent 状态可实时展示。
9. Artifact 链路打通。
10. 用户确认链路打通。
11. 有两个内置工厂模板。
12. 有端到端演示路径。
13. 重启后历史数据保留。
