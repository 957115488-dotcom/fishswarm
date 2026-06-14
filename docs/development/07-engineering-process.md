# 07. 工程实施规范

## 1. 目标

本文档定义鱼群从初始化、开发、测试、打包到发布的工程流程。

它的目标是让项目可以稳定迭代，而不是只做一次演示。

## 2. 本地开发环境

推荐环境：

1. Node.js LTS。
2. pnpm。
3. SQLite。
4. Git。
5. Windows 代码签名证书，可后置。

推荐命令：

```text
pnpm install
pnpm dev
pnpm desktop:dev
pnpm lint
pnpm test
pnpm db:migrate
pnpm db:seed
pnpm desktop:build
```

## 3. 环境变量

开发环境至少需要：

```text
DATABASE_URL=file:./.fishswarm-dev/data/fishswarm.sqlite
OPENAI_API_KEY=
AUTH_SECRET=
APP_URL=http://127.0.0.1
FISHSWARM_HOME=./.fishswarm-dev
ARTIFACT_STORAGE_DRIVER=database
```

可选：

```text
REDIS_URL=
POSTGRES_DATABASE_URL=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

规则：

1. `.env` 不提交。
2. 提交 `.env.example`。
3. 新增环境变量必须更新 `.env.example` 和本文档。

## 4. 分支与提交

建议分支：

1. `main`：稳定分支。
2. `feat/*`：功能开发。
3. `fix/*`：缺陷修复。
4. `docs/*`：文档变更。

提交信息建议：

```text
feat: add agent worker onboarding
fix: prevent task run without assignee
docs: add orchestration design
test: cover task graph validation
```

## 5. 代码组织规则

### 5.1 领域逻辑

领域逻辑放在：

```text
src/core/services/
src/runtime/orchestrator/
src/runtime/agent-runtime/
```

不要把复杂业务逻辑写在 React 组件或 API route 里。

### 5.2 Schema

请求、Agent 输出、任务图、评审结果都应该有 schema。

建议目录：

```text
src/core/schemas/
```

### 5.3 工具

Agent 工具统一放在：

```text
src/runtime/tools/
```

所有工具都必须通过 Tool Gateway 调用。

## 6. 测试策略

### 6.1 必须测试的核心逻辑

1. Project 状态流转。
2. Task 状态流转。
3. TaskGraph schema 校验。
4. AgentWorker 权限检查。
5. Tool Gateway 权限检查。
6. AgentRun 输出解析。
7. Review 结果处理。

### 6.2 集成测试路径

至少覆盖：

1. 创建 Factory。
2. 创建 AgentWorker。
3. AgentWorker 加入 Factory。
4. 创建 Project。
5. 自动生成 ProjectTeam。
6. 生成 TaskGraph。
7. 执行 Task。
8. 生成 Artifact。
9. 创建 Review。

### 6.3 前端 E2E 路径

第一条 E2E：

1. 进入 Dashboard。
2. 打开内置软件开发工厂。
3. 创建一个自定义 Agent。
4. 创建项目。
5. 自动组队。
6. 生成任务图。
7. 执行一个任务。
8. 查看 AgentRun。
9. 查看 Artifact。

## 7. 数据库迁移

规则：

1. schema 变更必须生成 migration。
2. migration 名称要能说明意图。
3. seed 只创建演示和系统模板数据。
4. 不在 seed 中写入用户私有数据。

建议命令：

```text
pnpm db:migrate
pnpm db:seed
```

## 8. Seed 数据

MVP seed 应包含：

1. 系统 Workspace。
2. 软件开发工厂。
3. 研究分析工厂。
4. 软件开发工厂默认 Agent。
5. 研究分析工厂默认 Agent。
6. 基础 workflowDefinition。
7. 基础 qualityGates。

## 9. 日志与可观测性

必须记录：

1. API 错误。
2. Orchestrator 状态流转。
3. AgentRun 输入摘要和输出摘要。
4. ToolCall。
5. Review 结果。
6. UserApproval 决策。
7. Desktop Main Process 启动和退出。
8. Local App Server 健康状态。

敏感信息规则：

1. 不记录 API key。
2. 不记录完整用户密钥。
3. 工具输入中如有敏感字段，需要脱敏。

## 10. 安全边界

第一版最低要求：

1. Agent 默认没有工具权限。
2. 工具权限来自 AgentWorker 配置。
3. 高风险工具调用必须创建 UserApproval。
4. Artifact 写入需要绑定 projectId。
5. API 必须校验 workspace 访问权限。

## 11. 部署策略

MVP 不是优先部署成 Web 服务，而是优先打包成桌面应用。

桌面发布：

1. Electron。
2. electron-builder。
3. Windows NSIS 安装包。
4. 用户数据目录保存 SQLite、日志和产物。

后续团队版可部署为：

1. Vercel：Web 和 API。
2. Supabase 或 Railway：PostgreSQL。
3. Upstash 或 Railway：Redis。
4. 后台 worker：Railway、Render 或独立 Node 进程。

如果后续使用远程 API 执行长任务，需要注意平台函数超时。AgentRun 建议使用队列 worker。

## 12. 发布检查清单

每次发布前检查：

1. `pnpm lint` 通过。
2. `pnpm test` 通过。
3. migration 已运行。
4. seed 在空库可运行。
5. 桌面应用可启动。
6. Local App Server 可启动。
7. Agent Operations Dashboard 可显示。
8. 关键 E2E 路径可走通。
9. 环境变量完整。
10. 没有调试密钥或本地路径泄漏。
11. 文档与实现一致。

## 13. MVP 完成验收

MVP 发布前必须能演示：

1. 双击启动桌面应用。
2. 查看 Agent Operations Dashboard。
3. 创建工厂。
4. 创建 Agent 员工。
5. 员工加入工厂。
6. 创建项目。
7. 自动组队。
8. 自动生成任务图。
9. 执行一个真实 AgentRun。
10. 在首屏看到 Agent 状态变化。
11. 生成 Artifact。
12. 完成 Review。
13. 生成 Handoff Summary。
14. 重启后历史数据仍可查看。
