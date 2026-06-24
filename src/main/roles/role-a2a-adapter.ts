import type {
  A2AAgentCard,
  A2AAgentSkill,
  A2AArtifact,
  A2AMessage,
  A2APart,
  A2ATask,
  A2ATaskState,
  RoleDefinition,
  RoleRunArtifact,
  RoleRunResult,
  ValidationLog,
} from './role-types';
import type { RoleMailboxMessage } from './role-session-store';

export interface BuildRoleAgentCardInput {
  role: RoleDefinition;
  baseUrl?: string;
}

export interface BuildRoleTaskInput {
  result: RoleRunResult;
  validation?: ValidationLog;
  history?: RoleMailboxMessage[];
}

export function buildRoleA2AAgentCard(input: BuildRoleAgentCardInput): A2AAgentCard {
  const { role, baseUrl } = input;
  return {
    protocolVersion: 'fishswarm-a2a-lite/0.1',
    name: role.name,
    description: role.description,
    url: baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/a2a/roles/${encodeURIComponent(role.id)}`
      : undefined,
    provider: {
      organization: 'FishSwarm',
    },
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
      artifacts: true,
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['application/json', 'text/markdown'],
    skills: buildRoleA2ASkills(role),
    metadata: {
      roleId: role.id,
      roleName: role.name,
      triggerMode: role.triggerMode,
      defaultRunMode: role.defaultRunMode,
      triggerScopes: role.triggerScopes,
      builtIn: role.builtIn,
      enabled: role.enabled,
    },
  };
}

export function buildRoleA2ATask(input: BuildRoleTaskInput): A2ATask {
  const { result, validation, history = [] } = input;
  const state = roleResultToA2ATaskState(result, validation);
  const statusMessage = buildStatusMessage(result, validation);
  return {
    id: result.runId,
    contextId: result.sessionId,
    status: {
      state,
      message: statusMessage,
      timestamp: result.completedAt,
    },
    history: [
      ...history.map(roleMailboxMessageToA2AMessage),
      {
        role: 'agent',
        parts: [{ kind: 'text', text: result.visibleMessage || result.summary }],
        metadata: {
          roleId: result.roleId,
          roleName: result.roleName,
          resultStatus: result.status,
        },
      },
    ],
    artifacts: [
      resultToSummaryArtifact(result),
      ...(result.artifacts || []).map((artifact, index) =>
        roleRunArtifactToA2AArtifact(artifact, index)
      ),
    ],
    metadata: {
      taskId: result.taskId,
      roleId: result.roleId,
      roleName: result.roleName,
      runId: result.runId,
      validationId: validation?.validationId,
      validationVerdict: validation?.verdict,
    },
  };
}

function buildRoleA2ASkills(role: RoleDefinition): A2AAgentSkill[] {
  const tags = [...new Set([...role.triggerScopes, ...role.triggerKeywords].filter(Boolean))];
  return [
    {
      id: `${role.id}:primary`,
      name: role.shortName || role.name,
      description: role.description,
      tags,
    },
    ...role.handbook.responsibilities.slice(0, 3).map((responsibility, index) => ({
      id: `${role.id}:responsibility-${index + 1}`,
      name: responsibility.slice(0, 80),
      description: responsibility,
      tags: role.triggerScopes,
    })),
  ];
}

function roleResultToA2ATaskState(result: RoleRunResult, validation?: ValidationLog): A2ATaskState {
  if (validation?.verdict === 'blocked' || result.status === 'blocked') return 'input-required';
  if (validation?.verdict === 'needs_revision' || result.status === 'needs_revision') {
    return 'working';
  }
  if (result.status === 'failed') return 'failed';
  if (validation && validation.verdict !== 'passed') return 'working';
  return 'completed';
}

function buildStatusMessage(result: RoleRunResult, validation?: ValidationLog): A2AMessage {
  const text = validation
    ? `${result.roleName}: ${result.summary}\n验收：${validation.summary}`
    : `${result.roleName}: ${result.summary}`;
  return {
    role: 'agent',
    parts: [{ kind: 'text', text }],
    metadata: {
      resultStatus: result.status,
      validationVerdict: validation?.verdict,
    },
  };
}

function roleMailboxMessageToA2AMessage(message: RoleMailboxMessage): A2AMessage {
  return {
    role: message.from === 'user' ? 'user' : 'agent',
    parts: [{ kind: 'text', text: message.content }],
    metadata: {
      messageId: message.id,
      messageType: message.type,
      from: message.from,
      to: message.to,
      roleSessionId: message.roleSessionId,
      runId: message.runId,
      createdAt: message.createdAt,
      data: message.data,
    },
  };
}

function resultToSummaryArtifact(result: RoleRunResult): A2AArtifact {
  const lines = [
    `# ${result.roleName} 交付摘要`,
    '',
    `- 状态：${result.status}`,
    `- 摘要：${result.summary}`,
    result.findings.length > 0 ? `- 发现：${result.findings.length} 项` : '',
    result.decisions.length > 0 ? `- 决策候选：${result.decisions.length} 项` : '',
    result.nextActions.length > 0 ? `- 下一步：${result.nextActions.length} 项` : '',
  ].filter(Boolean);
  return {
    artifactId: `${result.runId}:summary`,
    name: `${result.roleName} summary`,
    description: result.summary,
    parts: [{ kind: 'text', text: lines.join('\n') }],
    metadata: {
      kind: 'role-result-summary',
      roleId: result.roleId,
      roleName: result.roleName,
      resultStatus: result.status,
    },
  };
}

function roleRunArtifactToA2AArtifact(artifact: RoleRunArtifact, index: number): A2AArtifact {
  return {
    artifactId: `artifact-${index + 1}`,
    name: artifact.title,
    description: artifact.summary,
    parts: [roleRunArtifactToA2APart(artifact)],
    metadata: {
      kind: 'role-run-artifact',
      sourcePath: artifact.path,
      sourceType: artifact.type,
    },
  };
}

function roleRunArtifactToA2APart(artifact: RoleRunArtifact): A2APart {
  return {
    kind: 'file',
    file: {
      name: artifact.title,
      uri: artifact.path,
      mimeType: 'text/markdown',
    },
  };
}
