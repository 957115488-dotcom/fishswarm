import { describe, expect, it } from 'vitest';
import { buildRoleA2AAgentCard, buildRoleA2ATask } from '../../main/roles/role-a2a-adapter';
import { BUILT_IN_ROLES } from '../../main/roles/built-in-roles';
import type { RoleMailboxMessage } from '../../main/roles/role-session-store';
import type { RoleRunResult, ValidationLog } from '../../shared/ipc-types';

describe('role A2A adapter', () => {
  it('builds an A2A-lite agent card from a FishSwarm role', () => {
    const role = BUILT_IN_ROLES.find((item) => item.id === 'product-strategist')!;
    const card = buildRoleA2AAgentCard({ role, baseUrl: 'http://localhost:5173/' });

    expect(card.protocolVersion).toBe('fishswarm-a2a-lite/0.1');
    expect(card.name).toBe(role.name);
    expect(card.url).toBe('http://localhost:5173/a2a/roles/product-strategist');
    expect(card.capabilities.artifacts).toBe(true);
    expect(card.defaultOutputModes).toContain('text/markdown');
    expect(card.skills[0]).toMatchObject({
      id: 'product-strategist:primary',
      name: role.shortName,
    });
    expect(card.metadata).toMatchObject({
      roleId: role.id,
      defaultRunMode: role.defaultRunMode,
      enabled: role.enabled,
    });
  });

  it('builds an A2A-lite task with history and markdown artifacts', () => {
    const result: RoleRunResult = {
      runId: 'run-1',
      roleId: 'product-strategist',
      roleName: '产品策略师',
      taskId: 'task-1',
      sessionId: 'session-1',
      status: 'completed',
      summary: '已完成项目进度分析。',
      visibleMessage: '@小鱼，我已完成分析，详细交付见文档。',
      findings: [],
      decisions: [],
      nextActions: [],
      validationHints: [],
      artifacts: [
        {
          type: 'markdown',
          path: '.fishswarm/role-artifacts/project-progress.md',
          title: '项目进度分析',
          summary: '完整分析和下一步建议。',
        },
      ],
      startedAt: '2026-06-22T08:00:00.000Z',
      completedAt: '2026-06-22T08:01:00.000Z',
    };
    const validation: ValidationLog = {
      validationId: 'validation-1',
      taskId: 'task-1',
      sessionId: 'session-1',
      validatorRoleId: 'qa-release-steward',
      validatorRoleName: '验收负责人',
      checkedRoleRunIds: ['run-1'],
      verdict: 'passed',
      summary: '验收通过。',
      acceptedFindings: [],
      requiredRework: [],
      createdAt: '2026-06-22T08:02:00.000Z',
    };
    const history: RoleMailboxMessage[] = [
      {
        id: 'message-1',
        parentSessionId: 'session-1',
        roleSessionId: 'role-session-1',
        taskId: 'task-1',
        runId: 'run-1',
        roleId: 'product-strategist',
        roleName: '产品策略师',
        type: 'assignment',
        from: 'xiaoyu',
        to: '产品策略师',
        content: '小鱼将任务派发给产品策略师。',
        createdAt: '2026-06-22T08:00:00.000Z',
      },
    ];

    const task = buildRoleA2ATask({ result, validation, history });

    expect(task.id).toBe('run-1');
    expect(task.contextId).toBe('session-1');
    expect(task.status.state).toBe('completed');
    expect(task.history).toHaveLength(2);
    expect(task.artifacts).toHaveLength(2);
    expect(task.artifacts[1]).toMatchObject({
      name: '项目进度分析',
      parts: [
        {
          kind: 'file',
          file: {
            uri: '.fishswarm/role-artifacts/project-progress.md',
            mimeType: 'text/markdown',
          },
        },
      ],
    });
    expect(task.metadata).toMatchObject({
      taskId: 'task-1',
      runId: 'run-1',
      validationVerdict: 'passed',
    });
  });

  it('maps blocked validation to input-required state', () => {
    const result: RoleRunResult = {
      runId: 'run-blocked',
      roleId: 'product-strategist',
      roleName: '产品策略师',
      taskId: 'task-blocked',
      status: 'blocked',
      summary: '缺少用户确认。',
      findings: [],
      decisions: [],
      nextActions: [],
      validationHints: [],
      startedAt: '2026-06-22T08:00:00.000Z',
      completedAt: '2026-06-22T08:01:00.000Z',
    };

    expect(buildRoleA2ATask({ result }).status.state).toBe('input-required');
  });
});
