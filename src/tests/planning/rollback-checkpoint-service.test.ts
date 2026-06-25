import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getWorkspaceKey,
  getWorkspaceTimelineDir,
} from '../../main/observability/project-timeline';
import { createRollbackCheckpointArtifact } from '../../main/planning/rollback-checkpoint-service';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function git(cwd: string, args: string[]) {
  execFileSync('git', ['-C', cwd, ...args], { stdio: 'ignore' });
}

function makeGitWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-rollback-'));
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
  fs.writeFileSync(path.join(cwd, 'src', 'feature.ts'), 'export const value = 2;\n');
  fs.writeFileSync(path.join(cwd, 'src', 'new-file.ts'), 'export const next = true;\n');
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

describe('rollback checkpoint service', () => {
  it('captures head, scoped dirty diff hash, target hashes, and checkpoint files', () => {
    const cwd = makeGitWorkspace();
    const envelope = createRollbackCheckpointArtifact({
      cwd,
      title: 'Before apply',
      patchProposalId: '12345678-1234-1234-1234-123456789abc',
      targetFiles: ['src/feature.ts'],
      now: new Date('2026-06-25T00:00:00.000Z'),
    });
    const artifacts = listWorkflowArtifacts({ cwd, kind: 'rollback_checkpoint' });
    const checkpointId = envelope.artifact.checkpointRef.replace('rollback-checkpoint:', '');
    const checkpointDir = path.join(
      getWorkspaceTimelineDir(cwd, getWorkspaceKey(cwd)),
      'rollback-checkpoints',
      checkpointId
    );

    expect(envelope.status).toBe('ready');
    expect(envelope.artifact.baseHead).toMatch(/[a-f0-9]{40}/);
    expect(envelope.artifact.dirtyDiffSha256).toHaveLength(64);
    expect(envelope.artifact.targetFileHashes).toHaveLength(1);
    expect(envelope.artifact.untrackedManifest.map((item) => item.path)).not.toContain(
      'src/new-file.ts'
    );
    expect(fs.existsSync(path.join(checkpointDir, 'dirty.diff'))).toBe(true);
    expect(fs.readFileSync(path.join(checkpointDir, 'dirty.diff'), 'utf8')).not.toContain(
      'src/new-file.ts'
    );
    expect(fs.existsSync(path.join(checkpointDir, 'untracked-manifest.json'))).toBe(true);
    expect(artifacts).toHaveLength(1);
  });

  it('records only targeted untracked files in rollback manifests', () => {
    const cwd = makeGitWorkspace();
    const envelope = createRollbackCheckpointArtifact({
      cwd,
      targetFiles: ['src/new-file.ts'],
    });

    expect(envelope.artifact.untrackedManifest.map((item) => item.path)).toEqual([
      'src/new-file.ts',
    ]);
    expect(envelope.artifact.targetFileHashes).toHaveLength(1);
  });

  it('rejects checkpoint target paths that escape the workspace', () => {
    const cwd = makeGitWorkspace();
    expect(() =>
      createRollbackCheckpointArtifact({
        cwd,
        targetFiles: ['../secret.txt'],
      })
    ).toThrow(/unsafe checkpoint path/i);
  });
});
