# 05. 前端设计

## 1. 前端目标

鱼群前端不是聊天页，而是一个桌面工厂工作台。

用户应该能清楚看到：

1. 当前所有 Agent 在做什么。
2. 哪些 Agent 空闲、运行、阻塞或等待确认。
3. 我有哪些工厂。
4. 工厂里有哪些 AI 员工。
5. 每个员工负责什么。
6. 当前项目由哪些员工组成团队。
7. 项目被拆成了哪些任务。
8. 哪些任务正在执行。
9. 哪些产物已经生成。
10. 哪些地方需要我确认。

## 2. 信息架构

```text
Dashboard
  Agent Operations
  Factories
    Factory Detail
    Factory Agents
    Factory Workflow
  Agent Workers
    Worker Detail
    Worker Onboarding
  Projects
    Project Detail
    Team
    Task Graph
    Task Board
    Runs
    Artifacts
    Approvals
  Artifacts
```

## 3. 主布局

### 3.1 左侧导航

内容：

1. 工作区切换。
2. 工厂。
3. 员工池。
4. 项目。
5. 产物中心。
6. 设置。

### 3.2 中间工作区

展示当前页面主体。

常见主体：

1. Agent Operations Dashboard。
2. 工厂列表。
3. 员工列表。
4. 项目看板。
5. 任务图。
6. 产物预览。

### 3.3 右侧上下文面板

展示与当前页面相关的信息：

1. 当前团队。
2. 执行日志。
3. 决策记录。
4. 待确认事项。

## 4. 页面设计

### 4.1 Agent Operations Dashboard

这是鱼群桌面应用的第一屏。

目标：

1. 让用户双击打开后立刻看到所有 Agent 工作情况。
2. 跨工厂、跨项目展示正在运行的任务。
3. 暴露阻塞、失败和等待确认事项。

顶部指标：

1. 活跃 Agent 数。
2. 正在运行任务数。
3. 排队任务数。
4. 阻塞任务数。
5. 待确认数。
6. 今日生成产物数。

主体区域：

1. Agent 状态表。
2. 运行时间线。
3. 当前任务队列。
4. 最近产物。
5. 待确认事项。

Agent 状态表字段：

1. 姓名。
2. 岗位。
3. 所属工厂。
4. 当前状态。
5. 当前任务。
6. 最近输出。
7. 最近错误。
8. 今日运行次数。

### 4.2 工厂列表页

目标：

1. 查看所有工厂。
2. 创建新工厂。
3. 复制内置模板。

元素：

1. 工厂名称。
2. 领域。
3. 员工数。
4. 项目数。
5. 状态。
6. 最近更新时间。

### 4.3 工厂详情页

Tab：

1. 总览。
2. 员工。
3. 流程。
4. 质量门禁。
5. 项目。

总览展示：

1. 工厂描述。
2. 适用场景。
3. 默认阶段。
4. 默认产物类型。

### 4.4 Agent 员工池

目标：

1. 查看所有 Agent 员工。
2. 根据岗位和状态筛选。
3. 新增员工。
4. 查看员工表现。

列表字段：

1. 姓名。
2. 岗位。
3. 状态。
4. 技能标签。
5. 所属工厂数。
6. 最近运行。

### 4.5 Agent 入职页

这是鱼群的核心页面之一。

表单分组：

1. 基本信息。
2. 岗位使命。
3. 职责与能力。
4. 行为边界。
5. 工具权限。
6. 输入输出格式。
7. 交接规则。
8. 评审标准。

交互要求：

1. 表单较长，使用分步或分组。
2. 每一步可以保存草稿。
3. 提供“试用任务”按钮。
4. 试用通过后可以转正。

### 4.6 项目列表页

目标：

1. 查看项目进度。
2. 创建项目。
3. 快速进入运行中的项目。

字段：

1. 项目名。
2. 工厂。
3. 状态。
4. 当前阶段。
5. 完成任务数。
6. 待确认数。
7. 最近更新时间。

### 4.7 项目创建页

表单字段：

1. 项目名称。
2. 选择工厂。
3. 项目目标。
4. 背景材料。
5. 成功标准。
6. 约束条件。

创建后进入项目详情页，并提示用户执行“自动组队”。

### 4.8 项目详情页

推荐 Tab：

1. 总览。
2. 团队。
3. 任务。
4. 图谱。
5. 运行记录。
6. 产物。
7. 确认事项。

总览展示：

1. 项目目标。
2. 当前阶段。
3. 项目状态。
4. 任务完成度。
5. 最近 Agent 活动。
6. 主要产物。

### 4.9 项目团队页

展示 ProjectTeamMember。

元素：

1. Agent 头像或标识。
2. 姓名。
3. 项目角色。
4. 岗位职责。
5. 状态。
6. 替换成员按钮。

### 4.10 任务看板页

列：

1. Ready。
2. Running。
3. Reviewing。
4. Needs Rework。
5. Blocked。
6. Done。

任务卡片：

1. 标题。
2. 负责人。
3. 阶段。
4. 依赖数量。
5. 验收标准摘要。
6. 最近运行状态。

### 4.11 任务图页

使用 React Flow。

节点：

1. 阶段节点。
2. 任务节点。
3. Agent 节点，可选。

边：

1. 任务依赖。
2. 交接关系。

### 4.12 AgentRun 详情页

展示：

1. 运行状态。
2. 执行 Agent。
3. 任务。
4. 输入上下文摘要。
5. 输出。
6. 工具调用。
7. 错误信息。
8. 生成的产物。

### 4.13 产物中心

支持：

1. 按项目筛选。
2. 按类型筛选。
3. 预览文档。
4. 查看元数据。
5. 查看由哪个 AgentRun 生成。

### 4.14 用户确认页

展示所有 pending approval。

操作：

1. 批准。
2. 拒绝。
3. 评论。
4. 返回修改。

## 5. 组件清单

### 5.1 通用组件

1. `AppShell`
2. `SidebarNav`
3. `ContextPanel`
4. `StatusBadge`
5. `EmptyState`
6. `ConfirmDialog`
7. `JsonPreview`
8. `MetricTile`
9. `EventTimeline`

### 5.2 工厂组件

1. `FactoryCard`
2. `FactoryForm`
3. `FactoryAgentList`
4. `WorkflowStageList`
5. `QualityGateEditor`

### 5.3 Agent 组件

1. `AgentWorkerCard`
2. `AgentWorkerForm`
3. `ToolPermissionPicker`
4. `SchemaEditor`
5. `WorkerStatusBadge`

### 5.4 项目组件

1. `ProjectCard`
2. `ProjectCreateForm`
3. `ProjectStatusHeader`
4. `ProjectTeamPanel`
5. `TaskBoard`
6. `TaskGraph`
7. `TaskDetailPanel`
8. `RunTimeline`
9. `ArtifactList`
10. `ApprovalPanel`

### 5.5 Agent Operations 组件

1. `AgentOperationsDashboard`
2. `AgentStatusTable`
3. `AgentRunTimeline`
4. `CurrentTaskQueue`
5. `PendingApprovalList`
6. `RecentArtifactList`

## 6. 视觉方向

鱼群应该像一个专业的工作台，而不是营销页。

建议：

1. 信息密度适中。
2. 以表格、列表、看板和图谱为主。
3. 少用大面积装饰。
4. 状态颜色清晰。
5. Agent 角色有可识别图标或颜色。

## 7. MVP 前端验收

1. 用户双击打开桌面应用后看到 Agent Operations Dashboard。
2. 用户能看到所有 Agent 的状态。
3. 用户能看到正在运行、排队、阻塞和等待确认的任务。
4. 用户能完成创建工厂。
5. 用户能完成 Agent 入职。
6. 用户能创建项目。
7. 用户能查看自动生成的团队。
8. 用户能查看任务看板。
9. 用户能查看任务图。
10. 用户能触发任务执行。
11. 用户能查看 AgentRun。
12. 用户能查看 Artifact。
13. 用户能处理 Approval。
