/**
 * IPC type definitions shared between the main process and the renderer/preload.
 *
 * Goals:
 *  - Eliminate `any` from preload/index.ts
 *  - Keep types minimal and structural (no runtime overhead)
 *  - Re-export from existing modules where possible; define locally only when
 *    the originating module lives in `main/` (not importable from renderer/preload).
 */

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------

/** Configuration for a single MCP server (mirrors MCPServerConfig in mcp-manager.ts). */
export interface McpServerConfig {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'streamable-http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  enabled: boolean;
}

/** Tool exposed by an MCP server (mirrors MCPTool in mcp-manager.ts). */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  serverId: string;
  serverName: string;
}

/** Runtime status of a single MCP server. */
export interface McpServerStatus {
  id: string;
  name: string;
  connected: boolean;
  status: 'connecting' | 'connected' | 'failed' | 'disabled';
  toolCount: number;
}

/**
 * Preset MCP server configs returned by `mcp.getPresets`.
 * Each value is a partial MCPServerConfig (without `id` and `enabled`).
 */
export type McpPresetsMap = Record<
  string,
  Omit<McpServerConfig, 'id' | 'enabled'> & {
    requiresEnv?: string[];
    envDescription?: Record<string, string>;
  }
>;

// ---------------------------------------------------------------------------
// Asset Center
// ---------------------------------------------------------------------------

export type AssetKind =
  | 'concept.lowcode'
  | 'skill.builtIn'
  | 'skill.domain'
  | 'plugin'
  | 'mcp.server'
  | 'mcp.tool'
  | 'role'
  | 'workflow.template'
  | 'workflow.artifact'
  | 'component.blueprint'
  | 'prompt.template'
  | 'dataModel.draft'
  | 'ai.provider'
  | 'ai.modelPreset'
  | 'ai.providerSetup'
  | 'ai.apiConfigSet'
  | 'export.package';

export type AssetSource = 'built-in' | 'project' | 'user' | 'plugin' | 'session' | 'generated';
export type AssetScope = 'app' | 'workspace' | 'session' | 'remote';
export type AssetStatus =
  | 'available'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'needsSetup'
  | 'requiresCredential'
  | 'requiresConnector'
  | 'unavailable'
  | 'unknown';

export type ReadOnlyAssetAction = 'viewDetails' | 'openSource' | 'preview';
export type DeferredAssetAction =
  | 'useInTask'
  | 'insertPrompt'
  | 'configure'
  | 'testConnection'
  | 'dryRunExport';
export type AssetAction = ReadOnlyAssetAction | DeferredAssetAction;

export interface AssetSourceRef {
  type: 'file' | 'directory' | 'ipc' | 'mcp' | 'plugin' | 'generated' | 'memory';
  path?: string;
  uri?: string;
  id?: string;
}

export interface AssetCenterItem {
  id: string;
  kind: AssetKind;
  source: AssetSource;
  scope: AssetScope;
  status: AssetStatus;
  title: string;
  summary: string;
  tags: string[];
  sourceRef: AssetSourceRef;
  schemaVersion: number;
  updatedAt?: string;
  contentHash?: string;
  credentialRefs?: string[];
  policyRefs?: string[];
  lineageRefs?: string[];
  actions: AssetAction[];
  warnings: string[];
}

export interface AssetCenterSnapshot {
  schemaVersion: number;
  generatedAt: string;
  items: AssetCenterItem[];
  stats: Record<string, number>;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Remote
// ---------------------------------------------------------------------------

/** Slim channel-type union (mirrors ChannelType in remote/types.ts). */
export type RemoteChannelType = 'feishu' | 'wechat' | 'telegram' | 'dingtalk' | 'websocket';

/** Feishu channel configuration (mirrors FeishuChannelConfig in remote/types.ts). */
export interface FeishuChannelConfig {
  type: 'feishu';
  appId: string;
  appSecret: string;
  verificationToken?: string;
  encryptKey?: string;
  useWebSocket?: boolean;
  dm: {
    policy: 'open' | 'pairing' | 'allowlist';
    allowFrom?: string[];
  };
  groups?: Record<string, { requireMention: boolean; allowFrom?: string[] }>;
  defaultGroupSettings?: { requireMention: boolean };
}

/** Gateway authentication config. */
export interface GatewayAuthConfig {
  mode: 'token' | 'allowlist' | 'pairing' | 'open';
  token?: string;
  allowlist?: string[];
  requirePairing?: boolean;
}

/** Tunnel configuration. */
export interface TunnelConfig {
  enabled: boolean;
  type: 'frp' | 'ngrok' | 'cloudflare';
  frp?: {
    serverAddr: string;
    serverPort: number;
    token?: string;
    subdomain?: string;
  };
  ngrok?: { authToken: string; region?: string };
  cloudflare?: { tunnelToken: string };
}

/** Gateway (remote server) configuration. */
export interface GatewayConfig {
  enabled: boolean;
  port: number;
  bind: '127.0.0.1' | '0.0.0.0';
  auth: GatewayAuthConfig;
  tunnel?: TunnelConfig;
  defaultWorkingDirectory?: string;
  autoApproveSafeTools?: boolean;
}

/** Full remote configuration returned by remote.getConfig. */
export interface RemoteConfig {
  gateway: GatewayConfig;
  channels: {
    feishu?: FeishuChannelConfig;
    wechat?: Record<string, unknown>;
    telegram?: Record<string, unknown>;
    dingtalk?: Record<string, unknown>;
    websocket?: Record<string, unknown>;
  };
}

/** A user that has been paired with a remote channel. */
export interface PairedUser {
  userId: string;
  userName?: string;
  channelType: RemoteChannelType;
  pairedAt: number;
  lastActiveAt: number;
}

/** A pending pairing request. */
export interface PairingRequest {
  code: string;
  channelType: RemoteChannelType;
  userId: string;
  userName?: string;
  createdAt: number;
  expiresAt: number;
}

/** An active remote session mapping. */
export interface RemoteSessionMapping {
  channelType: RemoteChannelType;
  channelId: string;
  userId?: string;
  sessionId: string;
  workingDirectory?: string;
  createdAt: number;
  lastActiveAt: number;
}

// ---------------------------------------------------------------------------
// Context / Guard
// ---------------------------------------------------------------------------

export interface ContextSnapshot {
  id: string;
  sessionId: string;
  title: string;
  cwd?: string;
  model?: string;
  savedAt: number;
  branch?: string;
  gitStatus?: string;
  recentMessages: Array<{
    role: string;
    text: string;
    timestamp: number;
  }>;
}

export interface SessionGuardState {
  sessionId: string;
  frozen: boolean;
  freezeRoot?: string;
  destructiveCommandGuard: boolean;
  updatedAt: number;
}

export interface SessionGuardUpdate {
  frozen?: boolean;
  freezeRoot?: string | null;
  destructiveCommandGuard?: boolean;
}

export type ProjectTimelineCategory =
  | 'browse'
  | 'context'
  | 'mcp'
  | 'role'
  | 'security'
  | 'skillify'
  | 'health'
  | 'change_scope'
  | 'session'
  | 'learned'
  | 'question'
  | 'decision'
  | 'workflow';

export interface ProjectTimelineEvent {
  id: string;
  ts: string;
  workspaceKey: string;
  cwd?: string;
  category: ProjectTimelineCategory;
  event: string;
  source: string;
  status?: 'started' | 'ok' | 'error' | 'blocked' | 'info';
  durationMs?: number;
  summary?: string;
  command?: string;
  toolName?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectLearning {
  id: string;
  ts: string;
  workspaceKey: string;
  cwd?: string;
  type:
    | 'pattern'
    | 'pitfall'
    | 'preference'
    | 'architecture'
    | 'tool'
    | 'operational'
    | 'investigation';
  key: string;
  insight: string;
  confidence: number;
  source: 'observed' | 'user-stated' | 'inferred' | 'cross-model';
  trusted: boolean;
  files?: string[];
  tags?: string[];
  supersedesLearningId?: string;
}

export interface ProjectLearningSearchInput {
  cwd?: string;
  workspaceKey?: string;
  limit?: number;
  query?: string;
  type?: ProjectLearning['type'];
  source?: ProjectLearning['source'];
  trusted?: boolean;
  minConfidence?: number;
  includeSuperseded?: boolean;
  tags?: string[];
}

export interface ProjectLearningStats {
  cwd?: string;
  workspaceKey: string;
  generatedAt: number;
  totalCount: number;
  activeCount: number;
  supersededCount: number;
  trustedCount: number;
  untrustedCount: number;
  averageConfidence: number;
  byType: Record<ProjectLearning['type'], number>;
  bySource: Record<ProjectLearning['source'], number>;
  topTags: Array<{ tag: string; count: number }>;
}

export interface ProjectLearningMaintenanceReport {
  cwd?: string;
  workspaceKey: string;
  generatedAt: number;
  totalCount: number;
  activeCount: number;
  duplicateGroups: Array<{
    type: ProjectLearning['type'];
    key: string;
    count: number;
    latestId: string;
    supersededIds: string[];
  }>;
  staleFileReferences: Array<{ learningId: string; key: string; file: string }>;
  lowConfidence: ProjectLearning[];
  pruneCandidates: Array<{ learning: ProjectLearning; reasons: string[] }>;
  recommendations: string[];
}

export interface ProjectLearningExportInput extends ProjectLearningSearchInput {
  format?: 'markdown';
}

export interface ProjectLearningPruneInput {
  cwd?: string;
  workspaceKey?: string;
  dryRun?: boolean;
  keepLatestPerKey?: boolean;
  removeExplicitlySuperseded?: boolean;
  removeStaleFileReferences?: boolean;
  minConfidence?: number;
}

export interface ProjectLearningPruneResult {
  cwd?: string;
  workspaceKey: string;
  dryRun: boolean;
  filePath: string;
  backupPath?: string;
  beforeCount: number;
  afterCount: number;
  pruned: Array<{ learning: ProjectLearning; reasons: string[] }>;
}

export type WorkflowArtifactKind =
  | 'backlog_spec'
  | 'investigation'
  | 'code_health'
  | 'document_release'
  | 'review_gate'
  | 'implementation_tasks'
  | 'release_summary'
  | 'ship_gate'
  | 'visual_qa'
  | 'canary_monitor'
  | 'browser_skill_evidence'
  | 'devex_audit'
  | 'benchmark_run'
  | 'browser_auth_import'
  | 'feature_blueprint'
  | 'data_model_draft'
  | 'component_tree_draft'
  | 'logic_flow_draft'
  | 'api_contract_draft'
  | 'implementation_plan_dsl'
  | 'patch_proposal'
  | 'diff_review'
  | 'human_review_gate'
  | 'apply_result'
  | 'qa_result'
  | 'rollback_checkpoint'
  | 'concept_application_map';

export type WorkflowArtifactStatus =
  | 'draft'
  | 'ready'
  | 'blocked'
  | 'needs-more-evidence'
  | 'pass'
  | 'warn'
  | 'fail';

export interface WorkflowArtifactEnvelope<T = unknown> {
  id: string;
  kind: WorkflowArtifactKind;
  ts: string;
  workspaceKey: string;
  cwd?: string;
  title: string;
  status: WorkflowArtifactStatus;
  artifact: T;
}

export interface WorkflowArtifactListInput {
  cwd?: string;
  workspaceKey?: string;
  kind?: WorkflowArtifactKind;
  limit?: number;
}

export interface BacklogSpecInput {
  cwd?: string;
  title: string;
  mode?: 'standard' | 'audit' | 'bug' | 'feature' | 'refactor';
  stakeholderContext?: string;
  verifiedCurrentState?: Array<{ file: string; evidence: string }>;
  proposedChange?: string;
  implementationDetails?: string[];
  acceptanceCriteria?: string[];
  testingPlan?: Array<{
    level: 'unit' | 'integration' | 'e2e' | 'manual';
    target: string;
    count?: number;
  }>;
  rollbackPlan?: string;
  outOfScope?: string[];
  recordDecision?: boolean;
}

export interface BacklogSpecArtifact {
  runId: string;
  title: string;
  mode: 'standard' | 'audit' | 'bug' | 'feature' | 'refactor';
  stakeholderContext: string;
  verifiedCurrentState: Array<{ file: string; evidence: string }>;
  proposedChange: string;
  implementationDetails: string[];
  acceptanceCriteria: string[];
  testingPlan: Array<{
    level: 'unit' | 'integration' | 'e2e' | 'manual';
    target: string;
    count?: number;
  }>;
  rollbackPlan?: string;
  outOfScope: string[];
  redactionStatus: 'pass' | 'blocked' | 'redacted';
  readinessScore: number;
  missingFields: string[];
  decisionId?: string;
  issue?: { provider: 'github' | 'gitlab' | 'local'; id: string; url?: string };
}

export interface InvestigationInput {
  cwd?: string;
  symptom: string;
  reproduction?: string;
  hypotheses?: Array<{
    id?: string;
    claim: string;
    evidence?: string[];
    verdict?: 'untested' | 'confirmed' | 'rejected';
  }>;
  rootCause?: string;
  affectedFiles?: string[];
  fixSummary?: string;
  regressionTests?: Array<{
    command: string;
    failedBefore?: boolean;
    passedAfter?: boolean;
  }>;
}

export interface InvestigationArtifact {
  runId: string;
  symptom: string;
  reproduction?: string;
  hypotheses: Array<{
    id: string;
    claim: string;
    evidence: string[];
    verdict: 'untested' | 'confirmed' | 'rejected';
  }>;
  rootCause?: string;
  affectedFiles: string[];
  fixSummary?: string;
  regressionTests: Array<{ command: string; failedBefore: boolean; passedAfter: boolean }>;
  status: 'root-cause-found' | 'fixed' | 'blocked' | 'needs-more-evidence';
  learningId?: string;
}

export interface CodeHealthDimension {
  id: 'typecheck' | 'lint' | 'test' | 'deadcode' | 'shell' | 'docs';
  command?: string;
  status: 'clean' | 'warn' | 'fail' | 'skipped';
  score?: number;
  durationMs?: number;
  outputTail?: string;
  detail?: string;
  recommendedCommand?: string;
}

export interface CodeHealthSnapshot {
  runId: string;
  cwd: string;
  branch: string;
  score: number;
  generatedAt: number;
  dimensions: CodeHealthDimension[];
  recommendations: string[];
}

export interface DocumentCoverageItem {
  id: string;
  label: string;
  path: string;
  diataxis: 'tutorial' | 'how-to' | 'reference' | 'explanation' | 'release-note';
  required: boolean;
  status: 'present' | 'missing';
}

export interface DocumentReleaseCoverageSnapshot {
  runId: string;
  cwd: string;
  generatedAt: number;
  score: number;
  releaseReady: boolean;
  items: DocumentCoverageItem[];
  missingRequired: string[];
  recommendations: string[];
}

export type ReviewGateRole =
  | 'product'
  | 'design'
  | 'engineering'
  | 'dx'
  | 'security'
  | 'qa'
  | 'outside'
  | string;

export type ReviewFindingSeverity = 'blocker' | 'major' | 'minor' | 'nit';
export type ReviewFindingStatus = 'open' | 'resolved' | 'accepted-risk';

export interface ReviewFindingInput {
  role: ReviewGateRole;
  title: string;
  severity: ReviewFindingSeverity;
  status?: ReviewFindingStatus;
  files?: string[];
  rationale?: string;
  recommendation?: string;
}

export interface ReviewGateInput {
  cwd?: string;
  title?: string;
  requiredRoles?: ReviewGateRole[];
  completedRoles?: ReviewGateRole[];
  findings?: ReviewFindingInput[];
  consensus?: string;
  externalReviewUnavailableReason?: string;
}

export interface ReviewFinding {
  id: string;
  role: ReviewGateRole;
  title: string;
  severity: ReviewFindingSeverity;
  status: ReviewFindingStatus;
  files: string[];
  rationale?: string;
  recommendation?: string;
}

export interface ReviewGateArtifact {
  runId: string;
  title: string;
  requiredRoles: ReviewGateRole[];
  completedRoles: ReviewGateRole[];
  missingRoles: ReviewGateRole[];
  findings: ReviewFinding[];
  status: 'pass' | 'warn' | 'fail' | 'blocked';
  blockerCount: number;
  openFindingCount: number;
  consensus?: string;
  externalReviewUnavailableReason?: string;
}

export type ImplementationTaskPriority = 'P1' | 'P2' | 'P3';
export type ImplementationTaskStatus = 'todo' | 'done' | 'blocked';

export interface ImplementationTask {
  id: string;
  title: string;
  priority: ImplementationTaskPriority;
  status: ImplementationTaskStatus;
  sourceArtifactId: string;
  sourceKind: WorkflowArtifactKind;
  component?: string;
  files: string[];
  rationale?: string;
}

export interface ImplementationTasksInput {
  cwd?: string;
  includeCompleted?: boolean;
}

export interface ImplementationTasksArtifact {
  runId: string;
  cwd: string;
  generatedAt: number;
  tasks: ImplementationTask[];
  dedupedCount: number;
  sources: Array<{
    id: string;
    kind: WorkflowArtifactKind;
    title: string;
    status: WorkflowArtifactStatus;
  }>;
}

export interface ReleaseCommandResult {
  command: string;
  status: 'pass' | 'fail' | 'skipped';
  artifactId?: string;
  outputTail?: string;
}

export interface ReleaseSummaryInput {
  cwd?: string;
  title?: string;
  changedFiles?: string[];
  completedCommands?: ReleaseCommandResult[];
  notes?: string[];
}

export interface ReleaseSummaryArtifact {
  runId: string;
  cwd: string;
  title: string;
  generatedAt: number;
  sourceArtifacts: Array<{
    id: string;
    kind: WorkflowArtifactKind;
    title: string;
    status: WorkflowArtifactStatus;
  }>;
  changedFiles: string[];
  completedCommands: ReleaseCommandResult[];
  gateSummary: Array<{
    gate: string;
    status: WorkflowArtifactStatus;
    artifactId?: string;
    detail: string;
  }>;
  outstandingTasks: ImplementationTask[];
  blockers: string[];
  warnings: string[];
  notes: string[];
  prBodyMarkdown: string;
}

export interface ShipGateManualCheck {
  label: string;
  status: 'pass' | 'fail' | 'skipped';
  detail?: string;
}

export interface ShipGateInput {
  cwd?: string;
  requiredArtifactKinds?: WorkflowArtifactKind[];
  maxArtifactAgeMs?: number;
  manualChecks?: ShipGateManualCheck[];
}

export interface ShipGateArtifact {
  runId: string;
  cwd: string;
  generatedAt: number;
  gate: 'pass' | 'warn' | 'fail';
  requiredArtifactKinds: WorkflowArtifactKind[];
  checkedArtifacts: Array<{
    id: string;
    kind: WorkflowArtifactKind;
    title: string;
    status: WorkflowArtifactStatus;
    ageMs: number;
  }>;
  missingKinds: WorkflowArtifactKind[];
  staleArtifacts: Array<{ id: string; kind: WorkflowArtifactKind; ageMs: number }>;
  blockers: string[];
  warnings: string[];
  manualChecks: ShipGateManualCheck[];
  releaseSummaryArtifactId?: string;
}

export type AdvancedQaCheckStatus = 'pass' | 'warn' | 'fail' | 'skipped';

export interface VisualViewportEvidence {
  viewport: 'mobile' | 'tablet' | 'desktop' | 'custom';
  path?: string;
  width?: number;
  height?: number;
  status: AdvancedQaCheckStatus;
  notes?: string;
}

export interface AdvancedQaCheck {
  id: string;
  label: string;
  status: AdvancedQaCheckStatus;
  detail?: string;
  evidencePath?: string;
}

export interface VisualQaInput {
  cwd?: string;
  title?: string;
  targetUrl?: string;
  screenshots?: VisualViewportEvidence[];
  checks?: AdvancedQaCheck[];
  notes?: string[];
}

export interface VisualQaArtifact {
  runId: string;
  cwd: string;
  title: string;
  targetUrl?: string;
  generatedAt: number;
  screenshots: VisualViewportEvidence[];
  checks: AdvancedQaCheck[];
  score: number;
  status: 'pass' | 'warn' | 'fail';
  recommendations: string[];
  notes: string[];
}

export interface CanaryMonitorCheck {
  label: string;
  status: AdvancedQaCheckStatus;
  metric?: 'errorRate' | 'latencyP95' | 'successRate' | 'visualDiff' | string;
  value?: number;
  threshold?: number;
  detail?: string;
}

export interface CanaryMonitorInput {
  cwd?: string;
  title?: string;
  targetUrl?: string;
  baselineArtifactId?: string;
  checks?: CanaryMonitorCheck[];
}

export interface CanaryMonitorArtifact {
  runId: string;
  cwd: string;
  title: string;
  targetUrl?: string;
  baselineArtifactId?: string;
  generatedAt: number;
  checks: CanaryMonitorCheck[];
  status: 'pass' | 'warn' | 'fail';
  recommendations: string[];
}

export interface BrowserSkillEvidenceInput {
  cwd?: string;
  skillName: string;
  stageId?: string;
  host?: string;
  source: 'scrape' | 'timeline' | 'manual';
  successfulRun: boolean;
  commandCount: number;
  requiresReview?: boolean;
  evidence?: string[];
}

export interface BrowserSkillEvidenceArtifact {
  runId: string;
  cwd: string;
  skillName: string;
  stageId?: string;
  host?: string;
  source: 'scrape' | 'timeline' | 'manual';
  successfulRun: boolean;
  commandCount: number;
  requiresReview: boolean;
  evidence: string[];
  status: 'staged' | 'ready' | 'needs-review' | 'blocked';
  recommendations: string[];
}

export interface DevexAuditStep {
  label: string;
  status: AdvancedQaCheckStatus;
  durationMs?: number;
  friction?: string;
}

export interface DevexAuditInput {
  cwd?: string;
  workflowName: string;
  startedAtMs?: number;
  completedAtMs?: number;
  steps?: DevexAuditStep[];
  notes?: string[];
}

export interface DevexAuditArtifact {
  runId: string;
  cwd: string;
  workflowName: string;
  generatedAt: number;
  timeToHelloWorldMs?: number;
  steps: DevexAuditStep[];
  score: number;
  status: 'pass' | 'warn' | 'fail';
  recommendations: string[];
  notes: string[];
}

export interface BenchmarkMetricInput {
  id: string;
  label: string;
  value: number;
  unit: string;
  baseline?: number;
  lowerIsBetter?: boolean;
}

export interface BenchmarkRunInput {
  cwd?: string;
  title?: string;
  target?: 'performance' | 'model' | 'workflow' | string;
  metrics?: BenchmarkMetricInput[];
  notes?: string[];
}

export interface BenchmarkMetricResult extends BenchmarkMetricInput {
  deltaPercent?: number;
  status: 'pass' | 'warn' | 'fail';
}

export interface BenchmarkRunArtifact {
  runId: string;
  cwd: string;
  title: string;
  target: string;
  generatedAt: number;
  metrics: BenchmarkMetricResult[];
  status: 'pass' | 'warn' | 'fail';
  recommendations: string[];
  notes: string[];
}

export interface BrowserAuthImportSummaryInput {
  cwd?: string;
  browser: 'chrome' | 'chromium' | 'edge' | 'unknown';
  mode: 'picker' | 'direct-domain' | 'cdp-already-connected';
  domains: Array<{ domain: string; cookieCount: number }>;
  valuesExposed?: boolean;
}

export interface BrowserAuthImportSummaryArtifact {
  runId: string;
  cwd: string;
  browser: 'chrome' | 'chromium' | 'edge' | 'unknown';
  mode: 'picker' | 'direct-domain' | 'cdp-already-connected';
  domains: Array<{ domain: string; cookieCount: number }>;
  valuesExposed: false;
  generatedAt: number;
  status: 'pass' | 'blocked';
  recommendations: string[];
}

export type ChangeScope =
  | 'frontend'
  | 'backend'
  | 'prompts'
  | 'tests'
  | 'docs'
  | 'config'
  | 'migrations'
  | 'api'
  | 'auth'
  | 'security'
  | 'mcp'
  | 'remote'
  | 'packaging';

export interface ChangeScopeReport {
  cwd: string;
  files: string[];
  scopes: Record<ChangeScope, boolean>;
  recommendedSkills: string[];
  recommendedCommands: string[];
}

export type RoleId =
  | 'product-strategist'
  | 'engineering-architect'
  | 'implementation-engineer'
  | 'product-designer'
  | 'developer-experience'
  | 'security-officer'
  | 'qa-release-steward'
  | 'handoff-compressor'
  | string;

export type RoleTriggerMode = 'automatic' | 'manual' | 'disabled';
export type RoleRunMode = 'lite' | 'review' | 'validation';

export interface RoleHandbook {
  identity: string;
  responsibilities: string[];
  boundaries: string[];
  inputRequirements: string[];
  outputFormat: string[];
  completionCriteria: string[];
  validationCriteria: string[];
  safetyRules: string[];
  decisionAuthority: string[];
}

export interface RoleLocalizedContent {
  name?: string;
  shortName?: string;
  description?: string;
  triggerKeywords?: string[];
  handbook?: Partial<RoleHandbook>;
}

export interface RoleDefinition {
  id: RoleId;
  name: string;
  shortName: string;
  description: string;
  enabled: boolean;
  builtIn: boolean;
  triggerMode: RoleTriggerMode;
  defaultRunMode: RoleRunMode;
  icon?: string;
  color?: string;
  triggerScopes: ChangeScope[];
  triggerKeywords: string[];
  handbook: RoleHandbook;
  locales?: Partial<Record<'en' | 'zh', RoleLocalizedContent>>;
  updatedAt: string;
}

export interface RoleRegistrySnapshot {
  workspaceKey: string;
  cwd?: string;
  roles: RoleDefinition[];
  stats: {
    total: number;
    enabled: number;
    builtIn: number;
    customized: number;
  };
}

export interface A2AAgentSkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface A2AAgentCard {
  protocolVersion: 'fishswarm-a2a-lite/0.1';
  name: string;
  description: string;
  url?: string;
  provider: {
    organization: string;
    url?: string;
  };
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
    artifacts: boolean;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: A2AAgentSkill[];
  metadata: {
    roleId: string;
    roleName: string;
    triggerMode: RoleTriggerMode;
    defaultRunMode: RoleRunMode;
    triggerScopes: ChangeScope[];
    builtIn: boolean;
    enabled: boolean;
  };
}

export type RoleLifecycleStatus =
  | 'gap_detected'
  | 'incubating_role'
  | 'candidate_ready'
  | 'candidate_blocked'
  | 'approval_required'
  | 'queued'
  | 'mounting_handbook'
  | 'online'
  | 'working'
  | 'returned'
  | 'validating'
  | 'accepted'
  | 'needs_revision'
  | 'blocked'
  | 'skipped'
  | 'failed';

export interface RoleLifecycleEvent {
  id: string;
  ts: string;
  sessionId: string;
  taskId: string;
  runId: string;
  roleId: string;
  roleName: string;
  status: RoleLifecycleStatus;
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface RoleRunFinding {
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  title: string;
  evidence?: string;
  recommendation: string;
}

export interface RoleDecisionCandidate {
  title: string;
  recommendation: string;
  requiresUserApproval: boolean;
  rationale?: string;
}

export interface RoleNextAction {
  owner: 'main_ai' | 'user' | 'role';
  roleId?: string;
  action: string;
}

export interface RoleRunArtifact {
  type: 'markdown';
  path: string;
  title: string;
  summary?: string;
}

export interface RoleRunResult {
  runId: string;
  roleId: string;
  roleName: string;
  taskId: string;
  sessionId?: string;
  status: 'completed' | 'needs_revision' | 'blocked' | 'failed';
  summary: string;
  visibleMessage?: string;
  findings: RoleRunFinding[];
  decisions: RoleDecisionCandidate[];
  nextActions: RoleNextAction[];
  validationHints: string[];
  artifacts?: RoleRunArtifact[];
  startedAt: string;
  completedAt: string;
}

export interface ValidationLog {
  validationId: string;
  taskId: string;
  sessionId?: string;
  validatorRoleId: string;
  validatorRoleName: string;
  checkedRoleRunIds: string[];
  verdict: 'passed' | 'needs_revision' | 'blocked';
  summary: string;
  acceptedFindings: string[];
  requiredRework: string[];
  createdAt: string;
}

export type A2ATaskState =
  | 'submitted'
  | 'working'
  | 'input-required'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface A2ATextPart {
  kind: 'text';
  text: string;
}

export interface A2AFilePart {
  kind: 'file';
  file: {
    name: string;
    uri: string;
    mimeType: string;
  };
}

export type A2APart = A2ATextPart | A2AFilePart;

export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

export interface A2AArtifact {
  artifactId: string;
  name: string;
  description?: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}

export interface A2ATask {
  id: string;
  contextId?: string;
  status: {
    state: A2ATaskState;
    message?: A2AMessage;
    timestamp: string;
  };
  history: A2AMessage[];
  artifacts: A2AArtifact[];
  metadata: {
    taskId: string;
    roleId?: string;
    roleName?: string;
    runId?: string;
    validationId?: string;
    validationVerdict?: ValidationLog['verdict'];
  };
}

export type SwarmEventType =
  | 'user.input'
  | 'xiaoyu.intent'
  | 'xiaoyu.dispatch'
  | 'role.online'
  | 'role.plan'
  | 'role.thinking'
  | 'role.tool'
  | 'role.delivery'
  | 'validation.started'
  | 'validation.accepted'
  | 'validation.needs_revision'
  | 'validation.blocked'
  | 'xiaoyu.rework'
  | 'xiaoyu.pause'
  | 'xiaoyu.next_role'
  | 'xiaoyu.final';

export type SwarmEventStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'needs_revision'
  | 'blocked'
  | 'failed';

export interface SwarmEvent {
  id: string;
  runId: string;
  parentRunId?: string;
  sessionId?: string;
  type: SwarmEventType;
  speaker: 'user' | 'xiaoyu' | string;
  target?: string;
  roleId?: string;
  roleName?: string;
  taskId?: string;
  validationId?: string;
  status?: SwarmEventStatus;
  content: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface RoleRuntimeSnapshot {
  workspaceKey: string;
  cwd?: string;
  sessionId?: string;
  activeEvents: RoleLifecycleEvent[];
  recentRuns: RoleRunResult[];
  validationLogs: ValidationLog[];
  swarmEvents: SwarmEvent[];
}

export type RoleCandidateStatus =
  | 'draft'
  | 'ready'
  | 'blocked'
  | 'used_once'
  | 'accepted'
  | 'rejected';

export type RoleCandidateRiskLevel = 'low' | 'medium' | 'high';

export interface RoleCapabilityGap {
  id: string;
  taskId: string;
  sessionId?: string;
  taskTextPreview: string;
  missingCapabilities: string[];
  attemptedRoleIds: string[];
  adequacyScore: number;
  confidence: number;
  reason: string;
  createdAt: string;
}

export interface RoleCapabilityAssessment {
  taskId: string;
  sessionId?: string;
  requiredCapabilities: string[];
  routedRoleScores: Array<{
    roleId: string;
    roleName: string;
    score: number;
    matchedCapabilities: string[];
    missingCapabilities: string[];
    reasons: string[];
  }>;
  bestScore: number;
  adequate: boolean;
  threshold: number;
}

export interface RoleCandidateSource {
  kind: 'local_synthesis' | 'web_research' | 'mcp_search' | 'browser_skill' | 'manual';
  title: string;
  url?: string;
  sanitizedExcerpt?: string;
  verdict: 'allow' | 'warn' | 'block';
  reasons: string[];
}

export interface RoleCandidate {
  candidateId: string;
  workspaceKey: string;
  cwd?: string;
  gap: RoleCapabilityGap;
  role: RoleDefinition;
  status: RoleCandidateStatus;
  riskLevel: RoleCandidateRiskLevel;
  requiresUserApproval: boolean;
  sourceSummary: string;
  sources: RoleCandidateSource[];
  blockedReasons: string[];
  createdAt: string;
  updatedAt: string;
  usedAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
}

export interface RoleCandidateSnapshot {
  workspaceKey: string;
  cwd?: string;
  candidates: RoleCandidate[];
}

export interface IncubateRoleInput {
  cwd?: string;
  sessionId: string;
  taskId?: string;
  taskText: string;
  context?: string;
  attemptedRoleIds?: string[];
  allowResearch?: boolean;
}

export interface IncubateRoleResult {
  gap: RoleCapabilityGap | null;
  assessment?: RoleCapabilityAssessment;
  candidate: RoleCandidate | null;
  reason: string;
}

export interface RoleRuntimeExecutionResult {
  taskId: string;
  routedRoleIds: string[];
  results: RoleRunResult[];
  validationLogs?: ValidationLog[];
  gap?: RoleCapabilityGap;
  assessment?: RoleCapabilityAssessment;
  candidate?: RoleCandidate;
  incubationStatus:
    | 'not_needed'
    | 'no_gap'
    | 'candidate_created'
    | 'candidate_used_once'
    | 'candidate_blocked'
    | 'approval_required'
    | 'research_failed';
  userVisibleSummary?: string;
}

export interface SaveRoleCandidateInput {
  cwd?: string;
  candidateId: string;
  editedRole?: RoleDefinition;
}

export interface RejectRoleCandidateInput {
  cwd?: string;
  candidateId: string;
  reason?: string;
}

export interface SaveRoleInput {
  cwd?: string;
  role: RoleDefinition;
}

export interface ResetRoleInput {
  cwd?: string;
  roleId: string;
}

export interface HealthCheckItem {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'error';
  detail?: string;
}

export interface HealthSummary {
  score: number;
  generatedAt: number;
  checks: HealthCheckItem[];
}

export interface BrowserSkillifyInput {
  cwd: string;
  name: string;
  description?: string;
  trigger?: string;
  limit?: number;
}

export interface BrowserSkillifyResult {
  skillName: string;
  skillDir: string;
  skillPath: string;
  workflowPath: string;
  stageId: string;
  commandCount: number;
  requiresReview: boolean;
  status: 'staged';
}

export type BrowserSkillTier = 'project' | 'global' | 'bundled';

export interface BrowserSkillFrontmatter {
  name: string;
  description?: string;
  host?: string;
  triggers: string[];
  args: Array<{ name: string; description?: string }>;
  trusted: boolean;
  enabled: boolean;
  version?: string;
  source?: 'human' | 'agent';
}

export interface BrowserSkillEntry {
  name: string;
  tier: BrowserSkillTier;
  dir: string;
  skillPath: string;
  workflowPath: string;
  frontmatter: BrowserSkillFrontmatter;
  bodyMd: string;
  enabled: boolean;
  trusted: boolean;
  testable: boolean;
  runnable: boolean;
  requiresReview: boolean;
  commandCount: number;
  lastModified: number;
}

export interface BrowserSkillDraft {
  stageId: string;
  skillName: string;
  stagedDir: string;
  skillPath: string;
  workflowPath: string;
  commandCount: number;
  requiresReview: boolean;
  createdAt: number;
}

export interface BrowserSkillRuntimeSnapshot {
  skills: BrowserSkillEntry[];
  drafts: BrowserSkillDraft[];
}

export interface BrowserSkillTestResult {
  ok: boolean;
  skillName: string;
  checkedAt: number;
  commandCount: number;
  browseAvailable: boolean;
  warnings: string[];
  errors: string[];
}

export interface BrowserSkillRunResult {
  ok: boolean;
  skillName: string;
  startedAt: number;
  durationMs: number;
  stepCount: number;
  stdout: string;
  stderr: string;
  warnings: string[];
  error?: string;
}

export type QuestionCategory =
  | 'approval'
  | 'clarification'
  | 'routing'
  | 'cherry-pick'
  | 'feedback-loop';
export type QuestionDoorType = 'one-way' | 'two-way';
export type QuestionPreference = 'always-ask' | 'never-ask' | 'ask-only-for-one-way';
export type QuestionPreferenceSource =
  | 'settings'
  | 'permission-dialog'
  | 'inline-user'
  | 'plan-tune';
export type QuestionChoice = 'allow' | 'deny' | 'defer' | 'skip' | 'accept' | 'reject';

export interface QuestionDefinition {
  id: string;
  label: string;
  category: QuestionCategory;
  doorType: QuestionDoorType;
  description: string;
  defaultChoice?: QuestionChoice;
}

export interface QuestionPreferenceRecord {
  questionId: string;
  preference: QuestionPreference;
  source: QuestionPreferenceSource;
  updatedAt: string;
  note?: string;
}

export interface QuestionEvent {
  id: string;
  ts: string;
  workspaceKey: string;
  cwd?: string;
  questionId: string;
  event:
    | 'asked'
    | 'answered'
    | 'auto_decided'
    | 'preference_set'
    | 'preference_rejected'
    | 'preference_cleared';
  category: QuestionCategory;
  doorType: QuestionDoorType;
  summary: string;
  choice?: QuestionChoice;
  result?: string;
  preference?: QuestionPreference;
  source: string;
  oneWay: boolean;
  reason?: string;
}

export interface QuestionPolicySnapshot {
  workspaceKey: string;
  cwd?: string;
  preferences: QuestionPreferenceRecord[];
  recentEvents: QuestionEvent[];
  registry: QuestionDefinition[];
  stats: {
    preferences: number;
    events: number;
    oneWayEvents: number;
    autoDecisions: number;
  };
}

export type DecisionEventKind = 'decide' | 'supersede' | 'redact';
export type DecisionScope = 'repo' | 'branch' | 'issue';
export type DecisionSource = 'user' | 'agent' | 'skill';

export interface DecisionEvent {
  id: string;
  kind: DecisionEventKind;
  decision?: string;
  rationale?: string;
  alternatives?: string;
  supersedes?: string;
  scope: DecisionScope;
  branch?: string;
  issue?: string;
  date: string;
  sessionId?: string;
  source: DecisionSource;
  confidence?: number;
  workspaceKey: string;
  cwd?: string;
}

export interface ActiveDecision extends DecisionEvent {
  kind: 'decide';
}

export interface AddDecisionInput {
  cwd?: string;
  decision: string;
  rationale?: string;
  alternatives?: string;
  scope?: DecisionScope;
  branch?: string;
  issue?: string;
  sessionId?: string;
  source?: DecisionSource;
  confidence?: number;
}

export interface DecisionStoreSnapshot {
  workspaceKey: string;
  cwd?: string;
  active: ActiveDecision[];
  events: DecisionEvent[];
  stats: {
    active: number;
    events: number;
    superseded: number;
    redacted: number;
  };
}
