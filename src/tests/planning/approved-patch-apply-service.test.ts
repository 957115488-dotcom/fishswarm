import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyApprovedPatch } from '../../main/planning/approved-patch-apply-service';
import { createHumanReviewGateArtifact } from '../../main/planning/human-review-gate-service';
import { createPatchProposalArtifact } from '../../main/planning/patch-proposal-service';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function git(cwd: string, args: string[]) {
  execFileSync('git', ['-C', cwd, ...args], { stdio: 'ignore' });
}

function makeGitWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-apply-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  git(root, ['init', 'workspace']);
  git(cwd, ['config', 'user.email', 'test@example.com']);
  git(cwd, ['config', 'user.name', 'Test User']);
  fs.writeFileSync(path.join(cwd, 'src', 'feature.ts'), 'export const value = 1;\n');
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'initial']);
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
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const validDiff = `diff --git a/src/feature.ts b/src/feature.ts
--- a/src/feature.ts
+++ b/src/feature.ts
@@ -1 +1 @@
-export const value = 1;
+export const value = 2;
`;

const invalidDiff = `diff --git a/src/feature.ts b/src/feature.ts
--- a/src/feature.ts
+++ b/src/feature.ts
@@ -1 +1 @@
-export const missing = 1;
+export const missing = 2;
`;

function createApprovedProposal(cwd: string, diff = validDiff) {
  const proposal = createPatchProposalArtifact({
    cwd,
    title: 'Update feature',
    diff,
    baseCommit: 'abc1234',
    allowedPaths: ['src/**'],
    deniedPaths: ['.env'],
  });
  const gate = createHumanReviewGateArtifact({
    cwd,
    patchProposalId: proposal.id,
    expectedDiffSha256: proposal.artifact.diffSha256,
    decision: 'approved',
    approver: 'reviewer',
    now: new Date('2026-06-25T00:00:00.000Z'),
  });
  return { proposal, gate };
}

describe('approved patch apply service', () => {
  it('applies only an approved patch after creating a rollback checkpoint', () => {
    const cwd = makeGitWorkspace();
    const { proposal, gate } = createApprovedProposal(cwd);
    const result = applyApprovedPatch({
      cwd,
      patchProposalId: proposal.id,
      humanReviewGateId: gate.id,
      now: new Date('2026-06-25T00:10:00.000Z'),
    });
    const fileContent = fs.readFileSync(path.join(cwd, 'src', 'feature.ts'), 'utf8');
    const rollbackArtifacts = listWorkflowArtifacts({ cwd, kind: 'rollback_checkpoint' });
    const applyResults = listWorkflowArtifacts({ cwd, kind: 'apply_result' });

    expect(result.status).toBe('pass');
    expect(result.artifact.status).toBe('applied');
    expect(result.artifact.rollbackCheckpointId).toBeDefined();
    expect(fileContent).toContain('value = 2');
    expect(rollbackArtifacts).toHaveLength(1);
    expect(applyResults).toHaveLength(1);
  });

  it('rejects rejected review gates before touching files', () => {
    const cwd = makeGitWorkspace();
    const proposal = createPatchProposalArtifact({
      cwd,
      title: 'Update feature',
      diff: validDiff,
      baseCommit: 'abc1234',
      allowedPaths: ['src/**'],
    });
    const gate = createHumanReviewGateArtifact({
      cwd,
      patchProposalId: proposal.id,
      decision: 'rejected',
      approver: 'reviewer',
    });

    expect(() =>
      applyApprovedPatch({ cwd, patchProposalId: proposal.id, humanReviewGateId: gate.id })
    ).toThrow(/not valid/i);
    expect(fs.readFileSync(path.join(cwd, 'src', 'feature.ts'), 'utf8')).toContain('value = 1');
  });

  it('writes a failed apply_result if git apply dry-run fails after checkpoint creation', () => {
    const cwd = makeGitWorkspace();
    const { proposal, gate } = createApprovedProposal(cwd, invalidDiff);
    const result = applyApprovedPatch({
      cwd,
      patchProposalId: proposal.id,
      humanReviewGateId: gate.id,
      now: new Date('2026-06-25T00:10:00.000Z'),
    });
    const rollbackArtifacts = listWorkflowArtifacts({ cwd, kind: 'rollback_checkpoint' });

    expect(result.status).toBe('fail');
    expect(result.artifact.status).toBe('failed');
    expect(result.artifact.error).toBeTruthy();
    expect(result.artifact.filesChanged).toEqual([]);
    expect(rollbackArtifacts).toHaveLength(1);
    expect(fs.readFileSync(path.join(cwd, 'src', 'feature.ts'), 'utf8')).toContain('value = 1');
  });
});
