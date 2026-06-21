import * as fs from 'fs';
import * as path from 'path';
import {
  appendProjectTimelineEvent,
  getWorkspaceKey,
  getWorkspaceTimelineDir,
  type ProjectLearning,
  type TimelineListOptions,
} from './project-timeline';

export interface ProjectLearningSearchOptions extends TimelineListOptions {
  query?: string;
  type?: ProjectLearning['type'];
  source?: ProjectLearning['source'];
  trusted?: boolean;
  minConfidence?: number;
  includeSuperseded?: boolean;
  tags?: string[];
}

export interface ProjectLearningStats {
  cwd?: string;
  workspaceKey: string;
  generatedAt: number;
  totalCount: number;
  activeCount: number;
  supersededCount: number;
  trustedCount: number;
  untrustedCount: number;
  averageConfidence: number;
  byType: Record<ProjectLearning['type'], number>;
  bySource: Record<ProjectLearning['source'], number>;
  topTags: Array<{ tag: string; count: number }>;
}

export interface ProjectLearningMaintenanceReport {
  cwd?: string;
  workspaceKey: string;
  generatedAt: number;
  totalCount: number;
  activeCount: number;
  duplicateGroups: Array<{
    type: ProjectLearning['type'];
    key: string;
    count: number;
    latestId: string;
    supersededIds: string[];
  }>;
  staleFileReferences: Array<{ learningId: string; key: string; file: string }>;
  lowConfidence: ProjectLearning[];
  pruneCandidates: Array<{ learning: ProjectLearning; reasons: string[] }>;
  recommendations: string[];
}

export interface ProjectLearningExportOptions extends ProjectLearningSearchOptions {
  format?: 'markdown';
}

export interface ProjectLearningPruneOptions extends TimelineListOptions {
  dryRun?: boolean;
  keepLatestPerKey?: boolean;
  removeExplicitlySuperseded?: boolean;
  removeStaleFileReferences?: boolean;
  minConfidence?: number;
}

export interface ProjectLearningPruneResult {
  cwd?: string;
  workspaceKey: string;
  dryRun: boolean;
  filePath: string;
  backupPath?: string;
  beforeCount: number;
  afterCount: number;
  pruned: Array<{ learning: ProjectLearning; reasons: string[] }>;
}

const LEARNING_TYPES: ProjectLearning['type'][] = [
  'pattern',
  'pitfall',
  'preference',
  'architecture',
  'tool',
  'operational',
  'investigation',
];

const LEARNING_SOURCES: ProjectLearning['source'][] = [
  'observed',
  'user-stated',
  'inferred',
  'cross-model',
];

export function searchProjectLearnings(
  options: ProjectLearningSearchOptions = {}
): ProjectLearning[] {
  const all = readAllProjectLearnings(options);
  const active = options.includeSuperseded ? all.slice().reverse() : getActiveLearnings(all);
  const query = normalizeSearch(options.query);
  const tags = (options.tags || []).map((tag) => tag.toLowerCase());

  const filtered = active.filter((learning) => {
    if (options.type && learning.type !== options.type) return false;
    if (options.source && learning.source !== options.source) return false;
    if (options.trusted !== undefined && learning.trusted !== options.trusted) return false;
    if (options.minConfidence !== undefined && learning.confidence < options.minConfidence)
      return false;
    if (
      tags.length > 0 &&
      !tags.every((tag) => (learning.tags || []).some((item) => item.toLowerCase() === tag))
    ) {
      return false;
    }
    if (!query) return true;
    return searchableText(learning).includes(query);
  });

  return filtered.slice(0, Math.max(1, options.limit || filtered.length || 1));
}

export function getProjectLearningStats(options: TimelineListOptions = {}): ProjectLearningStats {
  const all = readAllProjectLearnings(options);
  const active = getActiveLearnings(all);
  const workspaceKey = options.workspaceKey || getWorkspaceKey(options.cwd);
  const byType = Object.fromEntries(LEARNING_TYPES.map((type) => [type, 0])) as Record<
    ProjectLearning['type'],
    number
  >;
  const bySource = Object.fromEntries(LEARNING_SOURCES.map((source) => [source, 0])) as Record<
    ProjectLearning['source'],
    number
  >;
  const tagCounts = new Map<string, number>();

  for (const learning of active) {
    byType[learning.type] += 1;
    bySource[learning.source] += 1;
    for (const tag of learning.tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  const confidenceTotal = active.reduce((sum, learning) => sum + learning.confidence, 0);

  return {
    cwd: options.cwd,
    workspaceKey,
    generatedAt: Date.now(),
    totalCount: all.length,
    activeCount: active.length,
    supersededCount: all.length - active.length,
    trustedCount: active.filter((learning) => learning.trusted).length,
    untrustedCount: active.filter((learning) => !learning.trusted).length,
    averageConfidence:
      active.length > 0 ? Math.round((confidenceTotal / active.length) * 10) / 10 : 0,
    byType,
    bySource,
    topTags: Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      .slice(0, 12),
  };
}

export function buildProjectLearningMaintenanceReport(
  options: TimelineListOptions = {}
): ProjectLearningMaintenanceReport {
  const all = readAllProjectLearnings(options);
  const active = getActiveLearnings(all);
  const workspaceKey = options.workspaceKey || getWorkspaceKey(options.cwd);
  const duplicateGroups = getDuplicateGroups(all);
  const staleFileReferences = getStaleFileReferences(all, options.cwd);
  const lowConfidence = active.filter((learning) => learning.confidence <= 4);
  const pruneCandidates = collectPruneCandidates(all, {
    ...options,
    keepLatestPerKey: true,
    removeExplicitlySuperseded: true,
  });
  const recommendations: string[] = [];

  if (duplicateGroups.length > 0) {
    recommendations.push('Prune older duplicate learning keys after reviewing the latest insight.');
  }
  if (staleFileReferences.length > 0) {
    recommendations.push('Review stale file references before relying on the affected learnings.');
  }
  if (lowConfidence.length > 0) {
    recommendations.push(
      'Promote, rewrite, or remove low-confidence learnings after new evidence.'
    );
  }
  if (recommendations.length === 0) {
    recommendations.push('Learning store is clean enough for reuse.');
  }

  return {
    cwd: options.cwd,
    workspaceKey,
    generatedAt: Date.now(),
    totalCount: all.length,
    activeCount: active.length,
    duplicateGroups,
    staleFileReferences,
    lowConfidence,
    pruneCandidates,
    recommendations,
  };
}

export function exportProjectLearningsMarkdown(options: ProjectLearningExportOptions = {}): string {
  const learnings = searchProjectLearnings({ ...options, includeSuperseded: false });
  const workspaceKey = options.workspaceKey || getWorkspaceKey(options.cwd);
  const grouped = new Map<ProjectLearning['type'], ProjectLearning[]>();

  for (const type of LEARNING_TYPES) grouped.set(type, []);
  for (const learning of learnings) grouped.get(learning.type)?.push(learning);

  const lines = [
    `# FishSwarm Project Learnings`,
    ``,
    `- Workspace: \`${workspaceKey}\``,
    `- Generated: ${new Date().toISOString()}`,
    `- Active learnings: ${learnings.length}`,
  ];

  for (const [type, items] of grouped) {
    if (items.length === 0) continue;
    lines.push('', `## ${titleCase(type)}`);
    for (const learning of items) {
      lines.push(
        '',
        `### ${learning.key}`,
        '',
        `- Confidence: ${learning.confidence}/10`,
        `- Source: ${learning.source}${learning.trusted ? ' (trusted)' : ''}`,
        `- Updated: ${learning.ts}`,
        `- Insight: ${learning.insight}`
      );
      if (learning.tags?.length) {
        lines.push(`- Tags: ${learning.tags.map((tag) => `\`${tag}\``).join(', ')}`);
      }
      if (learning.files?.length) {
        lines.push(`- Files: ${learning.files.map((file) => `\`${file}\``).join(', ')}`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}

export function pruneProjectLearnings(
  options: ProjectLearningPruneOptions = {}
): ProjectLearningPruneResult {
  const dryRun = options.dryRun !== false;
  const workspaceKey = options.workspaceKey || getWorkspaceKey(options.cwd);
  const filePath = getLearningsFilePath(options.cwd, workspaceKey);
  const all = readAllProjectLearnings({ ...options, workspaceKey });
  const pruned = collectPruneCandidates(all, {
    ...options,
    keepLatestPerKey: options.keepLatestPerKey !== false,
    removeExplicitlySuperseded: options.removeExplicitlySuperseded !== false,
  });
  const prunedIds = new Set(pruned.map((candidate) => candidate.learning.id));
  const retained = all.filter((learning) => !prunedIds.has(learning.id));
  let backupPath: string | undefined;

  if (!dryRun && pruned.length > 0) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
      backupPath = `${filePath}.bak-${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
    }
    fs.writeFileSync(
      filePath,
      retained.map((learning) => JSON.stringify(learning)).join('\n'),
      'utf-8'
    );
    if (retained.length > 0) fs.appendFileSync(filePath, '\n', 'utf-8');
    appendProjectTimelineEvent({
      cwd: options.cwd,
      workspaceKey,
      category: 'learned',
      event: 'learning.pruned',
      source: 'project-learning-service',
      status: 'ok',
      summary: `Pruned ${pruned.length} project learning entries`,
      metadata: { beforeCount: all.length, afterCount: retained.length, dryRun },
    });
  }

  return {
    cwd: options.cwd,
    workspaceKey,
    dryRun,
    filePath,
    backupPath,
    beforeCount: all.length,
    afterCount: retained.length,
    pruned,
  };
}

function readAllProjectLearnings(options: TimelineListOptions = {}): ProjectLearning[] {
  const workspaceKey = options.workspaceKey || getWorkspaceKey(options.cwd);
  const filePath = getLearningsFilePath(options.cwd, workspaceKey);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as ProjectLearning;
      } catch {
        return null;
      }
    })
    .filter((learning): learning is ProjectLearning => learning !== null);
}

function getLearningsFilePath(cwd: string | undefined, workspaceKey: string): string {
  return path.join(getWorkspaceTimelineDir(cwd, workspaceKey), 'learnings.jsonl');
}

function getActiveLearnings(learnings: ProjectLearning[]): ProjectLearning[] {
  const explicitSuperseded = new Set(
    learnings.map((learning) => learning.supersedesLearningId).filter(Boolean) as string[]
  );
  const seenKeys = new Set<string>();
  const active: ProjectLearning[] = [];

  for (const learning of learnings.slice().sort(compareLearningNewestFirst)) {
    if (explicitSuperseded.has(learning.id)) continue;
    const key = getLearningIdentity(learning);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    active.push(learning);
  }

  return active;
}

function collectPruneCandidates(
  learnings: ProjectLearning[],
  options: ProjectLearningPruneOptions
): Array<{ learning: ProjectLearning; reasons: string[] }> {
  const latestByKey = new Map<string, ProjectLearning>();
  const explicitSuperseded = new Set(
    learnings.map((learning) => learning.supersedesLearningId).filter(Boolean) as string[]
  );
  const staleFiles = new Map<string, string[]>();

  for (const learning of learnings.slice().sort(compareLearningNewestFirst)) {
    const key = getLearningIdentity(learning);
    if (!latestByKey.has(key)) latestByKey.set(key, learning);
  }

  if (options.removeStaleFileReferences) {
    for (const item of getStaleFileReferences(learnings, options.cwd)) {
      const files = staleFiles.get(item.learningId) || [];
      files.push(item.file);
      staleFiles.set(item.learningId, files);
    }
  }

  return learnings
    .map((learning) => {
      const reasons: string[] = [];
      const latest = latestByKey.get(getLearningIdentity(learning));

      if (options.keepLatestPerKey && latest && latest.id !== learning.id) {
        reasons.push('older-duplicate-key');
      }
      if (options.removeExplicitlySuperseded && explicitSuperseded.has(learning.id)) {
        reasons.push('explicitly-superseded');
      }
      if (options.minConfidence !== undefined && learning.confidence < options.minConfidence) {
        reasons.push('below-min-confidence');
      }
      const stale = staleFiles.get(learning.id);
      if (stale?.length) {
        reasons.push(`stale-file-reference:${stale.join(',')}`);
      }

      return reasons.length > 0 ? { learning, reasons } : null;
    })
    .filter(
      (candidate): candidate is { learning: ProjectLearning; reasons: string[] } =>
        candidate !== null
    );
}

function getDuplicateGroups(
  learnings: ProjectLearning[]
): ProjectLearningMaintenanceReport['duplicateGroups'] {
  const groups = new Map<string, ProjectLearning[]>();

  for (const learning of learnings) {
    const key = getLearningIdentity(learning);
    const group = groups.get(key) || [];
    group.push(learning);
    groups.set(key, group);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => {
      const sorted = group.slice().sort(compareLearningNewestFirst);
      return {
        type: sorted[0].type,
        key: sorted[0].key,
        count: sorted.length,
        latestId: sorted[0].id,
        supersededIds: sorted.slice(1).map((learning) => learning.id),
      };
    });
}

function getStaleFileReferences(
  learnings: ProjectLearning[],
  cwd: string | undefined
): Array<{ learningId: string; key: string; file: string }> {
  if (!cwd) return [];
  return learnings.flatMap((learning) => {
    return (learning.files || [])
      .filter((file) => !fs.existsSync(path.resolve(cwd, file)))
      .map((file) => ({ learningId: learning.id, key: learning.key, file }));
  });
}

function compareLearningNewestFirst(a: ProjectLearning, b: ProjectLearning): number {
  const byTime = Date.parse(b.ts) - Date.parse(a.ts);
  return byTime !== 0 ? byTime : b.id.localeCompare(a.id);
}

function getLearningIdentity(learning: ProjectLearning): string {
  return `${learning.type}:${learning.key}`;
}

function searchableText(learning: ProjectLearning): string {
  return normalizeSearch(
    [
      learning.type,
      learning.key,
      learning.insight,
      learning.source,
      learning.cwd,
      ...(learning.files || []),
      ...(learning.tags || []),
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function normalizeSearch(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function titleCase(value: string): string {
  return value
    .split(/[-_]/g)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
