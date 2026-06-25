import crypto from 'node:crypto';
import type { LogicFlowBuiltinTemplate } from '../logic-flow/logic-flow-compiler';
import { listBuiltInLogicFlows } from '../logic-flow/logic-flow-compiler';
import type { AssetCenterItem } from './asset-center-types';

export interface LogicFlowTemplateAssetIndexInput {
  templates?: LogicFlowBuiltinTemplate[];
}

export interface LogicFlowTemplateAssetIndexResult {
  items: AssetCenterItem[];
  warnings: string[];
}

function sha256Text(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function stableSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function nodeTypeTags(template: LogicFlowBuiltinTemplate): string[] {
  const nodeTypes = new Set(template.document.nodes.map((node) => `node:${node.type}`));
  return [...nodeTypes].sort((a, b) => a.localeCompare(b));
}

function templateToAsset(template: LogicFlowBuiltinTemplate): AssetCenterItem {
  const id = stableSlug(template.id);
  const documentHash = sha256Text(JSON.stringify(template.document));

  return {
    id: `workflow.template:logic-flow:${id}`,
    kind: 'workflow.template',
    source: 'built-in',
    scope: 'app',
    status: 'available',
    title: template.title,
    summary: template.description,
    tags: ['logic-flow', 'lowcode', 'workflow-template', ...nodeTypeTags(template)],
    sourceRef: {
      type: 'generated',
      id: template.id,
    },
    schemaVersion: 1,
    contentHash: documentHash,
    actions: ['viewDetails', 'preview', 'useInTask'],
    warnings: ['LogicFlow templates are preview-only and are not executed directly.'],
  };
}

export function indexLogicFlowTemplateAssets(
  input: LogicFlowTemplateAssetIndexInput = {}
): LogicFlowTemplateAssetIndexResult {
  try {
    const templates = input.templates || listBuiltInLogicFlows();
    const items = templates.map(templateToAsset).sort((a, b) => a.id.localeCompare(b.id));
    return { items, warnings: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { items: [], warnings: [`Failed to index LogicFlow templates: ${message}`] };
  }
}
