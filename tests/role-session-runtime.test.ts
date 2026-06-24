import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { runRolesWithModel } from '../src/main/roles/role-runtime-service';
import { getRoleMailboxMessages, getRoleSessions } from '../src/main/roles/role-session-store';

const previousRolesRoot = process.env.FISHSWARM_ROLES_ROOT;
const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function makeRuntimeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-role-session-runtime-'));
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

describe('role session runtime', () => {
  it('routes Xiaoyu rework back into the same role session mailbox', async () => {
    const cwd = makeRuntimeWorkspace();
    const calledRoles: string[] = [];

    const execution = await runRolesWithModel(
      {
        cwd,
        sessionId: 'parent-session-1',
        taskText: 'Review MCP token scope and add validation checks.',
        context: 'Security-sensitive MCP work.',
        scopes: { mcp: true, security: true, tests: true },
      },
      {
        runMountedPrompt: async (_mountedPrompt, role) => {
          calledRoles.push(role.id);
          return JSON.stringify({
            status: 'needs_revision',
            summary: `${role.name} needs more evidence before handoff.`,
            findings: [],
            decisions: [],
            nextActions: [{ owner: 'role', roleId: role.id, action: 'Add concrete evidence.' }],
            validationHints: ['Do not continue until this role adds evidence.'],
          });
        },
      }
    );

    expect(execution.results).toHaveLength(2);
    expect(calledRoles[2]).toBe(calledRoles[0]);

    const sessions = getRoleSessions(cwd, 'parent-session-1');
    const rejectedRoleSession = sessions.find(
      (session) => session.roleId === execution.results[0].roleId
    );
    expect(rejectedRoleSession).toBeDefined();
    expect(rejectedRoleSession?.runIds).toEqual([
      execution.results[0].runId,
      execution.results[1].runId,
    ]);
    expect(rejectedRoleSession?.status).toBe('needs_revision');
    expect(rejectedRoleSession?.reworkOfRunId).toBe(execution.results[0].runId);
    expect(rejectedRoleSession?.messageCount).toBeGreaterThanOrEqual(5);

    const mailbox = getRoleMailboxMessages(cwd, 'parent-session-1');
    expect(mailbox.some((message) => message.type === 'assignment')).toBe(true);
    expect(
      mailbox.some(
        (message) =>
          message.roleSessionId === rejectedRoleSession?.roleSessionId &&
          message.type === 'rework_request' &&
          message.data?.previousRunId === execution.results[0].runId
      )
    ).toBe(true);
    expect(
      mailbox.some(
        (message) =>
          message.roleSessionId === rejectedRoleSession?.roleSessionId &&
          message.type === 'validation_result' &&
          message.data?.verdict === 'needs_revision'
      )
    ).toBe(true);
  });
});
