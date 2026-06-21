import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  appendProjectTimelineEvent,
  getWorkspaceKey,
} from '../observability/project-timeline';
import {
  appendJsonLine,
  ensureWorkHabitsWorkspaceDir,
  readJsonLines,
  readJsonObject,
  writeJsonObject,
} from './work-habits-paths';

export type QuestionCategory = 'approval' | 'clarification' | 'routing' | 'cherry-pick' | 'feedback-loop';
export type QuestionDoorType = 'one-way' | 'two-way';
export type QuestionPreference = 'always-ask' | 'never-ask' | 'ask-only-for-one-way';
export type QuestionChoice = 'allow' | 'deny' | 'defer' | 'skip' | 'accept' | 'reject';
export type QuestionPreferenceSource =
  | 'settings'
  | 'permission-dialog'
  | 'inline-user'
  | 'plan-tune';
export type QuestionRejectedSource =
  | 'agent-inferred'
  | 'tool-output'
  | 'file-content'
  | 'remote-message'
  | 'unknown';

export interface QuestionDefinition {
  id: string;
  label: string;
  category: QuestionCategory;
  doorType: QuestionDoorType;
  description: string;
  defaultChoice?: QuestionChoice;
}

export interface QuestionPreferenceRecord {
  questionId: string;
  preference: QuestionPreference;
  source: QuestionPreferenceSource;
  updatedAt: string;
  note?: string;
}

export interface QuestionEvent {
  id: string;
  ts: string;
  workspaceKey: string;
  cwd?: string;
  questionId: string;
  event: 'asked' | 'answered' | 'auto_decided' | 'preference_set' | 'preference_rejected' | 'preference_cleared';
  category: QuestionCategory;
  doorType: QuestionDoorType;
  summary: string;
  choice?: QuestionChoice;
  result?: string;
  preference?: QuestionPreference;
  source: string;
  oneWay: boolean;
  reason?: string;
}

export interface QuestionPolicyEvaluationInput {
  cwd?: string;
  questionId: string;
  summary: string;
  category?: QuestionCategory;
  skill?: string;
  defaultChoice?: QuestionChoice;
}

export interface QuestionPolicyEvaluation {
  action: 'ask' | 'auto_decide';
  questionId: string;
  choice?: QuestionChoice;
  preference?: QuestionPreferenceRecord;
  oneWay: boolean;
  reason: string;
}

export interface QuestionPolicySnapshot {
  workspaceKey: string;
  cwd?: string;
  preferences: QuestionPreferenceRecord[];
  recentEvents: QuestionEvent[];
  registry: QuestionDefinition[];
  stats: {
    preferences: number;
    events: number;
    oneWayEvents: number;
    autoDecisions: number;
  };
}

export interface PermissionQuestionInput {
  cwd?: string;
  sessionId: string;
  toolName: string;
  input: Record<string, unknown>;
}

const QUESTION_REGISTRY: QuestionDefinition[] = [
  {
    id: 'permission-read',
    label: 'Read-only tool permission',
    category: 'approval',
    doorType: 'two-way',
    description: 'Allow a low-risk read/list/search tool call.',
    defaultChoice: 'allow',
  },
  {
    id: 'permission-write',
    label: 'Write tool permission',
    category: 'approval',
    doorType: 'one-way',
    description: 'Allow a tool call that can write or edit files.',
  },
  {
    id: 'permission-bash',
    label: 'Command execution permission',
    category: 'approval',
    doorType: 'one-way',
    description: 'Allow shell or command execution.',
  },
  {
    id: 'permission-mcp-read',
    label: 'MCP read permission',
    category: 'approval',
    doorType: 'two-way',
    description: 'Allow a read-only MCP tool call.',
    defaultChoice: 'allow',
  },
  {
    id: 'permission-mcp-write',
    label: 'MCP interaction permission',
    category: 'approval',
    doorType: 'one-way',
    description: 'Allow an MCP tool call that can interact with or mutate external state.',
  },
  {
    id: 'permission-unknown',
    label: 'Unknown tool permission',
    category: 'approval',
    doorType: 'one-way',
    description: 'Allow a tool call whose risk is not yet classified.',
  },
  {
    id: 'decision-record',
    label: 'Record project decision',
    category: 'approval',
    doorType: 'two-way',
    description: 'Record a reusable project decision in the local decision store.',
  },
];

const QUESTION_REGISTRY_BY_ID = new Map(QUESTION_REGISTRY.map((item) => [item.id, item]));
const PREFERENCE_ALLOWED_SOURCES = new Set<QuestionPreferenceSource>([
  'settings',
  'permission-dialog',
  'inline-user',
  'plan-tune',
]);
const SPLIT_QUESTION_PATTERN = /-split-/;
const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\bdelete\b/i,
  /\bremove\s+(directory|folder|files?)\b/i,
  /\bwipe\b/i,
  /\bpurge\b/i,
  /\btruncate\b/i,
  /\bdrop\s+(table|database|schema|index|column)\b/i,
  /\bdelete\s+from\b/i,
  /\bforce[- ]push\b/i,
  /\bpush\s+--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bcheckout\s+--\b/i,
  /\brestore\s+\.\b/i,
  /\bclean\s+-f\b/i,
  /\bbranch\s+-D\b/i,
  /\bkubectl\s+delete\b/i,
  /\bterraform\s+destroy\b/i,
  /\brollback\b/i,
  /\brevoke\s+[\w\s]*\b(api key|token|credential|access key|password)\b/i,
  /\breset\s+[\w\s]*\b(api key|token|password|credential)\b/i,
  /\brotate\s+[\w\s]*\b(api key|token|secret|credential|access key|password)\b/i,
  /\b(schema\s+migration|breaking\s+change|data\s+model\s+change)\b/i,
];
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+(instructions|context|rules)/i,
  /you\s+are\s+now\s+/i,
  /override[:\s]/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /do\s+not\s+(report|flag|mention)/i,
];

export function getQuestionPolicySnapshot(cwd?: string): QuestionPolicySnapshot {
  const workspaceKey = getWorkspaceKey(cwd);
  const preferences = Object.values(readPreferences(cwd)).sort((a, b) =>
    a.questionId.localeCompare(b.questionId)
  );
  const events = listQuestionEvents(cwd, 200);
  return {
    workspaceKey,
    cwd,
    preferences,
    recentEvents: events.slice(0, 40),
    registry: [...QUESTION_REGISTRY],
    stats: {
      preferences: preferences.length,
      events: events.length,
      oneWayEvents: events.filter((event) => event.oneWay).length,
      autoDecisions: events.filter((event) => event.event === 'auto_decided').length,
    },
  };
}

export function evaluateQuestionPolicy(input: QuestionPolicyEvaluationInput): QuestionPolicyEvaluation {
  const definition = QUESTION_REGISTRY_BY_ID.get(input.questionId);
  const category = input.category || definition?.category || 'approval';
  const defaultChoice = input.defaultChoice || definition?.defaultChoice;
  const classification = classifyQuestion({
    questionId: input.questionId,
    summary: input.summary,
    category,
    registeredDoorType: definition?.doorType,
  });
  const preference = readPreferences(input.cwd)[input.questionId];

  if (classification.oneWay) {
    return {
      action: 'ask',
      questionId: input.questionId,
      preference,
      oneWay: true,
      reason: `one-way:${classification.reason}`,
    };
  }

  if (SPLIT_QUESTION_PATTERN.test(input.questionId)) {
    return {
      action: 'ask',
      questionId: input.questionId,
      preference,
      oneWay: false,
      reason: 'split-chain questions are always asked',
    };
  }

  if (!preference || preference.preference === 'always-ask') {
    return {
      action: 'ask',
      questionId: input.questionId,
      preference,
      oneWay: false,
      reason: preference ? 'preference:always-ask' : 'no preference',
    };
  }

  if (!defaultChoice) {
    return {
      action: 'ask',
      questionId: input.questionId,
      preference,
      oneWay: false,
      reason: 'preference exists but no safe default choice is available',
    };
  }

  if (preference.preference === 'never-ask' || preference.preference === 'ask-only-for-one-way') {
    appendQuestionEvent({
      cwd: input.cwd,
      questionId: input.questionId,
      event: 'auto_decided',
      category,
      doorType: 'two-way',
      summary: input.summary,
      choice: defaultChoice,
      preference: preference.preference,
      source: 'question-policy',
      oneWay: false,
      reason: preference.preference,
    });
    return {
      action: 'auto_decide',
      questionId: input.questionId,
      choice: defaultChoice,
      preference,
      oneWay: false,
      reason: `preference:${preference.preference}`,
    };
  }

  return {
    action: 'ask',
    questionId: input.questionId,
    preference,
    oneWay: false,
    reason: 'safe fallback',
  };
}

export function buildPermissionQuestion(input: PermissionQuestionInput): QuestionPolicyEvaluationInput {
  const display = input.toolName || 'unknown';
  const inputText = safeStringify(input.input);
  const lowerTool = display.toLowerCase();
  const summary = `Permission request for ${display}: ${inputText.slice(0, 500)}`;

  if (lowerTool.includes('bash') || lowerTool.includes('command') || lowerTool.includes('shell')) {
    return {
      cwd: input.cwd,
      questionId: 'permission-bash',
      summary,
      category: 'approval',
      defaultChoice: 'allow',
    };
  }
  if (
    lowerTool.includes('write') ||
    lowerTool.includes('edit') ||
    lowerTool.includes('replace') ||
    lowerTool.includes('delete') ||
    lowerTool.includes('remove')
  ) {
    return {
      cwd: input.cwd,
      questionId: 'permission-write',
      summary,
      category: 'approval',
      defaultChoice: 'allow',
    };
  }
  if (lowerTool.startsWith('mcp__')) {
    const mcpWriteLike =
      /(click|fill|type|press|write|edit|delete|remove|exec|eval|run|command|shell|send|post)/i.test(
        display
      ) || DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(inputText));
    return {
      cwd: input.cwd,
      questionId: mcpWriteLike ? 'permission-mcp-write' : 'permission-mcp-read',
      summary,
      category: 'approval',
      defaultChoice: 'allow',
    };
  }
  if (['read', 'glob', 'grep', 'ls', 'find', 'list_directory'].includes(lowerTool)) {
    return {
      cwd: input.cwd,
      questionId: 'permission-read',
      summary,
      category: 'approval',
      defaultChoice: 'allow',
    };
  }
  return {
    cwd: input.cwd,
    questionId: 'permission-unknown',
    summary,
    category: 'approval',
    defaultChoice: 'allow',
  };
}

export function setQuestionPreference(input: {
  cwd?: string;
  questionId: string;
  preference: QuestionPreference;
  source: QuestionPreferenceSource | QuestionRejectedSource;
  note?: string;
}): QuestionPreferenceRecord {
  const questionId = normalizeQuestionId(input.questionId);
  if (!PREFERENCE_ALLOWED_SOURCES.has(input.source as QuestionPreferenceSource)) {
    appendQuestionEvent({
      cwd: input.cwd,
      questionId,
      event: 'preference_rejected',
      category: QUESTION_REGISTRY_BY_ID.get(questionId)?.category || 'approval',
      doorType: QUESTION_REGISTRY_BY_ID.get(questionId)?.doorType || 'two-way',
      summary: `Rejected preference write from ${input.source}`,
      preference: input.preference,
      source: input.source,
      oneWay: QUESTION_REGISTRY_BY_ID.get(questionId)?.doorType === 'one-way',
      reason: 'source is not user-originated',
    });
    throw new Error(`Question preference source "${input.source}" is not user-originated.`);
  }
  if (!isQuestionPreference(input.preference)) {
    throw new Error('Invalid question preference.');
  }
  const note = sanitizeOptionalNote(input.note);
  const record: QuestionPreferenceRecord = {
    questionId,
    preference: input.preference,
    source: input.source as QuestionPreferenceSource,
    updatedAt: new Date().toISOString(),
    note,
  };
  const preferences = readPreferences(input.cwd);
  preferences[questionId] = record;
  writePreferences(input.cwd, preferences);
  appendQuestionEvent({
    cwd: input.cwd,
    questionId,
    event: 'preference_set',
    category: QUESTION_REGISTRY_BY_ID.get(questionId)?.category || 'approval',
    doorType: QUESTION_REGISTRY_BY_ID.get(questionId)?.doorType || 'two-way',
    summary: `Preference set to ${input.preference}`,
    preference: input.preference,
    source: input.source,
    oneWay: QUESTION_REGISTRY_BY_ID.get(questionId)?.doorType === 'one-way',
  });
  appendProjectTimelineEvent({
    cwd: input.cwd,
    category: 'question',
    event: 'question.preference_set',
    source: 'question-policy-store',
    status: 'ok',
    summary: `${questionId} -> ${input.preference}`,
    metadata: { questionId, preference: input.preference, source: input.source },
  });
  return record;
}

export function clearQuestionPreference(cwd: string | undefined, questionId?: string): { success: boolean } {
  if (!questionId) {
    writePreferences(cwd, {});
    appendQuestionEvent({
      cwd,
      questionId: 'all',
      event: 'preference_cleared',
      category: 'approval',
      doorType: 'two-way',
      summary: 'Cleared all question preferences',
      source: 'settings',
      oneWay: false,
    });
    return { success: true };
  }
  const normalized = normalizeQuestionId(questionId);
  const preferences = readPreferences(cwd);
  delete preferences[normalized];
  writePreferences(cwd, preferences);
  appendQuestionEvent({
    cwd,
    questionId: normalized,
    event: 'preference_cleared',
    category: QUESTION_REGISTRY_BY_ID.get(normalized)?.category || 'approval',
    doorType: QUESTION_REGISTRY_BY_ID.get(normalized)?.doorType || 'two-way',
    summary: `Cleared preference for ${normalized}`,
    source: 'settings',
    oneWay: QUESTION_REGISTRY_BY_ID.get(normalized)?.doorType === 'one-way',
  });
  return { success: true };
}

export function recordQuestionAnswer(input: {
  cwd?: string;
  questionId: string;
  summary: string;
  choice: QuestionChoice;
  result?: string;
  source: string;
  setPreference?: QuestionPreference;
}): void {
  const definition = QUESTION_REGISTRY_BY_ID.get(input.questionId);
  const classification = classifyQuestion({
    questionId: input.questionId,
    summary: input.summary,
    category: definition?.category || 'approval',
    registeredDoorType: definition?.doorType,
  });
  appendQuestionEvent({
    cwd: input.cwd,
    questionId: input.questionId,
    event: 'answered',
    category: definition?.category || 'approval',
    doorType: definition?.doorType || (classification.oneWay ? 'one-way' : 'two-way'),
    summary: input.summary,
    choice: input.choice,
    result: input.result,
    source: input.source,
    oneWay: classification.oneWay,
    reason: classification.reason,
  });

  if (input.setPreference && !classification.oneWay) {
    setQuestionPreference({
      cwd: input.cwd,
      questionId: input.questionId,
      preference: input.setPreference,
      source: 'permission-dialog',
    });
  }
}

export function listQuestionEvents(cwd?: string, limit = 100): QuestionEvent[] {
  return readJsonLines<QuestionEvent>(eventsPath(cwd))
    .slice(-Math.max(1, limit))
    .reverse();
}

export function classifyQuestion(input: {
  questionId?: string;
  summary?: string;
  category?: QuestionCategory;
  registeredDoorType?: QuestionDoorType;
}): { oneWay: boolean; reason: 'registry' | 'keyword' | 'unknown-high-risk' | 'default-two-way' } {
  if (input.registeredDoorType) {
    return { oneWay: input.registeredDoorType === 'one-way', reason: 'registry' };
  }
  if (input.questionId) {
    const definition = QUESTION_REGISTRY_BY_ID.get(input.questionId);
    if (definition) {
      return { oneWay: definition.doorType === 'one-way', reason: 'registry' };
    }
  }
  const summary = input.summary || '';
  if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(summary))) {
    return { oneWay: true, reason: 'keyword' };
  }
  if (input.category === 'approval' && !input.questionId) {
    return { oneWay: true, reason: 'unknown-high-risk' };
  }
  return { oneWay: false, reason: 'default-two-way' };
}

function appendQuestionEvent(
  input: Omit<QuestionEvent, 'id' | 'ts' | 'workspaceKey'> & { id?: string; ts?: string }
): QuestionEvent {
  const event: QuestionEvent = {
    id: input.id || randomUUID(),
    ts: input.ts || new Date().toISOString(),
    workspaceKey: getWorkspaceKey(input.cwd),
    cwd: input.cwd,
    questionId: input.questionId,
    event: input.event,
    category: input.category,
    doorType: input.doorType,
    summary: trimString(input.summary, 1000),
    choice: input.choice,
    result: input.result ? trimString(input.result, 200) : undefined,
    preference: input.preference,
    source: input.source,
    oneWay: input.oneWay,
    reason: input.reason,
  };
  appendJsonLine(eventsPath(input.cwd), event);
  return event;
}

function preferencesPath(cwd?: string): string {
  return path.join(ensureWorkHabitsWorkspaceDir(cwd), 'question-preferences.json');
}

function eventsPath(cwd?: string): string {
  return path.join(ensureWorkHabitsWorkspaceDir(cwd), 'question-events.jsonl');
}

function readPreferences(cwd?: string): Record<string, QuestionPreferenceRecord> {
  const raw = readJsonObject<Record<string, QuestionPreferenceRecord>>(preferencesPath(cwd), {});
  const output: Record<string, QuestionPreferenceRecord> = {};
  for (const [key, record] of Object.entries(raw)) {
    if (!record || typeof record !== 'object') continue;
    if (!isQuestionPreference(record.preference)) continue;
    const questionId = normalizeQuestionId(record.questionId || key);
    output[questionId] = {
      questionId,
      preference: record.preference,
      source: PREFERENCE_ALLOWED_SOURCES.has(record.source) ? record.source : 'settings',
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString(),
      note: typeof record.note === 'string' ? record.note : undefined,
    };
  }
  return output;
}

function writePreferences(cwd: string | undefined, preferences: Record<string, QuestionPreferenceRecord>): void {
  writeJsonObject(preferencesPath(cwd), preferences);
}

function normalizeQuestionId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(normalized)) {
    throw new Error('Invalid question id.');
  }
  return normalized;
}

function isQuestionPreference(value: unknown): value is QuestionPreference {
  return value === 'always-ask' || value === 'never-ask' || value === 'ask-only-for-one-way';
}

function sanitizeOptionalNote(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const note = value.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!note) return undefined;
  if (INJECTION_PATTERNS.some((pattern) => pattern.test(note))) {
    throw new Error('Question preference note contains instruction-like content.');
  }
  return note;
}

function safeStringify(value: unknown): string {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text || '';
  } catch {
    return '';
  }
}

function trimString(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...[truncated]` : value;
}
