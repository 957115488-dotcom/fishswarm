import { MCP_SERVER_PRESETS } from '../mcp/mcp-config-store';
import type { MCPServerConfig } from '../mcp/mcp-manager';
import type { AssetCenterItem } from './asset-center-types';

type McpServerPreset = Omit<MCPServerConfig, 'id' | 'enabled'> & {
  requiresEnv?: string[];
  envDescription?: Record<string, string>;
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
  const presets = input.presets || MCP_SERVER_PRESETS;
  const items = Object.entries(presets).map(([presetId, preset]) => {
    const credentialRefs = requiredCredentialRefs(presetId, preset);
    return {
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
  });

  return { items: items.sort((a, b) => a.id.localeCompare(b.id)), warnings: [] };
}
