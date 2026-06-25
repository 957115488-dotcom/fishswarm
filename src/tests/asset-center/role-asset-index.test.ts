import { describe, expect, it } from 'vitest';
import { BUILT_IN_ROLES } from '../../main/roles/built-in-roles';
import type { RoleDefinition } from '../../main/roles/role-types';
import { indexRoleAssets } from '../../main/asset-center/role-asset-index';

function fakeRole(overrides: Partial<RoleDefinition> = {}): RoleDefinition {
  return {
    id: 'fake-role',
    name: 'Fake Role',
    shortName: 'Fake',
    description: 'A fake role for asset indexing tests.',
    enabled: true,
    builtIn: true,
    triggerMode: 'automatic',
    defaultRunMode: 'review',
    triggerScopes: ['backend'],
    triggerKeywords: ['fake'],
    handbook: {
      identity: 'Fake identity',
      responsibilities: [],
      boundaries: [],
      inputRequirements: [],
      outputFormat: [],
      completionCriteria: [],
      validationCriteria: [],
      safetyRules: [],
      decisionAuthority: [],
    },
    updatedAt: '2026-06-24T00:00:00.000Z',
    ...overrides,
  };
}

describe('role asset index', () => {
  it('indexes built-in roles as read-only role assets', () => {
    const result = indexRoleAssets();

    expect(result.warnings).toEqual([]);
    expect(result.items.length).toBe(BUILT_IN_ROLES.length);
    expect(result.items.every((item) => item.kind === 'role')).toBe(true);
    expect(result.items.every((item) => item.actions.includes('viewDetails'))).toBe(true);
    expect(result.items.every((item) => item.actions.includes('useInTask'))).toBe(true);
  });

  it('keeps role ids stable and deterministic', () => {
    const result = indexRoleAssets({
      roles: [fakeRole({ id: 'z-role' }), fakeRole({ id: 'a-role' })],
    });

    expect(result.items.map((item) => item.id)).toEqual(['role:a-role', 'role:z-role']);
  });

  it('reflects enabled and disabled role state without creating runtime sessions', () => {
    const result = indexRoleAssets({
      roles: [
        fakeRole({ id: 'enabled-role', enabled: true }),
        fakeRole({ id: 'disabled-role', enabled: false }),
      ],
    });

    expect(result.items.find((item) => item.id === 'role:enabled-role')?.status).toBe('enabled');
    expect(result.items.find((item) => item.id === 'role:disabled-role')?.status).toBe('disabled');
  });
});
