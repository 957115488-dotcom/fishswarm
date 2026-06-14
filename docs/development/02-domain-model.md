# 02. 领域模型与数据设计

## 1. 设计原则

鱼群的领域模型应围绕“工厂、员工、项目、任务、运行、产物”设计。

核心模型必须保持通用，不能被某个业务模板绑死。

## 2. 核心实体

### 2.1 Workspace

工作区，承载用户或团队的全部资源。

字段：

1. `id`
2. `name`
3. `ownerId`
4. `createdAt`
5. `updatedAt`

关系：

1. 一个 Workspace 有多个 Factory。
2. 一个 Workspace 有多个 AgentWorker。
3. 一个 Workspace 有多个 Project。
4. 一个 Workspace 有多个 Artifact。

### 2.2 Factory

工厂模板或用户自定义工厂。

字段：

1. `id`
2. `workspaceId`
3. `name`
4. `description`
5. `domain`
6. `workflowDefinition`
7. `qualityGates`
8. `status`
9. `createdAt`
10. `updatedAt`

说明：

1. `workflowDefinition` 使用 JSON 保存阶段定义。
2. `qualityGates` 使用 JSON 保存质量门禁。
3. 内置模板可以用 `workspaceId = null` 或系统 workspace 表示。

### 2.3 AgentWorker

AI 员工档案。

字段：

1. `id`
2. `workspaceId`
3. `name`
4. `role`
5. `mission`
6. `responsibilities`
7. `skills`
8. `constraints`
9. `systemPrompt`
10. `toolPermissions`
11. `knowledgeSources`
12. `inputSchema`
13. `outputSchema`
14. `handoffRules`
15. `reviewCriteria`
16. `status`
17. `createdAt`
18. `updatedAt`

状态：

1. `draft`
2. `trial`
3. `active`
4. `paused`
5. `retired`

### 2.4 FactoryAgent

Factory 与 AgentWorker 的关联关系。

字段：

1. `id`
2. `factoryId`
3. `agentWorkerId`
4. `defaultPosition`
5. `required`
6. `sortOrder`

### 2.5 Project

用户派发的项目。

字段：

1. `id`
2. `workspaceId`
3. `factoryId`
4. `name`
5. `goal`
6. `background`
7. `constraints`
8. `successCriteria`
9. `phase`
10. `status`
11. `createdAt`
12. `updatedAt`

状态：

1. `intake`
2. `team_building`
3. `planning`
4. `running`
5. `reviewing`
6. `waiting_for_user`
7. `completed`
8. `cancelled`
9. `failed`

### 2.6 ProjectTeamMember

项目团队成员。

字段：

1. `id`
2. `projectId`
3. `agentWorkerId`
4. `projectRole`
5. `status`
6. `joinedAt`

### 2.7 Task

项目任务。

字段：

1. `id`
2. `projectId`
3. `parentTaskId`
4. `title`
5. `description`
6. `status`
7. `phase`
8. `assignedAgentWorkerId`
9. `dependsOn`
10. `input`
11. `expectedOutput`
12. `acceptanceCriteria`
13. `sortOrder`
14. `createdAt`
15. `updatedAt`

状态：

1. `draft`
2. `ready`
3. `assigned`
4. `running`
5. `reviewing`
6. `needs_rework`
7. `blocked`
8. `done`
9. `cancelled`

### 2.8 AgentRun

一次 Agent 执行记录。

字段：

1. `id`
2. `projectId`
3. `taskId`
4. `agentWorkerId`
5. `status`
6. `inputContext`
7. `model`
8. `output`
9. `toolCalls`
10. `error`
11. `startedAt`
12. `finishedAt`
13. `createdAt`

状态：

1. `queued`
2. `running`
3. `succeeded`
4. `failed`
5. `cancelled`

### 2.9 Artifact

产物。

字段：

1. `id`
2. `workspaceId`
3. `projectId`
4. `taskId`
5. `agentRunId`
6. `createdByAgentWorkerId`
7. `type`
8. `name`
9. `content`
10. `path`
11. `metadata`
12. `createdAt`
13. `updatedAt`

类型：

1. `document`
2. `code`
3. `table`
4. `report`
5. `image`
6. `decision_log`
7. `handoff_summary`
8. `other`

### 2.10 Review

评审记录。

字段：

1. `id`
2. `projectId`
3. `taskId`
4. `artifactId`
5. `reviewerAgentWorkerId`
6. `status`
7. `summary`
8. `issues`
9. `score`
10. `createdAt`

状态：

1. `passed`
2. `needs_rework`
3. `needs_user_decision`
4. `blocked`

### 2.11 UserApproval

用户确认节点。

字段：

1. `id`
2. `projectId`
3. `taskId`
4. `type`
5. `title`
6. `description`
7. `payload`
8. `status`
9. `decidedBy`
10. `decidedAt`
11. `createdAt`

状态：

1. `pending`
2. `approved`
3. `rejected`
4. `cancelled`

## 3. Prisma 草案

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  ownerId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  factories    Factory[]
  agentWorkers AgentWorker[]
  projects     Project[]
  artifacts    Artifact[]
}

model Factory {
  id                 String   @id @default(cuid())
  workspaceId        String?
  name               String
  description        String
  domain             String
  workflowDefinition Json
  qualityGates       Json
  status             String   @default("active")
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  workspace Workspace? @relation(fields: [workspaceId], references: [id])
  agents    FactoryAgent[]
  projects  Project[]
}

model AgentWorker {
  id               String   @id @default(cuid())
  workspaceId      String
  name             String
  role             String
  mission          String
  responsibilities Json
  skills           Json
  constraints      Json
  systemPrompt     String
  toolPermissions  Json
  knowledgeSources Json
  inputSchema      Json?
  outputSchema     Json?
  handoffRules     Json
  reviewCriteria   Json
  status           String   @default("draft")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id])
}
```

完整 schema 可在开发阶段继续扩展。这里先确认领域边界。

## 4. 状态流转规则

### 4.1 Project

```text
intake -> team_building -> planning -> running -> reviewing -> completed
                                |           |            |
                                v           v            v
                         waiting_for_user  failed   waiting_for_user
```

规则：

1. 没有 ProjectTeam 不得进入 planning。
2. 没有 Task 不得进入 running。
3. 有未完成的 required task 不得进入 completed。
4. 有 pending approval 时进入 waiting_for_user。

### 4.2 Task

```text
draft -> ready -> assigned -> running -> reviewing -> done
                                     |        |
                                     v        v
                                  blocked  needs_rework
```

规则：

1. 依赖未完成时不得进入 ready。
2. 没有 assignedAgentWorkerId 不得进入 running。
3. AgentRun 失败时进入 blocked 或 needs_rework。
4. Review passed 后进入 done。

## 5. 索引建议

需要索引：

1. `Factory.workspaceId`
2. `AgentWorker.workspaceId`
3. `Project.workspaceId`
4. `Project.factoryId`
5. `Task.projectId`
6. `Task.assignedAgentWorkerId`
7. `AgentRun.projectId`
8. `AgentRun.taskId`
9. `Artifact.projectId`
10. `Review.taskId`

