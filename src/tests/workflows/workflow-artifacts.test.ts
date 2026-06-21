import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createInvestigationArtifact } from '../../main/debug/investigation-workflow';
import { createDocumentReleaseCoverageArtifact } from '../../main/documentation/document-release-service';
import { createCodeHealthArtifact } from '../../main/observability/code-health-service';
import { listProjectLearnings } from '../../main/observability/project-timeline';
import { createBacklogSpecArtifact } from '../../main/planning/spec-workflow';
import { getDecisionStoreSnapshot } from '../../main/work-habits/decision-store';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const previousWorkHabitsRoot = process.env.FISHSWARM_WORK_HABITS_ROOT;
const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-workflow-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  process.env.FISHSWARM_WORK_HABITS_ROOT = path.join(root, 'habits');
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'src', 'feature.ts'), 'export const feature = true;\n');
  fs.writeFileSync(path.join(cwd, 'scripts', 'deploy-local.sh'), '#!/usr/bin/env bash\n');
  fs.writeFileSync(path.join(cwd, 'README.md'), '# Workspace\n');
  fs.writeFileSync(path.join(cwd, 'CONTRIBUTING.md'), '# Contributing\n');
  fs.writeFileSync(path.join(cwd, 'CHANGELOG.md'), '# Changelog\n');
  fs.writeFileSync(
    path.join(cwd, 'docs', 'gstack-fishswarm-development-batches.md'),
    '# Batches\n'
  );
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify(
      {
        scripts: {
          typecheck: 'tsc --noEmit',
          lint: 'eslint src --ext .ts',
          test: 'vitest run',
        },
      },
      null,
      2
    )
  );
  return cwd;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv('FISHSWARM_TIMELINE_ROOT', previousTimelineRoot);
  restoreEnv('FISHSWARM_WORK_HABITS_ROOT', previousWorkHabitsRoot);
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('workflow artifacts', () => {
  it('creates backlog spec artifacts and records ready specs as decisions', () => {
    const cwd = makeWorkspace();

    const envelope = createBacklogSpecArtifact({
      cwd,
      title: 'Add project learning governance',
      mode: 'feature',
      stakeholderContext: 'Operators need durable project memory before running role gates.',
      verifiedCurrentState: [{ file: 'src/feature.ts', evidence: 'Current placeholder exists.' }],
      proposedChange: 'Add a searchable learning governance layer.',
      implementationDetails: ['Add a main-process service.', 'Expose IPC for renderer workflows.'],
      acceptanceCriteria: [
        'Search returns the newest active learning.',
        'Markdown export omits superseded entries.',
      ],
      testingPlan: [{ level: 'unit', target: 'workflow artifacts' }],
      rollbackPlan: 'Remove the service and IPC handlers.',
      outOfScope: ['Renderer polish'],
    });

    const artifacts = listWorkflowArtifacts({ cwd, kind: 'backlog_spec' });
    const decisions = getDecisionStoreSnapshot(cwd);

    expect(envelope.status).toBe('ready');
    expect(envelope.artifact.readinessScore).toBe(100);
    expect(envelope.artifact.decisionId).toBeDefined();
    expect(artifacts).toHaveLength(1);
    expect(decisions.active[0].decision).toContain('Backlog spec ready');
  });

  it('keeps incomplete specs as drafts with explicit missing fields', () => {
    const cwd = makeWorkspace();

    const envelope = createBacklogSpecArtifact({
      cwd,
      title: 'Unclear request',
      proposedChange: 'Do something useful.',
    });

    expect(envelope.status).toBe('draft');
    expect(envelope.artifact.missingFields).toContain('stakeholderContext');
    expect(envelope.artifact.missingFields).toContain('testingPlan');
  });

  it('creates investigation artifacts and turns confirmed root causes into learnings', () => {
    const cwd = makeWorkspace();

    const envelope = createInvestigationArtifact({
      cwd,
      symptom: 'Learning export includes stale entries.',
      reproduction: 'Create two learnings with the same key and export markdown.',
      hypotheses: [
        {
          claim: 'The export path does not filter superseded keys.',
          evidence: ['Duplicate keys appear in learnings.jsonl.'],
          verdict: 'confirmed',
        },
      ],
      rootCause: 'Export used raw jsonl order instead of the active learning projection.',
      affectedFiles: ['src/main/observability/project-learning-service.ts'],
      fixSummary: 'Export now uses active learnings only.',
      regressionTests: [
        { command: 'vitest run workflow-artifacts.test.ts', failedBefore: true, passedAfter: true },
      ],
    });
    const learnings = listProjectLearnings({ cwd, limit: 10 });

    expect(envelope.status).toBe('pass');
    expect(envelope.artifact.status).toBe('fixed');
    expect(envelope.artifact.learningId).toBeDefined();
    expect(learnings[0].type).toBe('investigation');
  });

  it('creates code health and document release coverage artifacts', () => {
    const cwd = makeWorkspace();

    const codeHealth = createCodeHealthArtifact(cwd);
    const docs = createDocumentReleaseCoverageArtifact(cwd);
    const artifacts = listWorkflowArtifacts({ cwd });

    expect(codeHealth.kind).toBe('code_health');
    expect(codeHealth.artifact.dimensions.map((dimension) => dimension.id)).toContain('typecheck');
    expect(codeHealth.artifact.recommendations).toContain('typecheck: run npm run typecheck');
    expect(docs.kind).toBe('document_release');
    expect(docs.artifact.releaseReady).toBe(false);
    expect(docs.artifact.missingRequired).toContain('SECURITY.md');
    expect(artifacts.map((artifact) => artifact.kind)).toEqual(
      expect.arrayContaining(['code_health', 'document_release'])
    );
  });
});
