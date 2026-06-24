import type { ChangeScope } from '../../shared/ipc-types';
import { getRoleRegistrySnapshot } from './role-registry-store';
import type { RoleDefinition } from './role-types';
import type { RoleIntent } from './intent-detector';

export interface RouteRolesInput {
  cwd?: string;
  text: string;
  intent: RoleIntent;
  scopes?: Record<ChangeScope, boolean>;
  explicitRoleIds?: string[];
}

export interface RoutedRoles {
  roles: RoleDefinition[];
  reasons: Record<string, string[]>;
  validationRequired: boolean;
}

export function routeRolesForIntent(input: RouteRolesInput): RoutedRoles {
  if (input.intent.kinds.includes('none') || input.intent.confidence < 0.2) {
    return { roles: [], reasons: {}, validationRequired: false };
  }

  const available = getRoleRegistrySnapshot(input.cwd).roles.filter(
    (role) => role.enabled && role.triggerMode !== 'disabled'
  );
  const byId = new Map(available.map((role) => [role.id, role]));
  const selected = new Map<string, RoleDefinition>();
  const reasons: Record<string, string[]> = {};

  const addRole = (roleId: string, reason: string) => {
    const role = byId.get(roleId);
    if (!role) return;
    selected.set(role.id, role);
    reasons[role.id] = [...(reasons[role.id] || []), reason];
  };

  for (const roleId of input.explicitRoleIds || []) {
    addRole(roleId, 'Explicitly requested by the user or caller.');
  }

  const kinds = new Set(input.intent.kinds);
  const scopes = input.scopes || ({} as Record<ChangeScope, boolean>);
  const lowerText = input.text.toLowerCase();
  const runProjectPattern =
    /\b(run|launch|serve|start|dev server|npm run|pnpm|yarn|install dependencies?)\b|运行|启动|跑起来|拉起|本地跑|本地运行|安装依赖/i;
  const implementationWorkPattern =
    /\b(implement|implementation|build|create|write|edit|code|scaffold|fix|develop|ship|mvp|week\s*\d+|start|run|launch|serve)\b|\u5b9e\u73b0|\u5f00\u53d1|\u521b\u5efa|\u642d\u5efa|\u7f16\u5199|\u4fee\u6539|\u4fee\u590d|\u4ee3\u7801|\u9879\u76ee|\u5148\u505a|\u843d\u5730|运行|启动|跑起来|拉起|安装依赖/i;
  const directRunProjectWork =
    runProjectPattern.test(input.text) && /project|项目|工程|应用|app/i.test(input.text);
  const implementationWork =
    directRunProjectWork ||
    implementationWorkPattern.test(input.text) ||
    scopes.frontend ||
    scopes.backend ||
    scopes.api ||
    scopes.config ||
    scopes.docs ||
    scopes.packaging;
  const uxReviewPattern =
    /\b(ui|ux|screen|layout|page|panel|settings|usability|user-friendly|onboarding|tooltip|copy)\b|界面|页面|设置|交互|用户体验|普通用户|好用|易用|看懂|明白|清楚|提示|引导|新手/i;

  if (kinds.has('requirement') && !directRunProjectWork) {
    addRole('product-strategist', 'Requirement work needs product framing and scope control.');
    addRole('engineering-architect', 'Requirement work needs implementation and test planning.');
  }

  if (implementationWork) {
    addRole('implementation-engineer', 'Actionable implementation work needs an execution role.');
  }

  if (scopes.frontend || uxReviewPattern.test(input.text)) {
    addRole('product-designer', 'Frontend or visible workflow changes need design review.');
  }

  if (
    directRunProjectWork ||
    scopes.api ||
    scopes.mcp ||
    scopes.config ||
    scopes.docs ||
    scopes.packaging ||
    /\b(mcp|connector|setup|config|docs|error)\b|连接器|配置|报错|文档/i.test(input.text)
  ) {
    addRole(
      'developer-experience',
      'Developer-facing setup, configuration, or error paths need DX review.'
    );
  }

  if (
    scopes.security ||
    scopes.auth ||
    scopes.mcp ||
    scopes.remote ||
    kinds.has('risk') ||
    /\b(token|scope|permission|security|remote|tunnel|redact)\b|安全|权限|远程|泄露/.test(lowerText)
  ) {
    addRole(
      'security-officer',
      'Security-sensitive scope needs trust-boundary and permission review.'
    );
  }

  const validationRequired =
    kinds.has('validation') ||
    implementationWork ||
    scopes.tests ||
    scopes.security ||
    scopes.mcp ||
    scopes.remote ||
    scopes.packaging;

  if (validationRequired) {
    addRole(
      'qa-release-steward',
      'Validation or high-risk work needs acceptance and release checks.'
    );
  }

  if (kinds.has('decision')) {
    addRole('product-strategist', 'Decision-oriented question needs tradeoff framing.');
  }

  for (const role of available) {
    if (selected.has(role.id)) continue;
    if (
      role.triggerKeywords.some((keyword) =>
        roleKeywordMatches(role, keyword, lowerText, input.text, uxReviewPattern)
      )
    ) {
      addRole(role.id, `Matched role keyword for ${role.name}.`);
    }
  }

  return {
    roles: [...selected.values()],
    reasons,
    validationRequired,
  };
}

function roleKeywordMatches(
  role: RoleDefinition,
  keyword: string,
  lowerText: string,
  rawText: string,
  uxReviewPattern: RegExp
): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return false;
  if (role.id === 'product-designer' && ['user', '用户'].includes(normalized)) {
    return uxReviewPattern.test(rawText);
  }
  return lowerText.includes(normalized);
}
