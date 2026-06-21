import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeChangeScope } from '../../main/observability/change-scope-router';
import {
  buildProjectLearningMaintenanceReport,
  exportProjectLearningsMarkdown,
  getProjectLearningStats,
  pruneProjectLearnings,
  searchProjectLearnings,
} from '../../main/observability/project-learning-service';
import {
  appendProjectLearning,
  appendProjectTimelineEvent,
  listProjectLearnings,
  listProjectTimelineEvents,
} from '../../main/observability/project-timeline';
import { sanitizeModelTextOutput } from '../../main/observability/output-sanitizer';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function useTempTimelineRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-timeline-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = root;
  return root;
}

afterEach(() => {
  if (previousTimelineRoot === undefined) {
    delete process.env.FISHSWARM_TIMELINE_ROOT;
  } else {
    process.env.FISHSWARM_TIMELINE_ROOT = previousTimelineRoot;
  }
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('observability services', () => {
  it('sanitizes lone surrogates and truncates large text', () => {
    const result = sanitizeModelTextOutput(`ok\uD800${'x'.repeat(20)}`, {
      maxChars: 8,
      label: 'test',
    });

    expect(result.text).toContain('\uFFFD');
    expect(result.text).toContain('truncated');
    expect(result.warnings).toContain('lone_high_surrogate');
    expect(result.warnings).toContain('truncated');
  });

  it('stores project timeline events and learnings by workspace', () => {
    useTempTimelineRoot();
    const cwd = path.join(os.tmpdir(), 'fishswarm-project');

    appendProjectTimelineEvent({
      cwd,
      category: 'browse',
      event: 'gstack_browse.command_completed',
      source: 'test',
      status: 'ok',
      summary: 'snapshot completed',
      metadata: { token: 'secret' },
    });
    appendProjectLearning({
      cwd,
      type: 'operational',
      key: 'browse-snapshot',
      insight: 'Use snapshot before clicking refs.',
      confidence: 8,
      source: 'observed',
    });

    const events = listProjectTimelineEvents({ cwd });
    const learnings = listProjectLearnings({ cwd });
    const browseEvent = events.find((event) => event.event === 'gstack_browse.command_completed');

    expect(browseEvent).toBeDefined();
    expect(browseEvent?.metadata?.token).toBe('<REDACTED>');
    expect(learnings[0].key).toBe('browse-snapshot');
    expect(learnings[0].trusted).toBe(false);
  });

  it('searches, exports, reports, and safely prunes project learnings', () => {
    useTempTimelineRoot();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-learning-'));
    tempRoots.push(cwd);
    fs.writeFileSync(path.join(cwd, 'live.ts'), 'export const live = true;\n', 'utf-8');

    appendProjectLearning({
      cwd,
      ts: '2026-01-01T00:00:00.000Z',
      type: 'operational',
      key: 'browse-snapshot',
      insight: 'Use the old snapshot note.',
      confidence: 3,
      source: 'inferred',
      files: ['missing.ts'],
      tags: ['gstack'],
    });
    appendProjectLearning({
      cwd,
      ts: '2026-01-02T00:00:00.000Z',
      type: 'operational',
      key: 'browse-snapshot',
      insight: 'Use snapshot before clicking browser refs.',
      confidence: 9,
      source: 'observed',
      files: ['live.ts'],
      tags: ['gstack', 'browser'],
    });
    appendProjectLearning({
      cwd,
      ts: '2026-01-03T00:00:00.000Z',
      type: 'preference',
      key: 'short-updates',
      insight: 'Keep progress updates concise.',
      confidence: 8,
      source: 'user-stated',
      tags: ['workflow'],
    });

    const search = searchProjectLearnings({ cwd, query: 'browser refs' });
    const stats = getProjectLearningStats({ cwd });
    const report = buildProjectLearningMaintenanceReport({ cwd });
    const markdown = exportProjectLearningsMarkdown({ cwd, tags: ['gstack'] });
    const dryRun = pruneProjectLearnings({ cwd, dryRun: true });
    const written = pruneProjectLearnings({ cwd, dryRun: false });
    const retained = listProjectLearnings({ cwd, limit: 10 });

    expect(search).toHaveLength(1);
    expect(search[0].confidence).toBe(9);
    expect(stats.totalCount).toBe(3);
    expect(stats.activeCount).toBe(2);
    expect(stats.supersededCount).toBe(1);
    expect(stats.trustedCount).toBe(1);
    expect(report.duplicateGroups).toHaveLength(1);
    expect(report.staleFileReferences[0]).toMatchObject({ file: 'missing.ts' });
    expect(markdown).toContain('Use snapshot before clicking browser refs.');
    expect(markdown).not.toContain('Use the old snapshot note.');
    expect(dryRun.beforeCount).toBe(3);
    expect(dryRun.afterCount).toBe(2);
    expect(written.backupPath).toBeDefined();
    expect(fs.existsSync(written.backupPath || '')).toBe(true);
    expect(retained).toHaveLength(2);
    expect(retained.some((learning) => learning.insight.includes('old snapshot'))).toBe(false);
  });

  it('stores role timeline events', () => {
    useTempTimelineRoot();
    const cwd = path.join(os.tmpdir(), 'fishswarm-role-project');

    appendProjectTimelineEvent({
      cwd,
      category: 'role',
      event: 'role.lifecycle',
      source: 'role-runtime',
      status: 'ok',
      summary: 'Engineering Architect online.',
      metadata: { roleId: 'engineering-architect' },
    });

    const events = listProjectTimelineEvents({ cwd, category: 'role' });
    expect(events[0].event).toBe('role.lifecycle');
    expect(events[0].category).toBe('role');
  });

  it('routes change scopes to relevant skills and commands', () => {
    const report = analyzeChangeScope('D:\\repo', [
      'src/main/mcp/mcp-manager.ts',
      'src/main/security/redact.ts',
      'src/renderer/components/App.tsx',
      'scripts/pre-build-check.js',
    ]);

    expect(report.scopes.mcp).toBe(true);
    expect(report.scopes.security).toBe(true);
    expect(report.scopes.frontend).toBe(true);
    expect(report.recommendedSkills).toContain('gstack-cso');
    expect(report.recommendedCommands).toContain('npm run typecheck');
  });
});
