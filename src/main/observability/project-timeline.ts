import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';

export type ProjectTimelineCategory =
  | 'browse'
  | 'context'
  | 'mcp'
  | 'role'
  | 'security'
  | 'skillify'
  | 'health'
  | 'change_scope'
  | 'session'
  | 'learned'
  | 'question'
  | 'decision'
  | 'workflow';

export interface ProjectTimelineEvent {
  id: string;
  ts: string;
  workspaceKey: string;
  cwd?: string;
  category: ProjectTimelineCategory;
  event: string;
  source: string;
  status?: 'started' | 'ok' | 'error' | 'blocked' | 'info';
  durationMs?: number;
  summary?: string;
  command?: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectLearning {
  id: string;
  ts: string;
  workspaceKey: string;
  cwd?: string;
  type:
    | 'pattern'
    | 'pitfall'
    | 'preference'
    | 'architecture'
    | 'tool'
    | 'operational'
    | 'investigation';
  key: string;
  insight: string;
  confidence: number;
  source: 'observed' | 'user-stated' | 'inferred' | 'cross-model';
  trusted: boolean;
  files?: string[];
  tags?: string[];
  supersedesLearningId?: string;
}

export interface TimelineListOptions {
  cwd?: string;
  workspaceKey?: string;
  limit?: number;
  category?: ProjectTimelineCategory;
}

const SENSITIVE_KEY = /\b(password|token|secret|key|auth|bearer|api[_-]?key|cookie)\b/i;
const MAX_STRING_LENGTH = 500;

export function getTimelineRoot(): string {
  return (
    process.env.FISHSWARM_TIMELINE_ROOT || path.join(os.homedir(), '.fishswarm', 'project-timeline')
  );
}

export function getWorkspaceKey(cwd?: string): string {
  const normalized = cwd ? path.resolve(cwd) : process.cwd();
  const slug = path
    .basename(normalized)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 48);
  const hash = createHash('sha256').update(normalized.toLowerCase()).digest('hex').slice(0, 10);
  return `${slug || 'workspace'}-${hash}`;
}

export function getWorkspaceTimelineDir(cwd?: string, workspaceKey = getWorkspaceKey(cwd)): string {
  return path.join(getTimelineRoot(), 'workspaces', workspaceKey);
}

export function appendProjectTimelineEvent(
  input: Omit<ProjectTimelineEvent, 'id' | 'ts' | 'workspaceKey'> & {
    id?: string;
    ts?: string;
    workspaceKey?: string;
  }
): ProjectTimelineEvent {
  const workspaceKey = input.workspaceKey || getWorkspaceKey(input.cwd);
  const event: ProjectTimelineEvent = {
    id: input.id || randomUUID(),
    ts: input.ts || new Date().toISOString(),
    workspaceKey,
    cwd: input.cwd,
    category: input.category,
    event: input.event,
    source: input.source,
    status: input.status,
    durationMs: input.durationMs,
    summary: input.summary ? trimString(input.summary, 1000) : undefined,
    command: input.command ? trimString(input.command, 200) : undefined,
    toolName: input.toolName,
    metadata: sanitizeRecord(input.metadata),
  };

  appendJsonLine(
    path.join(getWorkspaceTimelineDir(input.cwd, workspaceKey), 'timeline.jsonl'),
    event
  );
  return event;
}

export function appendProjectLearning(
  input: Omit<ProjectLearning, 'id' | 'ts' | 'workspaceKey' | 'trusted'> & {
    id?: string;
    ts?: string;
    workspaceKey?: string;
  }
): ProjectLearning {
  const workspaceKey = input.workspaceKey || getWorkspaceKey(input.cwd);
  const learning: ProjectLearning = {
    id: input.id || randomUUID(),
    ts: input.ts || new Date().toISOString(),
    workspaceKey,
    cwd: input.cwd,
    type: input.type,
    key: normalizeLearningKey(input.key),
    insight: trimString(input.insight, 2000),
    confidence: clampConfidence(input.confidence),
    source: input.source,
    trusted: input.source === 'user-stated',
    files: normalizeStringList(input.files, 50, 240),
    tags: normalizeStringList(input.tags, 20, 60),
    supersedesLearningId: input.supersedesLearningId
      ? trimString(input.supersedesLearningId, 120)
      : undefined,
  };

  appendJsonLine(
    path.join(getWorkspaceTimelineDir(input.cwd, workspaceKey), 'learnings.jsonl'),
    learning
  );
  appendProjectTimelineEvent({
    cwd: input.cwd,
    workspaceKey,
    category: 'learned',
    event: 'learning.recorded',
    source: 'project-learning',
    status: 'ok',
    summary: learning.insight,
    metadata: { type: learning.type, key: learning.key, confidence: learning.confidence },
  });
  return learning;
}

export function listProjectTimelineEvents(
  options: TimelineListOptions = {}
): ProjectTimelineEvent[] {
  const workspaceKey = options.workspaceKey || getWorkspaceKey(options.cwd);
  const events = readJsonLines<ProjectTimelineEvent>(
    path.join(getWorkspaceTimelineDir(options.cwd, workspaceKey), 'timeline.jsonl')
  );
  const filtered = options.category
    ? events.filter((event) => event.category === options.category)
    : events;
  return filtered.slice(-Math.max(1, options.limit || 200)).reverse();
}

export function listProjectLearnings(options: TimelineListOptions = {}): ProjectLearning[] {
  const workspaceKey = options.workspaceKey || getWorkspaceKey(options.cwd);
  return readJsonLines<ProjectLearning>(
    path.join(getWorkspaceTimelineDir(options.cwd, workspaceKey), 'learnings.jsonl')
  )
    .slice(-Math.max(1, options.limit || 200))
    .reverse();
}

function appendJsonLine(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf-8');
}

function readJsonLines<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((item): item is T => item !== null);
}

function normalizeLearningKey(value: string): string {
  const key = value
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!key) throw new Error('Learning key must contain letters, numbers, underscores, or dashes');
  return key;
}

function clampConfidence(value: number): number {
  const rounded = Math.round(value);
  return Math.max(1, Math.min(10, rounded));
}

function normalizeStringList(
  value: string[] | undefined,
  maxItems: number,
  maxLength: number
): string[] | undefined {
  if (!value) return undefined;
  const items = value
    .map((item) => trimString(item.replace(/\0/g, '').trim(), maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
  return items.length > 0 ? items : undefined;
}

function sanitizeRecord(
  value: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    output[key] = sanitizeValue(key, raw);
  }
  return output;
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return '<REDACTED>';
  if (typeof value === 'string') {
    return SENSITIVE_KEY.test(value) ? '<REDACTED>' : trimString(value, MAX_STRING_LENGTH);
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(key, item));
  if (typeof value === 'object' && value) {
    return sanitizeRecord(value as Record<string, unknown>);
  }
  return undefined;
}

function trimString(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...[truncated]` : value;
}
