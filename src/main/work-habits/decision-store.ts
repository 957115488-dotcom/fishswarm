import * as path from 'path';
import { randomUUID } from 'crypto';
import { appendProjectTimelineEvent, getWorkspaceKey } from '../observability/project-timeline';
import { scanUntrustedText } from '../security/content-security';
import { redactText } from '../security/redact';
import {
  appendJsonLine,
  ensureWorkHabitsWorkspaceDir,
  readJsonLines,
  writeJsonObject,
} from './work-habits-paths';

export type DecisionEventKind = 'decide' | 'supersede' | 'redact';
export type DecisionScope = 'repo' | 'branch' | 'issue';
export type DecisionSource = 'user' | 'agent' | 'skill';

export interface DecisionEvent {
  id: string;
  kind: DecisionEventKind;
  decision?: string;
  rationale?: string;
  alternatives?: string;
  supersedes?: string;
  scope: DecisionScope;
  branch?: string;
  issue?: string;
  date: string;
  sessionId?: string;
  source: DecisionSource;
  confidence?: number;
  workspaceKey: string;
  cwd?: string;
}

export interface ActiveDecision extends DecisionEvent {
  kind: 'decide';
}

export interface AddDecisionInput {
  cwd?: string;
  decision: string;
  rationale?: string;
  alternatives?: string;
  scope?: DecisionScope;
  branch?: string;
  issue?: string;
  sessionId?: string;
  source?: DecisionSource;
  confidence?: number;
}

export interface DecisionStoreSnapshot {
  workspaceKey: string;
  cwd?: string;
  active: ActiveDecision[];
  events: DecisionEvent[];
  stats: {
    active: number;
    events: number;
    superseded: number;
    redacted: number;
  };
}

const DECISION_SCOPES = new Set<DecisionScope>(['repo', 'branch', 'issue']);
const DECISION_SOURCES = new Set<DecisionSource>(['user', 'agent', 'skill']);
const ID_PATTERN = /^[a-z0-9-]{8,80}$/i;

function replaceModelControlMarkers(text: string): string {
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code <= 0x1f || code === 0x7f || code === 0x85 || code === 0x2028 || code === 0x2029
        ? ' '
        : char;
    })
    .join('');
}

export function getDecisionStoreSnapshot(cwd?: string, limit = 100): DecisionStoreSnapshot {
  const events = listDecisionEvents(cwd, limit);
  const active = computeActiveDecisions(readAllDecisionEvents(cwd));
  return {
    workspaceKey: getWorkspaceKey(cwd),
    cwd,
    active,
    events,
    stats: {
      active: active.length,
      events: readAllDecisionEvents(cwd).length,
      superseded: readAllDecisionEvents(cwd).filter((event) => event.kind === 'supersede').length,
      redacted: readAllDecisionEvents(cwd).filter((event) => event.kind === 'redact').length,
    },
  };
}

export function addDecision(input: AddDecisionInput): ActiveDecision {
  const validated = validateDecisionInput(input);
  const event: ActiveDecision = {
    id: randomUUID(),
    kind: 'decide',
    decision: validated.decision,
    rationale: validated.rationale,
    alternatives: validated.alternatives,
    scope: validated.scope,
    branch: validated.branch,
    issue: validated.issue,
    date: new Date().toISOString(),
    sessionId: validated.sessionId,
    source: validated.source,
    confidence: validated.confidence,
    workspaceKey: getWorkspaceKey(input.cwd),
    cwd: input.cwd,
  };
  appendDecisionEvent(event);
  rebuildDecisionSnapshot(input.cwd);
  appendProjectTimelineEvent({
    cwd: input.cwd,
    category: 'decision',
    event: 'decision.recorded',
    source: 'decision-store',
    status: 'ok',
    summary: event.decision,
    metadata: {
      decisionId: event.id,
      scope: event.scope,
      source: event.source,
      confidence: event.confidence,
    },
  });
  return event;
}

export function supersedeDecision(cwd: string | undefined, decisionId: string, source: DecisionSource = 'user'): DecisionEvent {
  const targetId = normalizeDecisionId(decisionId);
  const active = computeActiveDecisions(readAllDecisionEvents(cwd));
  if (!active.some((decision) => decision.id === targetId)) {
    throw new Error(`Active decision not found: ${targetId}`);
  }
  const event: DecisionEvent = {
    id: randomUUID(),
    kind: 'supersede',
    supersedes: targetId,
    scope: 'repo',
    date: new Date().toISOString(),
    source,
    workspaceKey: getWorkspaceKey(cwd),
    cwd,
  };
  appendDecisionEvent(event);
  rebuildDecisionSnapshot(cwd);
  appendProjectTimelineEvent({
    cwd,
    category: 'decision',
    event: 'decision.superseded',
    source: 'decision-store',
    status: 'ok',
    summary: `Superseded decision ${targetId}`,
    metadata: { decisionId: targetId },
  });
  return event;
}

export function redactDecision(cwd: string | undefined, decisionId: string, source: DecisionSource = 'user'): DecisionEvent {
  const targetId = normalizeDecisionId(decisionId);
  const events = readAllDecisionEvents(cwd);
  if (!events.some((event) => event.kind === 'decide' && event.id === targetId)) {
    throw new Error(`Decision not found: ${targetId}`);
  }
  const event: DecisionEvent = {
    id: randomUUID(),
    kind: 'redact',
    supersedes: targetId,
    scope: 'repo',
    date: new Date().toISOString(),
    source,
    workspaceKey: getWorkspaceKey(cwd),
    cwd,
  };
  appendDecisionEvent(event);
  rebuildDecisionSnapshot(cwd);
  appendProjectTimelineEvent({
    cwd,
    category: 'decision',
    event: 'decision.redacted',
    source: 'decision-store',
    status: 'ok',
    summary: `Redacted decision ${targetId}`,
    metadata: { decisionId: targetId },
  });
  return event;
}

export function listDecisionEvents(cwd?: string, limit = 100): DecisionEvent[] {
  return readAllDecisionEvents(cwd).slice(-Math.max(1, limit)).reverse();
}

export function listActiveDecisions(cwd?: string): ActiveDecision[] {
  return computeActiveDecisions(readAllDecisionEvents(cwd));
}

export function computeActiveDecisions(events: DecisionEvent[]): ActiveDecision[] {
  const retired = new Set<string>();
  for (const event of events) {
    if ((event.kind === 'supersede' || event.kind === 'redact') && event.supersedes) {
      retired.add(event.supersedes);
    }
  }
  return events
    .filter((event): event is ActiveDecision => event.kind === 'decide' && !retired.has(event.id))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function filterDecisionsByScope(
  decisions: ActiveDecision[],
  context: { branch?: string; issue?: string } = {}
): ActiveDecision[] {
  return decisions.filter((decision) => {
    if (decision.scope === 'repo') return true;
    if (decision.scope === 'branch') return Boolean(context.branch && context.branch === decision.branch);
    if (decision.scope === 'issue') return Boolean(context.issue && context.issue === decision.issue);
    return false;
  });
}

export function datamarkDecisionText(text: string): string {
  const zwsp = '\u200b';
  return replaceModelControlMarkers(text)
    .replace(/`{3,}/g, "'''")
    .replace(/-{3,}/g, '-')
    .replace(/<\|/g, `<${zwsp}|`)
    .replace(/\|>/g, `|${zwsp}>`)
    .replace(/<(\/?)(system|user|assistant|tool)>/gi, `<${zwsp}$1$2>`)
    .replace(/\b(human|assistant|system|user)(\s*):/gi, `$1${zwsp}$2:`);
}

function validateDecisionInput(input: AddDecisionInput): Required<Omit<AddDecisionInput, 'cwd' | 'sessionId' | 'rationale' | 'alternatives' | 'branch' | 'issue'>> & {
  sessionId?: string;
  rationale?: string;
  alternatives?: string;
  branch?: string;
  issue?: string;
} {
  const decision = sanitizeDecisionText(input.decision, 'decision', 2000);
  const rationale = input.rationale
    ? sanitizeDecisionText(input.rationale, 'rationale', 2000)
    : undefined;
  const alternatives = input.alternatives
    ? sanitizeDecisionText(input.alternatives, 'alternatives', 2000)
    : undefined;
  const scope = input.scope || 'repo';
  if (!DECISION_SCOPES.has(scope)) {
    throw new Error('Invalid decision scope.');
  }
  const source = input.source || 'user';
  if (!DECISION_SOURCES.has(source)) {
    throw new Error('Invalid decision source.');
  }
  const confidence = input.confidence === undefined ? 7 : Math.round(input.confidence);
  if (confidence < 1 || confidence > 10) {
    throw new Error('Decision confidence must be between 1 and 10.');
  }
  const branch = input.branch ? sanitizeDecisionText(input.branch, 'branch', 120) : undefined;
  const issue = input.issue ? sanitizeDecisionText(input.issue, 'issue', 120) : undefined;
  if (scope === 'branch' && !branch) throw new Error('Branch-scoped decisions require a branch.');
  if (scope === 'issue' && !issue) throw new Error('Issue-scoped decisions require an issue.');

  return {
    decision,
    rationale,
    alternatives,
    scope,
    branch,
    issue,
    sessionId: input.sessionId,
    source,
    confidence,
  };
}

function sanitizeDecisionText(value: string, field: string, maxLength: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`Decision ${field} is required.`);
  if (text.length > maxLength) {
    throw new Error(`Decision ${field} is too long.`);
  }
  const redacted = redactText(text);
  if (redacted.redacted) {
    throw new Error(`Decision ${field} contains sensitive content: ${redacted.findings.join(', ')}`);
  }
  const scan = scanUntrustedText(text);
  if (scan.verdict === 'block') {
    throw new Error(`Decision ${field} contains prompt-injection-like content: ${scan.reasons.join(', ')}`);
  }
  return text;
}

function appendDecisionEvent(event: DecisionEvent): void {
  appendJsonLine(eventsPath(event.cwd), event);
}

function rebuildDecisionSnapshot(cwd?: string): ActiveDecision[] {
  const active = computeActiveDecisions(readAllDecisionEvents(cwd));
  writeJsonObject(snapshotPath(cwd), active);
  return active;
}

function readAllDecisionEvents(cwd?: string): DecisionEvent[] {
  return readJsonLines<DecisionEvent>(eventsPath(cwd)).filter(isDecisionEvent);
}

function isDecisionEvent(value: DecisionEvent): boolean {
  if (!value || typeof value !== 'object') return false;
  if (value.kind !== 'decide' && value.kind !== 'supersede' && value.kind !== 'redact') return false;
  if (!ID_PATTERN.test(value.id)) return false;
  if (!DECISION_SCOPES.has(value.scope)) return false;
  if (!DECISION_SOURCES.has(value.source)) return false;
  return true;
}

function normalizeDecisionId(value: string): string {
  const normalized = value.trim();
  if (!ID_PATTERN.test(normalized)) throw new Error('Invalid decision id.');
  return normalized;
}

function eventsPath(cwd?: string): string {
  return path.join(ensureWorkHabitsWorkspaceDir(cwd), 'decision-events.jsonl');
}

function snapshotPath(cwd?: string): string {
  return path.join(ensureWorkHabitsWorkspaceDir(cwd), 'decisions.active.json');
}
