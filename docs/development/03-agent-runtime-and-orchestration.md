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

### 2.2 任务级职责

1. 检查任务依赖。
2. 匹配任务负责人。
3. 创建 AgentRun。
4. 推送队列任务。
5. 处理执行结果。
6. 触发评审。
7. 生成返工任务。

## 3. Agent Runtime 职责

一次 AgentRun 的完整流程：

1. 读取 AgentWorker。
2. 读取 Task。
3. 读取 Project。
4. 读取相关 Artifact。
5. 读取可用工具权限。
6. 构造模型输入。
7. 调用模型。
8. 解析输出。
9. 校验输出 schema。
10. 保存 AgentRun。
11. 创建 Artifact。
12. 返回运行结果。

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

