import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDocumentReleaseCoverageArtifact } from '../../main/documentation/document-release-service';
import { createCodeHealthArtifact } from '../../main/observability/code-health-service';
import { createBacklogSpecArtifact } from '../../main/planning/spec-workflow';
import {
  createImplementationTasksArtifact,
  createReleaseSummaryArtifact,
  createReviewGateArtifact,
  evaluateShipGate,
} from '../../main/shipping/release-gate-service';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const previousWorkHabitsRoot = process.env.FISHSWARM_WORK_HABITS_ROOT;
const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-release-gate-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  process.env.FISHSWARM_WORK_HABITS_ROOT = path.join(root, 'habits');
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  fs.mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'README.md'), '# Workspace\n');
  fs.writeFileSync(path.join(cwd, 'README_zh.md'), '# 工作区\n');
  fs.writeFileSync(path.join(cwd, 'CONTRIBUTING.md'), '# Contributing\n');
  fs.writeFileSync(path.join(cwd, 'SECURITY.md'), '# Security\n');
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

function createReadySpec(cwd: string): void {
  createBacklogSpecArtifact({
    cwd,
    title: 'Ship release gate workflow',
    stakeholderContext: 'Release steward needs role review evidence before shipping.',
    verifiedCurrentState: [{ file: 'src/main/index.ts', evidence: 'IPC hub exists.' }],
    proposedChange: 'Add review and ship gate artifacts.',
    implementationDetails: ['Create release gate service.'],
    acceptanceCriteria: ['Ship gate fails when a blocker finding remains open.'],
    testingPlan: [{ level: 'unit', target: 'release gate service' }],
  });
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

describe('release gate workflow artifacts', () => {
  it('fails review gates with open blocker findings and aggregates P1 tasks', () => {
    const cwd = makeWorkspace();

    const review = createReviewGateArtifact({
      cwd,
      title: 'Pre-ship role review',
      completedRoles: ['product', 'design', 'engineering', 'dx', 'security', 'qa'],
      findings: [
        {
          role: 'security',
          severity: 'blocker',
          title: 'Token can leak into release notes.',
          files: ['src/main/release/release-gate-service.ts'],
          recommendation: 'Redact release summaries before rendering PR body.',
        },
      ],
      consensus: 'Do not ship with an open security blocker.',
    });
    const tasks = createImplementationTasksArtifact({ cwd });

    expect(review.status).toBe('fail');
    expect(review.artifact.blockerCount).toBe(1);
    expect(tasks.artifact.tasks[0]).toMatchObject({
      priority: 'P1',
      sourceKind: 'review_gate',
    });
  });

  it('renders release summaries and fails ship gate when a blocker artifact exists', () => {
    const cwd = makeWorkspace();
    createReadySpec(cwd);
    createCodeHealthArtifact(cwd);
    createDocumentReleaseCoverageArtifact(cwd);
    createReviewGateArtifact({
      cwd,
      completedRoles: ['product', 'design', 'engineering', 'dx', 'security', 'qa'],
      findings: [{ role: 'qa', severity: 'blocker', title: 'Regression test not rerun.' }],
    });
    createImplementationTasksArtifact({ cwd });

    const summary = createReleaseSummaryArtifact({
      cwd,
      title: 'Release gate summary',
      completedCommands: [{ command: 'npm test -- --run release-gates.test.ts', status: 'pass' }],
    });
    const shipGate = evaluateShipGate({ cwd });

    expect(summary.status).toBe('fail');
    expect(summary.artifact.prBodyMarkdown).toContain('## Gate Summary');
    expect(summary.artifact.blockers[0]).toContain('review_gate is fail');
    expect(shipGate.artifact.gate).toBe('fail');
    expect(shipGate.artifact.blockers).toContainEqual(
      expect.stringContaining('review_gate is fail')
    );
  });

  it('passes ship gate when required artifacts are fresh and clean', () => {
    const cwd = makeWorkspace();
    createReadySpec(cwd);
    createDocumentReleaseCoverageArtifact(cwd);
    createReviewGateArtifact({
      cwd,
      completedRoles: ['product', 'design', 'engineering', 'dx', 'security', 'qa'],
      findings: [
        {
          role: 'engineering',
          severity: 'minor',
          status: 'resolved',
          title: 'Clarify rollback note.',
        },
      ],
    });
    createReleaseSummaryArtifact({
      cwd,
      title: 'Clean release summary',
      completedCommands: [{ command: 'npx vitest run release-gates.test.ts', status: 'pass' }],
    });

    const shipGate = evaluateShipGate({
      cwd,
      requiredArtifactKinds: ['backlog_spec', 'review_gate', 'document_release', 'release_summary'],
    });
    const artifacts = listWorkflowArtifacts({ cwd });

    expect(shipGate.status).toBe('pass');
    expect(shipGate.artifact.gate).toBe('pass');
    expect(shipGate.artifact.missingKinds).toHaveLength(0);
    expect(artifacts.map((artifact) => artifact.kind)).toContain('ship_gate');
  });
});
