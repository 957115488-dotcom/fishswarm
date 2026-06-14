# 鱼群开发文档总览

日期：2026-06-08
产品名：鱼群
文档版本：v0.1

## 1. 文档目的

这套开发文档用于指导鱼群从产品概念进入工程实现。

鱼群的目标不是先做某一个垂直行业应用，而是先搭建一个可配置的多 Agent 协同办公工厂底座。用户后续可以把不同 AI 员工配置进工厂，并通过工厂模板、任务编排、工具权限、质量评审和产物管理来完成不同类型的项目。

## 2. 推荐阅读顺序

1. [00-mvp-scope.md](./00-mvp-scope.md)：第一版开发范围。
2. [01-system-architecture.md](./01-system-architecture.md)：系统架构与模块边界。
3. [02-domain-model.md](./02-domain-model.md)：领域模型、状态机和数据库草案。
4. [03-agent-runtime-and-orchestration.md](./03-agent-runtime-and-orchestration.md)：Agent 运行时、编排器和任务流。
5. [04-api-design.md](./04-api-design.md)：后端 API 设计。
6. [05-frontend-design.md](./05-frontend-design.md)：前端页面、组件和交互设计。
7. [06-development-roadmap.md](./06-development-roadmap.md)：开发阶段、里程碑和验收标准。
8. [07-engineering-process.md](./07-engineering-process.md)：本地开发、测试、部署和工程规范。
9. [08-defect-review-and-corrections.md](./08-defect-review-and-corrections.md)：当前方案缺陷与修正方向。
10. [09-desktop-app-architecture.md](./09-desktop-app-architecture.md)：桌面应用架构。

## 3. MVP 技术路线

第一版建议使用桌面优先的全栈 TypeScript，降低协作成本，并满足“双击打开后看到所有 Agent 工作情况”的目标。

推荐栈：

1. Electron。
2. React。
3. Vite。
4. Tailwind CSS。
5. SQLite。
6. Drizzle ORM 或 Prisma SQLite。
7. 本地 Node App Server。
8. 本地内存队列 + SQLite 状态持久化。
9. Zod。
10. React Flow。
11. Server-Sent Events 或 WebSocket。

第一版可以先使用单体仓库。等 Agent Runtime、队列执行和工具网关复杂起来后，再拆成 packages 或独立服务。

## 4. 第一版核心目标

第一版必须证明四件事：

1. 用户可以双击打开鱼群桌面窗口。
2. 用户可以在首屏看到所有 Agent 的工作情况。
3. 用户可以创建一个工厂。
4. 用户可以让 Agent 员工入职。
5. 用户可以派发项目并自动组队。
6. 系统可以生成任务图、执行 Agent、保存产物并进入评审。

软件开发工厂和研究分析工厂只作为两个内置模板，用来证明底座是通用的。

## 5. 工程原则

### 5.1 先底座，后模板

所有核心代码应围绕 Workspace、Factory、AgentWorker、Project、Task、AgentRun、Artifact 等通用概念设计。

不要把 `SoftwareProject`、`PRD`、`FrontendAgent` 这类垂直概念写死到核心表和核心服务里。它们应该作为模板配置或 seed 数据存在。

### 5.2 先可控，后自治

第一版不要追求完全自治。关键阶段必须有用户确认：

1. 工厂模板确认。
2. 项目团队确认。
3. 任务图确认。
4. 高风险工具调用确认。
5. 最终交付确认。

### 5.3 先结构化，后自由对话

Agent 的关键输出必须尽量结构化。项目计划、任务图、评审结果、工具调用、产物元数据都应该有 schema。

自由文本可以用于解释，但不能作为系统状态流转的唯一依据。

### 5.4 先审计，后优化

每一次 Agent 执行都要保存：

1. 输入上下文。
2. 使用的 Agent 档案版本。
3. 工具调用。
4. 输出。
5. 错误。
6. 状态变更。
7. 产物引用。

这样后续才能做质量分析、返工、成本统计和安全审计。

## 6. 建议目录结构

```text
FishSwarm/
  electron/
    main.ts
    preload.ts
  src/
    renderer/
      pages/
      components/
      styles/
    server/
      api/
      events/
      app-server.ts
    core/
      domain/
      services/
      schemas/
    runtime/
      orchestrator/
      agent-runtime/
      tools/
      scheduler/
      model-provider/
    db/
      schema/
      migrations/
  docs/
    plans/
    development/
```

## 7. 第一版交付物

开发完成后，至少应该具备：

1. 可双击启动的桌面应用。
2. 可自动启动本地 App Server。
3. 可初始化本地 SQLite 数据库。
4. 首屏可查看所有 Agent 工作状态。
5. 可创建 Workspace、Factory、AgentWorker、Project。
6. 可从工厂模板生成项目团队。
7. 可生成任务图并展示。
8. 可触发至少一种真实 AgentRun。
9. 可实时看到 AgentRun 状态变化。
10. 可保存 AgentRun 输出为 Artifact。
11. 可进行简单 Review。
12. 可查看项目执行日志。
13. 可导出或查看最终交付摘要。

## 8. 文档维护规则

这套文档应该跟随实现持续更新：

1. 数据模型变更时，同步更新 `02-domain-model.md`。
2. 编排流程变更时，同步更新 `03-agent-runtime-and-orchestration.md`。
3. API 变更时，同步更新 `04-api-design.md`。
4. 页面和组件变更时，同步更新 `05-frontend-design.md`。
5. 里程碑完成或调整时，同步更新 `06-development-roadmap.md`。
6. 工程命令、部署方式、测试策略变更时，同步更新 `07-engineering-process.md`。
7. 桌面壳、本地服务、本地存储或打包方式变更时，同步更新 `09-desktop-app-architecture.md`。
