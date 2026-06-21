import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { CodeHealthDimension, CodeHealthSnapshot } from '../../shared/ipc-types';
import {
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
  type WorkflowArtifactStatus,
} from '../workflows/workflow-artifact-store';

export function buildCodeHealthSnapshot(cwd: string): CodeHealthSnapshot {
  const scripts = readPackageScripts(cwd);
  const dimensions: CodeHealthDimension[] = [
    commandDimension('typecheck', scripts.typecheck, 'npm run typecheck'),
    commandDimension('lint', scripts.lint, 'npm run lint'),
    commandDimension('test', scripts.test, 'npm test'),
    commandDimension(
      'deadcode',
      scripts.deadcode || scripts.knip || scripts['lint:deadcode'],
      'npm run deadcode'
    ),
    shellDimension(cwd, scripts),
    docsDimension(cwd),
  ];
  const scored = dimensions.filter(
    (dimension) => dimension.status !== 'skipped' && dimension.score !== undefined
  );
  const score =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, dimension) => sum + (dimension.score || 0), 0) / scored.length
        )
      : 0;

  return {
    runId: randomUUID(),
    cwd,
    branch: getBranch(cwd),
    score,
    generatedAt: Date.now(),
    dimensions,
    recommendations: dimensions
      .filter((dimension) => dimension.status === 'warn' || dimension.status === 'fail')
      .map((dimension) =>
        dimension.recommendedCommand
          ? `${dimension.id}: run ${dimension.recommendedCommand}`
          : `${dimension.id}: ${dimension.detail || 'review status'}`
      ),
  };
}

export function createCodeHealthArtifact(
  cwd: string
): WorkflowArtifactEnvelope<CodeHealthSnapshot> {
  const snapshot = buildCodeHealthSnapshot(cwd);
  return saveWorkflowArtifact({
    cwd,
    kind: 'code_health',
    title: `Code health ${snapshot.score}/100`,
    status: codeHealthStatus(snapshot.score),
    artifact: snapshot,
  });
}

function commandDimension(
  id: CodeHealthDimension['id'],
  script: string | undefined,
  recommendedCommand: string
): CodeHealthDimension {
  if (!script) {
    return {
      id,
      status: 'skipped',
      detail: 'No package script configured.',
      recommendedCommand,
    };
  }
  return {
    id,
    command: recommendedCommand,
    status: 'warn',
    score: 7,
    detail: 'Command is configured but not executed by this read-only snapshot.',
    recommendedCommand,
  };
}

function shellDimension(cwd: string, scripts: Record<string, string>): CodeHealthDimension {
  const shellFiles = listFiles(cwd).filter((file) => file.endsWith('.sh'));
  const command = scripts.shellcheck || scripts['lint:shell'];
  if (shellFiles.length === 0) {
    return { id: 'shell', status: 'skipped', detail: 'No shell files discovered.' };
  }
  if (!command) {
    return {
      id: 'shell',
      status: 'warn',
      score: 5,
      detail: `${shellFiles.length} shell file(s), no shell lint script configured.`,
      recommendedCommand: 'add npm run lint:shell',
    };
  }
  return {
    id: 'shell',
    command: command.includes('npm run') ? command : 'npm run lint:shell',
    status: 'warn',
    score: 7,
    detail: `${shellFiles.length} shell file(s), shell lint configured but not executed.`,
    recommendedCommand: 'npm run lint:shell',
  };
}

function docsDimension(cwd: string): CodeHealthDimension {
  const required = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md'];
  const missing = required.filter((file) => !fs.existsSync(path.join(cwd, file)));
  if (missing.length > 0) {
    return {
      id: 'docs',
      status: 'warn',
      score: 6,
      detail: `Missing docs: ${missing.join(', ')}`,
    };
  }
  return {
    id: 'docs',
    status: 'clean',
    score: 10,
    detail: 'Required top-level docs are present.',
  };
}

function readPackageScripts(cwd: string): Record<string, string> {
  const packagePath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packagePath)) return {};
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts || {};
  } catch {
    return {};
  }
}

function getBranch(cwd: string): string {
  try {
    return (
      execFileSync('git', ['branch', '--show-current'], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      }).trim() || 'unknown'
    );
  } catch {
    return 'unknown';
  }
}

function listFiles(cwd: string): string[] {
  const output: string[] = [];
  const queue = ['scripts', '.github'].map((item) => path.join(cwd, item));
  for (const dir of queue) {
    if (!fs.existsSync(dir)) continue;
    walk(dir, output, cwd);
  }
  return output;
}

function walk(dir: string, output: string[], cwd: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      walk(filePath, output, cwd);
    } else {
      output.push(path.relative(cwd, filePath));
    }
  }
}

function codeHealthStatus(score: number): WorkflowArtifactStatus {
  if (score >= 90) return 'pass';
  if (score >= 60) return 'warn';
  return 'fail';
}
