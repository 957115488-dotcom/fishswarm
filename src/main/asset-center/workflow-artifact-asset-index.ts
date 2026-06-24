import type { WorkflowArtifactEnvelope } from '../workflows/workflow-artifact-store';
import { listWorkflowArtifacts } from '../workflows/workflow-artifact-store';
import type { AssetCenterItem } from './asset-center-types';

export interface WorkflowArtifactAssetIndexInput {
  cwd?: string;
  workspaceKey?: string;
  limit?: number;
  artifacts?: WorkflowArtifactEnvelope[];
}

export interface WorkflowArtifactAssetIndexResult {
  items: AssetCenterItem[];
  warnings: string[];
}

function workflowStatus(status: WorkflowArtifactEnvelope['status']): AssetCenterItem['status'] {
  if (status === 'blocked' || status === 'fail') return 'unavailable';
  if (status === 'needs-more-evidence' || status === 'warn') return 'needsSetup';
  return 'available';
}

function artifactAsset(artifact: WorkflowArtifactEnvelope): AssetCenterItem {
  return {
    id: `workflow.artifact:${artifact.kind}:${artifact.id}`,
    kind: 'workflow.artifact',
    source: 'generated',
    scope: 'workspace',
    status: workflowStatus(artifact.status),
    title: artifact.title,
    summary: `${artifact.kind} workflow artifact with ${artifact.status} status.`,
    tags: ['workflow', 'artifact', artifact.kind, artifact.status],
    sourceRef: { type: 'generated', id: artifact.id },
    schemaVersion: 1,
    updatedAt: artifact.ts,
    contentHash: undefined,
    lineageRefs: [artifact.workspaceKey],
    actions: ['viewDetails'],
    warnings: artifact.cwd
      ? ['Artifact has workspace path metadata; export must redact or relativize paths.']
      : [],
  };
}

export function indexWorkflowArtifactAssets(
  input: WorkflowArtifactAssetIndexInput = {}
): WorkflowArtifactAssetIndexResult {
  try {
    const artifacts =
      input.artifacts ||
      listWorkflowArtifacts({
        cwd: input.cwd,
        workspaceKey: input.workspaceKey,
        limit: input.limit,
      });
    return {
      items: artifacts.map(artifactAsset).sort((a, b) => a.id.localeCompare(b.id)),
      warnings: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { items: [], warnings: [`Workflow artifact indexing failed: ${message}`] };
  }
}
