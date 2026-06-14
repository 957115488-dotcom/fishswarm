# 04. API 设计

## 1. API 原则

1. 所有请求必须做 schema 校验。
2. API 返回结构化 JSON。
3. 状态流转类接口调用 Service 或 Orchestrator。
4. 长任务接口只创建任务或入队，不阻塞等待模型执行。
5. 高风险动作必须支持用户确认。

## 2. 通用响应

成功：

```json
{
  "ok": true,
  "data": {}
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": {}
  }
}
```

## 3. Workspace API

### 创建工作区

`POST /api/workspaces`

Body:

```json
{
  "name": "我的鱼群工作区"
}
```

### 获取工作区列表

`GET /api/workspaces`

## 4. Factory API

### 创建工厂

`POST /api/factories`

Body:

```json
{
  "workspaceId": "xxx",
  "name": "软件开发工厂",
  "description": "用于开发软件项目的 AI 协作工厂",
  "domain": "software_development",
  "workflowDefinition": {},
  "qualityGates": {}
}
```

### 获取工厂列表

`GET /api/factories?workspaceId=xxx`

### 获取工厂详情

`GET /api/factories/:factoryId`

### 更新工厂

`PATCH /api/factories/:factoryId`

### 把员工加入工厂

`POST /api/factories/:factoryId/agents`

Body:

```json
{
  "agentWorkerId": "xxx",
  "defaultPosition": "project_manager",
  "required": true,
  "sortOrder": 1
}
```

## 5. Agent Worker API

### 创建 Agent 员工

`POST /api/agent-workers`

Body:

```json
{
  "workspaceId": "xxx",
  "name": "林舟",
  "role": "项目经理",
  "mission": "负责理解项目目标、拆解任务并协调团队交付",
  "responsibilities": [],
  "skills": [],
  "constraints": [],
  "systemPrompt": "你是一名项目经理 Agent...",
  "toolPermissions": [],
  "knowledgeSources": [],
  "inputSchema": {},
  "outputSchema": {},
  "handoffRules": {},
  "reviewCriteria": {}
}
```

### 获取员工列表

`GET /api/agent-workers?workspaceId=xxx`

### 获取员工详情

`GET /api/agent-workers/:agentWorkerId`

### 更新员工

`PATCH /api/agent-workers/:agentWorkerId`

### 员工转正

`POST /api/agent-workers/:agentWorkerId/activate`

## 6. Project API

### 创建项目

`POST /api/projects`

Body:

```json
{
  "workspaceId": "xxx",
  "factoryId": "xxx",
  "name": "客户管理系统 MVP",
  "goal": "构建一个用于管理客户线索和跟进记录的 Web 应用",
  "background": "面向小型销售团队",
  "constraints": {},
  "successCriteria": []
}
```

### 获取项目列表

`GET /api/projects?workspaceId=xxx`

### 获取项目详情

`GET /api/projects/:projectId`

### 自动组队

`POST /api/projects/:projectId/build-team`

行为：

1. 读取项目关联的 Factory。
2. 读取 FactoryAgent。
3. 创建 ProjectTeamMember。
4. 项目状态进入 `planning` 或 `waiting_for_user`。

### 生成任务图

`POST /api/projects/:projectId/generate-task-graph`

行为：

1. 选择管理 Agent。
2. 创建 AgentRun。
3. 生成 TaskGraph。
4. 创建 Task。
5. 等待用户确认或进入 ready。

### 生成交付摘要

`POST /api/projects/:projectId/generate-handoff`

## 7. Task API

### 获取任务列表

`GET /api/projects/:projectId/tasks`

### 获取任务详情

`GET /api/tasks/:taskId`

### 更新任务

`PATCH /api/tasks/:taskId`

### 执行任务

`POST /api/tasks/:taskId/run`

行为：

1. 检查任务依赖。
2. 检查负责人。
3. 创建 AgentRun。
4. 入队或同步执行。
5. 返回 AgentRun id。

### 评审任务

`POST /api/tasks/:taskId/review`

## 8. Agent Run API

### 获取运行记录列表

`GET /api/projects/:projectId/agent-runs`

### 获取运行记录详情

`GET /api/agent-runs/:agentRunId`

### 重试运行

`POST /api/agent-runs/:agentRunId/retry`

## 9. Artifact API

### 获取项目产物

`GET /api/projects/:projectId/artifacts`

### 获取产物详情

`GET /api/artifacts/:artifactId`

### 创建产物

`POST /api/artifacts`

主要由 Agent Runtime 调用，前端一般不直接创建。

## 10. Review API

### 获取任务评审

`GET /api/tasks/:taskId/reviews`

### 创建评审

`POST /api/tasks/:taskId/reviews`

Body:

```json
{
  "status": "passed",
  "summary": "产物满足验收标准",
  "issues": [],
  "score": 90
}
```

## 11. Approval API

### 获取待确认事项

`GET /api/projects/:projectId/approvals`

### 批准

`POST /api/approvals/:approvalId/approve`

### 拒绝

`POST /api/approvals/:approvalId/reject`

## 12. Seed API 或命令

开发阶段需要 seed 内置模板：

1. 软件开发工厂。
2. 研究分析工厂。
3. 对应默认 Agent 员工。

建议实现为：

```text
pnpm db:seed
```

而不是公开 API。

