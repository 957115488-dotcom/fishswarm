import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createPatchProposalArtifact,
  extractDiffFilePaths,
  scanDiffForSecrets,
  validatePatchProposalPaths,
} from '../../main/planning/patch-proposal-service';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-patch-proposal-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
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

const safeDiff = `diff --git a/src/main/asset.ts b/src/main/asset.ts
--- a/src/main/asset.ts
+++ b/src/main/asset.ts
@@ -1 +1 @@
-export const value = 1;
+export const value = 2;
`;

describe('patch proposal service', () => {
  it('extracts normalized file paths from git diffs', () => {
    expect(extractDiffFilePaths(safeDiff)).toEqual(['src/main/asset.ts']);
  });

  it('validates allowed and denied path policy before saving artifacts', () => {
    expect(
      validatePatchProposalPaths({
        files: ['src/main/asset.ts'],
        allowedPaths: ['src/**'],
        deniedPaths: ['.env', 'secrets/**'],
      }).blocked
    ).toEqual([]);

    expect(
      validatePatchProposalPaths({
        files: ['secrets/token.txt'],
        allowedPaths: ['src/**'],
        deniedPaths: ['secrets/**'],
      }).blocked[0]?.reason
    ).toContain('denied');

    expect(
      validatePatchProposalPaths({
        files: ['../outside.txt'],
        allowedPaths: ['src/**'],
      }).blocked[0]?.reason
    ).toContain('Invalid');
  });

  it('creates a ready patch proposal workflow artifact for safe diffs', () => {
    const cwd = makeWorkspace();
    const envelope = createPatchProposalArtifact({
      cwd,
      title: 'Update asset value',
      diff: safeDiff,
      baseCommit: 'abc1234',
      allowedPaths: ['src/**'],
      deniedPaths: ['.env', 'secrets/**'],
      roleRefs: ['implementation-engineer'],
      conceptRefs: ['lowcode-concept:asset-center'],
      sessionId: 'session-1',
    });
    const artifacts = listWorkflowArtifacts({ cwd, kind: 'patch_proposal' });

    expect(envelope.kind).toBe('patch_proposal');
    expect(envelope.status).toBe('ready');
    expect(envelope.artifact.diffSha256).toHaveLength(64);
    expect(envelope.artifact.files).toEqual(['src/main/asset.ts']);
    expect(envelope.artifact.secretScan.status).toBe('pass');
    expect(envelope.artifact.lineage.reviewState).toBe('ready_for_review');
    expect(artifacts).toHaveLength(1);
  });

  it('blocks proposal creation when diff paths violate policy', () => {
    expect(() =>
      createPatchProposalArtifact({
        diff: safeDiff,
        baseCommit: 'abc1234',
        allowedPaths: ['docs/**'],
      })
    ).toThrow(/path validation failed/i);
  });

  it('records blocker findings for secret-shaped diff content', () => {
    const cwd = makeWorkspace();
    const secretDiff = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -1 +1 @@
-export const key = '';
+export const key = 'sk-1234567890abcdefghijklmnop';
`;

    const scan = scanDiffForSecrets(secretDiff);
    const envelope = createPatchProposalArtifact({
      cwd,
      diff: secretDiff,
      baseCommit: 'abc1234',
      allowedPaths: ['src/**'],
    });

    expect(scan.status).toBe('blocked');
    expect(envelope.status).toBe('blocked');
    expect(envelope.artifact.secretScan.findings[0]?.severity).toBe('blocker');
    expect(envelope.artifact.riskSummary).toContain('Blocked by secret scan');
  });
});
