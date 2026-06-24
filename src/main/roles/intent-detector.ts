export type RoleIntentKind =
  | 'requirement'
  | 'risk'
  | 'validation'
  | 'decision'
  | 'question'
  | 'none';

export interface RoleIntent {
  kinds: RoleIntentKind[];
  confidence: number;
  reasons: string[];
  originalText: string;
}

const DETECTORS: Array<{
  kind: Exclude<RoleIntentKind, 'none'>;
  weight: number;
  pattern: RegExp;
  reason: string;
}> = [
  {
    kind: 'requirement',
    weight: 3,
    pattern:
      /(start|run|launch|serve|build|implement|add|create|develop|adapt|integrate|fix|complete|design|plan|migrate|帮我|做|完成|实现|开发|设计|迁移|生成|新增|添加|修复|运行|启动|跑起来|拉起)/i,
    reason: 'The message asks FishSwarm to create, adapt, fix, design, or complete work.',
  },
  {
    kind: 'risk',
    weight: 3,
    pattern:
      /(security|risk|token|scope|permission|prompt injection|redact|remote|tunnel|secret|leak|production|安全|风险|权限|注入|泄露|令牌|远程|隧道|生产|真实用户数据)/i,
    reason: 'The message mentions security, permission, token, remote, or untrusted-content risk.',
  },
  {
    kind: 'validation',
    weight: 3,
    pattern: /(verify|validation|acceptance|qa|test|check|验收|验证|测试|检查|怎么验证|如何验证)/i,
    reason: 'The message asks for validation, acceptance, testing, or checking.',
  },
  {
    kind: 'decision',
    weight: 2,
    pattern:
      /(should|whether|default|choose|decision|要不要|是否|默认|选择|决策|应该|合适吗|可不可以|能不能|能否|可否|好不好|怎么样|你觉得|明白吗|看懂吗|清楚吗)/i,
    reason: 'The message asks for a decision or tradeoff.',
  },
  {
    kind: 'question',
    weight: 1,
    pattern: /(\?|？|how|what|why|怎么|什么|为什么|如何|吗|呢)/i,
    reason: 'The message is phrased as a question.',
  },
];

export function detectRoleIntent(text: string): RoleIntent {
  const originalText = text || '';
  const normalized = originalText.trim();
  if (!normalized) {
    return { kinds: ['none'], confidence: 0, reasons: [], originalText };
  }

  const matches = DETECTORS.filter((detector) => detector.pattern.test(normalized));
  if (matches.length === 0) {
    return { kinds: ['none'], confidence: 0.1, reasons: [], originalText };
  }

  const kinds = [...new Set(matches.map((match) => match.kind))];
  const rawScore = matches.reduce((sum, match) => sum + match.weight, 0);
  const confidence = Math.min(1, Math.max(0.2, rawScore / 8));

  return {
    kinds,
    confidence,
    reasons: matches.map((match) => match.reason),
    originalText,
  };
}
