import * as path from 'path';
import { randomUUID } from 'crypto';
import { appendProjectTimelineEvent, getWorkspaceKey } from '../observability/project-timeline';
import { scanUntrustedText } from '../security/content-security';
import { redactText } from '../security/redact';
import { appendJsonLine, ensureRolesWorkspaceDir, readJsonLines } from './role-paths';
import type {
  RoleLifecycleEvent,
  RoleRunResult,
  RoleRuntimeSnapshot,
  SwarmEvent,
  SwarmEventStatus,
  ValidationLog,
} from './role-types';

type SwarmEventInput = Omit<SwarmEvent, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
};

export function appendRoleLifecycleEvent(
  cwd: string | undefined,
  input: Omit<RoleLifecycleEvent, 'id' | 'ts'>
): RoleLifecycleEvent {
  const event: RoleLifecycleEvent = {
    ...input,
    id: randomUUID(),
    ts: new Date().toISOString(),
    summary: sanitizeRuntimeText(input.summary, 'lifecycle summary', 1000),
  };
  appendJsonLine(roleEventsPath(cwd), event);
  appendSwarmEvents(cwd, buildSwarmEventsFromLifecycleEvent(event));
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.lifecycle',
    source: 'role-runtime',
    status: lifecycleStatusToTimelineStatus(event.status),
    summary: event.summary,
    metadata: {
      sessionId: event.sessionId,
      taskId: event.taskId,
      runId: event.runId,
      roleId: event.roleId,
      roleName: event.roleName,
      lifecycleStatus: event.status,
    },
  });
  return event;
}

export function appendRoleRunResult(cwd: string | undefined, result: RoleRunResult): RoleRunResult {
  const sanitized: RoleRunResult = {
    ...result,
    summary: sanitizeRuntimeText(result.summary, 'role result summary', 2000),
    visibleMessage: result.visibleMessage
      ? sanitizeRuntimeText(result.visibleMessage, 'role visible message', 600)
      : undefined,
    findings: result.findings.map((finding) => ({
      ...finding,
      title: sanitizeRuntimeText(finding.title, 'finding title', 300),
      evidence: finding.evidence
        ? sanitizeRuntimeText(finding.evidence, 'finding evidence', 1000)
        : undefined,
      recommendation: sanitizeRuntimeText(finding.recommendation, 'finding recommendation', 1000),
    })),
    decisions: result.decisions.map((decision) => ({
      ...decision,
      title: sanitizeRuntimeText(decision.title, 'decision title', 300),
      recommendation: sanitizeRuntimeText(decision.recommendation, 'decision recommendation', 1000),
      rationale: decision.rationale
        ? sanitizeRuntimeText(decision.rationale, 'decision rationale', 1000)
        : undefined,
    })),
    nextActions: result.nextActions.map((action) => ({
      ...action,
      action: sanitizeRuntimeText(action.action, 'next action', 1000),
    })),
    validationHints: result.validationHints.map((hint) =>
      sanitizeRuntimeText(hint, 'validation hint', 1000)
    ),
    artifacts: result.artifacts?.map((artifact) => ({
      type: artifact.type,
      path: sanitizeRuntimeText(artifact.path, 'artifact path', 500),
      title: sanitizeRuntimeText(artifact.title, 'artifact title', 200),
      summary: artifact.summary
        ? sanitizeRuntimeText(artifact.summary, 'artifact summary', 500)
        : undefined,
    })),
  };
  appendJsonLine(roleRunsPath(cwd), sanitized);
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.run_completed',
    source: 'role-runtime',
    status:
      sanitized.status === 'failed' ? 'error' : sanitized.status === 'blocked' ? 'blocked' : 'ok',
    summary: sanitized.summary,
    metadata: {
      sessionId: sanitized.sessionId,
      taskId: sanitized.taskId,
      runId: sanitized.runId,
      roleId: sanitized.roleId,
      roleName: sanitized.roleName,
      resultStatus: sanitized.status,
      findings: sanitized.findings.length,
      decisions: sanitized.decisions.length,
      artifacts: sanitized.artifacts?.length || 0,
    },
  });
  return sanitized;
}

export function appendValidationLog(cwd: string | undefined, log: ValidationLog): ValidationLog {
  const sanitized: ValidationLog = {
    ...log,
    summary: sanitizeRuntimeText(log.summary, 'validation summary', 1000),
    acceptedFindings: log.acceptedFindings.map((finding) =>
      sanitizeRuntimeText(finding, 'accepted finding', 1000)
    ),
    requiredRework: log.requiredRework.map((item) =>
      sanitizeRuntimeText(item, 'required rework', 1000)
    ),
  };
  appendJsonLine(validationLogsPath(cwd), sanitized);
  appendSwarmEvents(cwd, buildSwarmEventsFromValidationLog(sanitized));
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.validation_recorded',
    source: 'role-runtime',
    status:
      sanitized.verdict === 'passed' ? 'ok' : sanitized.verdict === 'blocked' ? 'blocked' : 'info',
    summary: sanitized.summary,
    metadata: {
      sessionId: sanitized.sessionId,
      taskId: sanitized.taskId,
      validationId: sanitized.validationId,
      validatorRoleId: sanitized.validatorRoleId,
      verdict: sanitized.verdict,
      checkedRoleRunIds: sanitized.checkedRoleRunIds,
    },
  });
  return sanitized;
}

export function getRoleRuntimeSnapshot(
  cwd?: string,
  sessionId?: string,
  limit = 100
): RoleRuntimeSnapshot {
  const activeEvents = filterSession(
    readJsonLines<RoleLifecycleEvent>(roleEventsPath(cwd)),
    sessionId
  )
    .slice(-Math.max(1, limit))
    .reverse();
  const recentRuns = filterSession(readJsonLines<RoleRunResult>(roleRunsPath(cwd)), sessionId)
    .slice(-Math.max(1, limit))
    .reverse();
  const validationLogs = dedupeValidationLogs(
    filterSession(readJsonLines<ValidationLog>(validationLogsPath(cwd)), sessionId)
  )
    .slice(-Math.max(1, limit))
    .reverse();
  const swarmEvents = dedupeSwarmEvents(
    filterSession(readJsonLines<SwarmEvent>(swarmEventsPath(cwd)), sessionId)
  )
    .slice(-Math.max(1, limit))
    .reverse();

  return {
    workspaceKey: getWorkspaceKey(cwd),
    cwd,
    sessionId,
    activeEvents,
    recentRuns,
    validationLogs,
    swarmEvents,
  };
}

export function appendSwarmEvent(cwd: string | undefined, input: SwarmEventInput): SwarmEvent {
  const event: SwarmEvent = {
    ...input,
    id: input.id || randomUUID(),
    createdAt: input.createdAt || new Date().toISOString(),
    content: sanitizeRuntimeText(input.content, 'swarm event content', 1200),
  };
  appendJsonLine(swarmEventsPath(cwd), event);
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'swarm.event',
    source: 'role-runtime',
    status: swarmEventStatusToTimelineStatus(event.status),
    summary: event.content,
    metadata: {
      sessionId: event.sessionId,
      taskId: event.taskId,
      runId: event.runId,
      parentRunId: event.parentRunId,
      roleId: event.roleId,
      roleName: event.roleName,
      validationId: event.validationId,
      swarmEventType: event.type,
      swarmStatus: event.status,
    },
  });
  return event;
}

export function appendSwarmEvents(
  cwd: string | undefined,
  events: SwarmEventInput[]
): SwarmEvent[] {
  return events.map((event) => appendSwarmEvent(cwd, event));
}

export function buildSwarmEventsFromLifecycleEvent(event: RoleLifecycleEvent): SwarmEvent[] {
  const roleDisplayName = localizeSwarmRoleName(event.roleId, event.roleName);
  const base = {
    sessionId: event.sessionId,
    taskId: event.taskId,
    runId: event.runId,
    roleId: event.roleId,
    roleName: roleDisplayName,
    createdAt: event.ts,
  };
  const status = lifecycleStatusToSwarmStatus(event.status);

  switch (event.status) {
    case 'queued':
      return [
        {
          ...base,
          id: `${event.id}:xiaoyu-dispatch`,
          type: 'xiaoyu.dispatch',
          speaker: 'xiaoyu',
          target: roleDisplayName,
          status,
          content: `小鱼：@${roleDisplayName}，这个任务交给你处理。`,
          data: { lifecycleEventId: event.id, lifecycleStatus: event.status },
        },
      ];
    case 'online':
      return [
        {
          ...base,
          id: `${event.id}:role-online`,
          type: 'role.online',
          speaker: roleDisplayName,
          target: 'xiaoyu',
          status,
          content: `${roleDisplayName}：@小鱼，我已上线，角色 session 已经接到任务。`,
          data: { lifecycleEventId: event.id, lifecycleStatus: event.status },
        },
        {
          ...base,
          id: `${event.id}:role-plan`,
          type: 'role.plan',
          speaker: roleDisplayName,
          target: 'xiaoyu',
          status,
          content: buildRolePlanSwarmContent(event, roleDisplayName),
          data: {
            lifecycleEventId: event.id,
            lifecycleStatus: event.status,
            rolePlan: normalizeMetadataList(event.metadata?.rolePlan),
            expectedDeliverables: normalizeMetadataList(event.metadata?.expectedDeliverables),
          },
        },
      ];
    case 'returned':
      return [
        {
          ...base,
          id: `${event.id}:role-delivery`,
          type: 'role.delivery',
          speaker: roleDisplayName,
          target: 'xiaoyu',
          status,
          content: `${roleDisplayName}：@小鱼，我完成了本轮处理。${localizeSwarmRuntimeText(event.summary)}`,
          data: {
            lifecycleEventId: event.id,
            lifecycleStatus: event.status,
            resultStatus: event.metadata?.resultStatus,
          },
        },
      ];
    case 'validating':
      return [
        {
          ...base,
          id: `${event.id}:validation-started`,
          type: 'validation.started',
          speaker: roleDisplayName,
          target: 'xiaoyu',
          status,
          content: `${roleDisplayName}：@小鱼，我开始验收这份交付。${localizeSwarmRuntimeText(event.summary)}`,
          data: {
            lifecycleEventId: event.id,
            lifecycleStatus: event.status,
            checkedRoleRunIds: event.metadata?.checkedRoleRunIds,
          },
        },
      ];
    case 'failed':
      return [
        {
          ...base,
          id: `${event.id}:role-failed`,
          type: 'role.delivery',
          speaker: roleDisplayName,
          target: 'xiaoyu',
          status,
          content: `${roleDisplayName}：@小鱼，我这轮执行失败：${localizeSwarmRuntimeText(event.summary)}`,
          data: { lifecycleEventId: event.id, lifecycleStatus: event.status },
        },
      ];
    default:
      return [];
  }
}

export function buildSwarmEventsFromValidationLog(log: ValidationLog): SwarmEvent[] {
  const parentRunId = log.checkedRoleRunIds[0];
  const validatorDisplayName = localizeSwarmRoleName(log.validatorRoleId, log.validatorRoleName);
  const base = {
    sessionId: log.sessionId,
    taskId: log.taskId,
    runId: parentRunId || log.validationId,
    parentRunId,
    validationId: log.validationId,
    roleId: log.validatorRoleId,
    roleName: validatorDisplayName,
    createdAt: log.createdAt,
    data: {
      checkedRoleRunIds: log.checkedRoleRunIds,
      acceptedFindings: log.acceptedFindings,
      requiredRework: log.requiredRework,
    },
  };
  const decisionEvent: SwarmEvent = {
    ...base,
    id: `${log.validationId}:validation-${log.verdict}`,
    type:
      log.verdict === 'passed'
        ? 'validation.accepted'
        : log.verdict === 'blocked'
          ? 'validation.blocked'
          : 'validation.needs_revision',
    speaker: validatorDisplayName,
    target: 'xiaoyu',
    status: validationVerdictToSwarmStatus(log.verdict),
    content: buildValidationSwarmContent(log, validatorDisplayName),
  };
  return [decisionEvent];
}

function filterSession<T extends { sessionId?: string }>(items: T[], sessionId?: string): T[] {
  if (!sessionId) return items;
  return items.filter((item) => item.sessionId === sessionId);
}

function dedupeValidationLogs(logs: ValidationLog[]): ValidationLog[] {
  const byKey = new Map<string, ValidationLog>();
  for (const log of logs) {
    const key = validationLogDedupeKey(log);
    if (byKey.has(key)) {
      byKey.delete(key);
    }
    byKey.set(key, log);
  }
  return Array.from(byKey.values());
}

function dedupeSwarmEvents(events: SwarmEvent[]): SwarmEvent[] {
  const byId = new Map<string, SwarmEvent>();
  for (const event of events) {
    if (byId.has(event.id)) byId.delete(event.id);
    byId.set(event.id, event);
  }
  return Array.from(byId.values());
}

function validationLogDedupeKey(log: ValidationLog): string {
  const checkedRuns = [...log.checkedRoleRunIds].sort().join(',');
  if (checkedRuns) {
    return [log.sessionId || '', log.taskId, log.validatorRoleId, checkedRuns].join('|');
  }
  return `id:${log.validationId}`;
}

function lifecycleStatusToTimelineStatus(
  status: RoleLifecycleEvent['status']
): 'started' | 'ok' | 'error' | 'blocked' | 'info' {
  if (status === 'failed') return 'error';
  if (status === 'needs_revision' || status === 'blocked') return 'blocked';
  if (
    status === 'queued' ||
    status === 'mounting_handbook' ||
    status === 'online' ||
    status === 'working'
  ) {
    return 'started';
  }
  return 'ok';
}

function lifecycleStatusToSwarmStatus(
  status: RoleLifecycleEvent['status']
): SwarmEventStatus | undefined {
  if (status === 'queued') return 'pending';
  if (
    status === 'mounting_handbook' ||
    status === 'online' ||
    status === 'working' ||
    status === 'validating' ||
    status === 'incubating_role'
  ) {
    return 'running';
  }
  if (status === 'returned' || status === 'accepted' || status === 'candidate_ready') {
    return 'completed';
  }
  if (status === 'needs_revision') return 'needs_revision';
  if (status === 'blocked' || status === 'candidate_blocked' || status === 'approval_required') {
    return 'blocked';
  }
  if (status === 'failed') return 'failed';
  return undefined;
}

function validationVerdictToSwarmStatus(verdict: ValidationLog['verdict']): SwarmEventStatus {
  if (verdict === 'passed') return 'completed';
  if (verdict === 'blocked') return 'blocked';
  return 'needs_revision';
}

function swarmEventStatusToTimelineStatus(
  status: SwarmEventStatus | undefined
): 'started' | 'ok' | 'error' | 'blocked' | 'info' {
  if (status === 'failed') return 'error';
  if (status === 'blocked' || status === 'needs_revision') return 'blocked';
  if (status === 'running' || status === 'pending') return 'started';
  if (status === 'completed') return 'ok';
  return 'info';
}

function buildRolePlanSwarmContent(event: RoleLifecycleEvent, roleDisplayName: string): string {
  const rolePlan = normalizeMetadataList(event.metadata?.rolePlan).map(localizeSwarmRoleItem);
  const expectedDeliverables = normalizeMetadataList(event.metadata?.expectedDeliverables).map(
    localizeSwarmRoleItem
  );
  const planText =
    rolePlan.length > 0
      ? `我打算先${joinChineseItems(rolePlan)}。`
      : '我会先按角色职责梳理问题、判断风险，再形成结构化结论。';
  const deliverableText =
    expectedDeliverables.length > 0
      ? `预计交付给你：${joinChineseItems(expectedDeliverables)}。`
      : '预计交付给你：结构化发现、判断和下一步建议。';
  return `${roleDisplayName}：@小鱼，收到。${planText}${deliverableText}`;
}

function buildValidationSwarmContent(log: ValidationLog, validatorDisplayName: string): string {
  if (log.verdict === 'passed') {
    return `${validatorDisplayName}：@小鱼，这份交付验收通过：${localizeSwarmRuntimeText(log.summary)}`;
  }
  if (log.verdict === 'blocked') {
    return `${validatorDisplayName}：@小鱼，这份交付需要外部处理：${localizeSwarmRuntimeText(log.summary)}`;
  }
  return `${validatorDisplayName}：@小鱼，这份交付需要返工：${localizeSwarmRuntimeText(log.summary)}`;
}

function normalizeMetadataList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      String(item || '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .slice(0, 4);
}

function joinChineseItems(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join('、')}，最后${items[items.length - 1]}`;
}

export function localizeSwarmRoleName(roleId: string | undefined, roleName: string): string {
  const labelsById: Record<string, string> = {
    'product-strategist': '产品策略师',
    'engineering-architect': '工程架构师',
    'implementation-engineer': '实施工程师',
    'product-designer': '产品设计师',
    'developer-experience': '开发体验负责人',
    'security-officer': '安全官',
    'qa-release-steward': '验收负责人',
    'role-incubator': '角色孵化器',
  };
  const labelsByName: Record<string, string> = {
    'Product Strategist': '产品策略师',
    'Engineering Architect': '工程架构师',
    'Implementation Engineer': '实施工程师',
    'Product Designer': '产品设计师',
    'Developer Experience Lead': '开发体验负责人',
    'Developer Experience': '开发体验负责人',
    'Security Officer': '安全官',
    'QA / Release Steward': '验收负责人',
    'Role Incubator': '角色孵化器',
  };
  return (roleId && labelsById[roleId]) || labelsByName[roleName] || roleName;
}

function localizeSwarmRoleItem(item: string): string {
  const normalized = item.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  const labels: Record<string, string> = {
    'Identify the real user problem behind the request': '判断这个需求背后的真实用户问题',
    'Challenge whether the requested scope is too broad, too narrow, duplicated, or misframed':
      '检查当前范围是不是过大、过小、重复或方向偏了',
    'Separate must-have work from deferred work': '区分这次必须做的部分和可以后置的部分',
    'Identify product decisions that require explicit user judgment':
      '标出需要你亲自拍板的产品决策',
    'Problem framing': '问题界定',
    'Scope recommendation': '范围建议',
    'Out-of-scope list': '暂不处理清单',
    'User challenge list': '需要向你确认的问题',
    'Decision candidates with approval requirement': '需要你批准的决策候选',
    'Map affected modules and integration points': '梳理受影响模块和集成点',
    'Choose the smallest maintainable implementation approach': '选择最小且可维护的实现方案',
    'Identify failure modes, concurrency risks, and test gaps': '识别失败模式、并发风险和测试缺口',
    'Define verification commands and expected outcomes': '给出验证命令和预期结果',
    'Affected modules': '受影响模块',
    'Architecture notes or diagram summary': '架构说明',
    'Implementation plan': '实现计划',
    'Test matrix': '测试矩阵',
    'Failure modes and mitigations': '风险和缓解措施',
    'Translate accepted role plans into concrete file and command changes':
      '把已验收的方案落成具体文件和命令改动',
    'Create, edit, and wire project files within the current workspace':
      '创建、修改并串起当前工作区里的项目文件',
    'Run focused verification commands when available': '在可用时运行聚焦的验证命令',
    'Report changed files, commands run, blockers, and remaining checks to Xiaoyu':
      '向小鱼汇报改了哪些文件、跑了哪些命令、还有什么阻塞',
    'Execution summary': '执行摘要',
    'Changed files': '变更文件',
    'Commands run': '已运行命令',
    'Verification result': '验证结果',
    'Blockers and next actions': '阻塞和下一步',
    'Validation conclusion': '验收结论',
    'Accepted findings': '已接受发现',
    'Required rework': '必要返工项',
    'Validation commands': '验收命令',
    'Residual risks': '剩余风险',
  };
  return labels[normalized] || normalized;
}

function localizeSwarmRuntimeText(text: string): string {
  return String(text || '')
    .replace(/Product Strategist/g, '产品策略师')
    .replace(/Engineering Architect/g, '工程架构师')
    .replace(/Implementation Engineer/g, '实施工程师')
    .replace(/QA \/ Release Steward/g, 'QA / 发布负责人')
    .replace(/Responsibilities\s*-?\s*/g, '职责：')
    .replace(
      /Identify the real user problem behind the request\.?/g,
      '判断这个需求背后的真实用户问题'
    )
    .replace(
      /Challenge whether the requested scope is too broad, too narrow, duplicated, or misframed\.?/g,
      '检查当前范围是不是过大、过小、重复或方向偏了'
    )
    .replace(/Separate must-have work from deferred work\.?/g, '区分必须做和可以后置的工作')
    .replace(
      /Identify product decisions that require explicit user judgment\.?/g,
      '标出需要用户明确判断的产品决策'
    )
    .replace(/\s+-\s+/g, '；')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeRuntimeText(value: string, field: string, maxLength: number): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) throw new Error(`Role runtime ${field} is required.`);
  const redacted = redactText(text);
  if (redacted.redacted) {
    throw new Error(
      `Role runtime ${field} contains sensitive content: ${redacted.findings.join(', ')}`
    );
  }
  const scan = scanUntrustedText(text);
  if (scan.verdict === 'block') {
    throw new Error(
      `Role runtime ${field} contains prompt-injection-like content: ${scan.reasons.join(', ')}`
    );
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...[truncated]` : text;
}

function roleEventsPath(cwd?: string): string {
  return path.join(ensureRolesWorkspaceDir(cwd), 'role-events.jsonl');
}

function roleRunsPath(cwd?: string): string {
  return path.join(ensureRolesWorkspaceDir(cwd), 'role-runs.jsonl');
}

function validationLogsPath(cwd?: string): string {
  return path.join(ensureRolesWorkspaceDir(cwd), 'validation-logs.jsonl');
}

function swarmEventsPath(cwd?: string): string {
  return path.join(ensureRolesWorkspaceDir(cwd), 'swarm-events.jsonl');
}
