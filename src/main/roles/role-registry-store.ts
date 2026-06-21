import * as path from 'path';
import { appendProjectTimelineEvent, getWorkspaceKey } from '../observability/project-timeline';
import { BUILT_IN_ROLES } from './built-in-roles';
import { enrichGeneratedRoleLocales } from './role-candidate-builder';
import { ensureRolesWorkspaceDir, readJsonObject, writeJsonObject } from './role-paths';
import { normalizeRoleId, validateRoleDefinition } from './role-definition-validator';
import type { RoleDefinition, RoleRegistrySnapshot } from './role-types';

export function getRoleRegistrySnapshot(cwd?: string): RoleRegistrySnapshot {
  const overrides = readRoleOverrides(cwd);
  const overridesById = new Map(overrides.map((role) => [role.id, role]));
  const builtInIds = new Set(BUILT_IN_ROLES.map((role) => role.id));
  const roles: RoleDefinition[] = [];

  for (const builtIn of BUILT_IN_ROLES) {
    roles.push({ ...builtIn, ...(overridesById.get(builtIn.id) || {}), builtIn: true });
  }

  for (const override of overrides) {
    if (!builtInIds.has(override.id)) {
      roles.push({ ...override, builtIn: false });
    }
  }

  const customized = overrides.filter((role) => builtInIds.has(role.id)).length;
  return {
    workspaceKey: getWorkspaceKey(cwd),
    cwd,
    roles: roles.sort((a, b) => roleSortKey(a).localeCompare(roleSortKey(b))),
    stats: {
      total: roles.length,
      enabled: roles.filter((role) => role.enabled).length,
      builtIn: roles.filter((role) => role.builtIn).length,
      customized,
    },
  };
}

export function getRoleDefinition(cwd: string | undefined, roleId: string): RoleDefinition | null {
  const normalizedId = normalizeRoleId(roleId);
  return getRoleRegistrySnapshot(cwd).roles.find((role) => role.id === normalizedId) || null;
}

export function saveRoleOverride(cwd: string | undefined, role: RoleDefinition): RoleDefinition {
  const validated = validateRoleDefinition(enrichGeneratedRoleLocales(role));
  const overrides = readRoleOverrides(cwd).filter((item) => item.id !== validated.id);
  const saved = {
    ...validated,
    updatedAt: new Date().toISOString(),
  };
  overrides.push(saved);
  writeJsonObject(overridesPath(cwd), { roles: overrides });
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.override_saved',
    source: 'role-registry',
    status: 'ok',
    summary: `Saved role override: ${saved.name}`,
    metadata: {
      roleId: saved.id,
      enabled: saved.enabled,
      triggerMode: saved.triggerMode,
      defaultRunMode: saved.defaultRunMode,
    },
  });
  return saved;
}

export function resetRoleOverride(cwd: string | undefined, roleId: string): { success: boolean } {
  const normalizedId = normalizeRoleId(roleId);
  const overrides = readRoleOverrides(cwd);
  const next = overrides.filter((role) => role.id !== normalizedId);
  writeJsonObject(overridesPath(cwd), { roles: next });
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.override_reset',
    source: 'role-registry',
    status: 'ok',
    summary: `Reset role override: ${normalizedId}`,
    metadata: { roleId: normalizedId },
  });
  return { success: true };
}

function readRoleOverrides(cwd?: string): RoleDefinition[] {
  const parsed = readJsonObject<Record<string, unknown>>(overridesPath(cwd), { roles: [] });
  const roles = Array.isArray(parsed.roles) ? parsed.roles : [];
  return roles
    .filter(isRoleDefinition)
    .map((role) => validateRoleDefinition(enrichGeneratedRoleLocales(role)));
}

function overridesPath(cwd?: string): string {
  return path.join(ensureRolesWorkspaceDir(cwd), 'roles.json');
}

function roleSortKey(role: RoleDefinition): string {
  const index = BUILT_IN_ROLES.findIndex((builtIn) => builtIn.id === role.id);
  return `${index >= 0 ? index.toString().padStart(3, '0') : '999'}-${role.id}`;
}

function isRoleDefinition(value: RoleDefinition): boolean {
  return Boolean(value && typeof value === 'object' && typeof value.id === 'string');
}
