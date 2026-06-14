# 01. 系统架构

## 1. 架构目标

鱼群的架构要服务一个核心目标：让不同类型的 Agent 员工可以被配置、编排、执行和评审。

系统应该避免把某个业务工厂写死在核心代码里。软件开发工厂、研究分析工厂、内容生产工厂都应该是配置、模板或 seed 数据，而不是核心模型。

## 2. 总体架构

```text
Desktop Shell
  -> Renderer UI
    -> Local App Server
      -> Application Services
        -> Domain Services
        -> Orchestrator
          -> Agent Runtime
            -> Model Provider
            -> Tool Gateway
        -> Local Persistence
        -> Local Scheduler
```

## 3. 核心模块

### 3.1 Desktop Shell

职责：

1. 创建桌面窗口。
2. 启动本地 App Server。
3. 管理应用生命周期。
4. 管理托盘和菜单。
5. 管理本地配置。
6. 后续支持自动更新。

建议技术：

1. Electron。
2. Main process 管理窗口和本地服务。
3. Preload 只暴露必要安全能力。

### 3.2 Renderer UI

职责：

1. 展示工厂、员工、项目、任务、产物。
2. 提供创建和编辑表单。
3. 展示全局 Agent 工作状态。
4. 处理用户确认。
5. 调用本地 API。

建议技术：

1. React。
2. Vite。
3. Tailwind CSS。
4. React Flow。

### 3.3 Local App Server

职责：

1. 提供本地 HTTP 或 JSON-RPC API。
2. 推送 Agent 状态事件。
3. 校验请求参数。
4. 调用应用服务。
5. 管理 Orchestrator 和 Agent Runtime。
6. 管理本地数据库。

建议：

1. 仅监听 `127.0.0.1`。
2. 使用 Zod 校验输入输出。
3. 状态流转交给 Service 或 Orchestrator。

### 3.4 Domain Services

职责：

1. WorkspaceService。
2. FactoryService。
3. AgentWorkerService。
4. ProjectService。
5. TaskService。
6. ArtifactService。
7. ReviewService。

Domain Service 负责普通业务操作，例如创建员工、加入工厂、更新任务状态。

### 3.5 Orchestrator

职责：

1. 为项目选择工厂。
2. 组建项目团队。
3. 生成任务图。
4. 根据依赖选择下一个任务。
5. 分配任务给 AgentWorker。
6. 创建 AgentRun。
7. 处理任务完成、失败、返工和阻塞。
8. 触发 Review。

Orchestrator 是鱼群区别于普通 Agent 聊天应用的核心。

### 3.6 Agent Runtime

职责：

1. 加载 AgentWorker 档案。
2. 加载任务上下文。
3. 加载项目记忆和相关产物。
4. 生成模型输入。
5. 调用模型。
6. 校验输出 schema。
7. 写入 AgentRun。
8. 创建 Artifact。

Agent Runtime 不应该知道某个具体工厂的业务细节。它只根据 Agent 档案、任务输入和工具权限运行。

### 3.7 Tool Gateway

职责：

1. 管理所有工具调用。
2. 检查 Agent 是否有权限。
3. 记录工具调用日志。
4. 做危险操作确认。
5. 统一错误格式。

第一版工具可以很少：

1. 内部知识读取。
2. Artifact 写入。
3. 简单 Web Search，可后置。
4. 代码执行，可后置。

### 3.8 Local Scheduler

职责：

1. 异步执行 AgentRun。
2. 处理重试。
3. 避免长任务阻塞渲染进程。
4. 更新任务状态。
5. 应用重启后恢复未完成任务。

MVP 使用内存队列 + SQLite 状态持久化。Redis 和 BullMQ 留到服务端或团队版。

### 3.9 Local Persistence

职责：

1. 保存核心业务表。
2. 保存 AgentRun 日志。
3. 保存 Artifact 元数据。
4. 保存工厂模板配置。

建议：

1. SQLite 作为 MVP 主数据库。
2. Drizzle ORM 或 Prisma SQLite 作为 ORM。
3. 本地文件系统保存产物。
4. 后续团队版可迁移 PostgreSQL 和对象存储。

## 4. 模块依赖原则

推荐依赖方向：

```text
Renderer UI -> Local App Server -> Services -> Database
Local App Server -> Orchestrator -> Agent Runtime -> Tool Gateway
Agent Runtime -> Services
Local Scheduler -> Orchestrator
```

禁止：

1. Renderer UI 直接调用 Agent Runtime。
2. Agent Runtime 直接绕过 Tool Gateway 调工具。
3. 模板代码写死在核心服务里。
4. Agent 输出直接改变关键状态而不经过校验。

## 5. 运行流程示例

### 5.1 创建项目

1. 用户在前端提交项目目标。
2. API 校验参数。
3. ProjectService 创建 Project。
4. Orchestrator 根据 Factory 创建 ProjectTeam。
5. 返回项目页面。

### 5.2 生成任务图

1. 用户点击“生成任务图”。
2. API 调用 Orchestrator。
3. Orchestrator 选择管理 Agent。
4. Agent Runtime 执行管理 Agent。
5. 输出 TaskGraph JSON。
6. 系统校验 schema。
7. TaskService 创建任务。
8. 前端展示任务图。

### 5.3 执行任务

1. 用户点击任务执行。
2. Orchestrator 检查依赖。
3. Orchestrator 找到负责人 Agent。
4. Agent Runtime 准备上下文。
5. 调用模型。
6. 保存 AgentRun。
7. 保存 Artifact。
8. 进入 Review。

## 6. 环境变量

建议：

```text
DATABASE_URL=file:%APPDATA%/FishSwarm/data/fishswarm.sqlite
OPENAI_API_KEY=
APP_URL=
AUTH_SECRET=
ARTIFACT_STORAGE_DRIVER=database
FISHSWARM_HOME=
```

后续可增加：

```text
REDIS_URL=
POSTGRES_DATABASE_URL=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

## 7. 错误处理

统一错误类型：

1. ValidationError。
2. PermissionError。
3. NotFoundError。
4. StateTransitionError。
5. AgentOutputSchemaError。
6. ToolPermissionError。
7. ToolExecutionError。
8. ModelProviderError。
9. QueueExecutionError。

所有错误都应写入日志。AgentRun 失败时要保存错误摘要，方便用户理解为什么失败。
