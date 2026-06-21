export type ToolScope = 'read' | 'write' | 'admin' | 'network' | 'unknown';

export interface ScopePolicyResult {
  allowed: boolean;
  scope: ToolScope;
  reason?: string;
}

const READ_SEGMENTS = ['get', 'list', 'read', 'search', 'status', 'snapshot', 'screenshot', 'text'];
const WRITE_SEGMENTS = ['create', 'save', 'update', 'delete', 'remove', 'write', 'click', 'fill', 'type', 'press', 'send'];
const ADMIN_SEGMENTS = ['shell', 'exec', 'eval', 'run', 'command', 'token', 'secret', 'auth'];

export function classifyMcpTool(serverName: string, toolName: string): ToolScope {
  const haystack = `${serverName} ${toolName}`.toLowerCase();
  if (ADMIN_SEGMENTS.some((segment) => haystack.includes(segment))) return 'admin';
  if (WRITE_SEGMENTS.some((segment) => haystack.includes(segment))) return 'write';
  if (READ_SEGMENTS.some((segment) => haystack.includes(segment))) return 'read';
  if (haystack.includes('http') || haystack.includes('browser') || haystack.includes('chrome')) return 'network';
  return 'unknown';
}

export function evaluateMcpScopePolicy(serverName: string, toolName: string): ScopePolicyResult {
  const scope = classifyMcpTool(serverName, toolName);
  const strict = process.env.FISHSWARM_SECURITY_STRICT_MCP === '1';

  if (strict && scope === 'admin') {
    return {
      allowed: false,
      scope,
      reason: 'admin-scope MCP tools are blocked while FISHSWARM_SECURITY_STRICT_MCP=1',
    };
  }

  return { allowed: true, scope };
}

