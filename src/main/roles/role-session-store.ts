import * as path from 'path';
import { randomUUID } from 'crypto';
import { appendProjectTimelineEvent } from '../observability/project-timeline';
import { redactText } from '../security/redact';
import { scanUntrustedText } from '../security/content-security';
import {
  appendJsonLine,
  ensureRolesWorkspaceDir,
  readJsonObject,
  readJsonLines,
  writeJsonObject,
} from './role-paths';

export type RoleSessionStatus =
  | 'queued'
  | 'online'
  | 'running'
  | 'waiting_validation'
  | 'needs_revision'
  | 'reworking'
  | 'blocked'
  | 'completed'
  | 'failed';

export type RoleMailboxMessageType =
  | 'assignment'
  | 'role_plan'
  | 'role_delivery'
  | 'validation_request'
  | 'validation_result'
  | 'rework_request'
  | 'handoff';

export interface RoleSessionRecord {
  roleSessionId: string;
  parentSessionId: string;
  taskId: string;
  roleId: string;
  roleName: string;
  status: RoleSessionStatus;
  runIds: string[];
  currentRunId?: string;
  lastRunId?: string;
  lastValidationId?: string;
  reworkOfRunId?: string;
  messageCount: number;
  lastMessageId?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface RoleMailboxMessage {
  id: string;
  parentSessionId: string;
  roleSessionId: string;
  taskId: string;
  runId?: string;
  roleId: string;
  roleName: string;
  type: RoleMailboxMessageType;
  from: 'user' | 'xiaoyu' | string;
  to: 'xiaoyu' | string;
  content: string;
  createdAt: string;
  data?: Record<string, unknown>;
}

interface RoleSessionsFile {
  sessions: RoleSessionRecord[];
}

export interface GetOrCreateRoleSessionInput {
  parentSessionId: string;
  taskId: string;
  roleId: string;
  roleName: string;
  status?: RoleSessionStatus;
  metadata?: Record<string, unknown>;
}

export function getOrCreateRoleSession(
  cwd: string | undefined,
  input: GetOrCreateRoleSessionInput
): RoleSessionRecord {
  const file = readSessionsFile(cwd);
  const now = new Date().toISOString();
  const existingIndex = file.sessions.findIndex(
    (session) =>
      session.parentSessionId === input.parentSessionId &&
      session.taskId === input.taskId &&
      session.roleId === input.roleId
  );
  if (existingIndex >= 0) {
    const existing = file.sessions[existingIndex];
    const updated: RoleSessionRecord = {
      ...existing,
      roleName: sanitizeSessionText(input.roleName, 'roleName', 160),
      status: input.status || existing.status,
      updatedAt: now,
      metadata: { ...(existing.metadata || {}), ...(input.metadata || {}) },
    };
    file.sessions[existingIndex] = updated;
    writeSessionsFile(cwd, file);
    return updated;
  }

  const session: RoleSessionRecord = {
    roleSessionId: `role-session-${randomUUID()}`,
    parentSessionId: sanitizeSessionText(input.parentSessionId, 'parentSessionId', 160),
    taskId: sanitizeSessionText(input.taskId, 'taskId', 160),
    roleId: sanitizeSessionText(input.roleId, 'roleId', 160),
    roleName: sanitizeSessionText(input.roleName, 'roleName', 160),
    status: input.status || 'queued',
    runIds: [],
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata,
  };
  file.sessions.push(session);
  writeSessionsFile(cwd, file);
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.session_created',
    source: 'role-session-runtime',
    status: 'started',
    summary: `${session.roleName} role session created.`,
    metadata: {
      roleSessionId: session.roleSessionId,
      parentSessionId: session.parentSessionId,
      taskId: session.taskId,
      roleId: session.roleId,
    },
  });
  return session;
}

export function updateRoleSession(
  cwd: string | undefined,
  roleSessionId: string,
  update: Partial<
    Pick<
      RoleSessionRecord,
      'status' | 'currentRunId' | 'lastRunId' | 'lastValidationId' | 'reworkOfRunId' | 'metadata'
    >
  > & { runId?: string; lastMessageId?: string }
): RoleSessionRecord | null {
  const file = readSessionsFile(cwd);
  const index = file.sessions.findIndex((session) => session.roleSessionId === roleSessionId);
  if (index < 0) return null;
  const current = file.sessions[index];
  const runIds = update.runId ? appendUnique(current.runIds, update.runId) : current.runIds;
  const updated: RoleSessionRecord = {
    ...current,
    ...withoutUndefined({
      status: update.status,
      currentRunId: update.currentRunId,
      lastRunId: update.lastRunId,
      lastValidationId: update.lastValidationId,
      reworkOfRunId: update.reworkOfRunId,
      lastMessageId: update.lastMessageId,
    }),
    runIds,
    metadata: update.metadata
      ? { ...(current.metadata || {}), ...update.metadata }
      : current.metadata,
    updatedAt: new Date().toISOString(),
  };
  file.sessions[index] = updated;
  writeSessionsFile(cwd, file);
  return updated;
}

export function appendRoleMailboxMessage(
  cwd: string | undefined,
  input: Omit<RoleMailboxMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): RoleMailboxMessage {
  const message: RoleMailboxMessage = {
    ...input,
    id: input.id || `role-message-${randomUUID()}`,
    content: sanitizeSessionText(input.content, 'mailbox content', 1600),
    createdAt: input.createdAt || new Date().toISOString(),
  };
  appendJsonLine(mailboxPath(cwd), message);
  incrementRoleSessionMessageCount(cwd, message.roleSessionId, message.id);
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.mailbox_message',
    source: 'role-session-runtime',
    status: roleMailboxTypeToTimelineStatus(message.type),
    summary: message.content,
    metadata: {
      roleSessionId: message.roleSessionId,
      parentSessionId: message.parentSessionId,
      taskId: message.taskId,
      runId: message.runId,
      roleId: message.roleId,
      messageType: message.type,
      from: message.from,
      to: message.to,
    },
  });
  return message;
}

export function findRoleSessionByRunId(
  cwd: string | undefined,
  parentSessionId: string | undefined,
  runId: string
): RoleSessionRecord | null {
  const sessions = readSessionsFile(cwd).sessions;
  return (
    sessions.find(
      (session) =>
        session.runIds.includes(runId) &&
        (!parentSessionId || session.parentSessionId === parentSessionId)
    ) || null
  );
}

export function getRoleSessions(
  cwd?: string,
  parentSessionId?: string,
  limit = 100
): RoleSessionRecord[] {
  const sessions = readSessionsFile(cwd).sessions.filter(
    (session) => !parentSessionId || session.parentSessionId === parentSessionId
  );
  return sessions
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.max(1, limit));
}

export function getRoleMailboxMessages(
  cwd?: string,
  parentSessionId?: string,
  limit = 200
): RoleMailboxMessage[] {
  return readJsonLines<RoleMailboxMessage>(mailboxPath(cwd))
    .filter((message) => !parentSessionId || message.parentSessionId === parentSessionId)
    .slice(-Math.max(1, limit));
}

function incrementRoleSessionMessageCount(
  cwd: string | undefined,
  roleSessionId: string,
  lastMessageId: string
): void {
  const file = readSessionsFile(cwd);
  const index = file.sessions.findIndex((session) => session.roleSessionId === roleSessionId);
  if (index < 0) return;
  const current = file.sessions[index];
  file.sessions[index] = {
    ...current,
    messageCount: current.messageCount + 1,
    lastMessageId,
    updatedAt: new Date().toISOString(),
  };
  writeSessionsFile(cwd, file);
}

function readSessionsFile(cwd?: string): RoleSessionsFile {
  const parsed = readJsonObject<Record<string, unknown>>(sessionsPath(cwd), { sessions: [] });
  const sessions = Array.isArray(parsed.sessions)
    ? parsed.sessions.filter(isRoleSessionRecord)
    : [];
  return { sessions };
}

function writeSessionsFile(cwd: string | undefined, file: RoleSessionsFile): void {
  writeJsonObject(sessionsPath(cwd), file);
}

function sessionsPath(cwd?: string): string {
  return path.join(ensureRolesWorkspaceDir(cwd), 'role-sessions.json');
}

function mailboxPath(cwd?: string): string {
  return path.join(ensureRolesWorkspaceDir(cwd), 'role-mailbox.jsonl');
}

function isRoleSessionRecord(value: unknown): value is RoleSessionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as RoleSessionRecord;
  return (
    typeof record.roleSessionId === 'string' &&
    typeof record.parentSessionId === 'string' &&
    typeof record.taskId === 'string' &&
    typeof record.roleId === 'string' &&
    typeof record.roleName === 'string' &&
    Array.isArray(record.runIds)
  );
}

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

function roleMailboxTypeToTimelineStatus(
  type: RoleMailboxMessageType
): 'started' | 'ok' | 'error' | 'blocked' | 'info' {
  if (type === 'assignment' || type === 'rework_request' || type === 'validation_request') {
    return 'started';
  }
  if (type === 'validation_result') return 'info';
  return 'ok';
}

function sanitizeSessionText(value: string, field: string, maxLength: number): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) throw new Error(`Role session ${field} is required.`);
  const redacted = redactText(text);
  if (redacted.redacted) {
    throw new Error(
      `Role session ${field} contains sensitive content: ${redacted.findings.join(', ')}`
    );
  }
  const scan = scanUntrustedText(text);
  if (scan.verdict === 'block') {
    throw new Error(
      `Role session ${field} contains prompt-injection-like content: ${scan.reasons.join(', ')}`
    );
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...[truncated]` : text;
}
