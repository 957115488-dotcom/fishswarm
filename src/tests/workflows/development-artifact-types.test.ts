import { describe, expect, it } from 'vitest';
import type { WorkflowArtifactKind } from '../../shared/ipc-types';
import {
  STRUCTURED_DEVELOPMENT_ARTIFACT_KINDS,
  buildArtifactLineage,
  isStructuredDevelopmentArtifactKind,
  type PatchProposalArtifact,
} from '../../shared/development-artifact-types';

const expectedKinds: WorkflowArtifactKind[] = [
  'feature_blueprint',
  'data_model_draft',
  'component_tree_draft',
  'logic_flow_draft',
  'api_contract_draft',
  'implementation_plan_dsl',
  'patch_proposal',
  'diff_review',
  'human_review_gate',
  'apply_result',
  'qa_result',
  'rollback_checkpoint',
  'concept_application_map',
];

describe('structured development artifact types', () => {
  it('lists every planned structured development artifact kind', () => {
    expect([...STRUCTURED_DEVELOPMENT_ARTIFACT_KINDS]).toEqual(expectedKinds);
    for (const kind of expectedKinds) {
      expect(isStructuredDevelopmentArtifactKind(kind)).toBe(true);
    }
    expect(isStructuredDevelopmentArtifactKind('review_gate')).toBe(false);
  });

  it('builds lineage records with defensive array copies', () => {
    const parentArtifactIds = ['parent-1'];
    const sourceRefs = [{ type: 'asset' as const, id: 'role:qa' }];
    const lineage = buildArtifactLineage({
      parentArtifactIds,
      sourceRefs,
      roleRefs: ['qa-release-steward'],
      conceptRefs: ['lowcode-concept:asset-center'],
      sessionId: 'session-1',
      createdBy: 'agent',
      createdAt: '2026-06-25T00:00:00.000Z',
      contentSha256: 'a'.repeat(64),
      allowedPaths: ['src/**'],
      deniedPaths: ['.env'],
      reviewState: 'draft',
    });

    parentArtifactIds.push('mutated');
    sourceRefs[0].id = 'mutated';

    expect(lineage).toMatchObject({
      schemaVersion: 1,
      sessionId: 'session-1',
      createdBy: 'agent',
      reviewState: 'draft',
    });
    expect(lineage.parentArtifactIds).toEqual(['parent-1']);
    expect(lineage.sourceRefs[0]?.id).toBe('role:qa');
  });

  it('models patch proposals with exact diff hash and review lineage', () => {
    const artifact: PatchProposalArtifact = {
      kind: 'patch_proposal',
      title: 'Patch proposal',
      lineage: buildArtifactLineage({
        parentArtifactIds: [],
        sourceRefs: [],
        roleRefs: ['implementation-engineer'],
        conceptRefs: ['lowcode-concept:source-export'],
        createdBy: 'agent',
        createdAt: '2026-06-25T00:00:00.000Z',
        contentSha256: 'b'.repeat(64),
        allowedPaths: ['src/main/**'],
        deniedPaths: ['.env'],
        reviewState: 'ready_for_review',
      }),
      baseCommit: 'abc1234',
      diff: 'diff --git a/file b/file',
      diffSha256: 'c'.repeat(64),
      files: ['src/main/file.ts'],
      allowedPaths: ['src/main/**'],
      deniedPaths: ['.env'],
      secretScan: { status: 'pass', findings: [] },
      riskSummary: 'Low risk type-only contract.',
    };

    expect(artifact.kind).toBe('patch_proposal');
    expect(artifact.diffSha256).toHaveLength(64);
    expect(artifact.lineage.reviewState).toBe('ready_for_review');
  });
});
