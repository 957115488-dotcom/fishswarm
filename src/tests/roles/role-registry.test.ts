import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILT_IN_ROLES } from '../../main/roles/built-in-roles';
import { detectRoleIntent } from '../../main/roles/intent-detector';
import {
  getRoleRegistrySnapshot,
  resetRoleOverride,
  saveRoleOverride,
} from '../../main/roles/role-registry-store';
import { routeRolesForIntent } from '../../main/roles/role-router';

const previousRolesRoot = process.env.FISHSWARM_ROLES_ROOT;
const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function makeRoleWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-roles-'));
  tempRoots.push(root);
  process.env.FISHSWARM_ROLES_ROOT = path.join(root, 'roles');
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(cwd, { recursive: true });
  return cwd;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv('FISHSWARM_ROLES_ROOT', previousRolesRoot);
  restoreEnv('FISHSWARM_TIMELINE_ROOT', previousTimelineRoot);
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('built-in roles', () => {
  it('defines the required built-in roles with complete handbooks', () => {
    expect(BUILT_IN_ROLES.map((role) => role.id)).toEqual([
      'product-strategist',
      'engineering-architect',
      'implementation-engineer',
      'product-designer',
      'developer-experience',
      'security-officer',
      'qa-release-steward',
      'handoff-compressor',
    ]);

    for (const role of BUILT_IN_ROLES) {
      expect(role.enabled).toBe(true);
      expect(role.builtIn).toBe(true);
      expect(role.name.length).toBeGreaterThan(2);
      expect(role.shortName.length).toBeGreaterThan(1);
      expect(role.description.length).toBeGreaterThan(10);
      expect(role.triggerScopes.length + role.triggerKeywords.length).toBeGreaterThan(0);
      expect(role.handbook.identity.length).toBeGreaterThan(10);
      expect(role.handbook.responsibilities.length).toBeGreaterThan(0);
      expect(role.handbook.boundaries.length).toBeGreaterThan(0);
      expect(role.handbook.outputFormat.length).toBeGreaterThan(0);
      expect(role.handbook.completionCriteria.length).toBeGreaterThan(0);
      expect(role.handbook.safetyRules.length).toBeGreaterThan(0);
    }
  });
});

describe('role registry store', () => {
  it('returns built-in roles in the workspace snapshot', () => {
    const cwd = makeRoleWorkspace();
    const snapshot = getRoleRegistrySnapshot(cwd);
    expect(snapshot.roles).toHaveLength(8);
    expect(snapshot.stats.enabled).toBe(8);
  });

  it('applies workspace role overrides without mutating built-ins', () => {
    const cwd = makeRoleWorkspace();
    const original = getRoleRegistrySnapshot(cwd).roles.find(
      (role) => role.id === 'security-officer'
    )!;
    const updated = saveRoleOverride(cwd, {
      ...original,
      enabled: false,
      description: 'Custom security role description for this workspace.',
    });
    expect(updated.enabled).toBe(false);

    const snapshot = getRoleRegistrySnapshot(cwd);
    const role = snapshot.roles.find((item) => item.id === 'security-officer')!;
    expect(role.enabled).toBe(false);
    expect(role.builtIn).toBe(true);
    expect(snapshot.stats.customized).toBe(1);
  });

  it('resets a workspace role override', () => {
    const cwd = makeRoleWorkspace();
    const original = getRoleRegistrySnapshot(cwd).roles.find(
      (role) => role.id === 'product-designer'
    )!;
    saveRoleOverride(cwd, { ...original, enabled: false });
    resetRoleOverride(cwd, original.id);

    const role = getRoleRegistrySnapshot(cwd).roles.find((item) => item.id === original.id)!;
    expect(role.enabled).toBe(true);
  });
});

describe('role routing', () => {
  it('detects requirement, validation, risk, and decision intent from user text', () => {
    expect(detectRoleIntent('开始完成 GStack Browse 适配').kinds).toContain('requirement');
    expect(detectRoleIntent('我要怎么验证这个功能').kinds).toContain('validation');
    expect(detectRoleIntent('这个 MCP token scope 有安全风险吗').kinds).toContain('risk');
    expect(detectRoleIntent('这个连接器要不要默认启用').kinds).toContain('decision');
    expect(detectRoleIntent('你觉得目前这个项目作为普通用户能使用明白吗').kinds).toContain(
      'decision'
    );
  });

  it('routes MCP and security work to engineering, DX, security, and QA', () => {
    const cwd = makeRoleWorkspace();
    const intent = detectRoleIntent('修复 MCP 连接失败，检查 token scope，并告诉我怎么验证');
    const routed = routeRolesForIntent({
      cwd,
      text: '修复 MCP 连接失败，检查 token scope，并告诉我怎么验证',
      intent,
      scopes: {
        frontend: false,
        backend: true,
        prompts: false,
        tests: false,
        docs: false,
        config: true,
        migrations: false,
        api: false,
        auth: true,
        security: true,
        mcp: true,
        remote: false,
        packaging: false,
      },
    });

    expect(routed.roles.map((role) => role.id)).toEqual(
      expect.arrayContaining([
        'engineering-architect',
        'developer-experience',
        'security-officer',
        'qa-release-steward',
      ])
    );
  });

  it('routes product, engineering, design, DX, security, and QA according to intent and scopes', () => {
    const cwd = makeRoleWorkspace();
    const intent = detectRoleIntent(
      '实现一个设置页角色管理功能，修复 MCP 配置风险，并告诉我怎么验证'
    );
    const routed = routeRolesForIntent({
      cwd,
      text: '实现一个设置页角色管理功能，修复 MCP 配置风险，并告诉我怎么验证',
      intent,
      scopes: {
        frontend: true,
        backend: true,
        prompts: false,
        tests: true,
        docs: false,
        config: true,
        migrations: false,
        api: false,
        auth: false,
        security: true,
        mcp: true,
        remote: false,
        packaging: false,
      },
    });

    expect(routed.roles.map((role) => role.id)).toEqual(
      expect.arrayContaining([
        'product-strategist',
        'engineering-architect',
        'implementation-engineer',
        'product-designer',
        'developer-experience',
        'security-officer',
        'qa-release-steward',
      ])
    );
  });

  it('routes user experience evaluation questions to product and design roles', () => {
    const cwd = makeRoleWorkspace();
    const text = '你觉得目前这个项目作为一位普通用户，他能使用的明白吗？';
    const intent = detectRoleIntent(text);
    const routed = routeRolesForIntent({
      cwd,
      text,
      intent,
      scopes: {
        frontend: false,
        backend: false,
        prompts: false,
        tests: false,
        docs: false,
        config: false,
        migrations: false,
        api: false,
        auth: false,
        security: false,
        mcp: false,
        remote: false,
        packaging: false,
      },
    });

    expect(routed.roles.map((role) => role.id)).toEqual(
      expect.arrayContaining(['product-strategist', 'product-designer'])
    );
  });

  it('routes concrete build requests to implementation engineer instead of Xiaoyu execution', () => {
    const cwd = makeRoleWorkspace();
    const text = '先做 week1-2，创建 MVP 可运行版本并搭建项目结构';
    const intent = detectRoleIntent(text);
    const routed = routeRolesForIntent({
      cwd,
      text,
      intent,
      scopes: {
        frontend: true,
        backend: true,
        prompts: false,
        tests: false,
        docs: false,
        config: true,
        migrations: false,
        api: false,
        auth: false,
        security: false,
        mcp: false,
        remote: false,
        packaging: true,
      },
    });

    expect(routed.roles.map((role) => role.id)).toEqual(
      expect.arrayContaining(['implementation-engineer', 'qa-release-steward'])
    );
    expect(routed.validationRequired).toBe(true);
  });

  it('routes direct project run requests to implementation and DX without product framing', () => {
    const cwd = makeRoleWorkspace();
    const text = '\u5e2e\u6211\u8fd0\u884c\u8fd9\u4e2a\u9879\u76ee';
    const intent = detectRoleIntent(text);
    const routed = routeRolesForIntent({
      cwd,
      text,
      intent,
      scopes: {
        frontend: false,
        backend: false,
        prompts: false,
        tests: false,
        docs: false,
        config: false,
        migrations: false,
        api: false,
        auth: false,
        security: false,
        mcp: false,
        remote: false,
        packaging: false,
      },
    });
    const roleIds = routed.roles.map((role) => role.id);

    expect(intent.kinds).toContain('requirement');
    expect(roleIds).toEqual(
      expect.arrayContaining([
        'implementation-engineer',
        'developer-experience',
        'qa-release-steward',
      ])
    );
    expect(roleIds).not.toContain('product-strategist');
    expect(routed.validationRequired).toBe(true);
  });

  it('does not route production user-data migration work to design only because it mentions users', () => {
    const cwd = makeRoleWorkspace();
    const text = '帮我设计生产数据库迁移和回滚方案，涉及真实用户数据和线上回滚策略';
    const intent = detectRoleIntent(text);
    const routed = routeRolesForIntent({
      cwd,
      text,
      intent,
      scopes: {
        frontend: false,
        backend: true,
        prompts: false,
        tests: true,
        docs: false,
        config: false,
        migrations: true,
        api: false,
        auth: false,
        security: true,
        mcp: false,
        remote: false,
        packaging: false,
      },
    });

    const roleIds = routed.roles.map((role) => role.id);
    expect(roleIds).toEqual(
      expect.arrayContaining([
        'product-strategist',
        'engineering-architect',
        'implementation-engineer',
        'security-officer',
      ])
    );
    expect(roleIds).not.toContain('product-designer');
  });
});
