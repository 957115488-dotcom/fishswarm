import * as fs from 'fs';
import * as path from 'path';
import type { MCPServerConfig } from '../mcp/mcp-manager';
import type { Skill } from '../../renderer/types';

export interface HealthCheckItem {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'error';
  detail?: string;
}

export interface HealthSummary {
  score: number;
  generatedAt: number;
  checks: HealthCheckItem[];
}

export function buildHealthSummary(input: {
  cwd: string;
  isConfigured: boolean;
  mcpServers: MCPServerConfig[];
  skills: Skill[];
  memoryEnabled: boolean;
}): HealthSummary {
  const checks: HealthCheckItem[] = [];

  checks.push({
    id: 'api',
    label: 'API credentials',
    status: input.isConfigured ? 'ok' : 'error',
    detail: input.isConfigured ? 'Configured' : 'No usable API credentials configured',
  });

  checks.push({
    id: 'mcp',
    label: 'MCP connectors',
    status: input.mcpServers.some((server) => server.enabled) ? 'ok' : 'warn',
    detail: `${input.mcpServers.filter((server) => server.enabled).length}/${input.mcpServers.length} enabled`,
  });

  checks.push({
    id: 'skills',
    label: 'Skills',
    status: input.skills.length > 0 ? 'ok' : 'warn',
    detail: `${input.skills.length} discovered`,
  });

  checks.push({
    id: 'memory',
    label: 'Memory',
    status: input.memoryEnabled ? 'ok' : 'warn',
    detail: input.memoryEnabled ? 'Enabled' : 'Disabled',
  });

  checks.push({
    id: 'prebuild',
    label: 'Pre-build check',
    status: fs.existsSync(path.join(input.cwd, 'scripts', 'pre-build-check.js')) ? 'ok' : 'warn',
    detail: 'scripts/pre-build-check.js',
  });

  checks.push({
    id: 'gstack-browse-resource',
    label: 'GStack Browse resource',
    status: fs.existsSync(path.join(input.cwd, 'resources', 'gstack-browse')) ? 'ok' : 'warn',
    detail: 'resources/gstack-browse',
  });

  const weights = { ok: 1, warn: 0.55, error: 0 } as const;
  const score = Math.round(
    (checks.reduce((sum, check) => sum + weights[check.status], 0) / checks.length) * 100
  );

  return { score, generatedAt: Date.now(), checks };
}
