import { describe, expect, it } from 'vitest';
import { getLocalizedRoleName, localizeRoleText } from '../../renderer/utils/role-localization';

describe('role display localization', () => {
  it('localizes a role name from role id', () => {
    expect(getLocalizedRoleName('engineering-architect', 'Engineering Architect', 'zh-CN')).toBe(
      '\u5de5\u7a0b\u67b6\u6784\u5e08'
    );
    expect(getLocalizedRoleName('engineering-architect', '\u5de5\u7a0b\u67b6\u6784\u5e08', 'en')).toBe(
      'Engineering Architect'
    );
  });

  it('localizes known role names in existing assistant text', () => {
    const text =
      '角色协作 · Product Strategist handed off to Engineering Architect and Database Migration Specialist.';
    const localized = localizeRoleText(text, 'zh-CN');

    expect(localized).toContain('\u4ea7\u54c1\u7b56\u7565\u5e08');
    expect(localized).toContain('\u5de5\u7a0b\u67b6\u6784\u5e08');
    expect(localized).toContain('\u6570\u636e\u5e93\u8fc1\u79fb\u4e13\u5bb6');
    expect(localized).not.toContain('Engineering Architect');
  });

  it('restores known Chinese role names in English mode', () => {
    const text = '\u89d2\u8272\u534f\u4f5c · \u6570\u636e\u5e93\u8fc1\u79fb\u4e13\u5bb6';

    expect(localizeRoleText(text, 'en')).toContain('Database Migration Specialist');
  });
});
