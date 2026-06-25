import { BUILT_IN_ROLES } from '../roles/built-in-roles';
import type { RoleDefinition } from '../roles/role-types';
import type { AssetCenterItem } from './asset-center-types';

export interface RoleAssetIndexInput {
  roles?: RoleDefinition[];
}

export interface RoleAssetIndexResult {
  items: AssetCenterItem[];
  warnings: string[];
}

function roleStatus(role: RoleDefinition): AssetCenterItem['status'] {
  return role.enabled ? 'enabled' : 'disabled';
}

export function indexRoleAssets(input: RoleAssetIndexInput = {}): RoleAssetIndexResult {
  const roles = input.roles || BUILT_IN_ROLES;
  const items = roles.map((role) => ({
    id: `role:${role.id}`,
    kind: 'role',
    source: role.builtIn ? 'built-in' : 'user',
    scope: 'app',
    status: roleStatus(role),
    title: role.name,
    summary: role.description,
    tags: ['role', role.triggerMode, role.defaultRunMode, ...role.triggerScopes],
    sourceRef: { type: 'generated', id: role.id },
    schemaVersion: 1,
    updatedAt: role.updatedAt,
    actions: ['viewDetails', 'useInTask'],
    warnings: [],
  })) satisfies AssetCenterItem[];

  return { items: items.sort((a, b) => a.id.localeCompare(b.id)), warnings: [] };
}
