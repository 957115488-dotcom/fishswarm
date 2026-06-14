# 09. 桌面应用架构

## 1. 目标

鱼群第一版应是一个桌面优先应用。

目标体验：

1. 用户双击鱼群应用图标。
2. 桌面窗口打开。
3. 本地 App Server 自动启动。
4. 用户看到所有 Agent 的工作状态。
5. 用户可以创建工厂、创建 Agent、派发项目、观察任务执行和查看产物。

## 2. 推荐技术栈

### 2.1 MVP 推荐

1. Electron：桌面壳、本地 Node 能力、窗口、托盘、菜单、自动更新。
2. React：前端 UI。
3. Vite：前端构建。
4. TypeScript：全栈类型一致。
5. Tailwind CSS：快速构建工作台界面。
6. SQLite：本地数据库。
7. Drizzle ORM 或 Prisma SQLite：数据库访问。
8. Node.js Local App Server：承载 API、Orchestrator、Agent Runtime。
9. Server-Sent Events 或 WebSocket：推送 Agent 状态。
10. Zod：输入输出 schema 校验。
11. React Flow：任务图和协作图。

### 2.2 为什么不是纯 Web MVP

纯 Web 方案的问题：

1. 用户无法双击打开。
2. 需要独立部署服务。
3. 本地文件和命令执行能力受限。
4. Agent Runtime 不适合跑在浏览器里。
5. 个人用户使用门槛更高。

### 2.3 为什么 MVP 选 Electron

Electron 的优势：

1. 与 Node 生态天然兼容。
2. 适合本地 Agent Runtime。
3. 方便管理本地文件、进程和工具。
4. 打包和自动更新生态成熟。
5. React/Vite 集成简单。

Tauri 可以作为后续优化方向，但第一版不应为了包体积牺牲开发速度。

## 3. 桌面总体架构

```text
FishSwarm Desktop App
  Desktop Main Process
    Window Manager
    App Lifecycle
    Local App Server Launcher
    Tray / Menu
    Auto Update

  Renderer UI
    Agent Operations Dashboard
    Factory Workspace
    Agent Worker Onboarding
    Project Board
    Task Graph
    Artifact Center

  Local App Server
    Local API
    Event Stream
    Orchestrator
    Agent Runtime
    Tool Gateway
    Model Provider
    Local Job Scheduler

  Local Persistence
    SQLite Database
    Artifact Files
    Logs
    Config
```

## 4. 进程模型

### 4.1 Main Process

职责：

1. 创建应用窗口。
2. 管理窗口生命周期。
3. 启动 Local App Server。
4. 监听 App Server 健康状态。
5. 管理托盘。
6. 管理菜单。
7. 管理自动更新。
8. 暴露安全 IPC。

### 4.2 Renderer Process

职责：

1. 渲染工作台 UI。
2. 调用本地 API。
3. 订阅 Agent 状态事件。
4. 展示任务、运行、产物和确认事项。

限制：

1. 不直接访问数据库。
2. 不直接调用模型。
3. 不直接执行工具。
4. 不直接访问高风险文件操作。

### 4.3 Local App Server

职责：

1. 提供本地 HTTP 或 JSON-RPC API。
2. 执行 Orchestrator。
3. 执行 Agent Runtime。
4. 调用 Tool Gateway。
5. 写入 SQLite。
6. 写入本地产物。
7. 推送状态事件。

建议：

1. 监听 `127.0.0.1`。
2. 使用随机端口或固定本地端口。
3. 启动后把端口通知 Renderer。
4. 只接受本机访问。

## 5. 本地数据目录

Windows 建议：

```text
%APPDATA%/FishSwarm/
  config/
    settings.json
  data/
    fishswarm.sqlite
  artifacts/
    projects/
  logs/
    app.log
    agent-runs.log
  cache/
  temp/
```

开发环境可使用：

```text
./.fishswarm-dev/
```

## 6. 本地数据库

MVP 使用 SQLite。

原因：

1. 零额外安装。
2. 适合桌面单用户。
3. 便于备份和迁移。
4. 能保存 AgentRun、Task、Artifact 元数据。

保留抽象：

1. Repository 层不要绑定 SQLite 特性。
2. 后续可迁移 PostgreSQL。
3. 数据模型仍按通用领域模型设计。

## 7. 本地任务调度

MVP 不使用 Redis。

使用：

1. 内存队列。
2. SQLite 持久化状态。
3. 应用启动时恢复未完成任务。
4. 同时运行任务数量可配置。

任务状态恢复规则：

1. `queued`：重新入队。
2. `running`：标记为 interrupted，等待用户重试。
3. `failed`：保留错误。
4. `succeeded`：不重复执行。

## 8. Agent Operations Dashboard

这是桌面应用的第一屏。

### 8.1 顶部概览

显示：

1. 活跃 Agent 数。
2. 正在运行任务数。
3. 队列中任务数。
4. 阻塞任务数。
5. 待用户确认数。
6. 今日生成产物数。

### 8.2 Agent 状态列表

每个 Agent 展示：

1. 姓名。
2. 岗位。
3. 所属工厂。
4. 当前状态。
5. 当前任务。
6. 最近输出。
7. 最近错误。
8. 今日运行次数。

Agent 状态：

1. `idle`
2. `queued`
3. `running`
4. `reviewing`
5. `waiting_for_user`
6. `blocked`
7. `failed`

### 8.3 运行时间线

展示跨项目 AgentRun：

1. Agent 开始任务。
2. 工具调用。
3. 产物生成。
4. 评审通过。
5. 任务失败。
6. 用户确认。

### 8.4 待处理事项

展示所有需要用户处理的事项：

1. 任务图确认。
2. 高风险工具调用。
3. 返工确认。
4. 最终交付确认。

## 9. 本地 API

UI 与 Local App Server 通信。

MVP 推荐 HTTP + SSE：

```text
GET  /health
GET  /api/dashboard
GET  /api/agent-workers
POST /api/agent-workers
GET  /api/factories
POST /api/factories
GET  /api/projects
POST /api/projects
POST /api/projects/:id/build-team
POST /api/projects/:id/generate-task-graph
POST /api/tasks/:id/run
GET  /api/events
```

`/api/events` 推送：

1. `agent.status.changed`
2. `task.status.changed`
3. `agent_run.started`
4. `agent_run.completed`
5. `artifact.created`
6. `approval.created`

## 10. 安全模型

桌面应用也需要安全边界。

规则：

1. Renderer 不直接访问 Node API。
2. preload 只暴露必要能力。
3. Local App Server 只监听本机。
4. 工具调用必须经过 Tool Gateway。
5. 高风险工具需要 UserApproval。
6. API key 存储在本地安全存储或加密配置中。

## 11. 打包与分发

MVP 推荐：

1. electron-builder。
2. Windows NSIS 安装包。
3. 便携版可后置。
4. 自动更新可后置到第二阶段。

构建命令建议：

```text
pnpm dev
pnpm build
pnpm desktop:dev
pnpm desktop:build
```

## 12. 第一版目录结构

```text
FishSwarm/
  apps/
    desktop/
      electron/
        main.ts
        preload.ts
      renderer/
        src/
          pages/
          components/
          styles/
      package.json
  packages/
    core/
      src/
        domain/
        services/
        schemas/
    runtime/
      src/
        orchestrator/
        agent-runtime/
        tools/
        model-provider/
        scheduler/
    server/
      src/
        api/
        events/
        app-server.ts
    db/
      prisma/
      migrations/
  docs/
```

如果想降低 monorepo 复杂度，MVP 也可以先采用单包结构：

```text
FishSwarm/
  electron/
  src/
    renderer/
    server/
    core/
    runtime/
    db/
  docs/
```

## 13. MVP 验收

桌面 MVP 必须证明：

1. 双击或运行应用后打开桌面窗口。
2. 首屏是 Agent Operations Dashboard。
3. 本地 App Server 启动成功。
4. SQLite 自动初始化。
5. 内置两个工厂模板。
6. 能创建 Agent 员工。
7. 能创建项目。
8. 能自动组队。
9. 能生成任务图。
10. 能运行一个 Agent 任务。
11. Agent 状态实时更新。
12. Artifact 保存到本地。
13. 重启应用后历史记录仍存在。

