# 鱼群 FishSwarm

桌面优先的多智能体工作工厂。

把 Agent 当成员工配置进工厂，围绕项目目标完成组队、拆解、执行、评审和产物沉淀。

![Electron](https://img.shields.io/badge/Electron-33.2.1-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-6.0.3-646CFF?logo=vite)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-3178C6?logo=typescript)

## 核心概念

**工厂（Factory）** — 定义岗位、流程和质量门禁的模板  
**员工（AgentWorker）** — 可配置使命、职责、工具权限的 AI 员工  
**项目（Project）** — 基于工厂创建的目标驱动任务集合  
**任务图（TaskGraph）** — 由 Orchestrator 拆解的依赖任务网络  
**产物（Artifact）** — Agent 执行生成的输出结果  

## 功能演示

- [x] 桌面应用启动（Electron 窗口 + 本地 App Server）
- [x] Agent Operations Dashboard 实时状态展示
- [x] 工厂创建与团队组建
- [x] 项目派发与自动组队
- [x] 任务自动拆解与执行
- [x] 产物评审流程
- [x] 本地 SQLite 持久化

## 内置工厂模板

### 软件开发工厂

| 岗位 | 职责 |
|------|------|
| 项目经理 | 拆解目标、跟踪进度、协调阻塞 |
| 产品经理 | 需求分析、PRD 撰写、优先级排序 |
| 架构师 | 技术方案设计、代码评审 |
| 前端工程师 | 界面实现、交互打磨 |
| 后端工程师 | API 设计、数据建模 |
| 测试评审员 | 测试计划、回归验证 |

### 研究分析工厂

| 岗位 | 职责 |
|------|------|
| 研究经理 | 研究方向把控、结论汇总 |
| 搜索分析师 | 信息检索、竞品调研 |
| 数据整理员 | 数据清洗、结构化 |
| 行业分析师 | 市场分析、趋势研判 |
| 报告撰写员 | 报告输出、文案打磨 |
| 事实核查员 | 数据核实、交叉验证 |

## 技术架构

```
Desktop Shell (Electron)
  -> Renderer UI (React + Vite)
    -> Local App Server
      -> Application Services
        -> Domain Services
        -> Orchestrator
          -> Agent Runtime
            -> Model Provider
            -> Tool Gateway
        -> Local Persistence (SQLite)
```

详细架构说明见 [docs/development/01-system-architecture.md](docs/development/01-system-architecture.md)

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 生产构建

```bash
pnpm build
pnpm desktop:build
```

## 项目结构

```
fishswarm/
├── electron/           # Electron 主进程
│   ├── main.cjs        # 应用入口、窗口管理
│   ├── preload.cjs     # 预加载脚本，安全暴露 API
│   ├── app-server.cjs  # 本地 HTTP Server
│   └── core/           # 核心业务逻辑
│       ├── services.cjs     # 领域服务
│       ├── state-store.cjs  # 状态管理
│       ├── dashboard.cjs    # Agent 状态面板
│       ├── seed-state.cjs   # 初始数据
│       └── ...
├── src/                # React 渲染进程
│   ├── main.tsx
│   └── styles.css
├── docs/               # 开发文档
│   ├── development/    # 技术设计文档
│   └── plans/          # 产品规划文档
├── index.html
├── vite.config.ts
└── tsconfig.json
```

## 相关文档

- [MVP 开发范围](docs/development/00-mvp-scope.md)
- [系统架构](docs/development/01-system-architecture.md)
- [领域模型](docs/development/02-domain-model.md)
- [Agent 运行时与编排](docs/development/03-agent-runtime-and-orchestration.md)
- [API 设计](docs/development/04-api-design.md)
- [前端设计](docs/development/05-frontend-design.md)
- [开发路线图](docs/development/06-development-roadmap.md)

## License

Private — All rights reserved