type RoleLocale = 'en' | 'zh';

interface RoleNamePair {
  en: string;
  zh: string;
}

const ROLE_NAMES_BY_ID: Record<string, RoleNamePair> = {
  'product-strategist': { en: 'Product Strategist', zh: '\u4ea7\u54c1\u7b56\u7565\u5e08' },
  'engineering-architect': { en: 'Engineering Architect', zh: '\u5de5\u7a0b\u67b6\u6784\u5e08' },
  'product-designer': { en: 'Product Designer', zh: '\u4ea7\u54c1\u8bbe\u8ba1\u5e08' },
  'developer-experience': {
    en: 'Developer Experience Lead',
    zh: '\u5f00\u53d1\u4f53\u9a8c\u8d1f\u8d23\u4eba',
  },
  'security-officer': { en: 'Security Officer', zh: '\u5b89\u5168\u5b98' },
  'qa-release-steward': {
    en: 'QA / Release Steward',
    zh: 'QA / \u53d1\u5e03\u8d1f\u8d23\u4eba',
  },
  'role-incubator': { en: 'Role Incubator', zh: '\u89d2\u8272\u5b75\u5316\u5668' },
  'database-migration-specialist': {
    en: 'Database Migration Specialist',
    zh: '\u6570\u636e\u5e93\u8fc1\u79fb\u4e13\u5bb6',
  },
  'documentation-specialist': { en: 'Documentation Specialist', zh: '\u6587\u6863\u4e13\u5bb6' },
  'compliance-specialist': { en: 'Compliance Specialist', zh: '\u5408\u89c4\u4e13\u5bb6' },
  'financial-analysis-specialist': {
    en: 'Financial Analysis Specialist',
    zh: '\u8d22\u52a1\u5206\u6790\u4e13\u5bb6',
  },
  'data-analysis-specialist': {
    en: 'Data Analysis Specialist',
    zh: '\u6570\u636e\u5206\u6790\u4e13\u5bb6',
  },
  'marketing-copy-specialist': {
    en: 'Marketing Copy Specialist',
    zh: '\u8425\u9500\u6587\u6848\u4e13\u5bb6',
  },
  'browser-automation-specialist': {
    en: 'Browser Automation Specialist',
    zh: '\u6d4f\u89c8\u5668\u81ea\u52a8\u5316\u4e13\u5bb6',
  },
  'task-specialist': { en: 'Task Specialist', zh: '\u4efb\u52a1\u4e13\u5bb6' },
};

const ROLE_NAMES = Object.values(ROLE_NAMES_BY_ID);

function roleLocale(language?: string): RoleLocale {
  return language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacementPairs(locale: RoleLocale): Array<[string, string]> {
  const sourceLocale: RoleLocale = locale === 'zh' ? 'en' : 'zh';
  return ROLE_NAMES.flatMap((name) => {
    const source = name[sourceLocale];
    const target = name[locale];
    if (!source || !target || source === target) return [];
    return [[source, target] as [string, string]];
  }).sort((a, b) => b[0].length - a[0].length);
}

export function getLocalizedRoleName(
  roleId?: string | null,
  roleName?: string | null,
  language?: string
): string {
  const locale = roleLocale(language);
  const byId = roleId ? ROLE_NAMES_BY_ID[roleId] : undefined;
  if (byId?.[locale]) return byId[locale];

  const byName = ROLE_NAMES.find((name) => name.en === roleName || name.zh === roleName);
  return byName?.[locale] || roleName || '';
}

export function localizeRoleText(text: string, language?: string): string {
  if (!text) return text;
  const locale = roleLocale(language);
  return replacementPairs(locale).reduce(
    (value, [source, target]) => value.replace(new RegExp(escapeRegExp(source), 'g'), target),
    text
  );
}
