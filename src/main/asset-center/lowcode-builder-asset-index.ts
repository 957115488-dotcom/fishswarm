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

interface ExampleModuleFile {
  name?: string;
  componentName?: string;
  description?: string;
  theme?: string;
  blocks?: Array<{ kind?: string }>;
}

const COMPONENT_BLUEPRINTS_FILE = path.join('assets', 'component-blueprints.json');
const EXAMPLE_MODULE_FILE = path.join('examples', 'fishswarm-dashboard.module.json');
const GENERATOR_SCRIPT_FILE = path.join('scripts', 'generate-lowcode-module.mjs');

const BLUEPRINT_COPY: Record<string, { title: string; summary: string; tags: string[] }> = {
  'api-connector': {
    title: 'API Connector',
    summary: 'Describes integration entry points for external APIs, MCP, databases, or files.',
    tags: ['api', 'connector', 'mcp'],
  },
  'data-table': {
    title: 'Data Table',
    summary: 'Displays structured lists for entities, assets, tasks, or run records.',
    tags: ['data', 'table', 'domain-model'],
  },
  'form-section': {
    title: 'Form Section',
    summary: 'Collects model fields, API parameters, or workflow configuration.',
    tags: ['form', 'configuration'],
  },
  'metric-card': {
    title: 'Metric Card',
    summary: 'Shows key values, trends, and status as a reusable dashboard block.',
    tags: ['metric', 'dashboard'],
  },
  'module-card': {
    title: 'Module Card',
    summary: 'Packages a set of business capabilities as an entry module.',
    tags: ['module', 'dashboard'],
  },
  'process-flow': {
    title: 'Process Flow',
    summary: 'Represents business processes, role handoffs, or automation steps.',
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

function readJsonFile<T>(
  filePath: string,
  label: string
): {
  parsed?: T;
  content?: string;
  warning?: string;
} {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { parsed: JSON.parse(content) as T, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { warning: `Failed to read Lowcode ${label}: ${message}` };
  }
}

function readTextFile(filePath: string, label: string): { content?: string; warning?: string } {
  try {
    return { content: fs.readFileSync(filePath, 'utf8') };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { warning: `Failed to read Lowcode ${label}: ${message}` };
  }
}

function optionalFileInsideRoot(
  realRoot: string,
  relativeFile: string,
  label: string
): { filePath?: string; warning?: string } {
  const candidate = path.resolve(realRoot, relativeFile);
  const realCandidate = safeRealpath(candidate);
  if (!realCandidate) {
    return {};
  }

  if (!isInside(realRoot, realCandidate)) {
    return { warning: `Skipped Lowcode ${label} outside root: ${candidate}` };
  }

  return { filePath: realCandidate };
}

function indexExampleModule(realRoot: string): { item?: AssetCenterItem; warning?: string } {
  const located = optionalFileInsideRoot(realRoot, EXAMPLE_MODULE_FILE, 'example module');
  if (located.warning || !located.filePath) {
    return { warning: located.warning };
  }

  const { parsed, content, warning } = readJsonFile<ExampleModuleFile>(
    located.filePath,
    'example module'
  );
  if (warning || !parsed || !content) {
    return { warning: warning || 'Failed to parse low-code example module.' };
  }

  const moduleName = parsed.name || 'FishSwarm Low-code Operations Board';
  const id = stableSlug(parsed.componentName || moduleName || 'fishswarm-dashboard');
  const blockKinds = Array.isArray(parsed.blocks)
    ? parsed.blocks
        .map((block) => block.kind)
        .filter(Boolean)
        .map(String)
    : [];

  return {
    item: {
      id: `workflow.template:lowcode-builder:${id}`,
      kind: 'workflow.template',
      source: 'built-in',
      scope: 'app',
      status: 'available',
      title: moduleName,
      summary:
        parsed.description ||
        'Example low-code workflow style module manifest for a FishSwarm operations dashboard.',
      tags: ['lowcode', 'workflow-template', 'example-module', ...blockKinds],
      sourceRef: {
        type: 'file',
        path: located.filePath,
        id,
      },
      schemaVersion: 1,
      contentHash: sha256Text(content),
      actions: ['viewDetails', 'preview', 'useInTask'],
      warnings: [],
    },
  };
}

function indexGeneratorScript(realRoot: string): { item?: AssetCenterItem; warning?: string } {
  const located = optionalFileInsideRoot(realRoot, GENERATOR_SCRIPT_FILE, 'generator script');
  if (located.warning || !located.filePath) {
    return { warning: located.warning };
  }

  const { content, warning } = readTextFile(located.filePath, 'generator script');
  if (warning || !content) {
    return { warning: warning || 'Failed to read low-code generator script.' };
  }

  return {
    item: {
      id: 'workflow.template:lowcode-builder:generate-lowcode-module',
      kind: 'workflow.template',
      source: 'built-in',
      scope: 'app',
      status: 'available',
      title: 'Low-code Module Generator',
      summary:
        'Read-only reference to the bundled low-code generator script; execution stays outside the Asset Center.',
      tags: ['lowcode', 'workflow-template', 'generator', 'read-only'],
      sourceRef: {
        type: 'file',
        path: located.filePath,
        id: 'generate-lowcode-module',
      },
      schemaVersion: 1,
      contentHash: sha256Text(content),
      actions: ['viewDetails', 'openSource'],
      warnings: [
        'Generator is indexed read-only; execution is disabled from the resource library.',
      ],
    },
  };
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
  const warnings: string[] = [];
  let componentBlueprintItems: AssetCenterItem[] = [];

  if (realBlueprintPath) {
    if (!isInside(realRoot, realBlueprintPath)) {
      warnings.push(`Skipped low-code component blueprints outside root: ${blueprintPath}`);
    } else {
      const { parsed, content, warning } = readBlueprintFile(realBlueprintPath);
      if (warning || !parsed || !content) {
        warnings.push(warning || 'Failed to parse low-code component blueprints.');
      } else {
        const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : [];
        const contentHash = sha256Text(content);
        componentBlueprintItems = blocks
          .filter((block): block is ComponentBlueprintBlock & { kind: string } =>
            Boolean(block.kind)
          )
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
              actions: ['viewDetails', 'preview', 'useInTask'],
              warnings: [],
            } satisfies AssetCenterItem;
          })
          .sort((a, b) => a.id.localeCompare(b.id));
      }
    }
  }

  const extraItems: AssetCenterItem[] = [];
  const exampleModule = indexExampleModule(realRoot);
  const generatorScript = indexGeneratorScript(realRoot);

  if (exampleModule.warning) warnings.push(exampleModule.warning);
  if (exampleModule.item) extraItems.push(exampleModule.item);
  if (generatorScript.warning) warnings.push(generatorScript.warning);
  if (generatorScript.item) extraItems.push(generatorScript.item);

  return {
    items: [...componentBlueprintItems, ...extraItems].sort((a, b) => a.id.localeCompare(b.id)),
    warnings,
  };
}
