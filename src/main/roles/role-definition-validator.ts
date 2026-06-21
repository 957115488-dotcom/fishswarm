import { scanUntrustedText } from '../security/content-security';
import { redactText } from '../security/redact';
import { BUILT_IN_ROLES } from './built-in-roles';
import type { RoleDefinition, RoleHandbook } from './role-types';

const ROLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/;
const MAX_TEXT_LENGTH = 4000;

export function validateRoleDefinition(role: RoleDefinition): RoleDefinition {
  if (!role || typeof role !== 'object') throw new Error('Role definition is required.');
  const id = normalizeRoleId(role.id);
  const handbook = validateHandbook(role.handbook);
  const triggerMode = role.triggerMode;
  if (triggerMode !== 'automatic' && triggerMode !== 'manual' && triggerMode !== 'disabled') {
    throw new Error('Invalid role trigger mode.');
  }
  const defaultRunMode = role.defaultRunMode;
  if (defaultRunMode !== 'lite' && defaultRunMode !== 'review' && defaultRunMode !== 'validation') {
    throw new Error('Invalid role run mode.');
  }

  return {
    id,
    name: sanitizeText(role.name, 'name', 120),
    shortName: sanitizeText(role.shortName, 'shortName', 40),
    description: sanitizeText(role.description, 'description', 500),
    enabled: Boolean(role.enabled),
    builtIn: Boolean(BUILT_IN_ROLES.some((builtIn) => builtIn.id === id) || role.builtIn),
    triggerMode,
    defaultRunMode,
    icon: role.icon ? sanitizeText(role.icon, 'icon', 80) : undefined,
    color: role.color ? sanitizeText(role.color, 'color', 80) : undefined,
    triggerScopes: Array.isArray(role.triggerScopes) ? [...new Set(role.triggerScopes)] : [],
    triggerKeywords: sanitizeTextArray(role.triggerKeywords || [], 'triggerKeywords', 80),
    handbook,
    locales: validateLocales(role.locales),
    updatedAt: role.updatedAt || new Date().toISOString(),
  };
}

export function normalizeRoleId(value: string): string {
  const id = String(value || '').trim();
  if (!ROLE_ID_PATTERN.test(id)) throw new Error('Invalid role id.');
  return id;
}

function validateHandbook(handbook: RoleHandbook): RoleHandbook {
  if (!handbook || typeof handbook !== 'object') throw new Error('Role handbook is required.');
  return {
    identity: sanitizeText(handbook.identity, 'handbook.identity', MAX_TEXT_LENGTH),
    responsibilities: requireTextArray(handbook.responsibilities, 'handbook.responsibilities'),
    boundaries: requireTextArray(handbook.boundaries, 'handbook.boundaries'),
    inputRequirements: requireTextArray(handbook.inputRequirements, 'handbook.inputRequirements'),
    outputFormat: requireTextArray(handbook.outputFormat, 'handbook.outputFormat'),
    completionCriteria: requireTextArray(
      handbook.completionCriteria,
      'handbook.completionCriteria'
    ),
    validationCriteria: requireTextArray(
      handbook.validationCriteria,
      'handbook.validationCriteria'
    ),
    safetyRules: requireTextArray(handbook.safetyRules, 'handbook.safetyRules'),
    decisionAuthority: requireTextArray(handbook.decisionAuthority, 'handbook.decisionAuthority'),
  };
}

function validateLocales(roleLocales: RoleDefinition['locales']): RoleDefinition['locales'] {
  if (!roleLocales || typeof roleLocales !== 'object') return undefined;
  const locales: RoleDefinition['locales'] = {};
  for (const locale of ['en', 'zh'] as const) {
    const value = roleLocales[locale];
    if (!value || typeof value !== 'object') continue;
    locales[locale] = {
      name: value.name ? sanitizeText(value.name, `locales.${locale}.name`, 120) : undefined,
      shortName: value.shortName
        ? sanitizeText(value.shortName, `locales.${locale}.shortName`, 40)
        : undefined,
      description: value.description
        ? sanitizeText(value.description, `locales.${locale}.description`, 500)
        : undefined,
      triggerKeywords: value.triggerKeywords
        ? sanitizeTextArray(value.triggerKeywords, `locales.${locale}.triggerKeywords`, 80)
        : undefined,
      handbook: value.handbook ? validatePartialHandbook(value.handbook, locale) : undefined,
    };
  }
  return Object.keys(locales).length > 0 ? locales : undefined;
}

function validatePartialHandbook(
  handbook: Partial<RoleHandbook>,
  locale: 'en' | 'zh'
): Partial<RoleHandbook> {
  return {
    identity: handbook.identity
      ? sanitizeText(handbook.identity, `locales.${locale}.handbook.identity`, MAX_TEXT_LENGTH)
      : undefined,
    responsibilities: handbook.responsibilities
      ? sanitizeTextArray(
          handbook.responsibilities,
          `locales.${locale}.handbook.responsibilities`,
          MAX_TEXT_LENGTH
        )
      : undefined,
    boundaries: handbook.boundaries
      ? sanitizeTextArray(
          handbook.boundaries,
          `locales.${locale}.handbook.boundaries`,
          MAX_TEXT_LENGTH
        )
      : undefined,
    inputRequirements: handbook.inputRequirements
      ? sanitizeTextArray(
          handbook.inputRequirements,
          `locales.${locale}.handbook.inputRequirements`,
          MAX_TEXT_LENGTH
        )
      : undefined,
    outputFormat: handbook.outputFormat
      ? sanitizeTextArray(
          handbook.outputFormat,
          `locales.${locale}.handbook.outputFormat`,
          MAX_TEXT_LENGTH
        )
      : undefined,
    completionCriteria: handbook.completionCriteria
      ? sanitizeTextArray(
          handbook.completionCriteria,
          `locales.${locale}.handbook.completionCriteria`,
          MAX_TEXT_LENGTH
        )
      : undefined,
    validationCriteria: handbook.validationCriteria
      ? sanitizeTextArray(
          handbook.validationCriteria,
          `locales.${locale}.handbook.validationCriteria`,
          MAX_TEXT_LENGTH
        )
      : undefined,
    safetyRules: handbook.safetyRules
      ? sanitizeTextArray(
          handbook.safetyRules,
          `locales.${locale}.handbook.safetyRules`,
          MAX_TEXT_LENGTH
        )
      : undefined,
    decisionAuthority: handbook.decisionAuthority
      ? sanitizeTextArray(
          handbook.decisionAuthority,
          `locales.${locale}.handbook.decisionAuthority`,
          MAX_TEXT_LENGTH
        )
      : undefined,
  };
}

function requireTextArray(values: string[], field: string): string[] {
  const sanitized = sanitizeTextArray(values, field, MAX_TEXT_LENGTH);
  if (sanitized.length === 0) throw new Error(`${field} must contain at least one item.`);
  return sanitized;
}

function sanitizeTextArray(values: string[], field: string, maxLength: number): string[] {
  if (!Array.isArray(values)) throw new Error(`${field} must be an array.`);
  return values
    .map((value, index) => sanitizeText(String(value ?? ''), `${field}.${index}`, maxLength))
    .filter(Boolean);
}

function sanitizeText(value: string, field: string, maxLength: number): string {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) throw new Error(`Role ${field} is required.`);
  if (text.length > maxLength) throw new Error(`Role ${field} is too long.`);
  const redacted = redactText(text);
  if (redacted.redacted) {
    throw new Error(`Role ${field} contains sensitive content: ${redacted.findings.join(', ')}`);
  }
  const scan = scanUntrustedText(text);
  if (scan.verdict === 'block') {
    throw new Error(
      `Role ${field} contains prompt-injection-like content: ${scan.reasons.join(', ')}`
    );
  }
  return text;
}
