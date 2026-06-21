# GStack 到 FishSwarm 融合审计与实施建议

日期：2026-06-21

## 0. 总结判断

FishSwarm 已经吸收了 GStack 的一部分“基础设施思想”：浏览器命令运行器、浏览器 skill 化、角色运行时、问题偏好/决策存储、session guard、时间线、健康检查、插件/skills 底座、远程入口等。

但 FishSwarm 还没有完整吸收 GStack 最核心的“强协同工作流”：`/autoplan`、CEO/设计/工程/DX 串行评审、双声音交叉评审、Decision Audit Trail、Implementation Task Aggregator、`/qa`、`/review`、`/ship`、`/cso`、`/canary` 等。这些在 GStack 里不是装饰性 prompt，而是把角色协作、质量门禁、测试、发布和安全审查连成一条工程流水线的主体。

所以一句话结论是：FishSwarm 已经吸收了“能承载 GStack 的骨架”，但还没有吸收 GStack 最有价值的“角色协同方法论和流水线执行效果”。

## 1. 复现度口径

下面的百分比不是代码行数比例，也不是测试覆盖率，而是按五个维度做的工程判断：

- 能力面：GStack 原功能覆盖了多少。
- 流程深度：是否还原了原来的多阶段、多角色、门禁、产物传递。
- 产品集成：是否接入 FishSwarm 的 UI、IPC、会话、权限、状态。
- 安全和状态：是否有权限边界、日志、回放、恢复、审计。
- 可验证性：是否有文档、测试或可重复验证路径。

粗略解释：

- 80%-100%：接近完整复现。
- 60%-79%：产品化子集，主路径可用，但少关键深度。
- 40%-59%：底层能力有了，原效果只复现一部分。
- 20%-39%：概念吸收，离原工作流还远。
- 0%-19%：基本未融入。

## 1.5 GStack 总内容地图

把 `gstack-main` 拆开看，它大致不是一个单点功能，而是一套“AI 工程团队操作系统”。主要内容可以分成这些层：

| GStack 内容层 | 代表能力 | FishSwarm 当前吸收情况 |
| --- | --- | --- |
| 角色协同方法论 | CEO、Design、Engineering、DX、QA、CSO、Release 等角色，以及按顺序交接的 review pipeline | 有角色底座，但强协同流程未完整吸收 |
| 自动计划与评审 | `/autoplan`、plan CEO review、plan design review、plan eng review、plan DX review | 基本未完整融入，是最大缺口 |
| 执行质量闭环 | `/qa`、`/qa-only`、`/review`、回归测试、失败修复和复验 | 有底层 runner/timeline，缺完整 workflow |
| 发布与门禁 | `/ship`、`/canary`、release readiness、发布风险聚合 | 基本未形成原生 release gate |
| 浏览器自动化 | GStack Browse、真实浏览器控制、snapshot/ref、截图、PDF、tab、CDP、browser skills | 吸收了命令 runner 和 browser skill 子集 |
| 记忆与上下文 | GBrain、`/setup-gbrain`、`/sync-gbrain`、`/context-save`、`/context-restore`、checkpoint | FishSwarm 有自研 memory 和轻量 context，但不是原样 GBrain |
| 安全治理 | `/cso`、prompt injection 防护、canary token、security classifier、dashboard、权限隔离 | 有基础扫描/脱敏/guard，缺完整 CSO 和安全门禁 |
| 远程协作 | `/pair-agent`、远程 agent、tab isolation、scoped tokens、activity visibility | FishSwarm 有 remote 入口，但 pair-agent 语义未完整吸收 |
| Skills/Commands 模板系统 | 大量 `SKILL.md`、slash commands、`.tmpl`、可复用方法论模板 | FishSwarm 有 skills/plugin 底座，缺 GStack 关键工作流模板 |
| 工程文档与架构说明 | README、ARCHITECTURE、BROWSER、GBrain 文档、使用说明 | 部分思想已进入 `docs/gstack-extracts`，未全部产品化 |
| 平台/宿主适配 | iOS QA、OpenClaw、特定 host/CLI/adapter | 基本未吸收，适合按需插件化 |

其中最值得注意的是：GStack 的“角色之间协同工作”不是分散在一个角色文件里，而是贯穿 `autoplan`、plan review、QA、review、ship、安全和记忆上下文。FishSwarm 当前已经接住了其中若干底层模块，但还没有把这些模块拧成同样强的协作链条。

## 2. 已融入内容逐项剖析

### 2.1 GStack Browse / 浏览器命令运行器

对应 FishSwarm 位置：

- `src/main/mcp/gstack-browse-server.ts`
- `src/main/mcp/gstack-browse-runner.ts`
- `resources/gstack-browse/README.md`

原始 GStack 效果：

GStack 的浏览器能力是一套完整 browser stack，包括真实浏览器控制、snapshot/text/ref、点击填表、截图、PDF、标签页、CDP、性能、side panel、pair-agent 远程共享、browser skill 录制与运行、安全隔离等。

FishSwarm 已复现内容：

- 有一个 GStack Browse MCP 适配层。
- 有共享 runner，可以从环境变量、资源目录或本地 gstack 路径解析 browse binary。
- 支持基础 allowlist 命令：`open/goto`、`snapshot`、`text`、`click`、`fill`、`type`、`press`、`wait`、`screenshot`、`status`、`stop`。
- 对 `fill/type` 等敏感输入做日志脱敏。
- 将浏览器事件写入项目时间线。
- 可以被 Browser Skill Runtime 复用。

复现度：45%-60%。

已经复现的部分：

- 浏览器命令可被 FishSwarm 后端调用。
- 命令边界有 allowlist。
- 命令输出有一定 sanitization。
- 事件能进入 FishSwarm 的 timeline。
- 和浏览器 skill 运行时已经打通。

没有复现的部分：

- 没有完整的 GStack 浏览器产品面板。
- 没有完整 tab/session/CDP/perf/PDF/side panel 能力。
- 没有完整 pair-agent 协作浏览器安全模型。
- 没有把 browser refs、截图证据、QA 报告、release gate 串成强工作流。
- 资源目录看起来更像适配说明，不等于完整内置了各平台可执行浏览器栈。

如果补齐，效果会是：

- FishSwarm 可以从“能跑浏览器命令”升级为“浏览器是任务验证和 QA 的一等公民”。
- `/qa`、设计核查、发布前 smoke test、远程协作都可以复用同一套证据链。
- 用户可以看到更完整的浏览器状态、截图、失败原因和可回放步骤。

不补齐的缺陷：

- 浏览器能力会停留在工具调用层，无法自然形成 QA/report/release 的闭环。
- 遇到复杂网页、多个 tab、登录态、PDF、性能问题时，FishSwarm 对 GStack 的复现会明显变浅。

评价：

这是已经融入得比较实在的一块，但它更像“底座级吸收”，不是“GStack Browser 完整产品级复刻”。

### 2.2 Browser Skill Runtime / Skillify

对应 FishSwarm 位置：

- `src/main/skills/browser-skill-runtime.ts`
- `src/main/skills/browser-skillify-service.ts`
- `src/preload/index.ts`
- `docs/gstack-extracts/browser-skill-runtime.md`

原始 GStack 效果：

GStack 的 browser skills 目标是把一次浏览器操作沉淀成可复用技能：录制、抽象参数、保存、测试、启用、运行，并用于 QA、工作流和远程任务。

FishSwarm 已复现内容：

- 使用 `workflow.json` 表达可回放浏览器流程。
- 支持 project/global/bundled 三层 skill 来源。
- 使用 `.fishswarm/.tmp/browser-skillify` 做草稿暂存。
- 可以从成功的 browse timeline 事件生成草稿。
- 支持 commit、discard、enable/disable、remove、test、run。
- 运行时复用 GStack Browse runner。
- 对环境变量做 allowlist，并剥离明显 secret key。
- renderer preload 已暴露相关 IPC。

复现度：50%-60%。

已经复现的部分：

- 已经有可落盘、可测试、可运行的 browser skill runtime。
- 已经接入 FishSwarm 项目目录和全局目录。
- 已经有草稿到正式 skill 的生命周期。
- 已经做了基础安全限制。

没有复现的部分：

- GStack 中更复杂的 skillify 抽象能力没有完整出现，例如参数归纳、失败自修复、证据绑定、跨页面状态建模。
- 当前更偏 JSON workflow 执行，不是完整脚本级自动化平台。
- 没看到完整 UI 体验、批量管理、版本化、依赖声明、权限解释。
- 没有和 `/qa`、`/ship`、`/review` 等强流程深度绑定。

如果补齐，效果会是：

- 用户做过一次网页操作后，FishSwarm 能更可靠地沉淀成“个人自动化资产”。
- QA 和发布验证可以自动生成、自动回放、自动维护回归用例。
- 项目越用越会积累可复用浏览器技能。

不补齐的缺陷：

- browser skill 容易变成“高级宏录制”，而不是 GStack 式可维护工程资产。
- 复杂网页流程的复用率和稳定性会受限。

评价：

这是 FishSwarm 当前最接近 GStack 具体能力的一块之一，方向对，但还没达到 GStack 那种“工作流资产化”的深度。

### 2.3 角色运行时 / Role Runtime

对应 FishSwarm 位置：

- `src/main/roles/built-in-roles.ts`
- `src/main/roles/role-runtime-service.ts`
- `src/main/roles/role-handbook-mount.ts`
- `src/main/roles/role-router.ts`
- `src/main/claude/agent-runner.ts`
- `src/renderer/components/context/RoleActivitySection.tsx`
- `src/renderer/components/settings/SettingsRoles.tsx`
- `docs/role-orchestrator-runtime.md`

原始 GStack 效果：

GStack 的角色协同不是简单“多 persona 输出”。它把 CEO、Designer、Engineering、DX、QA、CSO、Release 等角色拆成有顺序、有产物、有审查标准、有门禁的流水线。以 `/autoplan` 为例，明确要求 CEO -> Design -> Engineering -> DX 顺序评审，还包含双声音交叉审查、Decision Audit Trail、Implementation Task Aggregator，并把产物交给后续 `/qa`、`/ship`、`/review`。

FishSwarm 已复现内容：

- 有 6 个内置角色：product strategist、engineering architect、product designer、developer experience、security officer、QA/release steward。
- 每个角色有职责、边界、输出结构。
- 有 role router，可以按 intent/scope/keywords 选择角色。
- 有 role handbook mount，把角色信息注入模型调用。
- 有 sequential role subcall：后一个角色可以看到前一个角色的 handoff。
- agent runner 可以把角色协同结果注入主 prompt 的 `Role Collaboration Results`。
- renderer 有角色活动展示和设置入口。

复现度：35%-45%。

已经复现的部分：

- FishSwarm 已经有角色实体。
- 已经能在主请求前运行多个角色。
- 已经有角色 handoff 和 validation log。
- 已经能把角色输出接回主模型。
- 用户侧已经能看到一些角色活动。

没有复现的部分：

- 没有完整 `/autoplan` 强制顺序和完整方法论。
- 没有 CEO/Design/Engineering/DX 各自的深度评审章节。
- 没有 Claude subagent + Codex 第二声音的双声音交叉机制。
- 没有 Decision Audit Trail 的强制产物门禁。
- 没有 Implementation Task Aggregator。
- 没有“每个角色产物作为下个角色输入”的完整报告链。
- 没有把角色协同结果强制进入 QA、review、ship 发布阶段。

如果补齐，效果会是：

- FishSwarm 会从“角色辅助回答”升级为“多角色工程治理系统”。
- 复杂需求会自动经过产品、设计、工程、DX、安全、QA 多角度压测。
- 产出的计划会更可执行，并能自动生成任务列表、风险清单、验收标准和测试计划。

不补齐的缺陷：

- 角色容易只是“更丰富的 prompt”，而不是实际协作。
- 多角色输出可能各说各话，缺少冲突消解、决策记录和任务落地。
- 复杂项目仍然依赖用户手工组织评审顺序和质量门槛。

评价：

FishSwarm 已经吸收了角色协同的外壳，但还没有吸收 GStack 里最值钱的协同方法论。这个缺口是当前最重要的融合缺口。

### 2.4 Session Guard / Freeze / Careful 类能力

对应 FishSwarm 位置：

- `src/main/session/session-guard-store.ts`
- `src/preload/index.ts`

原始 GStack 效果：

GStack 的 `/guard`、`/freeze`、`/careful` 目标是控制 agent 行为边界：冻结工作目录、限制破坏性命令、提醒风险、保护用户未提交修改，并把安全策略纳入协作流程。

FishSwarm 已复现内容：

- 有 session guard 状态存储。
- 支持 freeze root。
- 支持检测常见破坏性命令，如 `rm -rf`、`git reset --hard`、`Remove-Item -Recurse`、`DROP/TRUNCATE` 等。
- 有 `assertWriteAllowed`、`assertCommandAllowed` 这类边界检查。
- preload 暴露 guard get/set/clear。

复现度：55%-65%。

已经复现的部分：

- 基础保护模型已经进入产品。
- 对文件写入和 shell 命令都有约束入口。
- 能阻止一部分明显危险操作。

没有复现的部分：

- 没有看到完整的 GStack 风格用户工作流命令，例如 `/freeze` 后如何贯穿所有 agent 操作。
- 没有看到和 plan/review/ship 的门禁联动。
- 没有完整的风险解释、授权续期、临时豁免和审计 UI。
- 对复杂命令组合、脚本间接执行、跨 shell 场景的防护仍需验证。

如果补齐，效果会是：

- FishSwarm 可以更自信地执行长任务、自动修复和发布操作。
- 用户能明确看到当前会话处于什么安全模式，哪些操作被允许或拒绝。

不补齐的缺陷：

- 安全边界存在但容易隐形，用户不一定理解为什么拦截或何时生效。
- 高风险自动化流程上线时，guard 无法成为统一治理层。

评价：

这一块比角色协同更扎实，属于“可用但还没完全产品化”的状态。

### 2.5 Question Policy / Decision Store

对应 FishSwarm 位置：

- `src/main/work-habits/question-policy-store.ts`
- `src/main/work-habits/decision-store.ts`
- `docs/gstack-extracts/question-tuning-decision-store.md`

原始 GStack 效果：

GStack 的工作习惯能力试图让 agent 学会何时问问题、何时继续、如何记住用户偏好、如何保留决策和理由，并防止外部内容伪造用户偏好。

FishSwarm 已复现内容：

- 有 question preference registry。
- 区分 one-way/two-way 问题。
- 有 permission read/write/bash/mcp/read/write/unknown/decision-record 等分类。
- 两难问题可以在有偏好时自动决策。
- 拒绝非用户来源写入偏好。
- decision store 支持 decide/supersede/redact。
- decision 有 scope、confidence、source。
- 对决策文本做 prompt injection scan 和 redaction。

复现度：45%-55%。

已经复现的部分：

- FishSwarm 已经把“少问废话、多记偏好”做成了本地机制。
- 决策不是只留在聊天里，而是能进入结构化 store。
- 有基本来源约束和注入防护。

没有复现的部分：

- 没有跨设备同步。
- 没有语义召回。
- 没有和角色评审、任务计划、release gate 形成统一决策审计链。
- 没有完整的用户可编辑偏好管理体验。

如果补齐，效果会是：

- FishSwarm 可以更像长期协作者，持续记住“我怎么工作、哪些事不必问我、哪些决策已经定过”。
- Autoplan 和 QA 可以引用历史决策，减少重复讨论。

不补齐的缺陷：

- 记忆碎片化：部分存在 memory，部分存在 decision store，部分仍留在会话。
- 复杂项目会反复问已经回答过的问题。

评价：

这是很有价值的融合方向，已经有基础，但还需要和角色流水线的 Decision Audit Trail 合并。

### 2.6 Context Save / Restore

对应 FishSwarm 位置：

- `src/main/context/context-state-service.ts`

原始 GStack 效果：

GStack 的 `/context-save`、`/context-restore` 和 continuous checkpoint mode 会保存会话、工作目录、git 状态、WIP commit 和恢复线索，让 agent 在长任务、中断、重启后继续工作。

FishSwarm 已复现内容：

- 保存最近上下文状态。
- 包含 session id/title/cwd/model/savedAt/branch/git status/recent messages。
- 能恢复最新上下文快照。

复现度：30%-40%。

已经复现的部分：

- 有本地 context 快照。
- 有基本会话、cwd、模型、分支、git 状态和最近消息。

没有复现的部分：

- 没有 GStack 的 continuous checkpoint WIP commit 机制。
- 没有 `[gstack-context]` 式恢复协议。
- 没有把计划、角色评审、QA 结果、决策审计统一纳入恢复状态。
- 没有冲突恢复、跨任务恢复、用户确认恢复的完整 UX。

如果补齐，效果会是：

- 长任务更不怕中断。
- FishSwarm 能恢复的不只是聊天上下文，而是整个工程执行上下文。

不补齐的缺陷：

- 恢复后容易丢失“为什么这么做、做到第几步、哪些门禁已经过了”。
- 对多阶段自动化任务不够稳。

评价：

这是“有名字相似能力，但距离 GStack 原效果较远”的区域。

### 2.7 Timeline / Learnings / Health

对应 FishSwarm 位置：

- `src/main/observability/project-timeline.ts`
- `src/main/observability/health-service.ts`

原始 GStack 效果：

GStack 强调任务过程可审计：浏览器证据、角色评审、QA、ship、security、memory、context 都应形成可追踪过程。健康检查也不只是显示状态，而是辅助发布和协作门禁。

FishSwarm 已复现内容：

- 有本地 JSONL timeline。
- 分类包括 browse/context/mcp/role/security/skillify/health/change_scope/session/learned/question/decision。
- metadata 做 sanitization。
- health service 检查 API credentials、MCP enabled count、skills count、memory、pre-build script、gstack-browse resource。

复现度：35%-45%。

已经复现的部分：

- 已经有统一事件记录入口。
- 关键领域都能写入 timeline。
- 有基础健康摘要。

没有复现的部分：

- timeline 还不是完整工程审计报告。
- health 还不是 GStack `/ship` 或 `/canary` 的 release dashboard。
- 没有完整证据链展示、失败聚类、门禁结论、可重跑入口。

如果补齐，效果会是：

- 用户可以清楚看到“这个结论从哪些步骤和证据来”。
- 发布前可以自动汇总风险、测试、浏览器截图、安全结果。

不补齐的缺陷：

- 事件虽然被记录，但不一定被转化成可行动的质量报告。
- 出问题时回溯成本仍然偏高。

评价：

这是一个好底座，应该继续往 “review/QA/ship dashboard” 方向升级。

### 2.8 Memory 与 GBrain

对应 FishSwarm 位置：

- `src/main/memory/memory-service.ts`

原始 GStack 效果：

GStack 的 GBrain 是独立知识库/记忆系统，通过 MCP 注册、同步、trust policy、cleanup、context save 等机制为 agent 提供长期项目知识。

FishSwarm 已复现内容：

- 有自己的 memory service。
- 支持 core/experience memory。
- 支持 ingestion、embedding、progressive retrieval、memory tools、rebuild/clear/read debug 等。

复现度：50%-70%，但这是“替代方案复现”，不是“GBrain 原样复现”。

已经复现的部分：

- FishSwarm 已经不缺长期记忆底座。
- 能把项目经验、用户偏好、上下文知识沉淀为可检索信息。
- 和 FishSwarm 自己的产品架构更贴合。

没有复现的部分：

- 没有完整 GBrain MCP 注册和 sync 命令体系。
- 没有 GStack 文档里的 setup/sync/cleanup/trust policy 原样工作流。
- 没有明确兼容 GBrain 数据格式。

如果补齐，效果会是：

- 可以复用 GStack/GBrain 生态里的既有知识库和迁移路径。
- 对已有 GBrain 用户更友好。

不补齐的缺陷：

- 与 GStack 生态不完全兼容。
- 但如果 FishSwarm memory 足够成熟，这个缺陷不是核心风险。

评价：

没必要完全复刻 GBrain。更推荐把 GStack 的 sync/trust/cleanup 思想吸收到 FishSwarm memory，而不是强行照搬。

### 2.9 Skills / Plugin 底座

对应 FishSwarm 位置：

- `src/main/skills/skills-manager.ts`
- `src/main/skills/plugin-runtime-service.ts`

原始 GStack 效果：

GStack 依赖大量 skills 和 slash commands 组织工作方式，包括 plan review、QA、ship、security、browser、gbrain、pair-agent 等。它的价值很大一部分来自“把方法论打包成可调用技能”。

FishSwarm 已复现内容：

- 支持 built-in、global、project skills。
- 支持 install/uninstall。
- 有插件 catalog/install/toggle/materialize。
- plugin runtime 可以物化 skills、commands、agents、hooks、MCP。
- 有 Office/PDF 等内置 skills。

复现度：55%-65%。

已经复现的部分：

- FishSwarm 具备承载 GStack skills 的基础架构。
- 插件化方向比 GStack 单仓技能更产品化。
- 能把能力分发、启用、禁用、安装管理起来。

没有复现的部分：

- GStack 的关键 slash-command 方法论还没有被移植成 FishSwarm 原生 workflow。
- skills 之间的产物传递、门禁和顺序执行还不够强。
- 缺少针对 `/autoplan`、`/qa`、`/review`、`/ship` 的模板和运行引擎。

如果补齐，效果会是：

- FishSwarm 可以把 GStack 的大量方法论变成可安装、可配置、可升级的插件包。
- 用户可以按项目启用“强工程治理模式”。

不补齐的缺陷：

- 有插件系统，但缺少最有价值的工程工作流插件。
- 系统可扩展，却没有把 GStack 已验证的方法论变成产品优势。

评价：

底座相当有潜力。应该优先拿 GStack 的角色评审和 QA/ship 工作流来验证这套插件系统。

### 2.10 安全基础 / Prompt Injection 防护

对应 FishSwarm 位置：

- `src/main/security/content-security.ts`
- `src/main/security/redact.ts`

原始 GStack 效果：

GStack 有更系统的安全设想：prompt injection 防护层、canary token、安全分类器、security dashboard、CSO/STRIDE/OWASP 审查、工具权限和远程 agent 隔离。

FishSwarm 已复现内容：

- 有 regex prompt-injection scan。
- 有 redaction。
- 有 untrusted content 包装。
- 对 API key/token/JWT/env secret 等做脱敏。
- decision store 里也调用注入扫描。

复现度：35%-45%。

已经复现的部分：

- 基础注入和敏感信息泄露风险已经被纳入系统。
- 多个写入路径有 redaction。

没有复现的部分：

- 没有 canary token 完整机制。
- 没有安全分类器。
- 没有 security dashboard。
- 没有完整 `/cso` 工作流。
- 没有把安全扫描结果变成发布门禁。

如果补齐，效果会是：

- FishSwarm 可以更适合处理外部网页、远程消息、第三方文档和自动化执行。
- 高风险任务能在执行前后形成安全审查记录。

不补齐的缺陷：

- 防护偏基础，遇到复杂 prompt injection 或供应链式上下文污染时可能不足。
- 安全结果不进入 release gate，容易被当成普通日志忽略。

评价：

安全底座有了，但还不够 GStack 的“安全官 + 发布门禁”效果。

### 2.11 Remote / Pair-Agent 相关能力

对应 FishSwarm 位置：

- `src/main/remote/`

原始 GStack 效果：

GStack 的 `/pair-agent` 更偏“远程 AI 结对工程师”：tab isolation、scoped tokens、rate limiting、activity visibility、远程浏览器协作和权限控制。

FishSwarm 已复现内容：

- 有 Feishu/Slack/gateway/tunnel/remote manager 一类远程入口。
- 支持远程消息或外部渠道接入 FishSwarm。

复现度：40%-50%，但能力方向不完全一样。

已经复现的部分：

- FishSwarm 有远程连接和消息入口。
- 具备把外部协作渠道纳入 agent 工作流的基础。

没有复现的部分：

- 没有完整 pair-agent 安全模型。
- 没有 tab/session scoped browser collaboration。
- 没有完整远程 agent 活动面板、权限续期和速率限制体系。

如果补齐，效果会是：

- 用户可以安全地把 FishSwarm 暴露给远程协作者、移动端或团队渠道。
- 远程触发任务可以进入同一套 guard/role/QA/release 流程。

不补齐的缺陷：

- 远程入口有价值，但如果权限、审计、活动可见性不强，自动化风险会上升。

评价：

这块不建议优先照搬 GStack。应先把 guard、审计、角色和 QA 门禁做实，再扩大远程 agent 能力。

## 3. 尚未融入内容与必要性评估

### 3.1 `/autoplan` 多角色自动评审流水线

是否有必要融入：非常有必要。

优先级：P0/P1。

原始 GStack 内容：

`/autoplan` 是 GStack 的核心方法论之一。它读取 CEO、Design、Engineering、DX review skill，严格按 CEO -> Design -> Engineering -> DX 顺序执行，包含双声音评审、Decision Audit Trail、Implementation Task Aggregator，并把产物作为后续执行和发布的依据。

为什么需要融入：

FishSwarm 当前已有 role runtime，但缺少强制顺序、强制产物、强制决策记录和任务聚合。也就是说，FishSwarm 已有演员，但还没有 GStack 那套剧本、调度和验收标准。把 `/autoplan` 融入后，角色能力才会真正变成产品级协同。

怎么融入：

- 新增 `src/main/orchestration/`，实现 workflow engine。
- 定义 `autoplan-lite` 工作流：intake -> CEO/Product -> Design -> Engineering -> DX -> decision audit -> task aggregation。
- 把每个阶段输出结构化为 JSON artifact。
- 每个阶段必须读取前一阶段 artifact。
- 在 renderer 增加 Plan Review Timeline 和 Final Plan View。
- 失败时允许用户重跑单阶段，而不是整条链重跑。

融入后的好处：

- 用户给一个模糊需求，FishSwarm 能产出经过多角色审查的可执行计划。
- 后续编码、测试、发布都有同一份决策依据。
- 角色协作从“看起来很聪明”变成“能稳定产出工程计划”。

不融入的缺陷：

- role runtime 的价值会被限制在辅助建议。
- 复杂需求仍然缺少系统性评审。
- FishSwarm 与 GStack 的核心差距会一直存在。

### 3.2 CEO / Design / Engineering / DX 深度评审模板

是否有必要融入：有必要。

优先级：P1。

原始 GStack 内容：

GStack 不只是让角色说一句建议，而是规定每个评审角色检查哪些部分。例如 CEO 要看战略、用户价值、优先级、商业取舍；Design 要看 UX、信息架构、交互；Engineering 要看架构、风险、测试；DX 要看开发者体验、维护成本、文档和操作路径。

为什么需要融入：

FishSwarm 内置角色已有职责描述，但缺少 GStack 那种可重复、可审计的评审 checklist。没有 checklist，输出质量会随模型状态波动。

怎么融入：

- 把评审模板做成版本化 methodology files。
- 每个角色输出统一字段：`findings`、`risks`、`required_changes`、`open_questions`、`acceptance_criteria`。
- 让角色 runtime 支持“普通建议模式”和“正式评审模式”。
- 正式评审模式下，缺少关键字段则要求模型重试。

融入后的好处：

- 评审稳定性提升。
- 可以比较不同版本计划的质量。
- 用户能看到每个角色到底审了什么。

不融入的缺陷：

- 多角色输出容易泛化。
- 难以形成可测试、可回归的工程治理。

### 3.3 双声音交叉评审

是否有必要融入：有必要，但应可配置。

优先级：P1。

原始 GStack 内容：

GStack 在多个 review 阶段使用两种声音：先由 Claude subagent 做深度评审，再由 Codex 做二次审查和综合。核心目的不是堆模型，而是降低单模型盲区。

为什么需要融入：

FishSwarm 是多模型产品，天然适合把关键决策交给不同模型互审。尤其在架构、安全、发布前检查中，第二声音很有价值。

怎么融入：

- 在 workflow engine 中支持 `reviewers: [primary, secondary]`。
- secondary reviewer 只能看 primary artifact 和原始输入，不直接继承 primary 结论。
- 增加 consensus/split-decision 输出。
- 对高成本模型增加开关：轻量任务默认关闭，关键任务开启。

融入后的好处：

- 降低单模型遗漏。
- 对高风险变更更稳。
- 让 FishSwarm 的多模型能力变成实质工程价值。

不融入的缺陷：

- 多模型优势没有完全释放。
- 复杂计划和安全问题仍可能被单一模型盲区影响。

### 3.4 Decision Audit Trail

是否有必要融入：非常有必要。

优先级：P1。

原始 GStack 内容：

GStack 要求在评审和计划中记录关键决策、理由、备选项、风险和后续影响，并检查 Decision Audit Trail 不能为空。

为什么需要融入：

FishSwarm 已有 decision store，但还没有把它变成 plan/review 的强制产物。Decision Audit Trail 是把角色协作和长期记忆连接起来的关键桥梁。

怎么融入：

- 在 autoplan 和 review 工作流中强制生成 `decision_audit_trail`。
- 自动写入 `decision-store`，但必须标注来源是 workflow artifact。
- 支持 supersede：后续变更可以废弃旧决策。
- UI 显示“本次任务关键决策”。

融入后的好处：

- 后续 agent 不需要猜“为什么当时这么定”。
- 用户可以审查和修改关键决策。
- memory、role runtime、QA 可以共享同一份决策依据。

不融入的缺陷：

- 决策会散落在聊天、计划和代码里。
- 项目长期演进时容易重复争论或误改旧约束。

### 3.5 Implementation Task Aggregator

是否有必要融入：非常有必要。

优先级：P1。

原始 GStack 内容：

GStack 会把 CEO/Design/Engineering/DX 的发现聚合成实施任务，去重、排序、标注依赖和验收条件。

为什么需要融入：

没有任务聚合，多角色评审只会产生大量意见。任务聚合才是把“意见”变成“能执行的工作列表”。

怎么融入：

- 增加 artifact `implementation_tasks`。
- 字段包括 `id`、`title`、`source_roles`、`priority`、`dependencies`、`acceptance_criteria`、`test_notes`。
- 和现有 plan/checklist UI 打通。
- 支持从 task 一键进入实现或测试。

融入后的好处：

- 用户能直接看到下一步做什么。
- agent 可以按任务执行，而不是按一大段计划自由发挥。
- QA 可以按任务验收。

不融入的缺陷：

- 多角色协作会停在“评论区”。
- 实施阶段可能漏掉设计、DX 或安全提出的问题。

### 3.6 `/qa` 和 `/qa-only`

是否有必要融入：非常有必要。

优先级：P1。

原始 GStack 内容：

GStack 的 `/qa` 不只是跑测试。它会找 bug、修 bug、重新验证、自动生成回归测试。`/qa-only` 则偏只验证不修改。

为什么需要融入：

FishSwarm 现在已有 browser runner、browser skills、role runtime、timeline，这些正好可以支撑 QA 工作流。QA 是让 GStack 方法论落地的关键环节。

怎么融入：

- 新增 QA workflow：read plan/artifacts -> identify test matrix -> run static/unit/browser checks -> collect evidence -> optionally fix -> rerun。
- `qa-only` 禁止写文件，只允许检查和报告。
- QA 结果写入 timeline 和 artifact store。
- 对 browser skill 自动回放，失败时保存截图和步骤。

融入后的好处：

- 用户可以让 FishSwarm 对一个功能做完整验收。
- 自动生成回归测试会让项目越做越稳。
- 发布前风险明显下降。

不融入的缺陷：

- FishSwarm 会偏“实现助手”，而不是“实现 + 验证助手”。
- Browser Skill Runtime 的价值无法完全释放。

### 3.7 `/review`

是否有必要融入：有必要。

优先级：P1/P2。

原始 GStack 内容：

GStack `/review` 是代码审查和变更风险检查，关注 bug、回归、测试缺口和发布风险。

为什么需要融入：

FishSwarm 已经能读项目、运行测试、管理角色。如果没有强 review workflow，用户仍需要手工要求“帮我 review”。

怎么融入：

- 按变更 diff 建立 review artifact。
- 用 engineering/security/QA roles 分别审。
- 输出 findings，必须包含文件、行号、严重程度、证据和修复建议。
- 与最终回复和 UI code comments 打通。

融入后的好处：

- 代码改动后的质量闭环更完整。
- 用户能得到稳定格式的审查结果。

不融入的缺陷：

- 容易只做“解释型总结”，而不是严格 review。
- 测试缺口和回归风险可能漏掉。

### 3.8 `/cso` 安全审查

是否有必要融入：有必要。

优先级：P1/P2。

原始 GStack 内容：

GStack `/cso` 覆盖 OWASP、STRIDE、安全边界、权限、注入、secret 泄露等。

为什么需要融入：

FishSwarm 处理浏览器、远程消息、插件、MCP、文件写入和 shell 命令，安全面比普通代码助手更大。只有基础 regex 防护不够。

怎么融入：

- 新增 security review workflow。
- 对外部内容、插件安装、MCP 配置、远程入口、shell 命令做重点检查。
- 输出 threat model、findings、required mitigations。
- 高风险 findings 可阻断 ship。

融入后的好处：

- 插件生态和远程入口更安全。
- 用户能把 FishSwarm 用在更高信任要求的项目里。

不融入的缺陷：

- 安全风险只靠分散工具防护，缺少总审查。
- 发布门禁不够硬。

### 3.9 `/ship` 和 `/canary`

是否有必要融入：有必要，但不应第一批做重。

优先级：P2/P3。

原始 GStack 内容：

GStack `/ship` 是 release engineer，负责发布前检查、测试确认、风险判断、变更摘要。`/canary` 用于小流量或渐进验证。

为什么需要融入：

FishSwarm 如果要从 coding assistant 走向工程协作者，需要发布门禁。不过发布系统涉及不同项目技术栈，必须做得谨慎。

怎么融入：

- 先做 local ship checklist，不直接自动发布。
- 聚合 plan、review、QA、security、git diff、test result。
- 输出 release readiness：ready / blocked / risky。
- Canary 先支持“生成 canary plan”，不默认执行生产操作。

融入后的好处：

- 用户在交付前能看到明确风险。
- QA、review、security 的结果不再散落。

不融入的缺陷：

- FishSwarm 能写代码，但不能可靠告诉用户“现在是否能发”。
- 多阶段产物缺少最后的聚合出口。

### 3.10 Design Review / Design Shotgun / Design Consultation

是否有必要融入：中高必要，取决于 FishSwarm 面向的项目类型。

优先级：P2。

原始 GStack 内容：

GStack 里有多种设计相关工作流，用于 UX 检查、视觉/交互方案发散、方案取舍和实现前咨询。

为什么需要融入：

FishSwarm 如果经常处理前端和产品体验，设计评审会明显提升质量。尤其是和浏览器截图、Playwright/visual QA 结合后，价值很高。

怎么融入：

- 先做 `design-review`，检查信息架构、任务流、状态、空态、错误态、响应式和可访问性。
- 再做 `design-shotgun`，生成多个方向但不自动实施。
- 与 browser screenshot 和视觉回归结果绑定。

融入后的好处：

- 前端输出不只“能用”，而是更稳定地接近产品级体验。
- 设计问题能在编码前暴露。

不融入的缺陷：

- 前端功能容易完成了才发现 UX 结构不顺。
- 设计角色在 FishSwarm 里会偏建议化，而不是评审化。

### 3.11 GBrain Setup / Sync

是否有必要融入：可选。

优先级：P3。

原始 GStack 内容：

GStack 提供 `/setup-gbrain`、`/sync-gbrain`，围绕独立 GBrain MCP 记忆系统做安装、同步、清理和 trust policy。

为什么不必优先融入：

FishSwarm 已经有自己的 memory service。强行复刻 GBrain 可能导致两套记忆系统并存，增加复杂度。

推荐做法：

- 不照搬 GBrain。
- 吸收 sync、cleanup、trust policy 的设计。
- 提供一次性 migration/import，而不是长期双系统。

融入后的好处：

- 有利于 GStack 用户迁移。
- 可复用已有 GBrain 知识资产。

不融入的缺陷：

- 对原 GStack/GBrain 用户迁移不友好。
- 但对 FishSwarm 核心体验影响有限。

### 3.12 Retro / Office Hours / 其它软流程

是否有必要融入：有价值，但优先级低。

优先级：P3。

原始 GStack 内容：

GStack 有 retro、office-hours 等面向团队复盘、咨询和知识沉淀的流程。

为什么不是优先级最高：

这些流程能提升长期项目质量，但 FishSwarm 当前更缺的是 autoplan、QA、review、ship 这类主干闭环。

推荐做法：

- 等主干 workflow engine 稳定后，把 retro 做成项目复盘插件。
- 复用 timeline、decision store、memory 做总结。

融入后的好处：

- 长期项目能沉淀经验。
- 用户能从历史失败和返工中提炼规则。

不融入的缺陷：

- 项目学习能力弱一些。
- 但不是当前最大短板。

### 3.13 iOS QA、OpenClaw、特定宿主适配

是否有必要融入：按需。

优先级：P4。

原始 GStack 内容：

GStack 包含一些特定平台或生态适配能力，例如 iOS QA、OpenClaw、某些宿主集成。

为什么不建议优先融入：

这些能力依赖具体用户群和技术栈。FishSwarm 当前更应该先做通用工程协同闭环。

推荐做法：

- 做成插件，不进核心。
- 只有当用户项目明确需要 iOS 或对应宿主能力时再安装启用。

融入后的好处：

- 对特定场景很强。

不融入的缺陷：

- 对通用 FishSwarm 体验影响小。

## 4. 推荐融合路线图

### Phase 1：把角色协同做成真正的 Autoplan

目标：

- 把现有 role runtime 升级为 workflow artifact pipeline。
- 完成 CEO/Product、Design、Engineering、DX 四阶段串行评审。
- 产出 Decision Audit Trail 和 Implementation Task Aggregator。

建议新增：

- `src/main/orchestration/workflow-engine.ts`
- `src/main/orchestration/artifact-store.ts`
- `src/main/orchestration/workflows/autoplan.ts`
- `src/main/roles/methodologies/*.json`
- renderer 中的 plan review timeline。

验收标准：

- 用户输入一个需求后，可以生成结构化计划。
- 每个角色输出都有 artifact。
- 后一角色能引用前一角色结论。
- 最终必须有决策审计和任务列表。

### Phase 2：把 QA / Review / Security 串起来

目标：

- 新增 `qa`、`qa-only`、`review`、`security-review` 工作流。
- 复用 browser runner、browser skills、timeline、decision store。
- 把 findings 和 evidence 结构化。

建议新增：

- `src/main/qa/qa-workflow.ts`
- `src/main/review/review-workflow.ts`
- `src/main/security/security-review-workflow.ts`
- `src/main/orchestration/evidence-store.ts`

验收标准：

- QA 能生成测试矩阵、运行检查、记录失败、可选修复、重新验证。
- Review 能按文件/行号输出 findings。
- Security review 能输出 threat model 和阻断项。

### Phase 3：发布门禁和可选生态迁移

目标：

- 新增 `ship-check` 和轻量 canary planning。
- 把 plan、QA、review、security、git diff 聚合为 release readiness。
- 可选支持 GBrain import/sync 思路。

建议新增：

- `src/main/release/ship-check-workflow.ts`
- `src/main/release/release-readiness.ts`
- memory migration/import 工具。

验收标准：

- 用户能看到 ready/blocked/risky。
- 阻断项能追溯到具体 QA/review/security artifact。
- 不默认执行生产发布，只给明确建议或受控操作。

## 5. 最重要的产品判断

如果只从 GStack 中挑最值得 FishSwarm 吸收的东西，不是更多命令，也不是更多角色名字，而是这三个：

1. 串行角色评审流水线。
2. 决策审计和任务聚合。
3. QA/review/security/ship 的质量闭环。

FishSwarm 当前已经有足够多底层模块支撑这三件事。真正缺的是把它们从“分散能力”提升为“可重复执行的工程流程”。如果补上这一层，FishSwarm 对 GStack 的吸收会从 40%-60% 的基础设施复现，跃迁到 70% 以上的方法论复现。

## 6. 当前融合状态总表

| GStack 能力 | FishSwarm 状态 | 复现度 | 是否建议继续融合 | 优先级 |
| --- | --- | ---: | --- | --- |
| GStack Browse runner | 已有 MCP adapter 和 runner | 45%-60% | 是，补 UI/证据/QA 绑定 | P1 |
| Browser Skill Runtime | 已有 workflow.json、草稿、运行、测试 | 50%-60% | 是，补参数化和回归绑定 | P1 |
| Role Runtime | 已有角色、router、subcall、UI | 35%-45% | 是，必须补 autoplan | P0/P1 |
| Session Guard / Freeze | 已有 guard store 和危险命令检测 | 55%-65% | 是，补审计和 UX | P1 |
| Question Policy / Decision Store | 已有问题偏好和本地决策 | 45%-55% | 是，接入 Decision Audit Trail | P1 |
| Context Save / Restore | 有轻量上下文快照 | 30%-40% | 是，但排在主流程后 | P2 |
| Timeline / Health | 有 timeline 和 health summary | 35%-45% | 是，升级为 dashboard/evidence | P1/P2 |
| Memory / GBrain | 有自研 memory，非原样 GBrain | 50%-70% | 选择性吸收 sync/trust 思想 | P3 |
| Skills / Plugin | 有较强底座 | 55%-65% | 是，用来承载 GStack workflows | P1 |
| Security / CSO | 有基础扫描和脱敏 | 35%-45% | 是，补 CSO workflow | P1/P2 |
| Remote / Pair-agent | 有远程入口，方向不同 | 40%-50% | 谨慎融合，先补权限审计 | P2/P3 |
| `/autoplan` | 基本未完整融入 | 10%-20% | 非常必要 | P0/P1 |
| `/qa` / `/qa-only` | 未形成完整 workflow | 15%-25% | 非常必要 | P1 |
| `/review` | 未形成完整 workflow | 15%-25% | 有必要 | P1/P2 |
| `/ship` / `/canary` | 未形成完整 release gate | 10%-20% | 有必要，谨慎做 | P2/P3 |
| GBrain setup/sync | 未原样融入 | 10%-20% | 可选 | P3 |
| iOS QA / 特定平台适配 | 基本未融入 | 0%-10% | 按需插件化 | P4 |

## 7. GStack 迁移代码段维护清单（第一批）

本节开始把 GStack 中“应该补进 FishSwarm 的关键片段”维护到同一份审计文档里。注意：这里不是建议把 GStack 的 bash/prompt 原样复制进 FishSwarm，而是记录原始片段、迁移价值、FishSwarm 目标落点，以及更适合 FishSwarm 的 TypeScript/产品化实现形态。

本次先维护 P0/P1 主干能力：

- `/autoplan` 多角色串行评审。
- 四个 plan review section manifest 和 required outputs。
- `/qa` 浏览器 QA、修复、回归测试、报告。
- `/review` diff 审查、specialist dispatch、adversarial review。
- `/cso` 安全审查、置信门槛、报告 schema。
- `/ship` 发布门禁、review dashboard、fresh verification。
- Browser Skill schema、分层加载、staging/atomic commit、untrusted env。
- Staging guard 的 owned-dir 判定。

### 7.1 `/autoplan` 串行阶段执行契约

GStack 来源：

- `gstack-main/autoplan/SKILL.md`
- 关键位置：Phase order、loaded review skills、dual voices、Decision Audit Trail、Implementation Tasks aggregator。

GStack 原始片段要点：

```md
Phases MUST execute in strict order: CEO -> Design -> Eng -> DX.
Each phase MUST complete fully before the next begins.
NEVER run phases in parallel; each builds on the previous.

Between each phase, emit a phase-transition summary and verify that all required
outputs from the prior phase are written before starting the next.
```

还需要同步迁移的执行要求：

```md
You MUST still:
- READ the actual code, diffs, and files each section references
- PRODUCE every output the section requires (diagrams, tables, registries, artifacts)
- IDENTIFY every issue the section is designed to catch
- DECIDE each issue using the 6 principles
- LOG each decision in the audit trail
- WRITE all required artifacts to disk
```

FishSwarm 目标落点：

- `src/main/orchestration/workflow-engine.ts`
- `src/main/orchestration/workflows/autoplan.ts`
- `src/main/orchestration/artifact-store.ts`
- `src/main/roles/role-runtime-service.ts`
- `src/main/work-habits/decision-store.ts`
- renderer：Role/Plan Review Timeline。

建议迁移成 FishSwarm 的结构化代码契约：

```ts
export type AutoplanPhaseId = 'ceo' | 'design' | 'engineering' | 'dx';

export interface AutoplanPhaseSpec {
  id: AutoplanPhaseId;
  roleId: string;
  required: boolean;
  dependsOn: AutoplanPhaseId[];
  skipWhen?: 'no-ui-scope' | 'no-dx-scope';
  requiredArtifacts: string[];
}

export interface AutoplanRunArtifact {
  runId: string;
  cwd: string;
  branch: string;
  phaseOrder: AutoplanPhaseId[];
  phaseArtifacts: Record<AutoplanPhaseId, string[]>;
  decisionAuditTrailId: string;
  implementationTaskListId: string;
  status: 'complete' | 'complete-with-warnings' | 'blocked';
}
```

迁移原因：

- GStack 的核心不是“四个角色都说话”，而是“前一阶段完成并落盘后，后一阶段才能开始”。
- FishSwarm 当前有 role runtime，但还缺这个强顺序和 artifact gate。
- 这段应成为 FishSwarm Role Orchestrator v2 的 P0 骨架。

不建议直接照抄的部分：

- GStack 里的 `codex exec`、`~/.claude/skills/gstack/...`、`AskUserQuestion` 路径是宿主绑定实现。
- FishSwarm 应改成自己的 model runner、IPC、artifact store、decision store 和 project timeline。

### 7.2 `/autoplan` 双声音评审

GStack 来源：

- `gstack-main/autoplan/SKILL.md`
- 关键位置：CEO/Design/Eng/DX 各阶段的 Dual Voices。

GStack 原始片段要点：

```md
Dual voices: always run BOTH Claude subagent AND Codex if available.
Run them sequentially in foreground. First the Claude subagent, then Codex.
Both must complete before building the consensus table.
```

FishSwarm 目标落点：

- `src/main/orchestration/reviewer-runner.ts`
- `src/main/claude/agent-runner.ts`
- `src/main/roles/role-runtime-service.ts`

建议迁移成 FishSwarm 的结构：

```ts
export interface ModelVoiceSpec {
  id: 'primary' | 'outside';
  modelProvider: 'configured-default' | 'codex' | 'openai' | 'anthropic';
  independentContext: boolean;
  timeoutMs: number;
  optional: boolean;
}

export interface DualVoiceConsensus {
  phaseId: AutoplanPhaseId;
  primaryFindings: string[];
  outsideFindings: string[];
  agreedFindings: string[];
  disagreements: Array<{
    topic: string;
    primary: string;
    outside: string;
    decision: 'accept-primary' | 'accept-outside' | 'needs-user';
    rationale: string;
  }>;
}
```

迁移原因：

- FishSwarm 是多模型产品，双声音机制可以把“多模型”从配置项变成质量增益。
- GStack 的独立声音强调“fresh context”，可以减少第一个角色输出对第二个模型的锚定。

补充要求：

- Codex/外部模型不可用时要降级，但 artifact 中必须记录降级原因。
- 外部声音只能读原始计划、前序 phase summary 和必要上下文，不能读 GStack/FishSwarm 的内部技能提示文件。

### 7.3 Decision Audit Trail

GStack 来源：

- `gstack-main/autoplan/SKILL.md`
- 关键位置：`## Decision Audit Trail` 和 final checklist。

GStack 原始片段要点：

```md
Audit trail:
- [ ] Decision Audit Trail has at least one row per auto-decision (not empty)

If ANY checkbox above is missing, go back and produce the missing output.
Max 2 attempts; if still missing after retrying twice, proceed to the gate with a warning.
```

FishSwarm 目标落点：

- `src/main/work-habits/decision-store.ts`
- `src/main/orchestration/artifact-store.ts`
- `src/main/observability/project-timeline.ts`

建议迁移成 FishSwarm 的数据结构：

```ts
export interface WorkflowDecisionRecord {
  id: string;
  runId: string;
  phaseId: AutoplanPhaseId | 'qa' | 'review' | 'ship' | 'security';
  decision: string;
  rationale: string;
  alternatives: string[];
  chosenBy: 'auto-principle' | 'user' | 'model-consensus';
  confidence: number;
  sourceArtifactId: string;
  supersedesDecisionId?: string;
}
```

迁移原因：

- FishSwarm 已有 decision store，但还没有变成 plan/review 的强制产物。
- GStack 的价值在于：没有决策审计就不算完整评审。

实现建议：

- Autoplan 每个 phase 结束时写 `WorkflowDecisionRecord[]`。
- 写入 decision store 时保留 `runId`、`phaseId`、`sourceArtifactId`。
- renderer 显示“本轮关键决策”，允许用户 supersede。

### 7.4 Implementation Tasks Aggregator

GStack 来源：

- `gstack-main/autoplan/SKILL.md`
- `gstack-main/plan-ceo-review/sections/review-sections.md`
- `gstack-main/plan-eng-review/sections/review-sections.md`
- `gstack-main/plan-design-review/sections/review-sections.md`
- `gstack-main/plan-devex-review/sections/review-sections.md`

GStack 原始片段要点：

```bash
TASKS_DIR="${HOME}/.gstack/projects/${SLUG:-unknown}"
BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)

# Collect entries from all 4 phases, scoped to current branch + commit window.
# For each phase, keep only the latest run_id.
# Dedupe by (component, sorted(files), title).
# Sort by priority (P1 > P2 > P3) then by phase order.
```

FishSwarm 目标落点：

- `src/main/orchestration/task-aggregator.ts`
- `src/main/orchestration/artifact-store.ts`
- renderer：Plan Task List / Role Review Summary。

建议迁移成 FishSwarm 的数据结构：

```ts
export interface ImplementationTask {
  id: string;
  runId: string;
  phaseId: AutoplanPhaseId;
  priority: 'P1' | 'P2' | 'P3';
  component: string;
  title: string;
  sourceFinding: string;
  files: string[];
  effortHuman?: string;
  effortAgent?: string;
  acceptanceCriteria: string[];
  testNotes: string[];
}

export function taskDedupKey(task: ImplementationTask): string {
  return JSON.stringify({
    component: task.component,
    files: [...task.files].sort(),
    title: task.title,
  });
}
```

迁移原因：

- 没有 task aggregator，多角色评审只会产生意见，不会变成执行队列。
- GStack 里每个 review phase 都写自己的 task jsonl，Autoplan 再聚合；FishSwarm 应改成统一 artifact store。

### 7.5 Plan Review Section Manifest

GStack 来源：

- `gstack-main/plan-ceo-review/sections/manifest.json`
- `gstack-main/plan-eng-review/sections/manifest.json`
- `gstack-main/plan-design-review/sections/manifest.json`
- `gstack-main/plan-devex-review/sections/manifest.json`

GStack manifest 片段：

```json
{
  "$schema": "https://gstack.dev/schemas/section-manifest.json",
  "skill": "plan-eng-review",
  "version": 1,
  "sections": [
    {
      "id": "review-sections",
      "file": "review-sections.md",
      "title": "Architecture/Code/Test/Performance review, outside voice, required outputs + review report",
      "trigger": "running the 4-section review, outside voice, required outputs, and review report"
    }
  ]
}
```

FishSwarm 目标落点：

- `src/main/roles/methodologies/`
- `src/main/orchestration/methodology-loader.ts`

建议迁移成 FishSwarm 的 methodology manifest：

```ts
export interface RoleMethodologyManifest {
  id: string;
  roleId: string;
  version: number;
  sections: Array<{
    id: string;
    title: string;
    sourceFile: string;
    requiredOutputs: string[];
    trigger: string;
  }>;
}
```

应优先维护的四类 section：

- CEO/Product：11-section deep review，包含架构、错误/救援、安全、数据流、测试、性能、观测、部署、长期演进、设计。
- Engineering：Architecture、Code quality、Test review、Performance。
- Design：7 passes，信息架构、交互状态、用户旅程、AI slop、设计系统、响应式/可访问性、未决设计决策。
- DX：8 passes，getting started、API/CLI/SDK、错误消息、文档、迁移、开发环境、社区生态、DX measurement。

迁移原因：

- FishSwarm 现在角色职责是 prose handbook，缺 GStack 这种可版本化的 methodology manifest。
- 这会让角色评审从“模型自由发挥”变成“按固定深度检查”。

### 7.6 `/qa` 浏览器 QA 工作流

GStack 来源：

- `gstack-main/qa/SKILL.md`
- `gstack-main/qa/templates/qa-report-template.md`
- `gstack-main/qa/references/issue-taxonomy.md`

GStack 原始片段要点：

```md
You are a QA engineer AND a bug-fix engineer.
Test web applications like a real user: click everything, fill every form, check every state.
When you find bugs, fix them in source code with atomic commits, then re-verify.
Produce a structured report with before/after evidence.
```

模式片段：

```md
Diff-aware:
1. Analyze the branch diff.
2. Identify affected pages/routes from the changed files.
3. Detect the running app on common local dev ports.
4. Test each affected page/route.
5. Cross-reference with commit messages and PR description.
6. Check TODOS.md.
7. Report findings scoped to the branch changes.
```

修复循环片段：

```md
For each fixable issue, in severity order:
8a. Locate source
8b. Fix with the minimal change
8c. Commit one fix per issue
8d. Re-test with before/after screenshot pair
8e. Classify: verified / best-effort / reverted
8e.5. Regression Test
```

FishSwarm 目标落点：

- `src/main/qa/qa-workflow.ts`
- `src/main/qa/qa-report-store.ts`
- `src/main/skills/browser-skill-runtime.ts`
- `src/main/mcp/gstack-browse-runner.ts`
- `src/main/observability/project-timeline.ts`

建议迁移成 FishSwarm 的数据结构：

```ts
export interface QaIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'visual' | 'functional' | 'ux' | 'content' | 'performance' | 'console' | 'accessibility';
  url: string;
  description: string;
  reproSteps: string[];
  evidence: {
    beforeScreenshot?: string;
    afterScreenshot?: string;
    consoleErrors?: string[];
  };
  fixStatus: 'deferred' | 'verified' | 'best-effort' | 'reverted';
  regressionTest?: {
    path: string;
    status: 'committed' | 'deferred' | 'skipped';
  };
}

export interface QaRunArtifact {
  runId: string;
  mode: 'diff-aware' | 'full' | 'quick' | 'regression';
  targetUrl?: string;
  branch: string;
  commit: string;
  healthScore: number;
  issues: QaIssue[];
  shipReadiness: 'ready' | 'risky' | 'blocked';
}
```

迁移原因：

- FishSwarm 已有 browser runner 和 browser skill runtime，正好缺 QA workflow 把它们串起来。
- GStack 的 QA 价值在“找 bug -> 修 -> 截图复验 -> 回归测试 -> ship readiness”，不是单纯打开浏览器看一下。

### 7.7 QA Report Template

GStack 来源：

- `gstack-main/qa/templates/qa-report-template.md`

GStack 报告结构要点：

```md
# QA Report: {APP_NAME}

## Health Score: {SCORE}/100
## Top 3 Things to Fix
## Console Health
## Summary
## Issues
## Fixes Applied
## Before/After Evidence
## Regression Tests
## Ship Readiness
```

FishSwarm 目标落点：

- `src/main/qa/qa-report-renderer.ts`
- renderer：QA Report View。

建议迁移方式：

- 不直接写 `.gstack/qa-reports`，改写 `.fishswarm/qa-reports` 或 FishSwarm artifact store。
- 仍保留 health score、issue taxonomy、before/after evidence、regression tests、ship readiness。
- QA artifact 应被 `/ship` 或 `ship-check` 读取。

### 7.8 `/review` Diff 审查与 Specialist Dispatch

GStack 来源：

- `gstack-main/review/SKILL.md`
- `gstack-main/review/checklist.md`
- `gstack-main/review/specialists/*.md`

GStack scope drift 片段：

```md
Before reviewing code quality, check: did they build what was requested, nothing more, nothing less?

Output:
Scope Check: [CLEAN / DRIFT DETECTED / REQUIREMENTS MISSING]
Intent: <1-line summary>
Delivered: <1-line summary>
```

Specialist dispatch 片段：

```md
Always-on with 50+ changed lines:
1. Testing
2. Maintainability

Conditional:
3. Security
4. Performance
5. Data Migration
6. API Contract
7. Design

Each specialist outputs JSON objects:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,
"category":"category","summary":"description","fix":"recommended fix",
"fingerprint":"path:line:category","specialist":"name"}
```

FishSwarm 目标落点：

- `src/main/review/review-workflow.ts`
- `src/main/review/specialist-router.ts`
- `src/main/review/finding-store.ts`
- `src/main/observability/project-timeline.ts`

建议迁移成 FishSwarm 的数据结构：

```ts
export interface ReviewFinding {
  severity: 'CRITICAL' | 'INFORMATIONAL';
  confidence: number;
  path: string;
  line?: number;
  category: string;
  summary: string;
  fix?: string;
  fingerprint: string;
  specialist: 'core' | 'testing' | 'maintainability' | 'security' | 'performance' | 'data-migration' | 'api-contract' | 'design' | 'red-team';
  action?: 'auto-fixed' | 'fixed' | 'skipped' | 'needs-user';
}

export interface ReviewRunArtifact {
  runId: string;
  base: string;
  head: string;
  scopeCheck: 'clean' | 'drift-detected' | 'requirements-missing';
  specialists: Record<string, { dispatched: boolean; findings: number; reason?: string }>;
  qualityScore: number;
  findings: ReviewFinding[];
}
```

迁移原因：

- FishSwarm 目前有普通 review 能力，但没有 GStack 的 specialist army 和 finding merge/dedupe。
- 这能直接服务发布门禁，让 `/ship` 不只看测试是否通过。

### 7.9 `/review` Adversarial Review

GStack 来源：

- `gstack-main/review/SKILL.md`
- 关键位置：Step 5.7 Adversarial review。

GStack 原始片段要点：

```md
Every diff gets adversarial review from both Claude and Codex.
LOC is not a proxy for risk; a 5-line auth change can be critical.

Claude adversarial subagent always runs.
Codex adversarial challenge runs when CODEX_MODE is ready.
Codex structured review runs for large diffs only, 200+ lines.
```

FishSwarm 目标落点：

- `src/main/review/adversarial-review.ts`
- `src/main/orchestration/reviewer-runner.ts`

建议迁移方式：

- Always-on adversarial pass 可先只用 FishSwarm 当前默认模型的 fresh-context subcall。
- 多模型 Codex/OpenAI pass 做成可配置增强项。
- 输出合并进 `ReviewRunArtifact.findings`，并标记来源 `specialist: 'red-team'` 或 `source: 'outside-model'`。

### 7.10 `/cso` 安全审查

GStack 来源：

- `gstack-main/cso/SKILL.md`
- `gstack-main/cso/sections/audit-phases.md`

GStack 模式解析片段：

```md
/cso                 -> full daily audit, all phases, 8/10 confidence gate
/cso --comprehensive -> monthly deep scan, all phases, 2/10 bar
/cso --infra         -> infrastructure-only
/cso --code          -> code-only
/cso --skills        -> skill supply chain only
/cso --diff          -> branch changes only
/cso --owasp         -> OWASP Top 10 only
```

安全阶段要点：

```md
Phase 0: Architecture Mental Model + Stack Detection
Phase 1: Attack Surface Census
Phase 7: LLM & AI Security
Phase 8: Skill Supply Chain
Phase 9: OWASP Top 10 Assessment
Phase 10: STRIDE Threat Model
Phase 12: False Positive Filtering + Active Verification
Phase 13: Findings Report + Trend Tracking + Remediation
Phase 14: Save Report
```

FishSwarm 目标落点：

- `src/main/security/security-review-workflow.ts`
- `src/main/security/security-report-store.ts`
- `src/main/security/content-security.ts`
- `src/main/skills/plugin-runtime-service.ts`

建议迁移成 FishSwarm 的数据结构：

```ts
export interface SecurityFinding {
  id: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'TENTATIVE';
  confidence: number;
  status: 'VERIFIED' | 'UNVERIFIED' | 'TENTATIVE';
  phase: number;
  category: 'Secrets' | 'Supply Chain' | 'CI/CD' | 'Infrastructure' | 'Integrations' | 'LLM Security' | 'Skill Supply Chain' | 'OWASP';
  fingerprint: string;
  title: string;
  file?: string;
  line?: number;
  exploitScenario: string;
  impact: string;
  recommendation: string;
}

export interface SecurityReportArtifact {
  runId: string;
  mode: 'daily' | 'comprehensive';
  scope: 'full' | 'infra' | 'code' | 'skills' | 'supply-chain' | 'owasp';
  diffMode: boolean;
  phasesRun: number[];
  findings: SecurityFinding[];
  filterStats: {
    candidatesScanned: number;
    hardExclusionFiltered: number;
    confidenceGateFiltered: number;
    verificationFiltered: number;
    reported: number;
  };
}
```

迁移原因：

- FishSwarm 有 prompt injection scan 和 redaction，但还没有 CSO workflow。
- GStack 的重点是“安全报告必须有 exploit scenario、confidence gate、active verification”，这比简单 grep 更可靠。

### 7.11 LLM / AI Security 与 Skill Supply Chain

GStack 来源：

- `gstack-main/cso/sections/audit-phases.md`

GStack LLM Security 片段要点：

```md
Search for:
- Prompt injection vectors: user input flowing into system prompts or tool schemas
- Unsanitized LLM output: dangerouslySetInnerHTML, v-html, innerHTML, raw()
- Tool/function calling without validation
- AI API keys in code
- Eval/exec of LLM output

Only flag prompt injection when user content enters system prompts, tool schemas,
or function-calling contexts.
```

GStack Skill Supply Chain 片段要点：

```md
Scan local skill SKILL.md files for:
- curl, wget, fetch, http, exfiltrat
- ANTHROPIC_API_KEY, OPENAI_API_KEY, env., process.env
- IGNORE PREVIOUS, system override, disregard, forget your instructions
```

FishSwarm 目标落点：

- `src/main/security/content-security.ts`
- `src/main/skills/skills-manager.ts`
- `src/main/skills/plugin-runtime-service.ts`

迁移建议：

- 插件安装前、技能启用前、远程技能同步前都跑 skill supply-chain scan。
- 把 scan 结果写入 timeline 和 security report。
- 对高危项要求用户明确批准或拒绝安装。

### 7.12 `/ship` 发布门禁

GStack 来源：

- `gstack-main/ship/SKILL.md`
- `gstack-main/ship/sections/manifest.json`

GStack 原始片段要点：

```md
Re-running /ship means "run the whole checklist again."
Every verification step runs on every invocation:
tests, coverage audit, plan completion, pre-landing review, adversarial review,
VERSION/CHANGELOG check, TODOS, document-release.

Only actions are idempotent.
Never skip a verification step because a prior /ship run already performed it.
```

Review Readiness Dashboard 要点：

```md
Find the most recent entry for each skill:
plan-ceo-review, plan-eng-review, review, plan-design-review,
design-review-lite, adversarial-review, codex-review, codex-plan-review.

Verdict:
- CLEARED: Eng Review has a recent clean entry
- NOT CLEARED: Eng Review missing, stale, or has open issues
```

Fresh verification 片段：

```md
IRON LAW: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

If ANY code changed after the test run, re-run the test suite.
If the project has a build step, run it.
"Should work now" -> RUN IT.
"I'm confident" -> Confidence is not evidence.
```

FishSwarm 目标落点：

- `src/main/release/ship-check-workflow.ts`
- `src/main/release/release-readiness.ts`
- `src/main/review/finding-store.ts`
- `src/main/qa/qa-report-store.ts`
- `src/main/orchestration/artifact-store.ts`

建议迁移成 FishSwarm 的 release gate：

```ts
export interface ReleaseReadiness {
  runId: string;
  branch: string;
  head: string;
  verdict: 'ready' | 'blocked' | 'risky';
  gates: Array<{
    id: 'tests' | 'coverage' | 'plan-completion' | 'review' | 'adversarial' | 'qa' | 'security' | 'build';
    status: 'pass' | 'fail' | 'stale' | 'missing' | 'skipped';
    required: boolean;
    evidenceArtifactId?: string;
    message: string;
  }>;
  staleEvidence: string[];
  requiredActions: string[];
}
```

迁移原因：

- FishSwarm 不能只会实现代码，还要能回答“现在能不能发”。
- Ship gate 应聚合 QA、review、security、tests、build、plan completion，而不是新写一套孤立逻辑。

### 7.13 Ship Section Manifest

GStack 来源：

- `gstack-main/ship/sections/manifest.json`

GStack manifest 片段：

```json
{
  "skill": "ship",
  "sections": [
    { "id": "tests", "file": "tests.md", "title": "Test bootstrap, run, triage + eval suites" },
    { "id": "test-coverage", "file": "test-coverage.md", "title": "Test coverage audit (subagent)" },
    { "id": "plan-completion", "file": "plan-completion.md", "title": "Plan completion + verification audit (subagent)" },
    { "id": "review-army", "file": "review-army.md", "title": "Pre-landing review + specialist army" },
    { "id": "adversarial", "file": "adversarial.md", "title": "Adversarial review + learnings refresh" },
    { "id": "pr-body", "file": "pr-body.md", "title": "Documentation sync + PR/MR creation" }
  ]
}
```

FishSwarm 迁移建议：

- 不需要照搬 PR/MR 创建和 VERSION bump，先做 `ship-check`。
- 先把 section manifest 转为 FishSwarm release checklist registry。
- 每个 gate 都要求 evidence artifact。

### 7.14 Browser Skill Frontmatter 与三层优先级

GStack 来源：

- `gstack-main/browse/src/browser-skills.ts`

GStack 原始 TypeScript 片段要点：

```ts
export interface SkillFrontmatter {
  name: string;
  description?: string;
  host: string;
  triggers: string[];
  args: SkillArg[];
  trusted: boolean;
  version?: string;
  source?: 'human' | 'agent';
}

export interface BrowserSkill {
  name: string;
  tier: SkillTier;
  dir: string;
  frontmatter: SkillFrontmatter;
  bodyMd: string;
}
```

三层加载规则要点：

```ts
// Walk in priority order: project first, so it wins over global/bundled.
const order = [
  { tier: 'project', root: t.project },
  { tier: 'global', root: t.global },
  { tier: 'bundled', root: t.bundled },
];
```

FishSwarm 当前状态：

- `src/main/skills/browser-skill-runtime.ts` 已有 project/global/bundled 层级和 workflow.json。

建议补强：

- 把 `trusted`、`host`、`triggers`、`source`、`version` 作为 FishSwarm browser skill 的正式 schema 字段。
- UI 上显示 trust/source/tier，让用户知道这个技能来自项目、全局还是内置。
- `trusted=false` 默认只能使用 scrubbed env 和 allowlisted browser commands。

### 7.15 Browser Skill 安全写入与 Atomic Commit

GStack 来源：

- `gstack-main/browse/src/browser-skill-write.ts`

GStack 原始片段要点：

```ts
const SKILL_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function validateSkillName(name: string): void {
  if (!name) throw new Error('Skill name is empty.');
  if (name.length > 64) throw new Error(`Skill name too long`);
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error('Invalid skill name');
  }
}
```

Staging 与 commit 要点：

```ts
export function stageSkill(opts: StageSkillOptions): string {
  validateSkillName(opts.name);
  if (opts.files.size === 0) throw new Error('files map is empty');

  const wrapperDir = path.join(tmpRoot, `skillify-${spawnId}`);
  const stagedDir = path.join(wrapperDir, opts.name);

  for (const [relPath, contents] of opts.files) {
    if (relPath.startsWith('/') || relPath.includes('..')) {
      throw new Error(`Invalid file path in stageSkill: "${relPath}".`);
    }
    fs.writeFileSync(path.join(stagedDir, relPath), contents);
  }

  return stagedDir;
}

export function commitSkill(opts: CommitSkillOptions): string {
  validateSkillName(opts.name);
  // refuse symlinked staging dir
  // resolve real tier root
  // refuse destination escape
  // refuse to clobber existing skill
  // atomic rename into final tier
}
```

FishSwarm 目标落点：

- `src/main/skills/browser-skill-runtime.ts`
- `src/main/skills/browser-skillify-service.ts`

建议补强：

- FishSwarm 已有 staging 概念，但需要核对是否完全具备：name regex、relPath escape check、symlink staging dir 拒绝、real tier root escape check、refuse clobber、atomic rename。
- 这些不是 UX 细节，是 agent-authored workflow 写入的安全边界。

### 7.16 Browser Skill Spawn Token 与 Untrusted Env

GStack 来源：

- `gstack-main/browse/src/browser-skill-commands.ts`

GStack spawnSkill 片段要点：

```ts
// 1. Mint a scoped token.
// 2. Build env: trusted=true -> process.env; trusted=false -> scrubbed.
// 3. Spawn script.ts with cwd=skill.dir.
// 4. Capture stdout/stderr with cap and timeout.
// 5. On exit/timeout, revoke token. Always.
```

GStack untrusted env 片段要点：

```ts
const UNTRUSTED_ALLOWLIST = new Set([
  'LANG', 'LC_ALL', 'LC_CTYPE',
  'TERM',
  'TZ',
]);

if (!opts.trusted) {
  for (const k of Object.keys(out)) {
    if (SECRET_KEY_PATTERNS.some(p => p.test(k))) delete out[k];
  }
}

out.GSTACK_PORT = String(opts.port);
out.GSTACK_SKILL_TOKEN = opts.skillToken;
```

FishSwarm 目标落点：

- `src/main/skills/browser-skill-runtime.ts`
- `src/main/mcp/gstack-browse-runner.ts`
- `src/main/security/redact.ts`

建议补强：

- 如果 FishSwarm 后续从 JSON workflow 扩展到 script skill，必须先迁移 scoped token + timeout + capped output + env scrub。
- 当前 JSON workflow 也应记录 trust model：项目技能、全局技能、内置技能的执行权限不同。

### 7.17 Staging Guard / Owned Directory 判定

GStack 来源：

- `gstack-main/lib/staging-guard.ts`

GStack 原始片段要点：

```ts
export const STAGING_PREFIX = ".staging-ingest-";
export const STAGING_MARKER = ".gstack-staging";

export function checkOwnedStagingDir(dir: string, gstackHome: string): StagingVerdict {
  // realpath(dir) and realpath(gstackHome)
  // target must be a directory
  // dirname(canon) must equal home
  // basename must start with STAGING_PREFIX
  // refuse if path contains .git
  // STAGING_MARKER must exist and be a regular file, not symlink
  // return canonicalPath for deletion, not raw input
}
```

FishSwarm 目标落点：

- `src/main/session/session-guard-store.ts`
- `src/main/skills/browser-skill-runtime.ts`
- `src/main/context/context-state-service.ts`
- 后续如果增加 memory/context staging，也应复用同一 guard。

建议迁移成通用工具：

```ts
export interface OwnedTempDirPolicy {
  root: string;
  prefix: string;
  markerFile: string;
  forbidGitWorktree: boolean;
}

export interface OwnedTempDirVerdict {
  ok: boolean;
  reason?: string;
  canonicalPath?: string;
}
```

迁移原因：

- FishSwarm 后续会有 browser skillify、artifact staging、memory import、plugin materialize 等多种 agent-authored 写入路径。
- 所有“递归删除/移动 staging dir”的地方都应该先证明目录是 FishSwarm 自己铸造的。

## 8. 下一批待维护的 GStack 片段

第一批已经把 P0/P1 主干的首批迁移素材写入文档。下面这些是第二批要维护的 GStack 文件；第 9 节已经开始把它们整理为 FishSwarm 可迁移素材。

- `gstack-main/ship/sections/tests.md`：测试命令发现、失败 triage、prompt/eval suite 触发规则。
- `gstack-main/ship/sections/test-coverage.md`：覆盖率 gate 和用户 override。
- `gstack-main/ship/sections/plan-completion.md`：计划完成度逐项验证。
- `gstack-main/ship/sections/review-army.md`：ship 内置 pre-landing review。
- `gstack-main/review/specialists/*.md`：各 specialist 的具体 checklist。
- `gstack-main/qa/references/issue-taxonomy.md`：QA issue taxonomy 全量迁移到 FishSwarm schema。
- `gstack-main/context-save` / `context-restore`：连续 checkpoint 和恢复协议。
- `gstack-main/setup-gbrain` / `sync-gbrain`：只迁移 trust/sync/cleanup 思想，不建议照搬 GBrain。

## 9. GStack 迁移代码段维护清单（第二批）

第二批重点是把第 8 节里的待维护项推进成可落地的 FishSwarm 设计素材。与第 7 节一样，本节不主张把 GStack 的宿主绑定 bash 全量复制到 FishSwarm，而是提炼出可产品化的 TypeScript 接口、artifact schema、gate 规则和安全边界。

### 9.1 Ship Tests Gate / 测试框架发现与失败归因

GStack 来源：

- `gstack-main/ship/sections/tests.md`

GStack 原始片段要点：

```md
Step 4: Test Framework Bootstrap
- Detect existing test framework and project runtime.
- If test framework detected, read 2-3 existing test files to learn conventions.
- If runtime detected but no test framework, offer bootstrap.
- Generate 3-5 real tests for existing code.
- Never import secrets, API keys, or credentials in test files.

Step 5: Run tests
- Run detected test suites.
- If any test fails, do not immediately stop.
- Apply Test Failure Ownership Triage.
```

失败归因规则要点：

```md
Classify each failure:
- In-branch if failing test was modified on this branch, output references code changed on this branch, or trace reaches branch diff.
- Likely pre-existing if neither test nor code under test was modified and failure is unrelated to branch changes.
- When ambiguous, default to in-branch.
```

FishSwarm 目标落点：

- `src/main/release/test-gate.ts`
- `src/main/testing/test-framework-detector.ts`
- `src/main/testing/test-failure-triage.ts`
- `src/main/release/release-readiness.ts`

建议迁移成 FishSwarm 的结构：

```ts
export interface TestFrameworkDetection {
  runtime: 'node' | 'ruby' | 'python' | 'go' | 'rust' | 'php' | 'unknown';
  framework: 'vitest' | 'jest' | 'playwright' | 'rspec' | 'pytest' | 'go-test' | 'cargo-test' | 'unknown';
  testCommand?: string;
  evidenceFiles: string[];
  existingTestSamples: string[];
}

export interface TestFailureTriage {
  failureId: string;
  testFile?: string;
  sourceFile?: string;
  classification: 'in-branch' | 'likely-pre-existing' | 'ambiguous';
  evidence: string[];
  action: 'block-ship' | 'todo' | 'fix-separately' | 'skip-with-note';
}

export interface TestGateArtifact {
  runId: string;
  detection: TestFrameworkDetection;
  command: string;
  exitCode: number;
  failures: TestFailureTriage[];
  gate: 'pass' | 'blocked' | 'pass-with-preexisting-failures' | 'skipped';
}
```

迁移价值：

- FishSwarm 的 `ship-check` 不能只看“测试失败了”或“测试通过了”，还要能判断失败是否由当前分支引入。
- 这可以减少被历史坏测试阻塞，同时避免把当前分支破坏伪装成历史问题。

注意事项：

- FishSwarm 不应自动 bootstrap 测试框架作为默认发布流程的第一版；第一版可以只做检测、运行、归因和报告。
- Bootstrap 属于高影响代码变更，应作为显式动作或后续 P2。

### 9.2 Ship Eval Gate / Prompt 与模型相关文件的条件验证

GStack 来源：

- `gstack-main/ship/sections/tests.md`

GStack 原始片段要点：

```md
Evals are mandatory when prompt-related files change.
Skip this step entirely if no prompt files are in the diff.

Prompt-related files include prompt builders, evaluators, scorers, classifier services,
analyzers, system prompts, eval infrastructure and fixtures.

If unsure which suites are affected, run ALL suites that could plausibly be impacted.
Over-testing is better than missing a regression.
```

FishSwarm 目标落点：

- `src/main/release/eval-gate.ts`
- `src/main/testing/changed-file-classifier.ts`
- `src/main/release/release-readiness.ts`

建议迁移成 FishSwarm 的结构：

```ts
export interface EvalGateArtifact {
  runId: string;
  promptRelatedFiles: string[];
  affectedSuites: Array<{
    name: string;
    command: string;
    reason: string;
    exitCode?: number;
  }>;
  gate: 'pass' | 'blocked' | 'skipped' | 'unavailable';
  costSummary?: string;
}
```

迁移价值：

- FishSwarm 本身大量依赖 prompt、role、tool schema、model runner。修改这些文件时，只跑普通 unit test 不足以证明行为没坏。
- 这条 gate 可以变成“AI 行为变更专用验证”。

### 9.3 Test Coverage Audit Gate

GStack 来源：

- `gstack-main/ship/sections/test-coverage.md`

GStack 原始片段要点：

```md
100% coverage is the goal.
Evaluate what was ACTUALLY coded from the diff, not what was planned.

Trace every codepath changed:
- Read the diff.
- For each changed file, read the full file, not just diff hunk.
- Build a map of every line of code that can execute differently based on input.
- Every branch in this diagram needs a test.
```

覆盖率门禁要点：

```md
Defaults:
- Minimum = 60%
- Target = 80%

>= target: Pass.
>= minimum, < target: ask user to generate tests, ship anyway, or mark intentionally uncovered.
< minimum: hard warning; recommend generating tests before shipping.

If coverage percentage cannot be determined, skip the gate with explicit reason.
Do not default to 0% or block.
```

FishSwarm 目标落点：

- `src/main/release/coverage-gate.ts`
- `src/main/testing/coverage-audit.ts`
- `src/main/orchestration/artifact-store.ts`

建议迁移成 FishSwarm 的结构：

```ts
export interface ChangedCodePath {
  id: string;
  file: string;
  branchOrPath: string;
  risk: 'low' | 'medium' | 'high';
  coveredBy: string[];
  uncoveredReason?: string;
}

export interface CoverageGateArtifact {
  runId: string;
  base: string;
  head: string;
  changedCodePaths: ChangedCodePath[];
  coveragePct?: number;
  minimumPct: number;
  targetPct: number;
  generatedTests: string[];
  gate: 'pass' | 'needs-user' | 'overridden' | 'skipped';
  gateReason: string;
}
```

迁移价值：

- GStack 这里的“coverage”不是传统 Istanbul 覆盖率，而是 AI 对 diff codepath 的结构化审计。
- FishSwarm 如果照搬思想，可以在没有完善覆盖率工具的项目里也给出测试风险判断。

### 9.4 Plan Completion Audit Gate

GStack 来源：

- `gstack-main/ship/sections/plan-completion.md`
- `gstack-main/qa-only/SKILL.md`

GStack 原始片段要点：

```md
Extract every actionable item from the plan:
- Implementation bullets
- Test bullets
- Migration bullets
- Explicit file/path deliverables
- External setup items

Classify each item:
- DONE
- NOT DONE
- CHANGED
- UNVERIFIABLE
```

Path concreteness rule：

```md
If a plan item names a concrete filesystem path, it MUST be classified DONE or NOT DONE
based on file existence or validator output.
UNVERIFIABLE is only valid when the path is genuinely abstract or unreachable.
```

Gate logic 要点：

```md
Any NOT DONE items: highest priority, block or explicitly defer/drop.
Any UNVERIFIABLE items: confirm one at a time; never blanket-confirm all.
All DONE or CHANGED: pass.
```

FishSwarm 目标落点：

- `src/main/release/plan-completion-gate.ts`
- `src/main/orchestration/artifact-store.ts`
- `src/main/release/release-readiness.ts`

建议迁移成 FishSwarm 的结构：

```ts
export type PlanCompletionStatus = 'DONE' | 'NOT_DONE' | 'CHANGED' | 'UNVERIFIABLE' | 'PARTIAL';

export interface PlanCompletionItem {
  id: string;
  text: string;
  category: 'implementation' | 'test' | 'migration' | 'cross-repo' | 'external';
  status: PlanCompletionStatus;
  evidence: string[];
  manualVerificationPrompt?: string;
}

export interface PlanCompletionArtifact {
  runId: string;
  planArtifactId?: string;
  items: PlanCompletionItem[];
  totals: Record<PlanCompletionStatus, number>;
  gate: 'pass' | 'blocked' | 'needs-manual-verification' | 'skipped';
}
```

迁移价值：

- 这条 gate 是避免“计划写得很好，但实际没做完”的关键。
- FishSwarm 的 Autoplan 产物一旦上线，Ship 就必须能逐项审计计划是否完成。

### 9.5 Plan Verification / QA-only Bridge

GStack 来源：

- `gstack-main/ship/sections/plan-completion.md`

GStack 原始片段要点：

```md
Automatically verify the plan's testing/verification steps using /qa-only.

Use the plan's verification section as the primary test input.
Skip the fix loop; this is report-only verification during /ship.
Cap at the verification items from the plan; do not expand into general site QA.
```

FishSwarm 目标落点：

- `src/main/qa/qa-only-workflow.ts`
- `src/main/release/plan-verification-gate.ts`
- `src/main/mcp/gstack-browse-runner.ts`

建议迁移成 FishSwarm 的结构：

```ts
export interface PlanVerificationCase {
  id: string;
  instruction: string;
  targetUrl?: string;
  result: 'pass' | 'fail' | 'skipped';
  evidenceArtifactIds: string[];
}

export interface PlanVerificationArtifact {
  runId: string;
  planArtifactId: string;
  cases: PlanVerificationCase[];
  gate: 'pass' | 'blocked' | 'skipped';
}
```

迁移价值：

- 这能把 Autoplan 的“验收标准”真正交给浏览器/测试 runner 执行。
- 与第 7 节的 QA workflow 互补：`qa-only` 在发布前只验证，不自动修复。

### 9.6 Ship Review Army / 发布内置结构审查

GStack 来源：

- `gstack-main/ship/sections/review-army.md`

GStack 原始片段要点：

```md
Review the diff for structural issues that tests don't catch.

Every finding MUST include a confidence score.
Pre-emit verification gate requires quoting the motivating code line.

Specialists:
- Testing
- Maintainability
- Security
- Performance
- Data Migration
- API Contract
- Design
- Red Team when diff > 200 lines or critical findings exist
```

Finding merge 要点：

```md
Group findings by fingerprint.
Keep highest confidence.
Tag multi-specialist confirmation.
Boost confidence by +1, cap at 10.
Confidence 7+: main output.
5-6: caveat.
3-4: appendix.
1-2: suppress.
```

FishSwarm 目标落点：

- `src/main/review/specialist-router.ts`
- `src/main/review/finding-merge.ts`
- `src/main/release/review-gate.ts`

建议迁移成 FishSwarm 的合并函数契约：

```ts
export interface FindingMergeResult {
  findings: ReviewFinding[];
  suppressed: ReviewFinding[];
  appendix: ReviewFinding[];
  qualityScore: number;
  multiSpecialistConfirmed: string[];
}

export function mergeReviewFindings(findings: ReviewFinding[]): FindingMergeResult {
  // fingerprint group -> highest confidence -> confirmation boost -> confidence gates
  throw new Error('implementation placeholder');
}
```

迁移价值：

- 第 7 节已经维护了 `/review` 的独立工作流；这一节补的是 `/ship` 里的内嵌发布前审查。
- 两者应共用同一套 `ReviewFinding` schema，避免 review 和 ship 两套格式漂移。

### 9.7 Review Specialist Checklist Registry

GStack 来源：

- `gstack-main/review/specialists/testing.md`
- `gstack-main/review/specialists/maintainability.md`
- `gstack-main/review/specialists/security.md`
- `gstack-main/review/specialists/performance.md`
- `gstack-main/review/specialists/data-migration.md`
- `gstack-main/review/specialists/api-contract.md`
- `gstack-main/review/specialists/red-team.md`

GStack 统一输出 schema：

```json
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,
"category":"testing|maintainability|security|performance|data-migration|api-contract|red-team",
"summary":"...","fix":"...","fingerprint":"path:line:category","specialist":"name"}
```

应迁移的 specialist 类别：

| Specialist | GStack 检查类别 | FishSwarm 建议用途 |
| --- | --- | --- |
| testing | negative-path、edge-case、isolation、flaky、security enforcement、coverage gaps | review/ship 测试风险 |
| maintainability | dead code、magic numbers、stale comments、DRY、conditional side effects、module boundary | 自动修复或建议 |
| security | trust boundary、auth、injection、crypto、secrets、XSS、deserialization | review/CSO 共享 |
| performance | N+1、missing index、algorithmic complexity、bundle、rendering、pagination、async blocking | review/ship |
| data-migration | reversibility、data loss、lock duration、backfill、index creation、multi-phase safety | DB 变更门禁 |
| api-contract | breaking changes、versioning、error consistency、rate limiting、docs drift、compatibility | API 变更门禁 |
| red-team | happy path attack、silent failures、trust assumptions、edge breaks、cross-specialist gaps | 大 diff 或 critical 后追加 |

FishSwarm 目标落点：

- `src/main/review/specialists/`
- `src/main/review/specialist-registry.ts`

建议迁移成 FishSwarm 的 registry：

```ts
export type ReviewSpecialistId =
  | 'testing'
  | 'maintainability'
  | 'security'
  | 'performance'
  | 'data-migration'
  | 'api-contract'
  | 'design'
  | 'red-team';

export interface ReviewSpecialistSpec {
  id: ReviewSpecialistId;
  category: string;
  alwaysOn?: boolean;
  enabledWhen: string[];
  checklist: string[];
  outputSchema: 'ReviewFinding';
}
```

迁移价值：

- 这套 checklist 可以先以 JSON/Markdown methodology 形式进入 FishSwarm，不必马上实现多 agent 并行。
- 第一版可以串行跑 selected specialists；第二版再并行。

### 9.8 QA Issue Taxonomy

GStack 来源：

- `gstack-main/qa/references/issue-taxonomy.md`

GStack taxonomy 要点：

```md
Severity:
- critical: blocks core workflow, data loss, crash
- high: major feature broken or unusable, no workaround
- medium: feature works but noticeable problems, workaround exists
- low: cosmetic or polish issue

Categories:
- visual
- functional
- ux
- content
- performance
- console
- accessibility
```

Per-page exploration checklist：

```md
1. Visual scan
2. Interactive elements
3. Forms
4. Navigation
5. States
6. Console
7. Responsiveness
8. Auth boundaries
```

FishSwarm 目标落点：

- `src/main/qa/qa-taxonomy.ts`
- `src/main/qa/qa-workflow.ts`
- renderer：QA issue filter/grouping。

建议迁移成 FishSwarm 的常量：

```ts
export const QA_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export const QA_CATEGORIES = [
  'visual',
  'functional',
  'ux',
  'content',
  'performance',
  'console',
  'accessibility',
] as const;

export const QA_PAGE_CHECKLIST = [
  'visual-scan',
  'interactive-elements',
  'forms',
  'navigation',
  'states',
  'console',
  'responsiveness',
  'auth-boundaries',
] as const;
```

迁移价值：

- FishSwarm 的 QA 结果必须稳定分类，否则后续 ship readiness 无法聚合。
- 这个 taxonomy 可以直接成为 QA artifact、UI filter 和 report renderer 的共同枚举。

### 9.9 Context Save / Restore

GStack 来源：

- `gstack-main/context-save/SKILL.md`
- `gstack-main/context-restore/SKILL.md`

GStack context-save 片段要点：

```md
Gather state:
- branch
- git status --short
- git diff --stat
- git diff --cached --stat
- git log --oneline -10

Summarize:
1. What's being worked on
2. Decisions made
3. Remaining work
4. Notes
```

Saved file frontmatter 要点：

```yaml
---
status: in-progress
branch: {current branch name}
timestamp: {ISO-8601 timestamp}
session_duration_s: {computed duration}
files_modified:
  - path/to/file1
---
```

GStack context-restore 要点：

```md
Default: load the most recent saved context across ALL branches.
Do NOT filter the candidate set by current branch.
The branch is recorded in frontmatter, not used for filtering.
If current branch differs, tell the user.
```

FishSwarm 当前状态：

- `src/main/context/context-state-service.ts` 已有轻量 context state。

FishSwarm 目标落点：

- `src/main/context/context-state-service.ts`
- `src/main/context/context-checkpoint-store.ts`
- `src/main/observability/project-timeline.ts`

建议迁移成 FishSwarm 的结构：

```ts
export interface SavedContextArtifact {
  id: string;
  status: 'in-progress' | 'complete' | 'blocked';
  title: string;
  cwd: string;
  branch: string;
  timestamp: string;
  sessionDurationSeconds?: number;
  filesModified: string[];
  git: {
    statusShort: string;
    diffStat: string;
    stagedDiffStat: string;
    recentLog: string;
  };
  summary: string;
  decisionsMade: string[];
  remainingWork: string[];
  notes: string[];
}

export interface ContextRestoreCandidate {
  artifactId: string;
  title: string;
  branch: string;
  timestamp: string;
  branchDiffersFromCurrent: boolean;
}
```

迁移价值：

- FishSwarm 现在能恢复最近会话，但还不够恢复“工程执行状态”。
- 引入 saved context artifact 后，Autoplan、QA、Review、Ship 的 artifact 可以成为恢复的一部分。

### 9.10 Continuous Checkpoint Mode

GStack 来源：

- `gstack-main/context-save/SKILL.md`
- `gstack-main/context-restore/SKILL.md`

GStack 原始片段：

```md
If CHECKPOINT_MODE is continuous:
- auto-commit completed logical units with WIP prefix.
- commit after new intentional files, completed modules, verified bug fixes,
  and before long-running install/build/test commands.

Rules:
- stage only intentional files
- NEVER git add -A
- do not commit broken tests or mid-edit state
- push only if CHECKPOINT_PUSH is true

/context-restore reads [gstack-context]; /ship squashes WIP commits into clean commits.
```

FishSwarm 目标落点：

- `src/main/context/checkpoint-mode.ts`
- `src/main/git/git-service.ts`
- `src/main/release/ship-check-workflow.ts`

建议迁移成 FishSwarm 的结构：

```ts
export interface ContinuousCheckpointConfig {
  mode: 'explicit' | 'continuous';
  push: boolean;
  wipCommitPrefix: 'WIP:';
  requireCleanTests: boolean;
  forbidAddAll: boolean;
}

export interface WipCheckpointCommit {
  sha: string;
  message: string;
  contextBlock: {
    decisions: string[];
    remaining: string[];
    tried?: string[];
    workflow?: string;
  };
}
```

迁移建议：

- 不建议第一版默认开启 continuous checkpoint。
- 可以先做显式 `/context-save` 式保存，再把 WIP commit 作为高级开关。
- 如果做 WIP commit，Ship 必须能识别并 squash/整理，否则用户历史会被 WIP 噪声污染。

### 9.11 GBrain Setup / Sync 中值得吸收的部分

GStack 来源：

- `gstack-main/setup-gbrain/SKILL.md`
- `gstack-main/sync-gbrain/SKILL.md`

不建议原样迁移的部分：

- 不建议把 GBrain 作为 FishSwarm 第二套长期记忆默认引入。
- 不建议照搬 Claude Code 的 MCP 注册命令、`~/.claude/skills/gstack/...` 路径、Supabase provision 细节。

建议吸收的设计：

1. Per-repo trust policy。
2. Artifacts sync mode：`full`、`artifacts-only`、`off`。
3. Remote/shared brain 的 personal/shared trust policy。
4. Worktree-scoped source pin。
5. Sync dry-run、full、incremental、audit 模式。
6. Idempotent doctor/verdict block。
7. 并发 lock 与 stale lock 处理。

GStack per-repo policy 片段要点：

```md
If in git repo with origin remote:
- read-write: import this repo and embed
- read-only: search allowed but do not import/write
- deny: do not sync this repo
- unset: ask how this remote should interact with gbrain
```

GStack artifacts sync 片段要点：

```md
Artifacts sync options:
- full sync
- artifacts-only
- decline, keep everything local

Artifacts are CEO plans, designs, reports, retros.
```

FishSwarm 目标落点：

- `src/main/memory/memory-service.ts`
- `src/main/memory/memory-policy-store.ts`
- `src/main/orchestration/artifact-store.ts`
- `src/main/observability/health-service.ts`

建议迁移成 FishSwarm 的结构：

```ts
export type MemoryTrustTier = 'read-write' | 'read-only' | 'deny' | 'unset';
export type ArtifactSyncMode = 'full' | 'artifacts-only' | 'off';
export type BrainTrustPolicy = 'personal' | 'shared' | 'unset';

export interface MemoryRepoPolicy {
  remote: string;
  trustTier: MemoryTrustTier;
  artifactSyncMode: ArtifactSyncMode;
  updatedAt: string;
}

export interface MemorySyncVerdict {
  status: 'green' | 'yellow' | 'red';
  rows: Array<{
    label: string;
    state: 'OK' | 'WARN' | 'ERR' | 'FIX';
    detail: string;
  }>;
}
```

迁移价值：

- FishSwarm 的 memory 已经存在，缺的是“哪些 repo/remote 可以写入长期记忆”的清晰策略。
- 把 GStack 的 trust policy 吸收进 FishSwarm memory，比照搬 GBrain 更干净。

### 9.12 GBrain Search Guidance 可转化为 FishSwarm Memory Guidance

GStack 来源：

- `gstack-main/setup-gbrain/SKILL.md`
- `gstack-main/sync-gbrain/SKILL.md`

GStack guidance 要点：

```md
Prefer gbrain when:
- You need semantic search across concepts.
- You need symbol-aware code lookup.
- You need cross-session/project memory.

Use Grep for exact strings, filenames, and file globs.
```

FishSwarm 目标落点：

- `src/main/memory/memory-service.ts`
- `src/main/context/context-builder.ts`
- `src/main/claude/agent-runner.ts`

建议迁移方式：

- 改成 FishSwarm Memory Guidance，不写入 `CLAUDE.md`，而是由 context builder 动态注入。
- 按任务类型选择 retrieval：
  - exact file/string：`rg` 或本地搜索。
  - concept/history/decision：FishSwarm memory + decision store。
  - symbol/code graph：如果 FishSwarm 未来有 code index，再加入。

建议结构：

```ts
export interface RetrievalGuidance {
  preferExactSearchWhen: string[];
  preferMemoryWhen: string[];
  preferDecisionStoreWhen: string[];
  disabledReasons?: string[];
}
```

迁移价值：

- 避免把“长期记忆”无差别塞进每次上下文。
- 让 FishSwarm 的 memory 使用有边界、有解释、可关闭。

## 10. 第三批仍需维护的片段

第二批之后，GStack 中仍建议继续维护到文档的内容包括：

- `gstack-main/ship/sections/adversarial.md`：ship 独立 adversarial section，比 review 内嵌版更完整。
- `gstack-main/ship/sections/pr-body.md`：PR body 结构、redaction scan、自检，可以迁移为 FishSwarm release summary。
- `gstack-main/ship/sections/changelog.md`：CHANGELOG 生成规则，适合迁移为 release notes generator。
- `gstack-main/ship/sections/greptile.md`：第三方 review comment triage，可作为外部审查输入适配层。
- `gstack-main/canary/SKILL.md`：canary 发布和渐进验证。
- `gstack-main/pair-agent/SKILL.md`：远程 pair-agent 的权限和活动可见性。
- `gstack-main/guard`、`freeze`、`careful`、`unfreeze`：补完 FishSwarm session guard 的 UX 和审计。
- `gstack-main/design-review`、`design-shotgun`、`design-consultation`：补前端设计审查和方案发散。
- `gstack-main/retro`、`learn`、`office-hours`：长期复盘和团队记忆沉淀。

以下第 11 节已把这批内容拆成可迁移的代码段、FishSwarm 落点和必要性评估。它们不等价于“全部立即实现”，而是先把 GStack 原本的工作流效果维护成 FishSwarm 可以逐步吸收的工程契约。

## 11. GStack 迁移代码段维护清单（第三批）

### 11.0 第三批吸收状态总表

| GStack 片段 | FishSwarm 当前状态 | 是否完美复现 GStack 效果 | 融入必要性 |
|---|---|---|---|
| `ship/sections/adversarial.md` | FishSwarm 有多角色 review、QA、Security，但没有 ship 内置的双模型 adversarial gate。 | 未复现。现有角色能发现问题，但缺少“每个 diff 必过”的独立反方审查和结构化 synthesis。 | 高。适合并入 release/review gate。 |
| `ship/sections/pr-body.md` | 有 artifact 展示和角色验证，但没有 release summary / PR body renderer。 | 未复现。缺少 freshness、redaction、测试/评审/设计/计划完成度的统一出站摘要。 | 高。可直接提升交付闭环。 |
| `ship/sections/changelog.md` | 没有专门 changelog generator。 | 未复现。FishSwarm 目前不会强制每个 commit 映射到 release notes bullet。 | 中。做 release workflow 时应补。 |
| `ship/sections/greptile.md` | 有 review 角色，但没有第三方 review comment adapter。 | 未复现。没有 valid/actionable、already fixed、false positive 的外部评论分类协议。 | 中高。若接 GitHub/GitLab/Greptile 很有价值。 |
| `canary/SKILL.md` | `src/main/db/release-validator.ts` 有灰度阶段概念，但没有浏览器截图基线监控。 | 部分吸收。FishSwarm 有 canary 名词和 phase，但没复现 GStack 的视觉 baseline 和异常处置。 | 高。适合与 gstack browse runner 结合。 |
| `pair-agent/SKILL.md` | `src/main/remote/` 已有远程控制、配对、隧道、授权用户。 | 部分吸收。FishSwarm 做的是聊天/远程会话，不是“远程 AI agent 拥有独立 browser tab + scoped capability”。 | 中高。需要时可演化，不宜一次照搬。 |
| `guard/freeze/careful/unfreeze` | `src/main/session/session-guard-store.ts` 已有 freezeRoot 和 destructive command guard。 | 部分复现但语义不同。FishSwarm 当前更偏 hard block，GStack 是 warn/block 混合、强调用户决策 brief。 | 高。应补审计、模式和 UI 状态。 |
| `design-review` | 有 `product-designer` 角色，但没有截图证据、分数、before/after 修复循环。 | 部分吸收。角色理念已吸收，工作流和产物未复现。 | 高。对前端任务价值很大。 |
| `design-shotgun` | 没有多设计变体生成、comparison board、taste profile。 | 未复现。 | 中。偏增强能力，适合后续做设计探索模式。 |
| `design-consultation` | 有 Product Strategist / Product Designer，但没有 DESIGN.md 咨询生成闭环。 | 部分吸收。角色存在，设计系统源文件和 proposal gate 未复现。 | 中高。适合做新功能前置方案。 |
| `retro/SKILL.md` | 有 `project-timeline.ts` 和 learnings JSONL，但没有 weekly/global retro。 | 部分吸收。底层记录有，复盘分析器没有。 | 中高。对长期协同很重要。 |
| `learn/SKILL.md` | 有 `learnings.list`、`learnings.add` 和设置页展示。 | 部分吸收。缺 search/prune/export/stats、staleness/contradiction 检查。 | 高。它是 FishSwarm 长期记忆的运维界面。 |
| `office-hours/SKILL.md` | 有产品/设计角色，但没有 office-hours 的问题诊断、备选方案选择、设计文档和 handoff。 | 未完整复现。 | 中高。适合作为 FishSwarm 的“开工前群体协同”入口。 |

第三批的总体结论：FishSwarm 已经吸收了“角色协同”和“基础记忆/远程/安全”的骨架，但 GStack 更强的是把每个协作动作都变成可复查 artifact、gate、brief、report。鱼群项目还没有完全吃下这层“协同工作流的产物化”。

### 11.1 Ship Adversarial Review Gate

GStack 来源：
- `gstack-main/ship/sections/adversarial.md`

GStack 原始效果：
- 每个 ship diff 都进入 adversarial review，不以 LOC 大小决定是否需要审查。
- 至少两路视角：主模型 fresh-context adversarial subagent，以及可用时的 Codex outside review。
- 小 diff 也不能跳过。GStack 明确强调 5 行 auth 改动可能比 500 行 UI 改动更危险。
- Findings 分成 `FIXABLE` 和 `INVESTIGATE`，并以 `Recommendation: <action> because <reason>` 收尾。
- 大 diff 会进入结构化 review，`[P1]` 级别发现会让 gate fail。
- 结果持久化到 review log，并做跨模型 synthesis：多源一致、Claude 独有、Codex 独有、使用过哪些模型。

FishSwarm 当前吸收情况：
- 已有内置角色体系，尤其是 `security-officer`、`engineering-architect`、`qa-release-steward`。
- 已有 `change-scope-router.ts` 能根据变更范围推荐 `gstack-review`、`gstack-cso`、`gstack-ship`。
- 但没有“ship 前必跑 adversarial gate”，也没有双模型/多源 finding synthesis artifact。

复现评价：
- 不是完美复现。FishSwarm 的角色 review 是协同专家判断，GStack adversarial 是发布闸门。两者理念相近，但运行时机、强制性、产物和 fail 条件都不同。

建议 FishSwarm 落点：
- `src/main/review/adversarial-review.ts`
- `src/main/release/adversarial-gate.ts`
- `src/main/orchestration/reviewer-runner.ts`
- `src/main/observability/project-timeline.ts`

建议迁移结构：

```ts
export interface AdversarialReviewArtifact {
  runId: string;
  base: string;
  head: string;
  diffTotal: number;
  modelModes: Record<'primary' | 'outside', 'ready' | 'disabled' | 'not-installed' | 'not-authed' | 'failed'>;
  findings: ReviewFinding[];
  gate: 'pass' | 'fail' | 'informational' | 'skipped';
  recommendation: string;
  synthesis: {
    highConfidence: string[];
    uniqueToPrimary: string[];
    uniqueToOutside: string[];
  };
}
```

必要性判断：
- 应融入，优先级高。它能把“鱼群多角色协同”从建议层推到 release gate 层，避免角色意见散落在聊天里。

不建议照搬的部分：
- 不要硬编码 Claude/Codex 名称，可抽象成 `primary` 和 `outside`。
- 不要复制 GStack 的 `.claude` 路径和 shell 脚本式日志路径，应进入 FishSwarm timeline/artifact store。

### 11.2 Release Summary / PR Body Renderer

GStack 来源：
- `gstack-main/ship/sections/pr-body.md`

GStack 原始效果：
- PR 创建前先由文档同步 subagent 输出 JSON：`files_updated`、`commit_sha`、`pushed`、`documentation_section`。
- PR/MR 创建和更新是幂等的：如果已有 open PR，就更新；否则创建。
- PR body 每次都从 fresh results 重新生成，不能复用旧 body。
- PR title 必须带新版本号，并自检 title 是否以版本号开头。
- PR body 包含 Summary、Test Coverage、Pre-Landing Review、Design Review、Eval Results、Greptile Review、Scope Drift、Plan Completion、Linked Spec、Verification Results、TODOS、Documentation、Test plan。
- 出站前做 redaction scan，扫描 PR body 临时文件和 title；发现 credential 则阻断。

FishSwarm 当前吸收情况：
- 有 artifact parser 和 ContextPanel artifact 展示。
- 有 QA / Release Steward 角色。
- 没有统一 release summary renderer，也没有 PR body redaction gate。

复现评价：
- 未复现。FishSwarm 现在能显示产物，但还不能把测试、评审、计划、设计、外部评论、文档同步合成为一个可发布摘要。

建议 FishSwarm 落点：
- `src/main/release/release-summary.ts`
- `src/main/release/pr-body-renderer.ts`
- `src/main/security/redact.ts`
- `src/main/observability/project-timeline.ts`

建议迁移结构：

```ts
export interface ReleaseSummaryArtifact {
  runId: string;
  branch: string;
  title: string;
  sections: Array<{
    id: string;
    title: string;
    markdown: string;
    sourceArtifactIds: string[];
  }>;
  redaction: {
    status: 'pass' | 'blocked' | 'redacted';
    findings: string[];
  };
  freshness: {
    regeneratedAt: string;
    staleInputs: string[];
  };
}
```

必要性判断：
- 应融入，优先级高。它是把鱼群协同成果交付出去的“收口层”。没有这个层，多角色输出容易停留在过程里。

### 11.3 Changelog / Release Notes Generator

GStack 来源：
- `gstack-main/ship/sections/changelog.md`

GStack 原始效果：
- 自动读取 CHANGELOG header 格式。
- 枚举 branch 上的每个 commit，并把 commit 当成 checklist。
- 读取 full diff，按主题分组。
- 写入新版本的统一 entry，常见分类为 Added、Changed、Fixed。
- 强制 cross-check：每个 commit 至少映射到一个 bullet。
- 不询问用户“改了什么”，而是从 diff 和 history 推断。

FishSwarm 当前吸收情况：
- 没有 changelog generator。
- `src/main/db/release-validator.ts` 只负责数据库 release validation，不负责用户可读 release notes。

复现评价：
- 未复现。

建议 FishSwarm 落点：
- `src/main/release/changelog-generator.ts`
- `src/main/release/release-notes.ts`
- `src/main/observability/project-timeline.ts`

建议迁移结构：

```ts
export interface ChangelogDraft {
  version?: string;
  base: string;
  head: string;
  commitChecklist: Array<{
    sha: string;
    subject: string;
    represented: boolean;
    themes: string[];
  }>;
  sections: {
    added: string[];
    changed: string[];
    fixed: string[];
    security?: string[];
  };
  unmappedCommits: string[];
}
```

必要性判断：
- 中等优先级。FishSwarm 如果近期要强化 release/PR flow，应同步做；如果暂时只是本地桌面 app 内部开发，可排在 adversarial/release summary 后面。

### 11.4 External Review Adapter（Greptile 类评论）

GStack 来源：
- `gstack-main/ship/sections/greptile.md`

GStack 原始效果：
- 如果 PR 存在，ship 会拉取 Greptile 评论并分类。
- 分类由独立 triage 子流程完成，不直接改代码、不提交，只报告。
- 每条评论必须有 `classification`、`escalation_tier`、文件位置、summary、permalink。
- 分类包括 `valid_actionable`、`already_fixed`、`false_positive`、`suppressed`。
- 对 valid actionable 评论要让用户选择：现在修、承认风险继续 ship、标记 false positive。
- 对 already fixed 评论自动回复证据和修复 commit。
- 修完评论后测试视为 stale，需要重跑。

FishSwarm 当前吸收情况：
- 有多角色 review，但没有外部 review provider adapter。
- 没有把 GitHub/GitLab/Greptile 评论转换成统一 FishSwarm finding 的接口。

复现评价：
- 未复现。

建议 FishSwarm 落点：
- `src/main/review/external-review-adapter.ts`
- `src/main/release/external-review-gate.ts`
- `src/main/observability/project-timeline.ts`

建议迁移结构：

```ts
export interface ExternalReviewComment {
  provider: 'greptile' | 'github' | 'gitlab' | 'custom';
  classification: 'valid_actionable' | 'already_fixed' | 'false_positive' | 'suppressed';
  escalationTier: 1 | 2;
  ref: string;
  summary: string;
  permalink?: string;
  action: 'fix' | 'acknowledge' | 'reply-fp' | 'skip';
}
```

必要性判断：
- 中高。若 FishSwarm 后续接代码托管平台，这是非常值得吸收的评论归一化层；如果短期没有 PR/MR 集成，可先保留接口。

### 11.5 Canary Monitor / Post-Deploy Visual Check

GStack 来源：
- `gstack-main/canary/SKILL.md`

GStack 原始效果：
- 部署后持续监控指定 URL 和页面。
- 支持 `--baseline` 先采集上线前截图，baseline 是后续判断的核心。
- 支持 `--duration`、`--pages`、`--quick`。
- 每轮截图与 baseline 或 pre-deploy snapshot 对比。
- 异常时让用户选择 Investigate、Continue monitoring、Rollback。
- 输出 markdown/json 报告和 JSONL 历史记录。
- GStack 规则很明确：没有 baseline 时只算 health check，不算真正 canary。

FishSwarm 当前吸收情况：
- `src/main/db/release-validator.ts` 有灰度阶段：pre-release、canary、small、medium、large、full。
- `src/main/mcp/gstack-browse-runner.ts` 已有浏览器运行基础。
- 但没有页面 baseline、截图对比、异常处置和 canary report store。

复现评价：
- 部分吸收。FishSwarm 吸收了“灰度阶段”的概念，但没有吸收 GStack canary 的视觉验证闭环。

建议 FishSwarm 落点：
- `src/main/release/canary-monitor.ts`
- `src/main/qa/canary-report-store.ts`
- `src/main/mcp/gstack-browse-runner.ts`
- renderer 中的 canary report 面板。

建议迁移结构：

```ts
export interface CanaryMonitorConfig {
  url: string;
  pages: string[];
  durationMinutes: number;
  mode: 'baseline' | 'monitor' | 'quick';
}

export interface CanaryCheckResult {
  page: string;
  checkNumber: number;
  screenshotArtifactId: string;
  status: 'healthy' | 'degraded' | 'broken';
  anomalies: string[];
}

export interface CanaryReportArtifact {
  runId: string;
  baselineArtifactId?: string;
  config: CanaryMonitorConfig;
  status: 'HEALTHY' | 'DEGRADED' | 'BROKEN';
  checks: CanaryCheckResult[];
  recommendedAction: 'update-baseline' | 'investigate' | 'rollback' | 'none';
}
```

必要性判断：
- 应融入，优先级高。FishSwarm 如果要服务真实前端/网页交付，canary 是 QA / Release Steward 的自然延伸。

### 11.6 Pair-Agent / Remote Browser Session

GStack 来源：
- `gstack-main/pair-agent/SKILL.md`

GStack 原始效果：
- 一条命令创建 setup key 和给远程 AI agent 的接入说明。
- 远程 agent 拥有自己的 browser tab，默认 read+write，必要时 admin。
- setup key 10 分钟过期，session token 24 小时过期。
- 本机 agent 写配置即可，不同机器则尝试 ngrok 或提供 tunnel 指引。
- 支持 revoke、rotate root token。
- capability 受限：可导航、点击、填写、截图、新建 tab；不能访问本地文件系统、不能跑 shell、不能看其他 agent 的 tab、不能访问非 allowlist domain。

FishSwarm 当前吸收情况：
- `src/main/remote/` 已有 gateway、tunnel、message-router、配对、授权用户、owner sender 校验。
- UI 里已有远程控制面板、配对请求、授权用户、撤销授权。
- 但 FishSwarm 当前 remote 更像“外部聊天渠道控制本地 agent session”，不是“远程 AI agent 控制独立浏览器 tab”。

复现评价：
- 部分吸收，但不是同一种产品形态。FishSwarm 的远程控制在身份、配对、隧道上已经比 GStack pair-agent 有相似骨架；缺的是 browser tab ownership、domain allowlist、capability matrix 和每个 agent 的 tab 隔离。

建议 FishSwarm 落点：
- `src/main/remote/pair-agent-service.ts`
- `src/main/remote/session-token-store.ts`
- `src/main/mcp/gstack-browse-runner.ts`
- `src/main/observability/project-timeline.ts`

建议迁移结构：

```ts
export interface PairAgentSession {
  id: string;
  agentName: string;
  access: 'read' | 'read-write' | 'admin';
  allowedDomains: string[];
  tabId: string;
  setupKeyExpiresAt: string;
  sessionExpiresAt: string;
  tunnelUrl?: string;
  revokedAt?: string;
}

export interface PairAgentCapability {
  command: 'goto' | 'snapshot' | 'click' | 'fill' | 'screenshot' | 'newtab';
  allowed: boolean;
  reason?: string;
}
```

必要性判断：
- 中高，但建议分阶段。先补 capability matrix 和审计事件；真正 browser-tab scoped pair-agent 可等 FishSwarm 需要多外部 agent 同屏协作时再做。

### 11.7 Guard / Freeze / Careful / Unfreeze

GStack 来源：
- `gstack-main/careful/SKILL.md`
- `gstack-main/freeze/SKILL.md`
- `gstack-main/guard/SKILL.md`
- `gstack-main/unfreeze/SKILL.md`

GStack 原始效果：
- `careful`：对破坏性命令做运行前检查，常见危险包括 `rm -rf`、`DROP TABLE`、force push、`git reset --hard`、`git checkout .`、`kubectl delete` 等。
- `freeze`：把写入限制在某个目录内，只挡 Edit/Write；Read/Bash/Glob/Grep 不受影响。它明确说明这不是安全边界，因为 Bash 仍可改外部文件。
- `guard`：组合 careful + freeze。
- `unfreeze`：清掉 freeze 状态。
- GStack 更重视“session scoped state + 用户确认 UX”。

FishSwarm 当前吸收情况：
- `src/main/session/session-guard-store.ts` 已有：
  - `frozen`
  - `freezeRoot`
  - `destructiveCommandGuard`
  - `assertWriteAllowed`
  - `assertCommandAllowed`
- FishSwarm 的 destructive guard 当前是 hard block，而不是 warn。
- FishSwarm freeze 还会阻挡 command cwd 不在 freezeRoot 的命令，这比 GStack 原版更严格。

复现评价：
- 部分复现，但不是完美复现。FishSwarm 已有核心约束能力，甚至更强；缺的是 GStack 的模式化 UX、决策记录、warn/block 可配置、命中 pattern 的可解释审计。

建议 FishSwarm 落点：
- `src/main/session/session-guard-policy.ts`
- `src/main/session/destructive-command-classifier.ts`
- `src/main/session/session-guard-store.ts`
- renderer 中的 session guard 状态和一键 freeze/unfreeze 控件。

建议迁移结构：

```ts
export interface SessionGuardPolicy {
  careful: boolean;
  freezeRoot?: string;
  destructiveCommandMode: 'off' | 'warn' | 'block';
  appliesTo: Array<'shell' | 'write' | 'edit' | 'move' | 'delete'>;
}

export interface GuardDecision {
  allowed: boolean;
  decision: 'allow' | 'warn' | 'deny';
  reason: string;
  matchedPattern?: string;
  boundary?: string;
}
```

必要性判断：
- 应融入，优先级高。已有实现只差产品化和审计化，不是重做。

### 11.8 Design Review Workflow

GStack 来源：
- `gstack-main/design-review/SKILL.md`

GStack 原始效果：
- 以资深产品设计师 + 前端工程师视角做视觉 QA。
- 读取 `DESIGN.md` 或设计系统文档，没有则用通用设计原则，并可建议创建。
- 对 live site 截图，做首屏印象、设计系统抽取、逐页视觉审计、交互流、跨页一致性、报告、triage、修复循环、最终复审。
- 每个 finding 需要截图证据。
- 有 Design Score 和 AI Slop Score。
- 修复循环强调 minimal fix、before/after 截图、重跑 audit。

FishSwarm 当前吸收情况：
- `src/main/roles/built-in-roles.ts` 已有 `product-designer`，能审 UI、状态、层级、文案和视觉一致性。
- 但没有截图证据 store、设计评分、修复循环、设计报告 artifact。

复现评价：
- 部分吸收。FishSwarm 已吸收“设计师角色”，未吸收 GStack 的“设计审查流水线”。

建议 FishSwarm 落点：
- `src/main/design/design-review-workflow.ts`
- `src/main/qa/visual-evidence-store.ts`
- `src/main/mcp/gstack-browse-runner.ts`
- renderer 中的 design report view。

建议迁移结构：

```ts
export interface DesignFinding {
  id: string;
  category:
    | 'first-impression'
    | 'visual-hierarchy'
    | 'design-system'
    | 'responsive'
    | 'accessibility'
    | 'ai-slop'
    | 'performance-as-design'
    | 'interaction-flow';
  severity: 'critical' | 'high' | 'medium' | 'low';
  screenshotArtifactIds: string[];
  description: string;
  recommendation: string;
  fixStatus?: 'deferred' | 'fixed' | 'verified';
}

export interface DesignReviewArtifact {
  runId: string;
  mode: 'quick' | 'full' | 'deep' | 'diff-aware' | 'regression';
  designScore: 'A' | 'B' | 'C' | 'D' | 'F';
  aiSlopScore: 'A' | 'B' | 'C' | 'D' | 'F';
  findings: DesignFinding[];
}
```

必要性判断：
- 应融入，优先级高。FishSwarm 如果要做“角色之间协同工作”，Product Designer 不能只发文字意见，最好能产出可复查的视觉证据。

### 11.9 Design Shotgun / Variant Board

GStack 来源：
- `gstack-main/design-shotgun/SKILL.md`

GStack 原始效果：
- 先生成多个文本概念，再并行生成多个视觉变体。
- 打开 comparison board，收集用户反馈。
- 支持 regenerate、remix、more-like-this。
- 保存 approved variant、feedback、taste profile。
- Taste memory 有衰减逻辑，避免过度拟合历史偏好。

FishSwarm 当前吸收情况：
- 没有设计变体 board。
- 有 memory，但没有面向视觉偏好的 taste profile。

复现评价：
- 未复现。

建议 FishSwarm 落点：
- `src/main/design/design-exploration-service.ts`
- `src/main/design/design-artifact-store.ts`
- renderer comparison board。
- `src/main/memory/memory-service.ts` 可保存轻量 taste signals，但不要无条件塞进每次上下文。

建议迁移结构：

```ts
export interface DesignVariant {
  id: string;
  name: string;
  concept: string;
  imageArtifactId: string;
  approved: boolean;
  feedback?: string;
}

export interface DesignExplorationSession {
  runId: string;
  screenName: string;
  brief: string;
  variants: DesignVariant[];
  boardUrl?: string;
  tasteSignals: string[];
  approvedVariantId?: string;
}
```

必要性判断：
- 中等。它很能体现“鱼群”发散能力，但不是 P0；可在 design-review 和 design-consultation 稳定后再做。

### 11.10 Design Consultation / DESIGN.md Source of Truth

GStack 来源：
- `gstack-main/design-consultation/SKILL.md`
- `gstack-main/design-consultation/sections/proposal-and-preview.md`

GStack 原始效果：
- 通过设计咨询生成 `DESIGN.md`，作为项目设计源头。
- 不是表单式提问，而是完整提出一套 coherent system。
- 阶段包括产品上下文、taste profile、研究、EUREKA check、完整方案、字体/颜色/布局 drill-down、mockup preview、自我 gate、用户反馈、从 mockup 提取 token。
- proposal 必须包含 safe choices 和至少两个 creative risks。
- DESIGN.md 结构包括 Product Context、Aesthetic Direction、Typography、Color、Spacing、Layout、Motion、Decisions Log。

FishSwarm 当前吸收情况：
- 有 Product Strategist 和 Product Designer 两个角色。
- 但没有设计系统 source-of-truth 生成器，也没有 approved mockup token extraction。

复现评价：
- 部分吸收。FishSwarm 有角色，不等于有设计咨询 workflow。

建议 FishSwarm 落点：
- `src/main/design/design-system-consultation.ts`
- `src/main/design/design-system-store.ts`
- `src/main/design/design-artifact-store.ts`
- 可选写入仓库 `DESIGN.md`，但必须经用户明确同意。

建议迁移结构：

```ts
export interface DesignSystemProposal {
  productContext: string;
  memorableThing: string;
  aestheticDirection: string;
  typography: string[];
  color: string[];
  spacing: string;
  layout: string;
  motion: string;
  safeChoices: string[];
  creativeRisks: Array<{
    decision: string;
    rationale: string;
    tradeoff: string;
  }>;
  approvedMockupArtifactId?: string;
  extractedTokens?: Record<string, string>;
}
```

必要性判断：
- 中高。对新产品和大 UI 改造很有价值；对纯后端任务不必触发。

不建议照搬的部分：
- 不要自动写 `CLAUDE.md`。
- 不要强依赖 GStack 的 `~/.gstack/projects/$SLUG/designs/` 路径，应映射到 FishSwarm artifact store。

### 11.11 Retro / Engineering Retrospective

GStack 来源：
- `gstack-main/retro/SKILL.md`

GStack 原始效果：
- 支持 `/retro`、`24h`、`14d`、`30d`、`compare`、`global`。
- 计算窗口必须按本地午夜对齐，避免 `git --since` 使用当前时刻造成统计偏移。
- 有 stale-base guard，防止本地 `origin/<default>` 太旧或当前日期漂移导致假复盘。
- 采集 commit、LOC、test LOC、session 分布、hotspot、PR/MR、作者、Greptile signal、TODO backlog、skill usage、Eureka moments。
- 计算 features shipped、weighted commits、logical SLOC、test ratio、active days、session、focus score、ship of week。
- 对每个贡献者做 praise 和 growth opportunities。
- 捕获 learnings，保存 `.context/retros/*.json`，并输出 narrative。
- global 模式跨项目统计 AI coding sessions、streak、context switching、tool usage。

FishSwarm 当前吸收情况：
- `src/main/observability/project-timeline.ts` 已有 timeline JSONL 和 learnings JSONL。
- 有 learning recorded event。
- 没有 retrospective analyzer、commit metrics collector、retro report store。

复现评价：
- 部分吸收。FishSwarm 有原始“记忆和时间线”，但没有 GStack 的复盘分析层。

建议 FishSwarm 落点：
- `src/main/observability/retro-analyzer.ts`
- `src/main/observability/retro-report-store.ts`
- `src/main/observability/project-timeline.ts`
- renderer Observability 面板。

建议迁移结构：

```ts
export interface RetrospectiveMetrics {
  window: string;
  commits: number;
  contributors: number;
  logicalSlocAdded?: number;
  testLocRatio?: number;
  activeDays: number;
  sessions: number;
  deepSessions: number;
  focusScore?: number;
  fixRatio?: number;
  aiAssistedCommits?: number;
}

export interface RetrospectiveArtifact {
  runId: string;
  scope: 'workspace' | 'global';
  dateRange: { from: string; to: string };
  metrics: RetrospectiveMetrics;
  wins: string[];
  improvements: string[];
  habits: string[];
  learningsLogged: string[];
  staleBaseGuard?: {
    status: 'verified' | 'warn' | 'blocked' | 'skipped';
    detail: string;
  };
}
```

必要性判断：
- 中高。它不是一天内必须做的核心交付，但它能让 FishSwarm 从“多 agent 协作器”变成“会沉淀团队工程节奏的协作系统”。

### 11.12 Learn / Project Learnings Manager

GStack 来源：
- `gstack-main/learn/SKILL.md`

GStack 原始效果：
- `/learn` 显示最近 20 条 learnings，按 type 分组。
- `/learn search <query>` 检索。
- `/learn prune` 检查 stale file reference 和 contradictory entries，并让用户选择 remove/keep/update。
- `/learn export` 生成可加入项目文档的 markdown。
- `/learn stats` 汇总 total、unique、raw entries、by type、by source、avg confidence。
- `/learn add` 手动添加 type、key、insight、confidence、related files。
- learnings 类型包括 pattern、pitfall、preference、architecture、tool、operational。

FishSwarm 当前吸收情况：
- `src/main/observability/project-timeline.ts` 已有 `ProjectLearning`。
- `src/main/index.ts` 已注册 `learnings.list`、`learnings.add`。
- `src/renderer/components/settings/SettingsObservability.tsx` 能展示 learnings。
- 但没有 prune、export、stats，也没有 contradictory/stale 检查。

复现评价：
- 部分复现。FishSwarm 已吸收“记录和展示”，还没吸收“维护和治理”。

建议 FishSwarm 落点：
- `src/main/observability/project-learning-service.ts`
- `src/main/observability/project-timeline.ts`
- `src/renderer/components/settings/SettingsObservability.tsx`

建议迁移结构：

```ts
export interface LearningRecord {
  id: string;
  key: string;
  type: 'pattern' | 'pitfall' | 'preference' | 'architecture' | 'tool' | 'operational' | 'investigation';
  insight: string;
  confidence: number;
  source: 'observed' | 'user-stated' | 'inferred' | 'cross-model';
  files?: string[];
  trusted: boolean;
  supersedes?: string;
}

export interface LearningMaintenanceReport {
  stale: Array<{ id: string; missingFiles: string[] }>;
  conflicts: Array<{ key: string; ids: string[]; reason: string }>;
  stats: {
    rawEntries: number;
    uniqueEntries: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    avgConfidence: number;
  };
}
```

必要性判断：
- 应融入，优先级高。FishSwarm 已经有 learnings，缺维护会导致长期记忆慢慢变脏。

### 11.13 Office Hours / Pre-Implementation Design Doc

GStack 来源：
- `gstack-main/office-hours/SKILL.md`
- `gstack-main/office-hours/sections/design-and-handoff.md`

GStack 原始效果：
- 定位是 YC office hours partner，硬规则是只产出设计文档，不写代码。
- 先加载 brain context：product、goals、user-profile、recent-decisions、salience。
- 根据目标区分 Startup mode 和 Builder mode。
- Startup mode 会强制追问 demand reality、status quo、desperate specificity、narrowest wedge、observation、future-fit。
- Builder mode 更偏设计伙伴，帮助挖出 cool version、学习目标和实现路径。
- 做 related design discovery，检查已有 design docs。
- 可做 landscape awareness，但必须先过 privacy gate。
- 进入 premise challenge，要求用户确认前提。
- 可选 cross-model second opinion。
- 必须生成至少 2 个 alternatives，一个 minimal viable，一个 ideal architecture，可加 creative/lateral。
- 在用户批准方案前不能写 design doc。
- design doc 包含 Problem Statement、Constraints、Premises、Approaches Considered、Recommended Approach、Open Questions、Success Criteria、Distribution Plan、Assignment/Next Steps、What I noticed。
- design doc approve 后进入 handoff，根据 builder profile 做分层 closing，并推荐下一步 skill。

FishSwarm 当前吸收情况：
- 已有 Product Strategist、Engineering Architect、Product Designer、QA Release Steward 等角色。
- 但没有 office-hours 这种“开工前强制问题诊断 + 备选方案选择 + 设计文档 approval gate”的完整入口。
- 没有 builder profile、assignment history、resource dedup。

复现评价：
- 未完整复现。FishSwarm 的角色能参与计划讨论，但缺 GStack office-hours 的严格阶段门和设计文档产物。

建议 FishSwarm 落点：
- `src/main/planning/office-hours-workflow.ts`
- `src/main/planning/design-doc-store.ts`
- `src/main/roles/role-runtime-service.ts`
- `src/main/memory/memory-service.ts`
- `src/main/observability/project-timeline.ts`

建议迁移结构：

```ts
export interface OfficeHoursSession {
  runId: string;
  mode: 'startup' | 'builder';
  goal: string;
  contextUsed: {
    product?: string;
    goals?: string;
    recentDecisions?: string;
    userProfile?: string;
  };
  premises: Array<{ text: string; status: 'proposed' | 'accepted' | 'rejected' | 'revised' }>;
  alternatives: Array<{
    id: string;
    name: string;
    effort: 'S' | 'M' | 'L' | 'XL';
    risk: 'low' | 'medium' | 'high';
    summary: string;
    reuses: string[];
  }>;
  selectedAlternativeId?: string;
  designDocArtifactId?: string;
  assignment?: string;
}
```

必要性判断：
- 中高。它对“角色之间协同工作”很关键，因为它能防止鱼群过早进入实现，先让 Product/Engineering/Design/Security 对问题和方案达成共识。

不建议照搬的部分：
- 不要照搬 YC 资源推荐和关系经营文案到默认 FishSwarm 产品里。可以抽象成 `handoffRecommendations`，但要允许关闭。
- 不要自动写用户 profile，必须走明确的 memory/trust 策略。

## 12. 第三批之后的实施优先级建议

如果按“鱼群项目最需要吸收的 GStack 协同工作能力”排序，建议顺序是：

1. `learn` 补全治理能力：search、prune、export、stats。原因是 FishSwarm 已经有 ProjectLearning，补这层成本低、收益直接。
2. `guard/freeze/careful` 产品化：补 warn/block 模式、GuardDecision artifact、renderer 状态。原因是已有 session guard，差的是可解释和可操作。
3. `adversarial review gate`：把多角色 review 收口成 ship 前 gate。原因是这是角色协同从“意见”升级为“发布控制”的关键。
4. `release summary / PR body renderer`：把测试、设计、评审、计划完成度、外部评论合成出站摘要。原因是它能让 FishSwarm 的协同成果可交付。
5. `design-review`：补截图证据和 before/after 修复循环。原因是 FishSwarm 已有 Product Designer，但还缺视觉证据链。
6. `canary monitor`：在 release validator 的 canary 阶段上接截图 baseline。原因是 FishSwarm 已经有灰度 release 概念，但缺真实页面验证。
7. `office-hours`：做开工前方案诊断和设计文档 approval gate。原因是它能减少鱼群误解需求后直接开工的风险。
8. `retro`：把 timeline 和 learnings 变成周复盘。原因是这会让 FishSwarm 有长期改进闭环。
9. `external review adapter`：等 PR/MR provider 接入时做。原因是接口价值高，但依赖外部平台。
10. `pair-agent browser session`：等需要远程 AI agent 同时操作浏览器时再做。原因是 FishSwarm remote 已经有聊天型远程控制，GStack pair-agent 是更窄但更深的 browser 协作形态。
11. `design-shotgun` 和 `design-consultation`：作为设计增强能力排后。原因是价值高，但需要 artifact store、图片生成/比较 board、taste profile 的前置能力。

这一批最重要的判断是：GStack 中关于角色协同的精华，确实没有被 FishSwarm 完整融合。FishSwarm 已经有“角色”和“基础设施”，但很多 GStack 文件里的核心在于“协同的流程控制和产物化”：谁在什么时候发言、输出什么 artifact、什么条件 gate fail、怎么持久化、怎么影响下一次任务。后续实现应优先补这些连接层，而不是简单再增加角色数量。

## 13. GStack 迁移代码段维护清单（第四批）

第四批补的是 GStack 中尚未细化进前面三批、但能补足 FishSwarm 协同闭环的操作型流程：规格化、根因调查、健康仪表盘、文档同步、部署落地、性能回归、网页数据技能化、问题偏好自调、外部模型封装和开发体验实测。

### 13.0 第四批吸收状态总表

| GStack 片段 | FishSwarm 当前状态 | 是否完美复现 GStack 效果 | 融入必要性 |
|---|---|---|---|
| `gstack-main/spec/SKILL.md` | FishSwarm 有 Product/Engineering/Design 角色，但没有 backlog-ready spec 生成和 issue/archive gate。 | 未复现。 | 高。能补“开工前把需求磨成可执行契约”。 |
| `gstack-main/investigate/SKILL.md` | 有工程角色和 learnings，但没有系统化 debug workflow。 | 未复现。 | 高。能防止 agent 直接猜修。 |
| `gstack-main/health/SKILL.md` | 有 `src/main/observability/health-service.ts`，但偏运行环境健康，不是代码质量 dashboard。 | 部分吸收。 | 中高。适合补 CI/quality 状态。 |
| `gstack-main/land-and-deploy/SKILL.md`、`setup-deploy`、`landing-report` | 有 release validator 和 canary 评估建议，但没有真实 PR merge/deploy queue workflow。 | 未复现。 | 中高。接入 PR/MR 后价值很高。 |
| `gstack-main/document-generate/SKILL.md`、`document-release/SKILL.md` | 有 docs artifact 展示，缺文档覆盖矩阵和 Diataxis 生成器。 | 未复现。 | 中高。能补 ship 后文档闭环。 |
| `gstack-main/devex-review/SKILL.md` | 有 Developer Experience 角色，但没有 live DX audit 和 TTHW scorecard。 | 部分吸收。 | 中高。对开发者工具类功能很重要。 |
| `gstack-main/benchmark/SKILL.md`、`benchmark-models` | 有 browse runner，但没有性能 baseline 和模型基准比较。 | 未复现。 | 中。性能 benchmark 值得做，模型 benchmark 可后置。 |
| `gstack-main/scrape/SKILL.md`、`skillify/SKILL.md` | 有 browser skill runtime，但缺“成功抓取→固化为可复用技能”的工作流。 | 部分吸收。 | 中高。和 FishSwarm 的 skill 底座契合。 |
| `gstack-main/plan-tune/SKILL.md` | 有 `work-habits/question-policy-store.ts`，但没有完整 question log/profile/tuning UI。 | 部分吸收。 | 中。适合做长期 UX 优化。 |
| `gstack-main/codex/SKILL.md` | 前文已吸收“outside review”思想，但没有完整 Codex CLI wrapper。 | 部分吸收。 | 中。可抽象为 outside model adapter。 |
| `gstack-main/design-html/SKILL.md` | 有设计角色，缺设计终稿 HTML 生成和三视口验证。 | 未复现。 | 中。更偏设计产物实现，可后置。 |
| `open-gstack-browser`、`setup-browser-cookies` | FishSwarm 有 browser MCP 和 remote，但缺可见浏览器启动和 cookie import UX。 | 部分吸收。 | 中。对登录态 QA 有用，但要重视隐私边界。 |

### 13.1 Spec / Backlog-Ready Spec

GStack 来源：
- `gstack-main/spec/SKILL.md`

GStack 原始效果：
- 把模糊意图变成可执行 spec、issue 或 backlog item。
- 硬规则：第一轮不能直接产 issue，必须先问清楚 why、用户、当前状态、成功标准、约束。
- 支持 `--dedupe`、`--no-gate`、`--audit`、`--execute`、`--plan-file`、`--sync-archive`。
- issue 质量标准包括 stakeholder context、verified current state、audit table、quantified impact、file reference、acceptance criteria、testing pyramid、root cause、rollback、effort breakdown。
- 写 issue / archive 前做 redaction scan。
- 将 spec 作为 durable decision 写入 decision log。
- 可选创建新 worktree 并 spawn agent 执行，但有 dirty worktree gate 和最终确认 gate。

FishSwarm 当前吸收情况：
- 已有 Product Strategist、Engineering Architect、Product Designer 等角色。
- 有任务路由和角色发现，但没有“先问到足够清楚再产 spec”的专用状态机。
- 没有 spec archive、issue body redaction gate、spec-to-implementation handoff。

复现评价：
- 未复现。FishSwarm 的角色能参与计划，但缺 GStack `/spec` 的硬阶段门和 backlog-ready 输出模板。

建议 FishSwarm 落点：
- `src/main/planning/spec-workflow.ts`
- `src/main/planning/spec-store.ts`
- `src/main/roles/role-runtime-service.ts`
- `src/main/observability/project-timeline.ts`
- `src/main/security/output-sanitizer.ts`

建议迁移结构：

```ts
export interface BacklogSpecArtifact {
  runId: string;
  title: string;
  mode: 'standard' | 'audit' | 'bug' | 'feature' | 'refactor';
  verifiedCurrentState: Array<{ file: string; evidence: string }>;
  stakeholderContext: string;
  proposedChange: string;
  implementationDetails: string[];
  acceptanceCriteria: string[];
  testingPlan: Array<{ level: 'unit' | 'integration' | 'e2e' | 'manual'; target: string; count?: number }>;
  rollbackPlan?: string;
  outOfScope: string[];
  redactionStatus: 'pass' | 'blocked' | 'redacted';
  issue?: { provider: 'github' | 'gitlab' | 'local'; id: string; url?: string };
}
```

必要性判断：
- 应融入，优先级高。它能让 FishSwarm 的多角色协同从“收到需求就分工”升级为“先把需求变成可验证契约”。

### 13.2 Investigate / Root Cause Debugging

GStack 来源：
- `gstack-main/investigate/SKILL.md`

GStack 原始效果：
- 铁律：没有根因就不修复。
- Phase 1 先收集症状、错误、复现步骤、最近变化、历史 learnings。
- 形成具体、可测试的 root cause hypothesis。
- Scope lock：确认假设后把编辑限制在受影响模块，避免 debug 范围扩散。
- Phase 2 做模式分析，查历史相同文件修复，识别 recurring bug 是否是架构气味。
- Phase 3 先验证假设，必要时加临时 log/assertion；3 个假设失败后停止并升级。
- Phase 4 只修根因，要求 regression test 先失败后通过。
- Phase 5 重跑原始复现，输出 Debug Report，并把调查写入 learnings。

FishSwarm 当前吸收情况：
- 有 Engineering Architect 和 QA Release Steward。
- 有 `ProjectLearning`，但没有 investigation 类型工作流和三假设停止规则。
- session guard 能限制路径，但没有和 bug hypothesis 绑定。

复现评价：
- 未复现。FishSwarm 现在可以让 agent 修 bug，但没有强制“证据→假设→验证→修复→回归测试→学习”的链条。

建议 FishSwarm 落点：
- `src/main/debug/investigation-workflow.ts`
- `src/main/debug/root-cause-store.ts`
- `src/main/session/session-guard-policy.ts`
- `src/main/observability/project-timeline.ts`
- `src/main/observability/project-learning-service.ts`

建议迁移结构：

```ts
export interface InvestigationArtifact {
  runId: string;
  symptom: string;
  reproduction?: string;
  hypotheses: Array<{
    id: string;
    claim: string;
    evidence: string[];
    verdict: 'untested' | 'confirmed' | 'rejected';
  }>;
  rootCause?: string;
  affectedFiles: string[];
  fixSummary?: string;
  regressionTests: Array<{ command: string; failedBefore: boolean; passedAfter: boolean }>;
  status: 'root-cause-found' | 'fixed' | 'blocked' | 'needs-more-evidence';
}
```

必要性判断：
- 应融入，优先级高。它能明显提升 FishSwarm 修 bug 的可信度，也能让 learnings 真正积累“调查经验”。

### 13.3 Health / Code Quality Dashboard

GStack 来源：
- `gstack-main/health/SKILL.md`

GStack 原始效果：
- 只读 dashboard，不修问题。
- 检测 typecheck、lint、test runner、dead code、shell lint、GBrain 状态。
- 独立运行每个工具，记录输出尾部。
- 按权重计算 0-10 composite score：typecheck、lint、tests、deadcode、shell、gbrain。
- 将结果写入 `health-history.jsonl`，显示趋势和下降原因。
- skipped 工具不算失败，会重新分配权重。
- 低于 7 的维度输出 top issues 和建议命令。

FishSwarm 当前吸收情况：
- `src/main/observability/health-service.ts` 已做 API credentials、MCP、skills、memory、pre-build script、gstack-browse resource 等应用运行健康检查。
- 但它不是代码质量 dashboard，没有 lint/test/typecheck/deadcode 的评分趋势。

复现评价：
- 部分吸收。FishSwarm 的 health 是“运行时能力状态”，GStack `/health` 是“代码质量状态”。两者应该并存，不应互相替代。

建议 FishSwarm 落点：
- `src/main/observability/code-health-service.ts`
- `src/main/observability/health-history-store.ts`
- `src/main/observability/health-service.ts`
- renderer Observability 页面。

建议迁移结构：

```ts
export interface CodeHealthRun {
  runId: string;
  cwd: string;
  branch: string;
  score: number;
  dimensions: Array<{
    id: 'typecheck' | 'lint' | 'test' | 'deadcode' | 'shell' | 'memory';
    command?: string;
    status: 'clean' | 'warn' | 'fail' | 'skipped';
    score?: number;
    durationMs?: number;
    outputTail?: string;
  }>;
  trend?: { previousScore?: number; delta?: number; reason?: string };
}
```

必要性判断：
- 中高。它能把 FishSwarm 的“右侧观察/验证面板”从任务级扩展到项目级质量状态。

### 13.4 Land-And-Deploy / Setup Deploy / Landing Report

GStack 来源：
- `gstack-main/land-and-deploy/SKILL.md`
- `gstack-main/setup-deploy/SKILL.md`
- `gstack-main/landing-report/SKILL.md`

GStack 原始效果：
- `landing-report` 是只读版本队列/PR 队列 dashboard，显示 open PR、版本占用、sibling workspaces。
- `land-and-deploy` 从 PR 识别、CI、版本一致性、review staleness、文档发布检查、用户确认、merge queue、auto-merge、deploy strategy、staging-first、canary、revert、deploy report 全流程串起来。
- 3.5 readiness gate 是关键：合并不可轻易撤销，所以先汇总 review、test、PR body、document-release 状态，再让用户确认。
- 部署策略自动检测 GitHub Actions、Fly、Render、Vercel、Netlify、自定义 hooks。
- canary 深度根据 diff scope 决定：docs-only 跳过、config smoke、frontend full。
- 失败时提供 investigate / revert / continue health check 等选择。
- 最后输出 `.gstack/deploy-reports/{date}-pr{number}-deploy.md` 和 JSONL。

FishSwarm 当前吸收情况：
- 有 `src/main/db/release-validator.ts` 灰度阶段和数据库 release validation。
- 有前面第 11 节建议的 canary monitor，但还没有真实 PR/MR landing workflow。
- 没有版本队列、workspace-aware landing dashboard、deploy strategy store。

复现评价：
- 未复现。FishSwarm 目前有 release 的局部底座，但没有 GStack 那种“从 PR 到部署验证再到回滚”的完整落地闭环。

建议 FishSwarm 落点：
- `src/main/release/landing-workflow.ts`
- `src/main/release/deploy-config-store.ts`
- `src/main/release/landing-report-service.ts`
- `src/main/release/deploy-report-store.ts`
- `src/main/release/canary-monitor.ts`
- `src/main/observability/project-timeline.ts`

建议迁移结构：

```ts
export interface LandingReadinessReport {
  runId: string;
  pr: { provider: 'github' | 'gitlab'; number: number; title: string; branch: string; base: string };
  ci: { status: 'green' | 'red' | 'pending' | 'unknown'; checks: string[] };
  reviewStatus: 'current' | 'stale' | 'not-run' | 'inline-fix';
  testStatus: 'current' | 'stale' | 'failed' | 'unknown';
  docsStatus: 'updated' | 'debt' | 'skipped' | 'unknown';
  prBodyStatus: 'accurate' | 'stale' | 'unknown';
  userConfirmed: boolean;
}

export interface DeployReportArtifact {
  runId: string;
  mergePath: 'auto' | 'direct' | 'queue' | 'skipped';
  deployStrategy: 'github-actions' | 'platform-cli' | 'auto-deploy' | 'custom' | 'none';
  stagingStatus?: 'verified' | 'failed' | 'skipped';
  productionStatus: 'healthy' | 'degraded' | 'reverted' | 'unverified' | 'skipped';
  mergeSha?: string;
  revertSha?: string;
  timings: Record<'ci' | 'queue' | 'deploy' | 'canary' | 'total', number | undefined>;
}
```

必要性判断：
- 中高。只要 FishSwarm 要接 GitHub/GitLab PR 生命周期，这一块就值得吸收；短期如果仍是桌面本地开发，可先维护接口而不实现全部 provider。

### 13.5 Document Generate / Document Release

GStack 来源：
- `gstack-main/document-generate/SKILL.md`
- `gstack-main/document-release/SKILL.md`
- `gstack-main/document-release/sections/release-body.md`

GStack 原始效果：
- `document-release` 在 ship 后、merge 前运行，保证 README/ARCHITECTURE/CONTRIBUTING/CLAUDE.md 等文档与代码一致。
- Step 1.5 先做 coverage map，把新/变更 public surface 映射到 Diataxis 四象限：Reference、How-to、Tutorial、Explanation。
- coverage map 只标记缺口，不自动生成大文档；重大缺口建议运行 `document-generate`。
- `document-generate` 要先做 codebase archaeology，读代码、测试、现有文档，识别 public surface、概念、设计决策。
- 按 Diataxis 写 reference、explanation、how-to、tutorial。
- 写入前做 redaction scan，避免把真实 token 写进 docs。
- 若 PR 已存在，更新 PR body 的 Documentation Generated / Documentation Debt section。

FishSwarm 当前吸收情况：
- 有 artifact parser 和 docs 可展示。
- 没有文档覆盖矩阵，也没有 Diataxis 分类生成器。
- 前文第 11.2 已建议 release summary，但 docs section 仍缺上游数据源。

复现评价：
- 未复现。

建议 FishSwarm 落点：
- `src/main/docs/document-coverage-analyzer.ts`
- `src/main/docs/document-generator.ts`
- `src/main/docs/document-release-workflow.ts`
- `src/main/release/release-summary.ts`
- `src/main/security/output-sanitizer.ts`

建议迁移结构：

```ts
export interface DocumentationCoverageMap {
  runId: string;
  changedPublicSurfaces: Array<{
    name: string;
    kind: 'api' | 'cli' | 'ui' | 'config' | 'skill' | 'workflow' | 'schema';
    files: string[];
    coverage: {
      reference: boolean;
      howTo: boolean;
      tutorial: boolean;
      explanation: boolean;
    };
    gapSeverity: 'none' | 'common' | 'critical';
  }>;
}

export interface DocumentationGenerationArtifact {
  runId: string;
  scope: string;
  docs: Array<{ path: string; quadrant: 'reference' | 'how-to' | 'tutorial' | 'explanation'; summary: string }>;
  redactionStatus: 'pass' | 'blocked' | 'redacted';
  prSection?: string;
}
```

必要性判断：
- 中高。它能让 FishSwarm 的 release summary 不只是代码验证，也包含“用户怎么知道这个功能存在、怎么正确使用”的证据。

### 13.6 DevEx Review / Live Developer Experience Audit

GStack 来源：
- `gstack-main/devex-review/SKILL.md`

GStack 原始效果：
- 从真实开发者视角测试 onboarding、docs、CLI、SDK、错误信息和 upgrade path。
- 量化 TTHW（Time To Hello World）。
- 截图错误信息，按“问题、原因、修复、链接”评价。
- 七个 DX 特征：obvious、fast、forgiving、transparent、valuable、composable、trustworthy。
- 输出 DX scorecard with evidence，并与 `/plan-devex-review` 的计划分数做 boomerang comparison。
- 写 review log，进入 Review Readiness Dashboard。

FishSwarm 当前吸收情况：
- 已有 `developer-experience` 内置角色。
- `role-runtime-service.ts` 可触发 DX review 风格的角色输出。
- 但没有 live audit、计时、截图、CLI output evidence、boomerang comparison。

复现评价：
- 部分吸收。角色身份吸收了，实测工作流未吸收。

建议 FishSwarm 落点：
- `src/main/dx/devex-audit-workflow.ts`
- `src/main/dx/devex-scorecard-store.ts`
- `src/main/roles/role-runtime-service.ts`
- `src/main/mcp/gstack-browse-runner.ts`
- `src/main/observability/project-timeline.ts`

建议迁移结构：

```ts
export interface DeveloperExperienceAudit {
  runId: string;
  productType: 'cli' | 'sdk' | 'web-app' | 'api' | 'desktop' | 'unknown';
  tthwMeasured?: string;
  overallScore: number;
  dimensions: Array<{
    id: 'getting-started' | 'api-cli-sdk' | 'errors' | 'docs' | 'upgrade' | 'dev-env' | 'community' | 'measurement';
    score: number;
    evidence: Array<{ kind: 'screenshot' | 'command-output' | 'file'; ref: string; summary: string }>;
  }>;
  boomerang?: { plannedScore?: number; liveScore: number; delta: number };
}
```

必要性判断：
- 中高。FishSwarm 是开发者工具，DX 实测比单纯“角色建议”更有说服力。

### 13.7 Benchmark / Performance And Model Benchmarking

GStack 来源：
- `gstack-main/benchmark/SKILL.md`
- `gstack-main/benchmark-models/SKILL.md`

GStack 原始效果：
- `/benchmark` 用浏览器 daemon 收集真实 performance entries、navigation timing、resource timing、bundle sizes、request counts。
- 支持 baseline、quick、pages、diff、trend。
- baseline 写入 `.gstack/benchmark-reports/baselines/baseline.json`。
- 与 baseline 比较，按相对阈值判定 regression，不用固定绝对值。
- 输出 markdown/json report 和 trend。
- `/benchmark-models` 用同一 prompt 对比不同模型的 latency、tokens、cost、quality，可保存结果作为模型性能 baseline。

FishSwarm 当前吸收情况：
- 有 `gstack-browse-runner.ts`，但没有 performance baseline/report。
- 有多模型/角色概念，但没有模型 benchmark artifact。

复现评价：
- 未复现。

建议 FishSwarm 落点：
- `src/main/qa/performance-benchmark.ts`
- `src/main/qa/performance-baseline-store.ts`
- `src/main/models/model-benchmark-service.ts`
- `src/main/mcp/gstack-browse-runner.ts`

建议迁移结构：

```ts
export interface PerformanceBenchmarkReport {
  runId: string;
  url: string;
  pages: Array<{
    path: string;
    metrics: {
      loadMs?: number;
      domContentLoadedMs?: number;
      transferBytes?: number;
      requestCount?: number;
      slowestResources: Array<{ name: string; type: string; size?: number; durationMs: number }>;
    };
    baselineDelta?: Record<string, number>;
    regressions: string[];
  }>;
  status: 'baseline-captured' | 'pass' | 'regression' | 'no-baseline';
}
```

必要性判断：
- `/benchmark` 中等偏高，尤其适合前端和 canary 结合。
- `/benchmark-models` 中等，可以等 FishSwarm 的模型路由和成本记录更完整后再做。

### 13.8 Scrape / Skillify

GStack 来源：
- `gstack-main/scrape/SKILL.md`
- `gstack-main/skillify/SKILL.md`

GStack 原始效果：
- `/scrape` 是只读网页数据提取入口。
- 先匹配已有 browser-skill；匹配成功则走 fast path，约 200ms 返回。
- 没匹配则用 `$B` 原语原型化抓取，输出 JSON，并建议 `/skillify`。
- 明确拒绝 mutating intent，认证/cookie import 交给 setup-browser-cookies。
- `/skillify` 只处理最近成功的 `/scrape` 原型，不能把失败原型固化。
- 生成 `script.ts`、fixture、`script.test.ts`、`SKILL.md`，先写 staged dir，测试通过后才 approval commit。
- agent-authored skills 默认 `trusted: false`。
- 使用 atomic write，避免半坏技能落盘。

FishSwarm 当前吸收情况：
- 有 browser skill runtime 和安全写入机制（前文第 7.14-7.16 已分析）。
- 但缺“scrape 原型结果→自动生成 browser skill→fixture test→审批落盘”的产品级 workflow。

复现评价：
- 部分吸收。底层能力有，闭环未复现。

建议 FishSwarm 落点：
- `src/main/browser-skills/scrape-workflow.ts`
- `src/main/browser-skills/skillify-workflow.ts`
- `src/main/skills/browser-skill-runtime.ts`
- `src/main/security/skill-supply-chain.ts`
- `src/main/observability/project-timeline.ts`

建议迁移结构：

```ts
export interface ScrapePrototypeArtifact {
  runId: string;
  intent: string;
  url?: string;
  mode: 'matched-skill' | 'prototype';
  outputJson: unknown;
  selectorNotes?: string[];
  skillifyEligible: boolean;
}

export interface SkillifyCandidate {
  runId: string;
  sourceScrapeRunId: string;
  name: string;
  triggers: string[];
  files: Array<{ path: 'SKILL.md' | 'script.ts' | 'script.test.ts' | string; contentHash: string }>;
  fixtureArtifactId: string;
  testStatus: 'pass' | 'fail' | 'not-run';
  trusted: false;
  committed: boolean;
}
```

必要性判断：
- 中高。FishSwarm 已经有技能底座，吸收这套 workflow 能让用户把一次性浏览器任务沉淀成长期工具。

### 13.9 Plan Tune / Question Preference And Developer Profile

GStack 来源：
- `gstack-main/plan-tune/SKILL.md`

GStack 原始效果：
- 记录 AskUserQuestion 的问题 ID、用户选择、推荐项、是否 override。
- 支持显式偏好：`never-ask`、`always-ask`、`ask-only-for-one-way`。
- 一次性 consent gate，默认不开 question tuning。
- 5-Q setup 建立 declared profile：risk tolerance、breadth preference、detail preference、autonomy 等。
- 区分 declared profile 与 inferred profile。
- 支持 inspect profile、review question log、set preference、show gap、stats、recent auto-decisions、audit unmarked questions、dream cycle distill。
- 用户源防投毒：只有用户当前消息里的 `tune:` 才能写偏好。
- one-way doors 覆盖 `never-ask`， destructive/security/architecture 仍要问。

FishSwarm 当前吸收情况：
- 有 `src/main/work-habits/question-policy-store.ts`。
- 有 decision/question 类 timeline category。
- 但没有完整 question log UI、developer profile、auto-decision 回放、unmarked audit。

复现评价：
- 部分吸收。FishSwarm 已有问题策略底座，但缺 GStack 的“可观察、可修改、可追责”调谐界面。

建议 FishSwarm 落点：
- `src/main/work-habits/question-policy-store.ts`
- `src/main/work-habits/question-log-service.ts`
- `src/main/work-habits/developer-profile-store.ts`
- renderer Settings / Observability 中增加 question tuning 面板。

建议迁移结构：

```ts
export interface QuestionDecisionLog {
  id: string;
  ts: string;
  questionId: string;
  skill?: string;
  summary: string;
  category: 'approval' | 'clarification' | 'routing' | 'cherry-pick' | 'feedback-loop';
  doorType: 'one-way' | 'two-way';
  optionsCount: number;
  recommended?: string;
  userChoice?: string;
  source: 'asked' | 'auto-decided' | 'prose-fallback';
}

export interface QuestionPreference {
  questionId: string;
  preference: 'never-ask' | 'always-ask' | 'ask-only-for-one-way';
  source: 'user-inline' | 'settings' | 'plan-tune';
  updatedAt: string;
}
```

必要性判断：
- 中。它不是核心交付 gate，但会显著改善 FishSwarm 长期使用体验，尤其是减少重复确认和保留高风险确认。

### 13.10 Codex / Outside Model Adapter

GStack 来源：
- `gstack-main/codex/SKILL.md`

GStack 原始效果：
- 三种模式：review、challenge、consult。
- 先探测 codex binary、auth、版本 known-bad list、portable roots。
- 所有 prompt 都加 filesystem boundary，禁止读取 `.claude/skills`、`.agents`、agent 配置等无关技能文件。
- review mode 对当前 branch diff 做独立审查，`[P1]` 为 fail gate。
- challenge mode 用 adversarial prompt 找生产失败、攻击面、race、silent corruption。
- consult mode 支持会话连续性，plan review 时要把 plan 文件内容嵌进 prompt，而不是让 Codex 读外部路径。
- 用 JSONL 输出捕获 reasoning traces 和 tool calls。
- 持久化 `codex-review` log，并写入 plan review report。

FishSwarm 当前吸收情况：
- 前面已建议在 adversarial review gate 中抽象 outside model。
- 但 FishSwarm 没有完整 Codex CLI wrapper、auth probe、known-bad version、timeout/hang detection。

复现评价：
- 部分吸收。理念已吸收，具体 wrapper 和安全边界未复现。

建议 FishSwarm 落点：
- `src/main/models/outside-model-adapter.ts`
- `src/main/models/codex-cli-runner.ts`
- `src/main/review/adversarial-review.ts`
- `src/main/security/model-boundary-prompts.ts`

建议迁移结构：

```ts
export interface OutsideModelRun {
  runId: string;
  provider: 'codex' | 'gemini' | 'custom';
  mode: 'review' | 'challenge' | 'consult' | 'plan-review';
  authStatus: 'ready' | 'missing' | 'failed';
  sandbox: 'read-only' | 'workspace-write' | 'unknown';
  boundaryApplied: boolean;
  outputArtifactId?: string;
  gate?: 'pass' | 'fail' | 'informational';
  timeoutMs: number;
  error?: string;
}
```

必要性判断：
- 中。建议不要把 Codex 写死为唯一 outside voice，而是实现 provider adapter，让 FishSwarm 可以挂不同外部模型。

### 13.11 Design HTML / Browser Cookie Setup / Visible Browser

GStack 来源：
- `gstack-main/design-html/SKILL.md`
- `gstack-main/open-gstack-browser/SKILL.md`
- `gstack-main/setup-browser-cookies/SKILL.md`

GStack 原始效果：
- `design-html` 把 approved mockup / DESIGN.md / plan context 转成 production-quality HTML/CSS，并用 Pretext 处理文字 layout。
- 支持 approved.json、plan-driven、freeform 三种输入。
- 生成 HTML 后起 live reload server，三视口截图验证，再进入 refinement loop。
- 可从 HTML 提取 design tokens 并生成 DESIGN.md。
- `open-gstack-browser` 启动可见 Chromium，带侧边栏和 shimmer，方便用户看见每个浏览器动作。
- `setup-browser-cookies` 通过 picker UI 从真实 Chromium 浏览器选择域名导入 cookie；只显示域名和 cookie count，不暴露值。

FishSwarm 当前吸收情况：
- 有 gstack browse runner / GUI operate / MCP 浏览器基础。
- 但没有设计终稿 HTML 工作流，也没有 cookie import picker 的隐私 UX。
- Codex desktop 里可以控制浏览器，但 FishSwarm 产品本身还没有把“可见浏览器 + 登录态导入 + 设计三视口验证”做成一套用户功能。

复现评价：
- 部分吸收浏览器底座，未复现设计/登录态/可见操作闭环。

建议 FishSwarm 落点：
- `src/main/design/design-html-finalizer.ts`
- `src/main/browser/visible-browser-session.ts`
- `src/main/browser/cookie-import-service.ts`
- `src/main/qa/visual-evidence-store.ts`

建议迁移结构：

```ts
export interface DesignHtmlFinalization {
  runId: string;
  source: 'approved-mockup' | 'design-doc' | 'plan' | 'freeform';
  outputArtifactId: string;
  verificationScreenshots: Array<{ viewport: 'mobile' | 'tablet' | 'desktop'; artifactId: string }>;
  extractedTokens?: Record<string, string>;
  status: 'draft' | 'approved' | 'needs-iteration';
}

export interface BrowserAuthImportSummary {
  runId: string;
  browser: 'chrome' | 'chromium' | 'edge' | 'unknown';
  domains: Array<{ domain: string; cookieCount: number }>;
  valuesExposed: false;
  mode: 'picker' | 'direct-domain' | 'cdp-already-connected';
}
```

必要性判断：
- 中。对 UI/QA/设计场景有明显价值，但应在 design-review、canary、benchmark 基础稳定后再做。

### 13.12 第四批后仍建议暂缓或只做轻量映射的内容

以下 GStack 目录暂时不建议作为 FishSwarm 核心迁移优先级：

| GStack 目录 | 暂缓原因 | 建议处理 |
|---|---|---|
| `gstack-main/ios-clean/SKILL.md`、`gstack-main/ios-design-review/SKILL.md`、`gstack-main/ios-fix/SKILL.md`、`gstack-main/ios-qa/SKILL.md`、`gstack-main/ios-sync/SKILL.md` | 强 iOS/SwiftUI/真机专项，FishSwarm 当前不是 iOS QA 产品。 | 只记录为未来插件方向，不进核心。 |
| `gstack-main/make-pdf` | 文档导出工具，不属于角色协同核心。 | 可作为 documents/pdf 插件能力，不进入 FishSwarm 主流程。 |
| `gstack-main/diagram` | 图表生成有用，但不是 GStack 协同工作流主干。 | 可后续做 artifact renderer。 |
| `gstack-main/gstack-upgrade` | GStack 自升级流程，和 FishSwarm 产品升级机制不同。 | 不迁移原流程，只吸收 version check / migration prompt 思想。 |
| `gstack-main/benchmark-models` | 有模型选择价值，但依赖多 provider 成本、token、judge 体系。 | 等模型路由成熟后再做。 |

第四批结论：FishSwarm 已经有不少底座，但 GStack 的“真实工程闭环”还包括 spec、investigate、health、docs、deploy、performance、DX、question tuning 这些外围工作流。它们不是角色本身，却决定角色协同是否能沉淀为可靠系统。后续实现上，建议先做 `spec`、`investigate`、`document-release`、`health` 四件事，因为它们和当前 FishSwarm 的角色、timeline、learnings、artifact store 最容易接上。
