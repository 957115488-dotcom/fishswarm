# FishSwarm Asset Center

本文档说明 low-code workflow × FishSwarm 融合后的资源库（Asset Center）如何使用、如何扩展、以及它的安全边界。

## 1. 目标定位

Asset Center 不是新的主数据库，也不是低代码 IDE 运行时。它是一个只读资源索引与发现层，用统一 envelope 把 FishSwarm 已有能力和 low-code workflow 概念连接起来：

- low-code concept map
- domain skills / built-in skills
- roles
- MCP connectors
- plugins
- model providers / model presets / provider setup recipes
- workflow templates / workflow artifacts
- component blueprints
- export package actions

当前实现遵循 `ADR-001`：Asset Center 首版是 read-only scanner + source adapter + normalized snapshot，不迁移 source of truth，不主动安装、不执行、不写入第三方配置。

## 2. 用户视角

入口位于设置页：`Settings -> 资源库 / Assets`。

用户可以：

1. 查看资源总数、筛选结果数、warning 数。
2. 按关键词、group、kind、source、status 筛选。
3. 浏览三个分组：
   - 创作起点：low-code concepts、workflow templates、component blueprints、prompt/data model drafts。
   - 能力与连接：skills、roles、MCP、plugins、model providers。
   - 交付与审计：workflow artifacts、export packages。
4. 查看资产详情：ID、kind、source、scope、sourceRef、hash、tags、warnings、actions。
5. 对受控资产执行阶段性动作：
   - `useInTask`：只把结构化资产引用插入任务输入框，不自动执行。
   - `configure`：打开现有模型配置页，只传 provider/setup 引用，不传 API key。
   - `dryRunExport` / `createPackage`：进入受控导出流程，见 `docs/assets/export-package.md`。

用户不能在 Asset Center 中直接：

- 安装 skill/plugin。
- 启用/禁用任意外部能力。
- 运行资产或 workflow。
- 直接执行 shell 命令。
- 通过 renderer 写文件。
- 读取或导出真实密钥。

## 3. UI 结构

当前页面保持 FishSwarm 设置页原布局：左侧为资产列表，右侧为详情面板；导出类新功能嵌入右侧详情，不新增顶级页面，不改变整体页面框架。

```text
SettingsAssets
├─ Header / stats / refresh
├─ Security hint
├─ Search and filters
├─ Grouped asset cards
└─ Detail panel
   ├─ metadata
   ├─ actions
   ├─ task insertion / provider configure / export workflow
   ├─ tags
   └─ warnings
```

关键文件：

- `src/renderer/components/settings/SettingsAssets.tsx`
- `src/renderer/utils/asset-center-view-model.ts`
- `src/renderer/components/presets/AssetCard.tsx`
- `src/renderer/components/presets/AssetStatusPill.tsx`
- `src/renderer/components/presets/SectionCard.tsx`
- `src/renderer/components/presets/EmptyState.tsx`

## 4. 数据契约

主契约定义在：

- `src/main/asset-center/asset-center-types.ts`
- `src/shared/ipc-types.ts`
- `src/renderer/types/asset-center.ts`

核心 envelope：

```ts
interface AssetCenterItem {
  id: string;
  kind: AssetKind;
  source: AssetSource;
  scope: AssetScope;
  status: AssetStatus;
  title: string;
  summary: string;
  tags: string[];
  sourceRef: AssetSourceRef;
  schemaVersion: number;
  updatedAt?: string;
  contentHash?: string;
  credentialRefs?: string[];
  policyRefs?: string[];
  lineageRefs?: string[];
  actions: AssetAction[];
  warnings: string[];
}
```

Snapshot：

```ts
interface AssetCenterSnapshot {
  schemaVersion: number;
  generatedAt: string;
  items: AssetCenterItem[];
  stats: Record<string, number>;
  warnings: string[];
}
```

允许的 action 分层：

- Read-only：`viewDetails`、`openSource`、`preview`
- Controlled / deferred：`useInTask`、`insertPrompt`、`configure`、`testConnection`、`dryRunExport`、`createPackage`

`createPackage` 只允许出现在 `export.package` 资产上；`asset-center-service` 会过滤非导出资产伪造出的 `createPackage`。

## 5. Source adapter contract

Adapter 只做只读索引：

```ts
interface AssetSourceAdapterResult {
  items: AssetCenterItem[];
  warnings: string[];
}

interface AssetSourceAdapter {
  id: string;
  listAssets(): AssetSourceAdapterResult;
}
```

实现要求：

1. 不执行资产内容。
2. 不安装依赖。
3. 不读取真实密钥值。
4. source path 尽量归一化、相对化或以 reference 形式暴露。
5. 单个 adapter 抛错时必须降级为 snapshot warning，不得导致整页崩溃。
6. 每类 adapter 需要单元测试。

当前 adapter 文件：

- `src/main/asset-center/lowcode-concepts.ts`
- `src/main/asset-center/lowcode-builder-asset-index.ts`
- `src/main/asset-center/domain-skill-asset-index.ts`
- `src/main/asset-center/built-in-skill-asset-index.ts`
- `src/main/asset-center/logic-flow-template-asset-index.ts`
- `src/main/asset-center/provider-asset-index.ts`
- `src/main/asset-center/mcp-asset-index.ts`
- `src/main/asset-center/role-asset-index.ts`
- `src/main/asset-center/plugin-asset-index.ts`
- `src/main/asset-center/workflow-artifact-asset-index.ts`
- `src/main/asset-center/asset-export-asset-index.ts`

## 6. IPC 边界

只读资源库 IPC：

```ts
assetCenter.getSnapshot(): Promise<AssetCenterSnapshot>
```

受控导出 IPC：

```ts
assetExport.dryRun(payload): Promise<AssetExportDryRunResponse>
assetExport.createPackage(payload): Promise<AssetExportCreatePackageResponse>
```

禁止新增以下桥：

- `assetCenter.install`
- `assetCenter.run`
- `assetCenter.export`
- `assetCenter.apply`
- `assetCenter.openArbitraryPath`
- `command.exec`
- `network.fetch`

对应回归测试：

- `src/tests/asset-center/asset-center-ipc-contract.test.ts`
- `src/tests/security/lowcode-integration-security.test.ts`

## 7. 安全模型

Asset Center 的安全原则：

1. Renderer 只请求受控 IPC，不直接使用 Node fs/shell。
2. Provider asset 只暴露 `credentialRef` / `requiresCredential` 状态，不暴露 `apiKey`。
3. MCP asset 只暴露 required env 名称和 credential reference，不暴露 env value。
4. Snapshot sanitization 会移除不在 allowlist 内的 action。
5. `createPackage` action 只允许 `export.package`。
6. Export 流程单独经过 dry-run、policy、human approval、hash/drift 校验。
7. BrowserWindow 保持：`nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。

安全回归覆盖：

- `src/tests/security/lowcode-integration-security.test.ts`
- `src/tests/asset-center/provider-asset-index.test.ts`
- `src/tests/asset-center/mcp-asset-index.test.ts`
- `src/tests/asset-center/asset-center-service.test.ts`

## 8. 开发者新增资产源步骤

新增一个 source adapter 时：

1. 在 `src/main/asset-center` 新增 `*-asset-index.ts`。
2. 返回 `AssetSourceAdapterResult` 或独立 index result。
3. 每个 item 填齐 `id/kind/source/scope/status/title/summary/tags/sourceRef/schemaVersion/actions/warnings`。
4. 不要把 token、API key、cookie、private key 放入 item。
5. 在 `asset-center-service.ts` 汇入结果。
6. 补充 `src/tests/asset-center/*.test.ts`。
7. 如果新增 action，必须同时更新：
   - `src/main/asset-center/asset-center-types.ts`
   - `src/shared/ipc-types.ts`
   - sanitizer allowlist
   - 安全回归测试

## 9. 已知限制

- Asset Center 当前不是持久化收藏库；排序、收藏、用户启停状态尚未入库。
- `openSource` 仅作为 envelope action 保留，当前 UI 不提供任意路径打开。
- Plugin marketplace / installed plugin 信息来自当前 plugin runtime snapshot，可能是 best effort。
- Workflow artifact asset 默认只展示 envelope 信息，artifact 内容需要通过 workflow artifact 相关 API 查看。
- Export package 当前输出到 app userData 下的 `asset-exports` staging 目录，后续可增加用户选择目标目录。

## 10. 验证命令

常用验证：

```powershell
npx vitest run src/tests/asset-center src/tests/security src/tests/release
npm run typecheck
```
