import type {
  ArtifactSourceRef,
  StructuredDevelopmentArtifact,
} from '../../shared/development-artifact-types';
import { buildArtifactLineage } from '../../shared/development-artifact-types';
import {
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
  type WorkflowArtifactStatus,
} from './workflow-artifact-store';

export interface LinkRoleOutputArtifactInput<T extends StructuredDevelopmentArtifact> {
  cwd?: string;
  artifact: T;
  roleRef: string;
  assetRefs?: string[];
  conceptRefs?: string[];
  parentArtifactIds?: string[];
  sourceRefs?: ArtifactSourceRef[];
  taskBoardId?: string;
  status?: WorkflowArtifactStatus;
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

export function linkRoleOutputArtifact<T extends StructuredDevelopmentArtifact>(
  input: LinkRoleOutputArtifactInput<T>
): WorkflowArtifactEnvelope<T> {
  if (!input.roleRef.trim()) {
    throw new Error('roleRef is required to link role output artifacts.');
  }

  const lineage = buildArtifactLineage({
    ...input.artifact.lineage,
    parentArtifactIds: unique([
      ...input.artifact.lineage.parentArtifactIds,
      ...(input.parentArtifactIds || []),
    ]),
    sourceRefs: [...input.artifact.lineage.sourceRefs, ...(input.sourceRefs || [])],
    roleRefs: unique([...input.artifact.lineage.roleRefs, input.roleRef]),
    assetRefs: unique([...input.artifact.lineage.assetRefs, ...(input.assetRefs || [])]),
    conceptRefs: unique([...input.artifact.lineage.conceptRefs, ...(input.conceptRefs || [])]),
    taskBoardId: input.taskBoardId || input.artifact.lineage.taskBoardId,
  });
  const artifact = { ...input.artifact, lineage } as T;

  return saveWorkflowArtifact<T>({
    cwd: input.cwd,
    kind: artifact.kind,
    title: artifact.title,
    status: input.status || 'ready',
    artifact,
  });
}
