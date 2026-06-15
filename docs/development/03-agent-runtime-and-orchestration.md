# 03. Agent Runtime 与编排设计

## 1. 目标

Agent Runtime 和 Orchestrator 是鱼群的核心。

Orchestrator 决定“谁该做什么、什么时候做、做完以后流向哪里”。

Agent Runtime 负责“让某个 Agent 在给定上下文和工具权限下完成一次工作”。

两者必须分离，避免把调度逻辑和模型调用逻辑混在一起。

## 2. Orchestrator 职责

### 2.1 项目级职责

1. 选择工厂模板。
2. 创建项目团队。
3. 生成任务图。
4. 控制项目阶段。
5. 检查用户确认节点。
6. 汇总最终交付物。
7. 在任务无法匹配人才时触发进化层。
8. 在高风险动作前触发哨兵 Hook。

### 2.2 任务级职责

1. 检查任务依赖。
2. 匹配任务负责人。
3. 先匹配 TalentProfile，再选择 AgentWorker。
4. 创建 AgentRun。
5. 推送队列任务。
6. 处理执行结果。
7. 触发评审。
8. 生成返工任务。

## 3. Agent Runtime 职责

一次 AgentRun 的完整流程：

1. 读取 AgentWorker。
2. 读取本次任务使用的 TalentProfile。
3. 读取 Task。
4. 读取 Project。
5. 读取相关 Artifact。
6. 读取可用工具权限。
7. 触发 Sentinel Hook 检查动作边界。
8. 构造模型输入。
9. 调用模型。
10. 解析输出。
11. 校验输出 schema。
12. 保存 AgentRun。
13. 创建 Artifact。
14. 返回运行结果。

## 4. Agent 输入上下文

建议统一上下文结构：

```ts
type AgentRunContext = {
  workspace: {
    id: string;
    name: string;
  };
  factory: {
    id: string;
    name: string;
    domain: string;
    workflowDefinition: unknown;
    qualityGates: unknown;
  };
  project: {
    id: string;
    name: string;
    goal: string;
    background?: string;
    constraints?: unknown;
    successCriteria?: unknown;
  };
  task: {
    id: string;
    title: string;
    description: string;
    input?: unknown;
    expectedOutput?: unknown;
    acceptanceCriteria?: unknown;
  };
  agent: {
    id: string;
    name: string;
    role: string;
    mission: string;
    responsibilities: unknown;
    constraints: unknown;
    handoffRules: unknown;
    reviewCriteria: unknown;
  };
  talent: {
    id: string;
    name: string;
    responsibilities: unknown;
    outputContract?: unknown;
    reviewCriteria: unknown;
  };
  artifacts: Array<{
    id: string;
    type: string;
    name: string;
    summary?: string;
    content?: string;
  }>;
};
```

## 5. Agent 输出格式

MVP 应统一要求 Agent 输出结构化结果。

```ts
type AgentRunOutput = {
  summary: string;
  resultType: "task_plan" | "document" | "review" | "handoff" | "other";
  content: unknown;
  artifacts: Array<{
    type: string;
    name: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  nextActions: Array<{
    title: string;
    reason: string;
    suggestedOwnerRole?: string;
  }>;
  blockers: Array<{
    title: string;
    description: string;
    needsUserDecision: boolean;
  }>;
};
```

## 6. 任务图输出格式

管理 Agent 生成任务图时必须输出：

```ts
type TaskGraphOutput = {
  phases: Array<{
    name: string;
    description: string;
    tasks: Array<{
      clientId: string;
      title: string;
      description: string;
      assignedRole: string;
      input: unknown;
      expectedOutput: unknown;
      acceptanceCriteria: string[];
      dependsOn: string[];
    }>;
  }>;
};
```

系统要做校验：

1. `clientId` 唯一。
2. `dependsOn` 引用存在。
3. `assignedRole` 能匹配项目团队。
4. 至少有一个任务。
5. 每个任务都有验收标准。

## 7. 编排策略

### 7.1 MVP 策略

第一版使用保守规则编排：

1. 用户手动触发生成任务图。
2. 用户确认任务图。
3. 用户手动或系统半自动执行 ready 任务。
4. 每个任务执行后进入 review。
5. Review passed 后进入 done。
6. Review failed 后进入 needs_rework。
7. 缺少人才时进入 blocked，并生成 CapabilityGap。
8. 高风险动作进入 blocked，并生成 GuardedAction、ActionReviewBrief 和 UserApproval。

### 7.1.1 人才匹配策略

任务图中的每个任务应包含 `requiredTalentProfileId` 或可解析的角色名称。

匹配顺序：

1. 查找项目团队里的 TalentProfile 绑定。
2. 查找 factory 范围的 AgentRoleAssignment。
3. 查找 workspace 范围的 AgentRoleAssignment。
4. 根据 priority、Agent 状态和历史表现选择 AgentWorker。
5. 没有候选 Agent 时创建 CapabilityGap。

### 7.1.2 哨兵 Hook 策略

Agent 执行动作前必须先经过哨兵检查。

动作类型：

1. `read`
2. `suggest`
3. `create`
4. `modify`
5. `delete`
6. `external`
7. `execute`

默认规则：

1. read、suggest、create 可按 TalentScope 放行。
2. modify 需要管理层简报和用户审批。
3. delete、external、execute 视为高风险动作，需要用户审批。
4. 所有动作必须写入 AuditLog。

### 7.1.3 进化层策略

当任务无法匹配人才时，系统生成：

1. CapabilityGap。
2. LearningSource。
3. CandidateTalentProfile。
4. TalentTrainingRun。

候选人才通过 TalentEvaluation 后才能进入正式 TalentProfile。

### 7.2 后续策略

后续支持：

1. 自动执行所有 ready 任务。
2. 并行执行无依赖任务。
3. 根据 Agent 负载调度。
4. 根据历史表现选择 Agent。
5. 根据成本和模型能力路由。

## 8. Review 设计

Review 可以由 Review Agent 或规则执行。

Review 输入：

1. Task。
2. Acceptance criteria。
3. Artifact。
4. AgentRun output。

Review 输出：

```ts
type ReviewOutput = {
  status: "passed" | "needs_rework" | "needs_user_decision" | "blocked";
  summary: string;
  issues: Array<{
    severity: "low" | "medium" | "high";
    title: string;
    description: string;
    suggestedFix?: string;
  }>;
  score?: number;
};
```

## 9. Tool Gateway

Agent 不能直接调用工具。所有工具调用必须经过 Tool Gateway。

工具调用结构：

```ts
type ToolCallRequest = {
  agentWorkerId: string;
  projectId: string;
  taskId?: string;
  toolName: string;
  input: unknown;
};
```

Tool Gateway 检查：

1. 工具是否存在。
2. Agent 是否有权限。
3. 当前任务是否允许使用该工具。
4. 是否需要用户确认。
5. 输入是否符合 schema。

## 10. 失败处理

### 10.1 模型失败

处理：

1. 标记 AgentRun failed。
2. 记录错误。
3. 任务进入 blocked。
4. 用户可重试。

### 10.2 输出 schema 校验失败

处理：

1. 可自动请求模型修复一次。
2. 仍失败则 AgentRun failed。
3. 保存原始输出。
4. 任务进入 needs_rework 或 blocked。

### 10.3 工具失败

处理：

1. 记录 ToolCall 错误。
2. 根据工具重要性决定重试。
3. 高风险失败进入 waiting_for_user。

## 11. 最小实现接口

建议先实现：

```ts
interface Orchestrator {
  buildProjectTeam(projectId: string): Promise<void>;
  generateTaskGraph(projectId: string): Promise<void>;
  runTask(taskId: string): Promise<void>;
  reviewTask(taskId: string): Promise<void>;
  generateHandoff(projectId: string): Promise<void>;
}

interface AgentRuntime {
  run(input: {
    projectId: string;
    taskId: string;
    agentWorkerId: string;
  }): Promise<AgentRunResult>;
}
```
