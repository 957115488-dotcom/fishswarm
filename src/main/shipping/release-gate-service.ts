import { randomUUID } from 'crypto';
import type {
  BacklogSpecArtifact,
  ImplementationTask,
  ImplementationTasksArtifact,
  ImplementationTasksInput,
  InvestigationArtifact,
  ReleaseCommandResult,
  ReleaseSummaryArtifact,
  ReleaseSummaryInput,
  ReviewFinding,
  ReviewFindingInput,
  ReviewFindingSeverity,
  ReviewGateArtifact,
  ReviewGateInput,
  ReviewGateRole,
  ShipGateArtifact,
  ShipGateInput,
  WorkflowArtifactEnvelope,
  WorkflowArtifactKind,
  WorkflowArtifactStatus,
} from '../../shared/ipc-types';
import { listWorkflowArtifacts, saveWorkflowArtifact } from '../workflows/workflow-artifact-store';

const DEFAULT_REVIEW_ROLES: ReviewGateRole[] = [
  'product',
  'design',
  'engineering',
  'dx',
  'security',
  'qa',
];

const DEFAULT_SHIP_REQUIRED_ARTIFACTS: WorkflowArtifactKind[] = [
  'backlog_spec',
  'review_gate',
  'code_health',
  'document_release',
  'release_summary',
];

const DEFAULT_MAX_ARTIFACT_AGE_MS = 24 * 60 * 60 * 1000;

export function createReviewGateArtifact(
  input: ReviewGateInput
): WorkflowArtifactEnvelope<ReviewGateArtifact> {
  const requiredRoles = uniqueRoles(
    input.requiredRoles?.length ? input.requiredRoles : DEFAULT_REVIEW_ROLES
  );
  const findings = (input.findings || []).map(normalizeFinding);
  const completedRoles = uniqueRoles([
    ...(input.completedRoles || []),
    ...findings.map((finding) => finding.role),
  ]);
  const missingRoles = requiredRoles.filter((role) => !completedRoles.includes(role));
  const blockerCount = findings.filter(
    (finding) => finding.severity === 'blocker' && finding.status === 'open'
  ).length;
  const openFindingCount = findings.filter((finding) => finding.status === 'open').length;
  const artifact: ReviewGateArtifact = {
    runId: randomUUID(),
    title: cleanText(input.title || 'Release review gate', 180),
    requiredRoles,
    completedRoles,
    missingRoles,
    findings,
    status: 'pass',
    blockerCount,
    openFindingCount,
    consensus: input.consensus ? cleanText(input.consensus, 2000) : undefined,
    externalReviewUnavailableReason: input.externalReviewUnavailableReason
      ? cleanText(input.externalReviewUnavailableReason, 1000)
      : undefined,
  };
  artifact.status = getReviewGateStatus(artifact);

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'review_gate',
    title: artifact.title,
    status: mapReviewStatus(artifact.status),
    artifact,
  });
}

export function createImplementationTasksArtifact(
  input: ImplementationTasksInput = {}
): WorkflowArtifactEnvelope<ImplementationTasksArtifact> {
  const sourceArtifacts = listWorkflowArtifacts({ cwd: input.cwd, limit: 80 }).filter((artifact) =>
    ['backlog_spec', 'investigation', 'review_gate'].includes(artifact.kind)
  );
  const rawTasks = sourceArtifacts.flatMap((artifact) => tasksFromArtifact(artifact));
  const { tasks, dedupedCount } = dedupeTasks(rawTasks);
  const filtered = input.includeCompleted ? tasks : tasks.filter((task) => task.status !== 'done');
  const artifact: ImplementationTasksArtifact = {
    runId: randomUUID(),
    cwd: input.cwd || process.cwd(),
    generatedAt: Date.now(),
    tasks: filtered.sort(sortTasks),
    dedupedCount,
    sources: sourceArtifacts.map(toSourceSummary),
  };

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'implementation_tasks',
    title: `${artifact.tasks.length} implementation task(s)`,
    status: artifact.tasks.some((task) => task.priority === 'P1' && task.status !== 'done')
      ? 'warn'
      : 'pass',
    artifact,
  });
}

export function createReleaseSummaryArtifact(
  input: ReleaseSummaryInput = {}
): WorkflowArtifactEnvelope<ReleaseSummaryArtifact> {
  const sourceArtifacts = [
    latestArtifact(input.cwd, 'backlog_spec'),
    latestArtifact(input.cwd, 'review_gate'),
    latestArtifact(input.cwd, 'code_health'),
    latestArtifact(input.cwd, 'document_release'),
    latestArtifact(input.cwd, 'implementation_tasks'),
  ].filter((artifact): artifact is WorkflowArtifactEnvelope => artifact !== null);
  const tasks =
    (
      sourceArtifacts.find((artifact) => artifact.kind === 'implementation_tasks')?.artifact as
        | ImplementationTasksArtifact
        | undefined
    )?.tasks || [];
  const gateSummary = buildGateSummary(sourceArtifacts, input.completedCommands || []);
  const blockers = collectReleaseBlockers(sourceArtifacts, input.completedCommands || []);
  const warnings = collectReleaseWarnings(sourceArtifacts, tasks);
  const artifact: ReleaseSummaryArtifact = {
    runId: randomUUID(),
    cwd: input.cwd || process.cwd(),
    title: cleanText(input.title || 'Release summary', 180),
    generatedAt: Date.now(),
    sourceArtifacts: sourceArtifacts.map(toSourceSummary),
    changedFiles: cleanList(input.changedFiles, 100, 240),
    completedCommands: (input.completedCommands || []).map(normalizeCommandResult),
    gateSummary,
    outstandingTasks: tasks.filter((task) => task.status !== 'done'),
    blockers,
    warnings,
    notes: cleanList(input.notes, 20, 1000),
    prBodyMarkdown: '',
  };
  artifact.prBodyMarkdown = renderPrBodyMarkdown(artifact);

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'release_summary',
    title: artifact.title,
    status: blockers.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
    artifact,
  });
}

export function evaluateShipGate(
  input: ShipGateInput = {}
): WorkflowArtifactEnvelope<ShipGateArtifact> {
  const requiredArtifactKinds = input.requiredArtifactKinds?.length
    ? input.requiredArtifactKinds
    : DEFAULT_SHIP_REQUIRED_ARTIFACTS;
  const maxArtifactAgeMs = input.maxArtifactAgeMs || DEFAULT_MAX_ARTIFACT_AGE_MS;
  const generatedAt = Date.now();
  const checkedArtifacts = requiredArtifactKinds
    .map((kind) => latestArtifact(input.cwd, kind))
    .filter((artifact): artifact is WorkflowArtifactEnvelope => artifact !== null)
    .map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      status: artifact.status,
      ageMs: Math.max(0, generatedAt - Date.parse(artifact.ts)),
    }));
  const foundKinds = new Set(checkedArtifacts.map((artifact) => artifact.kind));
  const missingKinds = requiredArtifactKinds.filter((kind) => !foundKinds.has(kind));
  const staleArtifacts = checkedArtifacts
    .filter((artifact) => artifact.ageMs > maxArtifactAgeMs)
    .map((artifact) => ({ id: artifact.id, kind: artifact.kind, ageMs: artifact.ageMs }));
  const manualChecks = input.manualChecks || [];
  const blockers = [
    ...missingKinds.map((kind) => `Missing required artifact: ${kind}`),
    ...staleArtifacts.map((artifact) => `Stale artifact: ${artifact.kind} (${artifact.id})`),
    ...checkedArtifacts
      .filter((artifact) => artifact.status === 'fail' || artifact.status === 'blocked')
      .map((artifact) => `${artifact.kind} is ${artifact.status}: ${artifact.title}`),
    ...manualChecks
      .filter((check) => check.status === 'fail')
      .map((check) => `Manual check failed: ${check.label}`),
  ];
  const warnings = [
    ...checkedArtifacts
      .filter((artifact) => ['draft', 'needs-more-evidence', 'warn'].includes(artifact.status))
      .map((artifact) => `${artifact.kind} is ${artifact.status}: ${artifact.title}`),
    ...manualChecks
      .filter((check) => check.status === 'skipped')
      .map((check) => `Manual check skipped: ${check.label}`),
  ];
  const releaseSummaryArtifact = checkedArtifacts.find(
    (artifact) => artifact.kind === 'release_summary'
  );
  const artifact: ShipGateArtifact = {
    runId: randomUUID(),
    cwd: input.cwd || process.cwd(),
    generatedAt,
    gate: blockers.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass',
    requiredArtifactKinds,
    checkedArtifacts,
    missingKinds,
    staleArtifacts,
    blockers,
    warnings,
    manualChecks,
    releaseSummaryArtifactId: releaseSummaryArtifact?.id,
  };

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'ship_gate',
    title: `Ship gate ${artifact.gate}`,
    status: artifact.gate === 'pass' ? 'pass' : artifact.gate === 'warn' ? 'warn' : 'fail',
    artifact,
  });
}

function latestArtifact(
  cwd: string | undefined,
  kind: WorkflowArtifactKind
): WorkflowArtifactEnvelope | null {
  return listWorkflowArtifacts({ cwd, kind, limit: 1 })[0] || null;
}

function normalizeFinding(input: ReviewFindingInput, index: number): ReviewFinding {
  return {
    id: `finding-${index + 1}`,
    role: cleanRole(input.role),
    title: cleanText(input.title, 500),
    severity: input.severity,
    status: input.status || 'open',
    files: cleanList(input.files, 50, 240),
    rationale: input.rationale ? cleanText(input.rationale, 1000) : undefined,
    recommendation: input.recommendation ? cleanText(input.recommendation, 1000) : undefined,
  };
}

function getReviewGateStatus(artifact: ReviewGateArtifact): ReviewGateArtifact['status'] {
  if (artifact.missingRoles.length > 0) return 'blocked';
  if (artifact.blockerCount > 0) return 'fail';
  if (
    artifact.findings.some((finding) => finding.status === 'open' && finding.severity !== 'nit')
  ) {
    return 'warn';
  }
  return 'pass';
}

function mapReviewStatus(status: ReviewGateArtifact['status']): WorkflowArtifactStatus {
  if (status === 'blocked') return 'blocked';
  if (status === 'fail') return 'fail';
  if (status === 'warn') return 'warn';
  return 'pass';
}

function tasksFromArtifact(artifact: WorkflowArtifactEnvelope): ImplementationTask[] {
  if (artifact.kind === 'backlog_spec') {
    const spec = artifact.artifact as BacklogSpecArtifact;
    return [
      ...spec.implementationDetails.map((detail, index) =>
        buildTask(artifact, `Implement: ${detail}`, 'P2', [], `implementation-${index + 1}`)
      ),
      ...spec.acceptanceCriteria.map((criterion, index) =>
        buildTask(artifact, `Verify: ${criterion}`, 'P2', [], `acceptance-${index + 1}`)
      ),
    ];
  }
  if (artifact.kind === 'investigation') {
    const investigation = artifact.artifact as InvestigationArtifact;
    if (investigation.status === 'fixed') return [];
    return [
      buildTask(
        artifact,
        investigation.rootCause
          ? `Fix root cause: ${investigation.rootCause}`
          : `Investigate: ${investigation.symptom}`,
        investigation.rootCause ? 'P1' : 'P2',
        investigation.affectedFiles,
        'investigation'
      ),
    ];
  }
  if (artifact.kind === 'review_gate') {
    const review = artifact.artifact as ReviewGateArtifact;
    return review.findings
      .filter((finding) => finding.status === 'open')
      .map((finding, index) =>
        buildTask(
          artifact,
          `${finding.role}: ${finding.title}`,
          priorityFromSeverity(finding.severity),
          finding.files,
          `finding-${index + 1}`,
          finding.recommendation || finding.rationale
        )
      );
  }
  return [];
}

function buildTask(
  artifact: WorkflowArtifactEnvelope,
  title: string,
  priority: ImplementationTask['priority'],
  files: string[],
  suffix: string,
  rationale?: string
): ImplementationTask {
  return {
    id: `${artifact.id.slice(0, 8)}-${suffix}`,
    title: cleanText(title, 500),
    priority,
    status: 'todo',
    sourceArtifactId: artifact.id,
    sourceKind: artifact.kind,
    files: cleanList(files, 50, 240),
    rationale: rationale ? cleanText(rationale, 1000) : undefined,
  };
}

function dedupeTasks(tasks: ImplementationTask[]): {
  tasks: ImplementationTask[];
  dedupedCount: number;
} {
  const seen = new Map<string, ImplementationTask>();
  let dedupedCount = 0;
  for (const task of tasks) {
    const key = `${task.title.toLowerCase()}::${task.files.slice().sort().join(',')}`;
    if (seen.has(key)) {
      dedupedCount += 1;
      continue;
    }
    seen.set(key, task);
  }
  return { tasks: Array.from(seen.values()), dedupedCount };
}

function buildGateSummary(
  sourceArtifacts: WorkflowArtifactEnvelope[],
  commands: ReleaseCommandResult[]
): ReleaseSummaryArtifact['gateSummary'] {
  return [
    ...sourceArtifacts.map((artifact) => ({
      gate: artifact.kind,
      status: artifact.status,
      artifactId: artifact.id,
      detail: artifact.title,
    })),
    ...commands.map((command) => ({
      gate: command.command,
      status: mapCommandStatus(command.status),
      artifactId: command.artifactId,
      detail: command.outputTail || command.status,
    })),
  ];
}

function mapCommandStatus(status: ReleaseCommandResult['status']): WorkflowArtifactStatus {
  if (status === 'pass') return 'pass';
  if (status === 'fail') return 'fail';
  return 'warn';
}

function collectReleaseBlockers(
  sourceArtifacts: WorkflowArtifactEnvelope[],
  commands: ReleaseCommandResult[]
): string[] {
  return [
    ...sourceArtifacts
      .filter((artifact) => artifact.status === 'fail' || artifact.status === 'blocked')
      .map((artifact) => `${artifact.kind} is ${artifact.status}: ${artifact.title}`),
    ...commands
      .filter((command) => command.status === 'fail')
      .map((command) => `Command failed: ${command.command}`),
  ];
}

function collectReleaseWarnings(
  sourceArtifacts: WorkflowArtifactEnvelope[],
  tasks: ImplementationTask[]
): string[] {
  const warnings = sourceArtifacts
    .filter((artifact) => ['draft', 'needs-more-evidence', 'warn'].includes(artifact.status))
    .map((artifact) => `${artifact.kind} is ${artifact.status}: ${artifact.title}`);
  const p1Tasks = tasks.filter((task) => task.priority === 'P1' && task.status !== 'done');
  if (p1Tasks.length > 0) warnings.push(`${p1Tasks.length} P1 implementation task(s) remain open.`);
  return warnings;
}

function renderPrBodyMarkdown(artifact: ReleaseSummaryArtifact): string {
  const lines = [
    `# ${artifact.title}`,
    '',
    '## Gate Summary',
    ...artifact.gateSummary.map(
      (gate) => `- ${gate.gate}: ${gate.status}${gate.artifactId ? ` (${gate.artifactId})` : ''}`
    ),
    '',
    '## Verification',
    ...(artifact.completedCommands.length > 0
      ? artifact.completedCommands.map((command) => `- ${command.command}: ${command.status}`)
      : ['- No verification commands recorded.']),
    '',
    '## Blockers',
    ...(artifact.blockers.length > 0 ? artifact.blockers.map((item) => `- ${item}`) : ['- None']),
    '',
    '## Open Tasks',
    ...(artifact.outstandingTasks.length > 0
      ? artifact.outstandingTasks.map((task) => `- ${task.priority}: ${task.title}`)
      : ['- None']),
  ];
  if (artifact.notes.length > 0) {
    lines.push('', '## Notes', ...artifact.notes.map((note) => `- ${note}`));
  }
  return `${lines.join('\n')}\n`;
}

function normalizeCommandResult(command: ReleaseCommandResult): ReleaseCommandResult {
  return {
    command: cleanText(command.command, 500),
    status: command.status,
    artifactId: command.artifactId ? cleanText(command.artifactId, 120) : undefined,
    outputTail: command.outputTail ? cleanText(command.outputTail, 1000) : undefined,
  };
}

function priorityFromSeverity(severity: ReviewFindingSeverity): ImplementationTask['priority'] {
  if (severity === 'blocker') return 'P1';
  if (severity === 'major') return 'P2';
  return 'P3';
}

function toSourceSummary(artifact: WorkflowArtifactEnvelope): {
  id: string;
  kind: WorkflowArtifactKind;
  title: string;
  status: WorkflowArtifactStatus;
} {
  return {
    id: artifact.id,
    kind: artifact.kind,
    title: artifact.title,
    status: artifact.status,
  };
}

function sortTasks(a: ImplementationTask, b: ImplementationTask): number {
  const priorityScore = { P1: 0, P2: 1, P3: 2 } as const;
  return priorityScore[a.priority] - priorityScore[b.priority] || a.title.localeCompare(b.title);
}

function uniqueRoles(roles: ReviewGateRole[]): ReviewGateRole[] {
  return Array.from(new Set(roles.map(cleanRole))).filter(Boolean);
}

function cleanRole(role: ReviewGateRole): ReviewGateRole {
  return cleanText(String(role), 80).replace(/\s+/g, '-').toLowerCase();
}

function cleanList(value: string[] | undefined, maxItems: number, maxLength: number): string[] {
  return (value || [])
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...[truncated]` : text;
}
