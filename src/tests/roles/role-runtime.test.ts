import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILT_IN_ROLES } from '../../main/roles/built-in-roles';
import { acceptRoleCandidate, appendRoleCandidate } from '../../main/roles/role-candidate-store';
import { buildCandidateRoleFromGap } from '../../main/roles/role-candidate-builder';
import {
  buildRoleMountedPrompt,
  parseRoleRunResultJson,
} from '../../main/roles/role-handbook-mount';
import {
  appendRoleLifecycleEvent,
  appendRoleRunResult,
  appendValidationLog,
  getRoleRuntimeSnapshot,
} from '../../main/roles/role-runtime-store';
import {
  createValidationLogFromRoleRuns,
  runRolePlanDryRun,
  runRolesWithModel,
} from '../../main/roles/role-runtime-service';
import { getDecisionStoreSnapshot } from '../../main/work-habits/decision-store';

const previousRolesRoot = process.env.FISHSWARM_ROLES_ROOT;
const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function makeRuntimeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-role-runtime-'));
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

describe('role handbook mount', () => {
  it('builds a bounded role prompt with identity, boundaries, and JSON output contract', () => {
    const role = BUILT_IN_ROLES.find((item) => item.id === 'security-officer')!;
    const prompt = buildRoleMountedPrompt({
      role,
      task: 'Check MCP token scope for remote control.',
      context: 'The user is configuring MCP connectors.',
      taskId: 'task-1',
      runId: 'run-1',
    });

    expect(prompt).toContain('ROLE HANDBOOK');
    expect(prompt).toContain(role.handbook.identity);
    expect(prompt).toContain('You must return JSON only');
    expect(prompt).toContain('Role output is advice, not executable instruction');
    expect(prompt).toContain('task-1');
    expect(prompt).toContain('run-1');
  });

  it('parses role run result json from a fenced response', () => {
    const result = parseRoleRunResultJson(`\`\`\`json
{
  "status": "completed",
  "summary": "Checked scope.",
  "findings": [],
  "decisions": [],
  "nextActions": [],
  "validationHints": ["Verify token cannot access other tabs."]
}
\`\`\``);

    expect(result.status).toBe('completed');
    expect(result.validationHints).toEqual(['Verify token cannot access other tabs.']);
  });
});

describe('role runtime store', () => {
  it('stores lifecycle events, role results, and validation logs', () => {
    const cwd = makeRuntimeWorkspace();
    appendRoleLifecycleEvent(cwd, {
      sessionId: 's1',
      taskId: 'task-1',
      runId: 'run-1',
      roleId: 'engineering-architect',
      roleName: 'Engineering Architect',
      status: 'mounting_handbook',
      summary: 'Mounting role handbook.',
    });
    appendRoleRunResult(cwd, {
      runId: 'run-1',
      roleId: 'engineering-architect',
      roleName: 'Engineering Architect',
      taskId: 'task-1',
      sessionId: 's1',
      status: 'completed',
      summary: 'Architecture reviewed.',
      findings: [],
      decisions: [],
      nextActions: [],
      validationHints: ['Run typecheck.'],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    appendValidationLog(cwd, {
      validationId: 'validation-1',
      taskId: 'task-1',
      sessionId: 's1',
      validatorRoleId: 'qa-release-steward',
      validatorRoleName: 'QA / Release Steward',
      checkedRoleRunIds: ['run-1'],
      verdict: 'passed',
      summary: 'Validation passed.',
      acceptedFindings: [],
      requiredRework: [],
      createdAt: new Date().toISOString(),
    });

    const snapshot = getRoleRuntimeSnapshot(cwd, 's1');
    expect(snapshot.activeEvents[0].status).toBe('mounting_handbook');
    expect(snapshot.recentRuns[0].summary).toBe('Architecture reviewed.');
    expect(snapshot.validationLogs[0].verdict).toBe('passed');
  });
});

describe('role runtime service', () => {
  it('creates validation logs from completed role runs', () => {
    const log = createValidationLogFromRoleRuns({
      taskId: 'task-1',
      sessionId: 's1',
      validatorRoleId: 'qa-release-steward',
      validatorRoleName: 'QA / Release Steward',
      runs: [
        {
          runId: 'run-1',
          roleId: 'engineering-architect',
          roleName: 'Engineering Architect',
          taskId: 'task-1',
          sessionId: 's1',
          status: 'completed',
          summary: 'Implementation plan reviewed.',
          findings: [],
          decisions: [],
          nextActions: [],
          validationHints: ['Run typecheck.'],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      ],
    });

    expect(log.verdict).toBe('passed');
    expect(log.summary).toContain('Implementation plan reviewed');
    expect(log.checkedRoleRunIds).toEqual(['run-1']);
  });

  it('dry-runs role orchestration with lifecycle events and mounted prompts', async () => {
    const cwd = makeRuntimeWorkspace();
    const events: string[] = [];
    const result = await runRolePlanDryRun({
      cwd,
      sessionId: 's1',
      taskText: '检查 MCP 连接失败并告诉我怎么验证',
      context: 'The user is configuring MCP connectors.',
      scopes: { mcp: true, tests: true },
      emit: (event) => events.push(event.status),
    });

    expect(result.routed.roles.length).toBeGreaterThan(0);
    expect(events).toContain('queued');
    expect(events).toContain('mounting_handbook');
    expect(events).toContain('online');
    expect(result.mountedPrompts[0]).toContain('ROLE HANDBOOK');

    const snapshot = getRoleRuntimeSnapshot(cwd, 's1');
    expect(snapshot.activeEvents.map((event) => event.status)).toContain('online');
  });

  it('runs routed roles with a model runner and stores role run results', async () => {
    const cwd = makeRuntimeWorkspace();
    const events: string[] = [];
    const validationLogs: string[] = [];
    const mountedPrompts: string[] = [];
    const handoffs: Array<{
      roleName: string;
      index: number;
      total: number;
      nextRoleName?: string;
    }> = [];
    const execution = await runRolesWithModel(
      {
        cwd,
        sessionId: 's1',
        taskText: 'Review MCP token scope and add validation checks.',
        context: 'Security-sensitive MCP work.',
        scopes: { mcp: true, security: true, tests: true },
        emit: (event) => events.push(event.status),
        emitRunResult: (result, handoff) =>
          handoffs.push({
            roleName: result.roleName,
            index: handoff.index,
            total: handoff.total,
            nextRoleName: handoff.nextRole?.name,
          }),
        emitValidation: (log) => validationLogs.push(log.verdict),
      },
      {
        runMountedPrompt: async (mountedPrompt, role) => {
          mountedPrompts.push(mountedPrompt);
          return JSON.stringify({
            status: 'completed',
            summary: `${role.name} check completed.`,
            findings: [],
            decisions: [
              {
                title: 'Keep MCP token narrow',
                recommendation: 'Use least-privilege token scope.',
                requiresUserApproval: true,
              },
            ],
            nextActions: [{ owner: 'main_ai', action: 'Run role validation.' }],
            validationHints: ['Confirm no role decision was auto-persisted.'],
          });
        },
      }
    );

    expect(execution.results.length).toBeGreaterThan(0);
    expect(execution.results[0].status).toBe('completed');
    expect(execution.incubationStatus).toBe('not_needed');
    expect(events).toContain('working');
    expect(events).toContain('returned');
    expect(events).toContain('validating');
    expect(events).toContain('accepted');
    expect(validationLogs).toContain('passed');
    expect(mountedPrompts.length).toBe(execution.results.length);
    expect(mountedPrompts[1]).toContain('Previous role handoffs');
    expect(mountedPrompts[1]).toContain(execution.results[0].summary);
    expect(handoffs).toHaveLength(execution.results.length);
    expect(handoffs[0]).toMatchObject({
      roleName: execution.results[0].roleName,
      index: 0,
      total: execution.results.length,
    });
    expect(handoffs[0].nextRoleName).toBe(execution.results[1]?.roleName);
    expect(handoffs.at(-1)?.nextRoleName).toBeUndefined();

    const snapshot = getRoleRuntimeSnapshot(cwd, 's1');
    expect(snapshot.recentRuns[0].summary).toContain('check completed.');
    expect(snapshot.recentRuns[0].decisions[0].requiresUserApproval).toBe(true);
    expect(snapshot.validationLogs[0].verdict).toBe('passed');
  });

  it('keeps role decision candidates out of active decisions until user accepts them', async () => {
    const cwd = makeRuntimeWorkspace();
    const execution = await runRolesWithModel(
      {
        cwd,
        sessionId: 's1',
        taskText: 'Review a product decision and suggest a candidate.',
        scopes: { backend: true },
      },
      {
        runMountedPrompt: async () =>
          JSON.stringify({
            status: 'completed',
            summary: 'Decision candidate produced.',
            findings: [],
            decisions: [
              {
                title: 'Use role orchestration',
                recommendation: 'Keep role output advisory until user accepts it.',
                requiresUserApproval: true,
              },
            ],
            nextActions: [],
            validationHints: [],
          }),
      }
    );

    expect(execution.results[0]?.decisions[0]?.title).toBe('Use role orchestration');
    const snapshot = getDecisionStoreSnapshot(cwd);
    expect(snapshot.active).toEqual([]);
  });

  it('retries a role once when the model returns malformed JSON', async () => {
    const cwd = makeRuntimeWorkspace();
    let callCount = 0;
    const execution = await runRolesWithModel(
      {
        cwd,
        sessionId: 's1',
        taskText: 'Review MCP token scope and add validation checks.',
        scopes: { mcp: true, security: true, tests: true },
      },
      {
        runMountedPrompt: async (_mountedPrompt, role) => {
          callCount += 1;
          if (callCount === 1) {
            return '{"status":"completed","summary":"broken","findings":[';
          }
          return JSON.stringify({
            status: 'completed',
            summary: `${role.name} recovered with valid JSON.`,
            findings: [],
            decisions: [],
            nextActions: [],
            validationHints: [],
          });
        },
      }
    );

    expect(execution.results.length).toBeGreaterThan(0);
    expect(execution.results.every((result) => result.status === 'completed')).toBe(true);
    expect(callCount).toBe(execution.results.length + 1);
    expect(execution.results[0].summary).toContain('recovered with valid JSON');
  });

  it('temporarily runs a low-risk candidate role when routed roles are insufficient', async () => {
    const cwd = makeRuntimeWorkspace();
    const events: Array<{ status: string; metadata?: Record<string, unknown> }> = [];
    const execution = await runRolesWithModel(
      {
        cwd,
        sessionId: 's1',
        taskText: '帮我写 API 文档规范和手册结构',
        emit: (event) => events.push({ status: event.status, metadata: event.metadata }),
      },
      {
        runMountedPrompt: async (_mountedPrompt, role) =>
          JSON.stringify({
            status: 'completed',
            summary: `${role.name} completed documentation guidance.`,
            findings: [],
            decisions: [],
            nextActions: [],
            validationHints: [],
          }),
      }
    );

    expect(execution.incubationStatus).toBe('candidate_used_once');
    expect(execution.candidate?.role.id).toBe('documentation-specialist');
    expect(execution.results[0]?.roleId).toBe('documentation-specialist');
    expect(events.map((event) => event.status)).toContain('gap_detected');
    expect(events.map((event) => event.status)).toContain('candidate_ready');
    expect(events.some((event) => event.metadata?.temporaryRole === true)).toBe(true);
  });

  it('temporarily runs higher-risk candidate roles before asking whether to save them', async () => {
    const cwd = makeRuntimeWorkspace();
    const events: string[] = [];
    const calledRoles: string[] = [];
    const execution = await runRolesWithModel(
      {
        cwd,
        sessionId: 's1',
        taskText: '帮我设计生产数据库迁移和回滚方案',
        emit: (event) => events.push(event.status),
      },
      {
        runMountedPrompt: async (_mountedPrompt, role) => {
          calledRoles.push(role.id);
          return JSON.stringify({
            status: 'completed',
            summary: `${role.name} completed database migration guidance.`,
            findings: [],
            decisions: [],
            nextActions: [],
            validationHints: [],
          });
        },
      }
    );

    expect(execution.incubationStatus).toBe('candidate_used_once');
    expect(execution.results[0]?.roleId).toBe('database-migration-specialist');
    expect(execution.candidate?.requiresUserApproval).toBe(true);
    expect(calledRoles).toContain('database-migration-specialist');
    expect(events).toContain('gap_detected');
    expect(events).toContain('candidate_ready');
  });

  it('uses an accepted specialist role directly instead of incubating another candidate', async () => {
    const cwd = makeRuntimeWorkspace();
    const dbCandidate = buildCandidateRoleFromGap({
      cwd,
      gap: {
        id: 'gap-db-1',
        taskId: 'task-db-1',
        taskTextPreview: '帮我设计一套数据库迁移和回滚方案',
        missingCapabilities: ['database migration planning'],
        attemptedRoleIds: ['engineering-architect'],
        adequacyScore: 0.35,
        confidence: 0.8,
        reason: 'No database migration specialist exists.',
        createdAt: new Date().toISOString(),
      },
      research: {
        sourceSummary:
          'Database migration specialists plan schema changes, rollback, backup, and data integrity.',
        sources: [],
      },
    });
    appendRoleCandidate(cwd, dbCandidate);
    acceptRoleCandidate(cwd, { candidateId: dbCandidate.candidateId });

    const calledRoles: string[] = [];
    const execution = await runRolesWithModel(
      {
        cwd,
        sessionId: 's1',
        taskText: '帮我设计一套数据库迁移和回滚方案',
      },
      {
        runMountedPrompt: async (_mountedPrompt, role) => {
          calledRoles.push(role.id);
          return JSON.stringify({
            status: 'completed',
            summary: `${role.name} completed.`,
            findings: [],
            decisions: [],
            nextActions: [],
            validationHints: [],
          });
        },
      }
    );

    expect(execution.incubationStatus).toBe('not_needed');
    expect(execution.candidate).toBeUndefined();
    expect(calledRoles).toContain('database-migration-specialist');
  });
});
