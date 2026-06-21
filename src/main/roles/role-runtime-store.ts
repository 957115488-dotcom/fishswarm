import * as path from 'path';
import { randomUUID } from 'crypto';
import { appendProjectTimelineEvent, getWorkspaceKey } from '../observability/project-timeline';
import { scanUntrustedText } from '../security/content-security';
import { redactText } from '../security/redact';
import {
  appendJsonLine,
  ensureRolesWorkspaceDir,
  readJsonLines,
} from './role-paths';
import type {
  RoleLifecycleEvent,
  RoleRunResult,
  RoleRuntimeSnapshot,
  ValidationLog,
} from './role-types';

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
  };
  appendJsonLine(roleRunsPath(cwd), sanitized);
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.run_completed',
    source: 'role-runtime',
    status: sanitized.status === 'failed' ? 'error' : sanitized.status === 'blocked' ? 'blocked' : 'ok',
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
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.validation_recorded',
    source: 'role-runtime',
    status:
      sanitized.verdict === 'passed'
        ? 'ok'
        : sanitized.verdict === 'blocked'
          ? 'blocked'
          : 'info',
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
  const activeEvents = filterSession(readJsonLines<RoleLifecycleEvent>(roleEventsPath(cwd)), sessionId)
    .slice(-Math.max(1, limit))
    .reverse();
  const recentRuns = filterSession(readJsonLines<RoleRunResult>(roleRunsPath(cwd)), sessionId)
    .slice(-Math.max(1, limit))
    .reverse();
  const validationLogs = filterSession(readJsonLines<ValidationLog>(validationLogsPath(cwd)), sessionId)
    .slice(-Math.max(1, limit))
    .reverse();

  return {
    workspaceKey: getWorkspaceKey(cwd),
    cwd,
    sessionId,
    activeEvents,
    recentRuns,
    validationLogs,
  };
}

function filterSession<T extends { sessionId?: string }>(items: T[], sessionId?: string): T[] {
  if (!sessionId) return items;
  return items.filter((item) => item.sessionId === sessionId);
}

function lifecycleStatusToTimelineStatus(
  status: RoleLifecycleEvent['status']
): 'started' | 'ok' | 'error' | 'blocked' | 'info' {
  if (status === 'failed') return 'error';
  if (status === 'needs_revision') return 'blocked';
  if (status === 'queued' || status === 'mounting_handbook' || status === 'online' || status === 'working') {
    return 'started';
  }
  return 'ok';
}

function sanitizeRuntimeText(value: string, field: string, maxLength: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`Role runtime ${field} is required.`);
  const redacted = redactText(text);
  if (redacted.redacted) {
    throw new Error(`Role runtime ${field} contains sensitive content: ${redacted.findings.join(', ')}`);
  }
  const scan = scanUntrustedText(text);
  if (scan.verdict === 'block') {
    throw new Error(`Role runtime ${field} contains prompt-injection-like content: ${scan.reasons.join(', ')}`);
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
