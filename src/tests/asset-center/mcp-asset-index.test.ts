import { describe, expect, it } from 'vitest';
import { MCP_SERVER_PRESETS } from '../../main/mcp/mcp-config-store';
import { indexMcpAssets } from '../../main/asset-center/mcp-asset-index';

describe('mcp asset index', () => {
  it('indexes built-in MCP server presets as read-only assets', () => {
    const result = indexMcpAssets();
    const expectedIds = Object.keys(MCP_SERVER_PRESETS).map((presetId) => `mcp.server:${presetId}`);

    expect(result.warnings).toEqual([]);
    expect(expectedIds.every((id) => result.items.some((item) => item.id === id))).toBe(true);
    expect(result.items.every((item) => item.kind === 'mcp.server')).toBe(true);
    expect(
      result.items.every((item) => item.actions.every((action) => action === 'viewDetails'))
    ).toBe(true);
  });

  it('marks presets with required env as requiring credentials without copying env values', () => {
    const result = indexMcpAssets({
      presets: {
        private: {
          name: 'Private MCP',
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { SECRET_TOKEN: 'real-secret-value' },
          requiresEnv: ['SECRET_TOKEN'],
        },
      },
    });

    const serialized = JSON.stringify(result.items);

    expect(result.items[0]?.status).toBe('requiresCredential');
    expect(result.items[0]?.credentialRefs).toEqual(['credential:mcp.server:private:SECRET_TOKEN']);
    expect(serialized).not.toContain('real-secret-value');
  });

  it('keeps output ordering deterministic', () => {
    const result = indexMcpAssets({
      presets: {
        zeta: { name: 'Zeta', type: 'stdio', command: 'node', args: [] },
        alpha: { name: 'Alpha', type: 'stdio', command: 'node', args: [] },
      },
    });

    expect(result.items.map((item) => item.id)).toEqual(['mcp.server:alpha', 'mcp.server:zeta']);
  });
});
