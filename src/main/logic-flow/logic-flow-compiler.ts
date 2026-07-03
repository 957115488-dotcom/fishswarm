import type { LogicFlowDocument, LogicFlowPreview } from '../../shared/logic-flow-types';
import type { LogicFlowDraftArtifact } from '../../shared/development-artifact-types';
import { buildArtifactLineage } from '../../shared/development-artifact-types';
import {
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
} from '../workflows/workflow-artifact-store';
import { sha256Text } from '../planning/patch-proposal-service';
import { previewLogicFlowDocument, validateLogicFlowDocument } from './logic-flow-schema';

export interface LogicFlowBuiltinTemplate {
  id: string;
  title: string;
  description: string;
  document: LogicFlowDocument;
}

export interface CreatePlanArtifactFromLogicFlowInput {
  cwd?: string;
  document: LogicFlowDocument;
  sessionId?: string;
  roleRefs?: string[];
  conceptRefs?: string[];
  createdBy?: string;
}

const BUILTIN_LOGIC_FLOWS: LogicFlowBuiltinTemplate[] = [
  {
    id: 'lowcode-human-review-patch',
    title: 'low-code workflow human-reviewed patch flow',
    description: 'Plan, review, approve, apply, and QA without direct LogicFlow execution.',
    document: {
      schemaVersion: 1,
      id: 'lowcode-human-review-patch',
      title: 'Human-reviewed patch flow',
      nodes: [
        {
          id: 'blueprint',
          type: 'artifact',
          title: 'Feature blueprint',
          assetRef: 'feature_blueprint',
        },
        { id: 'patch', type: 'artifact', title: 'Patch proposal', assetRef: 'patch_proposal' },
        { id: 'review', type: 'manual', title: 'Human review gate' },
        { id: 'qa', type: 'artifact', title: 'QA result', assetRef: 'qa_result' },
      ],
      edges: [
        { id: 'edge-blueprint-patch', source: 'blueprint', target: 'patch' },
        { id: 'edge-patch-review', source: 'patch', target: 'review' },
        { id: 'edge-review-qa', source: 'review', target: 'qa' },
      ],
    },
  },
];

export function listBuiltInLogicFlows(): LogicFlowBuiltinTemplate[] {
  return BUILTIN_LOGIC_FLOWS.map((template) => ({
    ...template,
    document: JSON.parse(JSON.stringify(template.document)) as LogicFlowDocument,
  }));
}

export function validateLogicFlow(document: LogicFlowDocument) {
  return validateLogicFlowDocument(document);
}

export function previewLogicFlow(document: LogicFlowDocument): LogicFlowPreview {
  return previewLogicFlowDocument(document);
}

export function createPlanArtifactFromLogicFlow(
  input: CreatePlanArtifactFromLogicFlowInput
): WorkflowArtifactEnvelope<LogicFlowDraftArtifact> {
  const preview = previewLogicFlowDocument(input.document);
  if (!preview.valid) {
    throw new Error(
      `Cannot create LogicFlow artifact with validation errors: ${preview.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => diagnostic.message)
        .join('; ')}`
    );
  }

  const documentHash = sha256Text(JSON.stringify(input.document));
  const artifact: LogicFlowDraftArtifact = {
    kind: 'logic_flow_draft',
    title: input.document.title,
    lineage: buildArtifactLineage({
      parentArtifactIds: [],
      sourceRefs: [{ type: 'generated', id: input.document.id, title: input.document.title }],
      roleRefs: input.roleRefs || [],
      conceptRefs: input.conceptRefs || ['lowcode-concept:logic-design'],
      sessionId: input.sessionId,
      createdBy: input.createdBy || 'agent',
      createdAt: new Date().toISOString(),
      contentSha256: documentHash,
      allowedPaths: [...new Set(input.document.nodes.flatMap((node) => node.allowedPaths || []))],
      deniedPaths: [...new Set(input.document.nodes.flatMap((node) => node.deniedPaths || []))],
      reviewState: 'ready_for_review',
    }),
    document: input.document,
    diagnostics: preview.diagnostics,
    executable: false,
  };

  return saveWorkflowArtifact<LogicFlowDraftArtifact>({
    cwd: input.cwd,
    kind: 'logic_flow_draft',
    title: artifact.title,
    status: 'ready',
    artifact,
  });
}
