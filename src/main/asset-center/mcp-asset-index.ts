import { MCP_SERVER_PRESETS } from '../mcp/mcp-config-store';
import type { MCPServerConfig } from '../mcp/mcp-manager';
import type { AssetCenterItem } from './asset-center-types';

type McpServerPreset = Omit<MCPServerConfig, 'id' | 'enabled'> & {
  requiresEnv?: string[];
  envDescription?: Record<string, string>;
  tools?: Array<{ name: string; description?: string }>;
};

export interface McpAssetIndexInput {
  presets?: Record<string, McpServerPreset>;
}

export interface McpAssetIndexResult {
  items: AssetCenterItem[];
  warnings: string[];
}

function requiredCredentialRefs(presetId: string, preset: McpServerPreset): string[] {
  return (preset.requiresEnv || []).map(
    (envName) => `credential:mcp.server:${presetId}:${envName}`
  );
}

function mcpStatus(preset: McpServerPreset): AssetCenterItem['status'] {
  return preset.requiresEnv && preset.requiresEnv.length > 0 ? 'requiresCredential' : 'available';
}

export function indexMcpAssets(input: McpAssetIndexInput = {}): McpAssetIndexResult {
  const presets: Record<string, McpServerPreset> = input.presets || MCP_SERVER_PRESETS;
  const items = Object.entries(presets).flatMap(([presetId, preset]) => {
    const credentialRefs = requiredCredentialRefs(presetId, preset);
    const serverItem = {
      id: `mcp.server:${presetId}`,
      kind: 'mcp.server',
      source: 'built-in',
      scope: 'app',
      status: mcpStatus(preset),
      title: preset.name,
      summary: `${preset.name} MCP server preset using ${preset.type} transport.`,
      tags: ['mcp', 'server', preset.type, presetId],
      sourceRef: { type: 'generated', id: presetId },
      schemaVersion: 1,
      credentialRefs,
      actions: ['viewDetails'],
      warnings:
        credentialRefs.length > 0
          ? [`Requires credentials: ${(preset.requiresEnv || []).join(', ')}`]
          : [],
    } satisfies AssetCenterItem;
    const toolItems = (preset.tools || [])
      .filter((tool) => tool.name.trim().length > 0)
      .map(
        (tool) =>
          ({
            id: `mcp.tool:${presetId}:${tool.name.trim()}`,
            kind: 'mcp.tool',
            source: 'built-in',
            scope: 'app',
            status: mcpStatus(preset),
            title: tool.name.trim(),
            summary:
              tool.description ||
              `${tool.name.trim()} tool exposed by the ${preset.name} MCP server preset.`,
            tags: ['mcp', 'tool', presetId, tool.name.trim()],
            sourceRef: { type: 'generated', id: presetId, path: tool.name.trim() },
            schemaVersion: 1,
            credentialRefs,
            actions: ['viewDetails', 'useInTask'],
            warnings:
              credentialRefs.length > 0
                ? [`Tool requires MCP server credentials: ${(preset.requiresEnv || []).join(', ')}`]
                : [],
          }) satisfies AssetCenterItem
      );
    return [serverItem, ...toolItems];
  });

  return { items: items.sort((a, b) => a.id.localeCompare(b.id)), warnings: [] };
}
