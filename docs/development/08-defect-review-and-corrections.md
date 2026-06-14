# 08. 当前方案缺陷审查与修正方向

日期：2026-06-08
目标：把鱼群从 Web-first 方案修正为桌面优先的多 Agent 工厂应用。

## 1. 用户最终目标

用户最终想要的是：

> 双击打开鱼群后，出现一个桌面窗口，可以看到所有 Agent 的工作情况，并能管理工厂、员工、项目、任务、运行日志和产物。

这意味着鱼群第一版不应该只被设计成 Web SaaS。它应该首先是一个本地桌面应用，内部可以使用 Web 技术构建界面，但交付形态必须是可安装、可双击启动、可在本机运行后台 Agent Runtime 的应用。

## 2. 对 Codex 技术思路的参考

这里参考的是 Codex 类应用的架构思想，而不是照抄某个不可见的内部实现。

可借鉴点：

1. 桌面应用是一个工作台窗口，而不是纯网页。
2. UI 与 Agent Runtime 分离。
3. Agent loop 应该运行在可复用的本地服务或运行时中。
4. 本地工作区、文件系统、命令执行、日志和任务状态是一等能力。
5. 前端窗口应该像 command center，负责观察、确认、控制和展示。

公开资料依据：

1. OpenAI Help Center 对 Codex CLI 的描述强调它是运行在本机的轻量 coding agent，可以读取、修改并运行本地代码。
2. OpenAI 对 Codex 的产品介绍强调软件工程 agent 可以并行处理任务，用户再审查结果、请求修改或集成到本地环境。
3. OpenAI Help Center 的 Codex 使用说明提到 Codex local app environment 和 Remote Control 权限，说明本地客户端环境是 Codex 产品形态中的重要部分。
4. OpenAI API 文档中的 local shell 工具强调命令在用户自己的 runtime 中执行，API 只返回指令，实际执行权在本地环境。

鱼群应该采用类似思想：

```text
Desktop Shell
  -> Local App Server
    -> Orchestrator
      -> Agent Runtime
        -> Tool Gateway
        -> Model Provider
    -> Local Database
    -> Local Job Queue
```

## 3. 当前文档存在的主要缺陷

### 3.1 缺陷一：技术路线 Web-first

当前文档默认：

1. Next.js Web 应用。
2. PostgreSQL。
3. Redis。
4. BullMQ。
5. Vercel / Railway 部署。

问题：

1. 不符合“双击打开”的第一体验。
2. 对个人用户安装门槛高。
3. PostgreSQL 和 Redis 对本地桌面应用过重。
4. 用户无法自然理解“为什么一个桌面工具要先部署服务”。

修正：

1. MVP 改为桌面优先。
2. UI 使用 React + Vite 或 Next.js 静态前端。
3. 桌面壳使用 Electron 或 Tauri。
4. 本地数据库优先 SQLite。
5. 本地任务队列优先内存队列 + SQLite 持久化。

### 3.2 缺陷二：缺少 Desktop Shell

当前架构没有定义桌面主进程。

问题：

1. 无法描述双击启动。
2. 无法描述窗口、托盘、菜单、自动更新。
3. 无法描述本地后台服务生命周期。

修正：

增加 Desktop Shell 模块，负责：

1. 启动窗口。
2. 启动本地 App Server。
3. 管理本地配置。
4. 管理应用菜单。
5. 管理托盘和后台运行。
6. 处理自动更新。

### 3.3 缺陷三：缺少 Local App Server

当前方案把 API Layer 视作远程 Web API。

问题：

1. 桌面应用需要本地 API 统一管理 UI 与 Agent Runtime。
2. Agent 执行不能阻塞渲染进程。
3. 后续如果支持 CLI、浏览器扩展或远程控制，需要复用同一套本地服务。

修正：

增加 Local App Server。

职责：

1. 提供本地 HTTP 或 JSON-RPC API。
2. 管理 Orchestrator。
3. 管理 Agent Runtime。
4. 管理本地数据库。
5. 向 UI 推送 Agent 状态事件。

### 3.4 缺陷四：缺少全局 Agent 工作状态总览

当前前端更像项目管理后台，没有突出“所有 Agent 工作情况”。

问题：

1. 用户双击打开后，第一眼应该看到鱼群在干什么。
2. 现有页面需要进入项目详情才能看 AgentRun。
3. 缺少跨项目、跨工厂的 Agent 状态监控。

修正：

新增 Agent Operations Dashboard。

必须展示：

1. 当前活跃 Agent。
2. 正在执行的任务。
3. 等待中的任务。
4. 失败的任务。
5. 待用户确认的事项。
6. 最近产物。
7. 每个 Agent 的状态、负载、最近输出、错误。

### 3.5 缺陷五：本地存储和产物管理不足

当前文档更偏数据库记录，没有定义本地文件工作区。

问题：

1. 桌面应用天然要管理本地文件。
2. 产物可能是代码、文档、表格、图片、日志。
3. 需要可打开、可定位、可导出。

修正：

增加 Local Workspace。

建议目录：

```text
%USERPROFILE%/.fishswarm/
  config/
  data/
    fishswarm.sqlite
  artifacts/
  logs/
  workspaces/
  cache/
```

### 3.6 缺陷六：队列方案对本地 MVP 过重

Redis + BullMQ 更适合服务端部署。

问题：

1. 桌面本地安装 Redis 不友好。
2. MVP 不需要分布式队列。
3. 多进程复杂度过高。

修正：

MVP 使用：

1. 内存任务调度。
2. SQLite 持久化 AgentRun 状态。
3. 应用重启后恢复 queued/running 状态。

后续再引入：

1. Redis。
2. BullMQ。
3. 远程 worker。

### 3.7 缺陷七：API 设计没有区分本地 IPC 和远程 API

桌面应用里，UI 调后端可以走：

1. Electron IPC。
2. 本地 HTTP。
3. JSON-RPC。

当前文档只写了 HTTP API。

修正：

MVP 推荐：

1. UI 与 Local App Server 使用 HTTP + Server-Sent Events 或 WebSocket。
2. 内部模块可保留 service function 调用。
3. 后续如做 CLI，可复用同一套本地 API。

## 4. 修正后的技术路线

### 4.1 MVP 推荐路线

推荐：

1. Electron。
2. React。
3. Vite。
4. TypeScript。
5. Tailwind CSS。
6. SQLite。
7. Drizzle ORM 或 Prisma SQLite。
8. 本地 Node App Server。
9. 本地内存队列。
10. Server-Sent Events 或 WebSocket 推送状态。

理由：

1. Electron 对 Node、本地文件、子进程、窗口和托盘支持成熟。
2. 鱼群需要强本地能力，Electron 比纯 Web 更直接。
3. React + Vite 比 Next.js 更适合作为桌面内嵌 UI 的 MVP。
4. SQLite 让用户不需要额外安装数据库。

### 4.2 可选路线

Tauri 也是可选方案。

优点：

1. 安装包更小。
2. 系统资源占用更低。
3. 安全边界更强。

缺点：

1. Rust 集成成本更高。
2. Node 生态工具调用不如 Electron 顺滑。
3. 对 Agent Runtime、文件操作、命令执行的开发门槛更高。

结论：

第一版推荐 Electron。等核心产品验证后，再评估 Tauri。

## 5. 修正后的完成定义

鱼群 MVP 完成时，必须能做到：

1. 用户双击应用图标启动鱼群。
2. 桌面窗口打开 Agent Operations Dashboard。
3. 本地 App Server 自动启动。
4. 本地 SQLite 数据库自动初始化。
5. 用户可以看到所有 Agent 的当前状态。
6. 用户可以创建 Agent 员工。
7. 用户可以创建工厂。
8. 用户可以创建项目。
9. 用户可以触发任务执行。
10. 用户可以实时看到 AgentRun 状态变化。
11. 用户可以打开产物中心查看本地产物。
12. 用户关闭窗口后，历史数据仍然保留。

## 6. 文档修正清单

需要同步修正：

1. `README.md`：技术路线改为桌面优先。
2. `01-system-architecture.md`：加入 Desktop Shell、Local App Server、SQLite。
3. `05-frontend-design.md`：加入 Agent Operations Dashboard。
4. `06-development-roadmap.md`：新增桌面应用初始化里程碑。
5. `07-engineering-process.md`：加入打包、安装、本地数据目录和自动启动说明。
6. 新增 `09-desktop-app-architecture.md`：完整桌面架构。

## 7. 参考资料

1. OpenAI Help Center: OpenAI Codex CLI - Getting Started  
   https://help.openai.com/en/articles/11096431
2. OpenAI: Introducing Codex  
   https://openai.com/index/introducing-codex/
3. OpenAI Help Center: Using Codex with your ChatGPT plan  
   https://help.openai.com/en/articles/11369540-getting-started-with-codex
4. OpenAI API Docs: Local shell  
   https://platform.openai.com/docs/guides/tools-local-shell
