import type { RoleCapabilityAssessment } from './role-types';

export interface AssessRoleCapabilityInput {
  sessionId?: string;
  taskId: string;
  taskText: string;
  routedRoles: Array<{
    id: string;
    name: string;
    triggerKeywords?: string[];
    triggerScopes?: string[];
    handbookText?: string;
    routingReasons?: string[];
  }>;
  threshold?: number;
}

interface CapabilityDefinition {
  id: string;
  label: string;
  keywords: string[];
  specialistRoleIds: string[];
}

const DEFAULT_THRESHOLD = 0.68;

export const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    id: 'database-migration',
    label: 'database migration planning',
    keywords: [
      'database',
      'migration',
      'rollback',
      'schema',
      'data integrity',
      'production data',
      '数据库',
      '迁移',
      '回滚',
      '数据',
    ],
    specialistRoleIds: ['database-migration-specialist'],
  },
  {
    id: 'legal-compliance',
    label: 'legal and compliance review',
    keywords: ['legal', 'compliance', 'policy', 'privacy', 'gdpr', '法律', '合规', '隐私'],
    specialistRoleIds: ['compliance-specialist'],
  },
  {
    id: 'financial-analysis',
    label: 'financial analysis',
    keywords: ['finance', 'financial', 'accounting', 'revenue', 'cost', '财务', '成本', '收入'],
    specialistRoleIds: ['financial-analysis-specialist'],
  },
  {
    id: 'data-analysis',
    label: 'data analysis',
    keywords: ['analytics', 'analysis', 'dataset', 'statistics', 'metric', '数据分析', '统计'],
    specialistRoleIds: ['data-analysis-specialist'],
  },
  {
    id: 'marketing-copy',
    label: 'marketing copywriting',
    keywords: ['marketing', 'copywriting', 'campaign', 'landing page', '文案', '营销'],
    specialistRoleIds: ['marketing-copy-specialist'],
  },
  {
    id: 'browser-automation',
    label: 'browser automation',
    keywords: [
      'browser',
      'automation',
      'web form',
      'click',
      'screenshot',
      '浏览器',
      '网页',
      '截图',
    ],
    specialistRoleIds: ['browser-automation-specialist'],
  },
  {
    id: 'documentation',
    label: 'documentation',
    keywords: ['documentation', 'docs', 'api reference', 'manual', '文档', '手册'],
    specialistRoleIds: ['documentation-specialist'],
  },
  {
    id: 'asset-curation',
    label: 'asset curation',
    keywords: [
      'asset center',
      'asset library',
      'resource library',
      'template asset',
      'lowcode asset',
      'asset curation',
    ],
    specialistRoleIds: ['qa-release-steward'],
  },
  {
    id: 'low-code-blueprint',
    label: 'low-code blueprint design',
    keywords: ['low-code', 'lowcode', 'component blueprint', 'component tree', 'lowcode-builder'],
    specialistRoleIds: ['product-designer'],
  },
  {
    id: 'workflow-template',
    label: 'workflow template and logic flow design',
    keywords: ['workflow template', 'logicflow', 'logic flow', 'flow preview', 'flow compiler'],
    specialistRoleIds: ['product-designer'],
  },
  {
    id: 'export-package',
    label: 'auditable export package',
    keywords: ['export package', 'dry-run', 'manifest', 'checksum', 'redaction report'],
    specialistRoleIds: ['qa-release-steward', 'security-officer'],
  },
];

export function assessRoleCapabilityAdequacy(
  input: AssessRoleCapabilityInput
): RoleCapabilityAssessment {
  const threshold = input.threshold ?? DEFAULT_THRESHOLD;
  const requiredCapabilities = extractRequiredCapabilities(input.taskText);
  if (requiredCapabilities.length === 0) {
    const hasRoutedRole = input.routedRoles.length > 0;
    return {
      taskId: input.taskId,
      sessionId: input.sessionId,
      requiredCapabilities: [],
      routedRoleScores: input.routedRoles.map((role) => ({
        roleId: role.id,
        roleName: role.name,
        score: hasRoutedRole ? threshold : 0,
        matchedCapabilities: [],
        missingCapabilities: [],
        reasons: hasRoutedRole
          ? ['No specialist capability gap detected; existing general-purpose role can proceed.']
          : ['No routed role and no specialist capability detected.'],
      })),
      bestScore: hasRoutedRole ? threshold : 0,
      adequate: hasRoutedRole,
      threshold,
    };
  }
  const routedRoleScores = input.routedRoles.map((role) => {
    const haystack = [
      role.id,
      role.name,
      ...(role.triggerKeywords || []),
      ...(role.triggerScopes || []),
      ...(role.routingReasons || []),
      role.handbookText || '',
    ]
      .join(' ')
      .toLowerCase();
    const matchedCapabilities: string[] = [];
    const missingCapabilities: string[] = [];

    for (const capability of requiredCapabilities) {
      const specialistMatch = capability.specialistRoleIds.includes(role.id);
      const keywordHits = capability.keywords.filter((keyword) =>
        haystack.includes(keyword.toLowerCase())
      );
      if (specialistMatch || keywordHits.length >= 2) {
        matchedCapabilities.push(capability.label);
      } else {
        missingCapabilities.push(capability.label);
      }
    }

    let score =
      requiredCapabilities.length === 0
        ? 0
        : matchedCapabilities.length / requiredCapabilities.length;
    if (requiredCapabilities.length > 0 && isBroadRole(role.id)) {
      score = Math.min(score, 0.55);
    }
    if (
      requiredCapabilities.length > 0 &&
      matchedCapabilities.length === 0 &&
      isBroadRole(role.id)
    ) {
      score = 0.35;
    }

    return {
      roleId: role.id,
      roleName: role.name,
      score,
      matchedCapabilities,
      missingCapabilities,
      reasons:
        matchedCapabilities.length > 0
          ? [`Matched ${matchedCapabilities.join(', ')}.`]
          : [
              `Missing specialist capability for ${requiredCapabilities.map((item) => item.label).join(', ') || 'task specialist'}.`,
            ],
    };
  });
  const bestScore = routedRoleScores.reduce((best, item) => Math.max(best, item.score), 0);

  return {
    taskId: input.taskId,
    sessionId: input.sessionId,
    requiredCapabilities: requiredCapabilities.map((capability) => capability.label),
    routedRoleScores,
    bestScore,
    adequate: requiredCapabilities.length > 0 && bestScore >= threshold,
    threshold,
  };
}

export function extractRequiredCapabilities(text: string): CapabilityDefinition[] {
  const lower = String(text || '').toLowerCase();
  const matches = CAPABILITY_DEFINITIONS.filter((definition) =>
    definition.keywords.some((keyword) => lower.includes(keyword.toLowerCase()))
  );
  if (matches.length > 0) return matches;
  return [];
}

export function capabilityLabelsFromText(text: string): string[] {
  const capabilities = extractRequiredCapabilities(text);
  return capabilities.length > 0
    ? capabilities.map((capability) => capability.label)
    : ['task specialist'];
}

function isBroadRole(roleId: string): boolean {
  return [
    'engineering-architect',
    'implementation-engineer',
    'product-strategist',
    'developer-experience',
  ].includes(roleId);
}
