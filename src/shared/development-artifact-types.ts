import type { WorkflowArtifactKind } from './ipc-types';

export const STRUCTURED_DEVELOPMENT_ARTIFACT_KINDS = [
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
] as const satisfies readonly WorkflowArtifactKind[];

export type StructuredDevelopmentArtifactKind =
  (typeof STRUCTURED_DEVELOPMENT_ARTIFACT_KINDS)[number];

export type ArtifactReviewState =
  | 'draft'
  | 'ready_for_review'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'superseded';

export interface ArtifactSourceRef {
  type: 'asset' | 'file' | 'session' | 'workflow' | 'manual' | 'generated';
  id?: string;
  path?: string;
  uri?: string;
  title?: string;
}

export interface ArtifactLineage {
  schemaVersion: 1;
  parentArtifactIds: string[];
  sourceRefs: ArtifactSourceRef[];
  roleRefs: string[];
  conceptRefs: string[];
  sessionId?: string;
  createdBy: 'user' | 'agent' | 'system' | string;
  createdAt: string;
  contentSha256: string;
  allowedPaths: string[];
  deniedPaths: string[];
  reviewState: ArtifactReviewState;
}

export interface BaseDevelopmentArtifact<TKind extends StructuredDevelopmentArtifactKind> {
  kind: TKind;
  title: string;
  lineage: ArtifactLineage;
}

export interface FeatureBlueprintArtifact extends BaseDevelopmentArtifact<'feature_blueprint'> {
  problem: string;
  goals: string[];
  nonGoals: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  risks: Array<{ level: 'low' | 'medium' | 'high'; summary: string; mitigation?: string }>;
}

export interface DataModelDraftArtifact extends BaseDevelopmentArtifact<'data_model_draft'> {
  models: Array<{
    name: string;
    description?: string;
    fields: Array<{ name: string; type: string; required: boolean; description?: string }>;
    relations?: Array<{ target: string; cardinality: 'one' | 'many'; description?: string }>;
  }>;
}

export interface ComponentTreeDraftArtifact extends BaseDevelopmentArtifact<'component_tree_draft'> {
  rootComponent: string;
  components: Array<{
    id: string;
    name: string;
    responsibility: string;
    children: string[];
    assetRefs?: string[];
  }>;
}

export interface LogicFlowDraftArtifact extends BaseDevelopmentArtifact<'logic_flow_draft'> {
  document: unknown;
  diagnostics: Array<{ severity: 'info' | 'warning' | 'error'; message: string; nodeId?: string }>;
  executable: false;
}

export interface ApiContractDraftArtifact extends BaseDevelopmentArtifact<'api_contract_draft'> {
  endpoints: Array<{
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    requestSchema?: unknown;
    responseSchema?: unknown;
    authRequired: boolean;
  }>;
}

export interface ImplementationPlanDslArtifact extends BaseDevelopmentArtifact<'implementation_plan_dsl'> {
  milestones: Array<{
    id: string;
    title: string;
    tasks: Array<{ id: string; title: string; files: string[]; verification: string[] }>;
  }>;
}

export interface SecretScanFinding {
  type: 'api_key' | 'token' | 'private_key' | 'cookie' | 'unknown';
  file?: string;
  line?: number;
  severity: 'info' | 'warning' | 'blocker';
  fingerprint: string;
}

export interface PatchProposalArtifact extends BaseDevelopmentArtifact<'patch_proposal'> {
  baseCommit: string;
  baseDirtyHash?: string;
  diff: string;
  diffSha256: string;
  files: string[];
  allowedPaths: string[];
  deniedPaths: string[];
  secretScan: {
    status: 'pass' | 'warn' | 'blocked';
    findings: SecretScanFinding[];
  };
  riskSummary: string;
}

export interface DiffReviewArtifact extends BaseDevelopmentArtifact<'diff_review'> {
  patchProposalId: string;
  diffSha256: string;
  findings: Array<{
    severity: 'blocker' | 'major' | 'minor' | 'nit';
    file?: string;
    summary: string;
    recommendation?: string;
  }>;
  verdict: 'approve' | 'request_changes' | 'block';
}

export interface HumanReviewGateArtifact extends BaseDevelopmentArtifact<'human_review_gate'> {
  patchProposalId: string;
  approvedDiffSha256: string;
  approver: string;
  approvedAt: string;
  expiresAt: string;
  allowedPaths: string[];
  allowedActions: string[];
  decision: 'approved' | 'rejected' | 'expired';
  reason?: string;
}

export interface ApplyResultArtifact extends BaseDevelopmentArtifact<'apply_result'> {
  patchProposalId: string;
  approvalArtifactId: string;
  approvedDiffSha256: string;
  appliedAt: string;
  status: 'applied' | 'failed' | 'skipped';
  filesChanged: string[];
  rollbackCheckpointId?: string;
  error?: string;
}

export interface QaResultArtifact extends BaseDevelopmentArtifact<'qa_result'> {
  status: 'pass' | 'warn' | 'fail' | 'skipped';
  summary: string;
  checks: Array<{
    command: string;
    status: 'pass' | 'warn' | 'fail' | 'skipped';
    outputTail?: string;
    durationMs?: number;
  }>;
}

export interface RollbackCheckpointArtifact extends BaseDevelopmentArtifact<'rollback_checkpoint'> {
  baseHead: string;
  dirtyDiffSha256?: string;
  untrackedManifest: Array<{ path: string; size: number; sha256?: string }>;
  targetFileHashes: Array<{ path: string; sha256: string }>;
  checkpointRef: string;
  createdAt: string;
}

export interface ConceptApplicationMapArtifact extends BaseDevelopmentArtifact<'concept_application_map'> {
  conceptRefs: string[];
  assetRefs: string[];
  decisions: Array<{ conceptRef: string; adoptedAs: string; rationale: string }>;
}

export type StructuredDevelopmentArtifact =
  | FeatureBlueprintArtifact
  | DataModelDraftArtifact
  | ComponentTreeDraftArtifact
  | LogicFlowDraftArtifact
  | ApiContractDraftArtifact
  | ImplementationPlanDslArtifact
  | PatchProposalArtifact
  | DiffReviewArtifact
  | HumanReviewGateArtifact
  | ApplyResultArtifact
  | QaResultArtifact
  | RollbackCheckpointArtifact
  | ConceptApplicationMapArtifact;

const STRUCTURED_KIND_SET = new Set<WorkflowArtifactKind>(STRUCTURED_DEVELOPMENT_ARTIFACT_KINDS);

export function isStructuredDevelopmentArtifactKind(
  kind: WorkflowArtifactKind
): kind is StructuredDevelopmentArtifactKind {
  return STRUCTURED_KIND_SET.has(kind);
}

export function buildArtifactLineage(
  input: Omit<ArtifactLineage, 'schemaVersion'> & { schemaVersion?: 1 }
): ArtifactLineage {
  return {
    schemaVersion: 1,
    parentArtifactIds: [...input.parentArtifactIds],
    sourceRefs: input.sourceRefs.map((source) => ({ ...source })),
    roleRefs: [...input.roleRefs],
    conceptRefs: [...input.conceptRefs],
    sessionId: input.sessionId,
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    contentSha256: input.contentSha256,
    allowedPaths: [...input.allowedPaths],
    deniedPaths: [...input.deniedPaths],
    reviewState: input.reviewState,
  };
}
