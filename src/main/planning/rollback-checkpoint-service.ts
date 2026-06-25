import { execFileSync } from 'node:child_process';
import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { RollbackCheckpointArtifact } from '../../shared/development-artifact-types';
import { buildArtifactLineage } from '../../shared/development-artifact-types';
import { isPathWithinRoot } from '../tools/path-containment';
import { getWorkspaceKey, getWorkspaceTimelineDir } from '../observability/project-timeline';
import {
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
} from '../workflows/workflow-artifact-store';
import { sha256Text } from './patch-proposal-service';

export interface CreateRollbackCheckpointInput {
  cwd: string;
  title?: string;
  patchProposalId?: string;
  targetFiles: string[];
  now?: Date;
  createdBy?: string;
}

interface TargetFileHash {
  path: string;
  sha256: string;
}

function sha256Buffer(content: Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function runGit(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

function normalizeRelativePath(value: string): string {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/').replace(/^\.\//, ''));
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Unsafe checkpoint path: ${value}`);
  }
  if (path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Unsafe checkpoint path: ${value}`);
  }
  return normalized;
}

function resolveWorkspacePath(cwd: string, relativePath: string): string {
  const absolute = path.resolve(cwd, relativePath);
  if (!isPathWithinRoot(absolute, path.resolve(cwd), process.platform === 'win32')) {
    throw new Error(`Checkpoint path escapes workspace: ${relativePath}`);
  }
  return absolute;
}

function listUntrackedFiles(cwd: string, targetFiles: string[]): string[] {
  const targetSet = new Set(targetFiles.map(normalizeRelativePath));
  const output = runGit(cwd, ['ls-files', '--others', '--exclude-standard', '-z']);
  return output
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeRelativePath)
    .filter((entry) => targetSet.has(entry))
    .sort((a, b) => a.localeCompare(b));
}

function getTargetFileHashes(cwd: string, targetFiles: string[]): TargetFileHash[] {
  return targetFiles
    .map(normalizeRelativePath)
    .map((relativePath) => {
      const absolute = resolveWorkspacePath(cwd, relativePath);
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return null;
      return { path: relativePath, sha256: sha256Buffer(fs.readFileSync(absolute)) };
    })
    .filter((entry): entry is TargetFileHash => entry !== null)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function buildUntrackedManifest(
  cwd: string,
  targetFiles: string[]
): RollbackCheckpointArtifact['untrackedManifest'] {
  return listUntrackedFiles(cwd, targetFiles).map((relativePath) => {
    const absolute = resolveWorkspacePath(cwd, relativePath);
    const stat = fs.statSync(absolute);
    const item: RollbackCheckpointArtifact['untrackedManifest'][number] = {
      path: relativePath,
      size: stat.size,
    };
    if (stat.isFile()) {
      item.sha256 = sha256Buffer(fs.readFileSync(absolute));
    }
    return item;
  });
}

function writeCheckpointFiles(input: {
  cwd: string;
  checkpointId: string;
  dirtyDiff: string;
  untrackedManifest: RollbackCheckpointArtifact['untrackedManifest'];
  targetFileHashes: TargetFileHash[];
}): string {
  const workspaceKey = getWorkspaceKey(input.cwd);
  const checkpointDir = path.join(
    getWorkspaceTimelineDir(input.cwd, workspaceKey),
    'rollback-checkpoints',
    input.checkpointId
  );
  fs.mkdirSync(checkpointDir, { recursive: true });
  fs.writeFileSync(path.join(checkpointDir, 'dirty.diff'), input.dirtyDiff, 'utf8');
  fs.writeFileSync(
    path.join(checkpointDir, 'untracked-manifest.json'),
    `${JSON.stringify(input.untrackedManifest, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(checkpointDir, 'target-file-hashes.json'),
    `${JSON.stringify(input.targetFileHashes, null, 2)}\n`,
    'utf8'
  );
  return `rollback-checkpoint:${input.checkpointId}`;
}

export function createRollbackCheckpointArtifact(
  input: CreateRollbackCheckpointInput
): WorkflowArtifactEnvelope<RollbackCheckpointArtifact> {
  if (!input.cwd || !fs.existsSync(input.cwd) || !fs.statSync(input.cwd).isDirectory()) {
    throw new Error('A valid workspace cwd is required to create a rollback checkpoint.');
  }
  if (input.targetFiles.length === 0) {
    throw new Error('At least one target file is required to create a rollback checkpoint.');
  }

  const cwd = path.resolve(input.cwd);
  const targetFiles = input.targetFiles.map(normalizeRelativePath);
  const checkpointId = randomUUID();
  const createdAt = (input.now || new Date()).toISOString();
  const baseHead = runGit(cwd, ['rev-parse', 'HEAD']).trim() || 'unknown';
  const dirtyDiff = runGit(cwd, ['diff', '--binary', '--', ...targetFiles]);
  const dirtyDiffSha256 = dirtyDiff.trim() ? sha256Text(dirtyDiff) : undefined;
  const targetFileHashes = getTargetFileHashes(cwd, targetFiles);
  const untrackedManifest = buildUntrackedManifest(cwd, targetFiles);
  const checkpointRef = writeCheckpointFiles({
    cwd,
    checkpointId,
    dirtyDiff,
    untrackedManifest,
    targetFileHashes,
  });

  const artifact: RollbackCheckpointArtifact = {
    kind: 'rollback_checkpoint',
    title: input.title || 'Rollback checkpoint',
    lineage: buildArtifactLineage({
      parentArtifactIds: input.patchProposalId ? [input.patchProposalId] : [],
      sourceRefs: input.patchProposalId
        ? [{ type: 'workflow', id: input.patchProposalId, title: 'Patch proposal' }]
        : [],
      roleRefs: [],
      conceptRefs: ['lowcode-concept:source-export'],
      createdBy: input.createdBy || 'system',
      createdAt,
      contentSha256: sha256Text(
        JSON.stringify({
          baseHead,
          dirtyDiffSha256,
          targetFileHashes,
          untrackedManifest,
          checkpointRef,
        })
      ),
      allowedPaths: targetFiles,
      deniedPaths: ['.env', '.git/**', 'node_modules/**'],
      reviewState: 'ready_for_review',
    }),
    baseHead,
    dirtyDiffSha256,
    untrackedManifest,
    targetFileHashes,
    checkpointRef,
    createdAt,
  };

  return saveWorkflowArtifact<RollbackCheckpointArtifact>({
    cwd,
    kind: 'rollback_checkpoint',
    title: artifact.title,
    status: 'ready',
    artifact,
  });
}
