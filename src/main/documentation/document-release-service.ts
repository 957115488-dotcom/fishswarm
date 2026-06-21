import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { DocumentCoverageItem, DocumentReleaseCoverageSnapshot } from '../../shared/ipc-types';
import {
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
  type WorkflowArtifactStatus,
} from '../workflows/workflow-artifact-store';

const DOCUMENT_MATRIX: Array<Omit<DocumentCoverageItem, 'status'>> = [
  {
    id: 'readme',
    label: 'Product overview',
    path: 'README.md',
    diataxis: 'explanation',
    required: true,
  },
  {
    id: 'readme-zh',
    label: 'Chinese overview',
    path: 'README_zh.md',
    diataxis: 'explanation',
    required: false,
  },
  {
    id: 'contributing',
    label: 'Contribution workflow',
    path: 'CONTRIBUTING.md',
    diataxis: 'how-to',
    required: true,
  },
  {
    id: 'security',
    label: 'Security policy',
    path: 'SECURITY.md',
    diataxis: 'reference',
    required: true,
  },
  {
    id: 'changelog',
    label: 'Release notes',
    path: 'CHANGELOG.md',
    diataxis: 'release-note',
    required: true,
  },
  {
    id: 'roadmap',
    label: 'Roadmap',
    path: 'ROADMAP.md',
    diataxis: 'explanation',
    required: false,
  },
  {
    id: 'development-batches',
    label: 'GStack migration batches',
    path: 'docs/gstack-fishswarm-development-batches.md',
    diataxis: 'how-to',
    required: true,
  },
];

export function buildDocumentReleaseCoverageSnapshot(cwd: string): DocumentReleaseCoverageSnapshot {
  const items = DOCUMENT_MATRIX.map((item) => ({
    ...item,
    status: fs.existsSync(path.join(cwd, item.path)) ? 'present' : 'missing',
  })) satisfies DocumentCoverageItem[];
  const required = items.filter((item) => item.required);
  const missingRequired = required
    .filter((item) => item.status === 'missing')
    .map((item) => item.path);
  const presentRequired = required.length - missingRequired.length;
  const score = required.length > 0 ? Math.round((presentRequired / required.length) * 100) : 100;

  return {
    runId: randomUUID(),
    cwd,
    generatedAt: Date.now(),
    score,
    releaseReady: missingRequired.length === 0,
    items,
    missingRequired,
    recommendations:
      missingRequired.length > 0
        ? missingRequired.map((file) => `Add or update release documentation: ${file}`)
        : ['Document release coverage is complete for required files.'],
  };
}

export function createDocumentReleaseCoverageArtifact(
  cwd: string
): WorkflowArtifactEnvelope<DocumentReleaseCoverageSnapshot> {
  const snapshot = buildDocumentReleaseCoverageSnapshot(cwd);
  return saveWorkflowArtifact({
    cwd,
    kind: 'document_release',
    title: `Document coverage ${snapshot.score}/100`,
    status: documentReleaseStatus(snapshot),
    artifact: snapshot,
  });
}

function documentReleaseStatus(snapshot: DocumentReleaseCoverageSnapshot): WorkflowArtifactStatus {
  if (snapshot.releaseReady) return 'pass';
  return snapshot.score >= 60 ? 'warn' : 'fail';
}
