import { describe, expect, it } from 'vitest';
import {
  getLocalizedRoleName,
  localizeRoleText,
  localizeSpeakerName,
} from '../../renderer/utils/role-localization';

describe('role display localization', () => {
  it('localizes a role name from role id', () => {
    expect(getLocalizedRoleName('engineering-architect', 'Engineering Architect', 'zh-CN')).toBe(
      '\u5de5\u7a0b\u67b6\u6784\u5e08'
    );
    expect(
      getLocalizedRoleName('implementation-engineer', 'Implementation Engineer', 'zh-CN')
    ).toBe('\u5b9e\u65bd\u5de5\u7a0b\u5e08');
    expect(getLocalizedRoleName('handoff-compressor', 'Handoff Compressor', 'zh-CN')).toBe(
      '\u4ea4\u4ed8\u538b\u7f29\u5458'
    );
    expect(
      getLocalizedRoleName('engineering-architect', '\u5de5\u7a0b\u67b6\u6784\u5e08', 'en')
    ).toBe('Engineering Architect');
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

  it('localizes runtime validation text in Chinese mode', () => {
    const text =
      'QA / Release Steward returned validation: Product Strategist failed: Role response is too large.';

    expect(localizeRoleText(text, 'zh-CN')).toBe(
      'QA / \u53d1\u5e03\u8d1f\u8d23\u4eba \u8fd4\u56de\u9a8c\u6536\u7ed3\u679c\uff1a\u4ea7\u54c1\u7b56\u7565\u5e08 \u6267\u884c\u5931\u8d25\uff1a\u89d2\u8272\u8fd4\u56de\u5185\u5bb9\u8fc7\u5927\uff0c\u8bf7\u538b\u7f29\u4e3a\u7ed3\u6784\u5316\u6458\u8981\u540e\u91cd\u8bd5\u3002'
    );
    expect(localizeSpeakerName('xiaoyu', 'zh-CN')).toBe('\u5c0f\u9c7c');
  });
});
