import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { AssetCenterItem } from './asset-center-types';

export interface LowcodeBuilderAssetIndexInput {
  lowcodeBuilderRoot: string;
}

export interface LowcodeBuilderAssetIndexResult {
  items: AssetCenterItem[];
  warnings: string[];
}

interface ComponentBlueprintFile {
  version?: number;
  source?: string;
  blocks?: ComponentBlueprintBlock[];
}

interface ComponentBlueprintBlock {
  kind?: string;
  displayName?: string;
  description?: string;
  defaultTitle?: string;
  defaultData?: unknown;
}

const COMPONENT_BLUEPRINTS_FILE = path.join('assets', 'component-blueprints.json');

const BLUEPRINT_COPY: Record<string, { title: string; summary: string; tags: string[] }> = {
  'api-connector': {
    title: '接口连接器 / API Connector',
    summary: '描述外部 API、MCP、数据库或文件存储的集成入口。',
    tags: ['api', 'connector', 'mcp'],
  },
  'data-table': {
    title: '数据表格 / Data Table',
    summary: '展示实体、资产、任务或运行记录的结构化列表。',
    tags: ['data', 'table', 'domain-model'],
  },
  'form-section': {
    title: '表单区块 / Form Section',
    summary: '收集模型字段、API 参数或流程配置。',
    tags: ['form', 'configuration'],
  },
  'metric-card': {
    title: '指标卡 / Metric Card',
    summary: '展示关键数值、趋势和状态，是管理看板的最小可复用区块。',
    tags: ['metric', 'dashboard'],
  },
  'module-card': {
    title: '功能模块卡 / Module Card',
    summary: '把一组业务能力封装成可拖拽的入口模块。',
    tags: ['module', 'dashboard'],
  },
  'process-flow': {
    title: '流程编排 / Process Flow',
    summary: '把业务流程、角色交接或自动化步骤表现为可排序流程。',
    tags: ['workflow', 'process'],
  },
};

function sha256Text(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function safeRealpath(target: string): string | null {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function stableSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function blueprintCopy(block: ComponentBlueprintBlock): {
  title: string;
  summary: string;
  tags: string[];
} {
  const kind = block.kind ? stableSlug(block.kind) : '';
  const known = BLUEPRINT_COPY[kind];
  if (known) return known;

  return {
    title: block.displayName || block.defaultTitle || kind || 'Component Blueprint',
    summary: block.description || 'Reusable low-code component blueprint.',
    tags: [],
  };
}

function readBlueprintFile(filePath: string): {
  parsed?: ComponentBlueprintFile;
  content?: string;
  warning?: string;
} {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { parsed: JSON.parse(content) as ComponentBlueprintFile, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { warning: `Failed to read low-code component blueprints: ${message}` };
  }
}

export function indexLowcodeBuilderAssets(
  input: LowcodeBuilderAssetIndexInput
): LowcodeBuilderAssetIndexResult {
  const root = path.resolve(input.lowcodeBuilderRoot);
  const realRoot = safeRealpath(root);
  if (!realRoot) {
    return { items: [], warnings: [] };
  }

  const blueprintPath = path.resolve(realRoot, COMPONENT_BLUEPRINTS_FILE);
  const realBlueprintPath = safeRealpath(blueprintPath);
  if (!realBlueprintPath) {
    return { items: [], warnings: [] };
  }

  if (!isInside(realRoot, realBlueprintPath)) {
    return {
      items: [],
      warnings: [`Skipped low-code component blueprints outside root: ${blueprintPath}`],
    };
  }

  const { parsed, content, warning } = readBlueprintFile(realBlueprintPath);
  if (warning || !parsed || !content) {
    return { items: [], warnings: [warning || 'Failed to parse low-code component blueprints.'] };
  }

  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
  const contentHash = sha256Text(content);
  const items = blocks
    .filter((block): block is ComponentBlueprintBlock & { kind: string } => Boolean(block.kind))
    .map((block) => {
      const kind = stableSlug(block.kind);
      const copy = blueprintCopy(block);
      return {
        id: `component.blueprint:lowcode-builder:${kind}`,
        kind: 'component.blueprint',
        source: 'built-in',
        scope: 'app',
        status: 'available',
        title: copy.title,
        summary: copy.summary,
        tags: ['lowcode', 'component-blueprint', kind, ...copy.tags],
        sourceRef: {
          type: 'file',
          path: realBlueprintPath,
          id: kind,
        },
        schemaVersion: 1,
        contentHash,
        actions: ['viewDetails', 'preview'],
        warnings: [],
      } satisfies AssetCenterItem;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return { items, warnings: [] };
}
