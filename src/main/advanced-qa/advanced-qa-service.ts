import { randomUUID } from 'crypto';
import type {
  AdvancedQaCheck,
  AdvancedQaCheckStatus,
  BenchmarkMetricInput,
  BenchmarkMetricResult,
  BenchmarkRunArtifact,
  BenchmarkRunInput,
  BrowserAuthImportSummaryArtifact,
  BrowserAuthImportSummaryInput,
  BrowserSkillEvidenceArtifact,
  BrowserSkillEvidenceInput,
  CanaryMonitorArtifact,
  CanaryMonitorInput,
  DevexAuditArtifact,
  DevexAuditInput,
  DevexAuditStep,
  VisualQaArtifact,
  VisualQaInput,
  VisualViewportEvidence,
  WorkflowArtifactEnvelope,
  WorkflowArtifactStatus,
} from '../../shared/ipc-types';
import { saveWorkflowArtifact } from '../workflows/workflow-artifact-store';

export function createVisualQaArtifact(
  input: VisualQaInput
): WorkflowArtifactEnvelope<VisualQaArtifact> {
  const screenshots = (input.screenshots || []).map(normalizeScreenshot);
  const checks = (input.checks || []).map(normalizeCheck);
  const status = summarizeStatus([
    ...screenshots.map((item) => item.status),
    ...checks.map((item) => item.status),
  ]);
  const artifact: VisualQaArtifact = {
    runId: randomUUID(),
    cwd: input.cwd || process.cwd(),
    title: cleanText(input.title || 'Visual QA evidence', 180),
    targetUrl: input.targetUrl ? cleanText(input.targetUrl, 500) : undefined,
    generatedAt: Date.now(),
    screenshots,
    checks,
    score: scoreStatuses([
      ...screenshots.map((item) => item.status),
      ...checks.map((item) => item.status),
    ]),
    status,
    recommendations: visualRecommendations(screenshots, checks),
    notes: cleanList(input.notes, 20, 1000),
  };

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'visual_qa',
    title: artifact.title,
    status: mapPassWarnFail(status),
    artifact,
  });
}

export function createCanaryMonitorArtifact(
  input: CanaryMonitorInput
): WorkflowArtifactEnvelope<CanaryMonitorArtifact> {
  const checks = (input.checks || []).map((check) => ({
    label: cleanText(check.label, 180),
    status: check.status,
    metric: check.metric ? cleanText(check.metric, 80) : undefined,
    value: check.value,
    threshold: check.threshold,
    detail: check.detail ? cleanText(check.detail, 500) : undefined,
  }));
  const status = summarizeStatus(checks.map((check) => check.status));
  const artifact: CanaryMonitorArtifact = {
    runId: randomUUID(),
    cwd: input.cwd || process.cwd(),
    title: cleanText(input.title || 'Canary monitor', 180),
    targetUrl: input.targetUrl ? cleanText(input.targetUrl, 500) : undefined,
    baselineArtifactId: input.baselineArtifactId
      ? cleanText(input.baselineArtifactId, 120)
      : undefined,
    generatedAt: Date.now(),
    checks,
    status,
    recommendations: canaryRecommendations(checks, input.baselineArtifactId),
  };

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'canary_monitor',
    title: artifact.title,
    status: mapPassWarnFail(status),
    artifact,
  });
}

export function createBrowserSkillEvidenceArtifact(
  input: BrowserSkillEvidenceInput
): WorkflowArtifactEnvelope<BrowserSkillEvidenceArtifact> {
  const requiresReview = input.requiresReview === true;
  const status = getBrowserSkillEvidenceStatus(
    input.successfulRun,
    input.commandCount,
    requiresReview
  );
  const artifact: BrowserSkillEvidenceArtifact = {
    runId: randomUUID(),
    cwd: input.cwd || process.cwd(),
    skillName: normalizeSkillName(input.skillName),
    stageId: input.stageId ? cleanText(input.stageId, 120) : undefined,
    host: input.host ? cleanText(input.host, 240) : undefined,
    source: input.source,
    successfulRun: input.successfulRun,
    commandCount: Math.max(0, Math.round(input.commandCount)),
    requiresReview,
    evidence: cleanList(input.evidence, 40, 1000),
    status,
    recommendations: browserSkillRecommendations(
      input.successfulRun,
      input.commandCount,
      requiresReview
    ),
  };

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'browser_skill_evidence',
    title: `Browser skill evidence: ${artifact.skillName}`,
    status: status === 'ready' ? 'pass' : status === 'blocked' ? 'fail' : 'warn',
    artifact,
  });
}

export function createDevexAuditArtifact(
  input: DevexAuditInput
): WorkflowArtifactEnvelope<DevexAuditArtifact> {
  const steps = (input.steps || []).map(normalizeDevexStep);
  const timeToHelloWorldMs =
    input.startedAtMs !== undefined && input.completedAtMs !== undefined
      ? Math.max(0, Math.round(input.completedAtMs - input.startedAtMs))
      : undefined;
  const baseScore = scoreStatuses(steps.map((step) => step.status));
  const score =
    timeToHelloWorldMs === undefined ? baseScore : applyTthwPenalty(baseScore, timeToHelloWorldMs);
  const status = score >= 85 ? 'pass' : score >= 60 ? 'warn' : 'fail';
  const artifact: DevexAuditArtifact = {
    runId: randomUUID(),
    cwd: input.cwd || process.cwd(),
    workflowName: cleanText(input.workflowName, 180),
    generatedAt: Date.now(),
    timeToHelloWorldMs,
    steps,
    score,
    status,
    recommendations: devexRecommendations(steps, timeToHelloWorldMs),
    notes: cleanList(input.notes, 20, 1000),
  };

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'devex_audit',
    title: `DevEx audit: ${artifact.workflowName}`,
    status: mapPassWarnFail(status),
    artifact,
  });
}

export function createBenchmarkRunArtifact(
  input: BenchmarkRunInput
): WorkflowArtifactEnvelope<BenchmarkRunArtifact> {
  const metrics = (input.metrics || []).map(normalizeBenchmarkMetric);
  const status = summarizeBenchmarkStatus(metrics);
  const artifact: BenchmarkRunArtifact = {
    runId: randomUUID(),
    cwd: input.cwd || process.cwd(),
    title: cleanText(input.title || 'Benchmark run', 180),
    target: cleanText(input.target || 'workflow', 80),
    generatedAt: Date.now(),
    metrics,
    status,
    recommendations: benchmarkRecommendations(metrics),
    notes: cleanList(input.notes, 20, 1000),
  };

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'benchmark_run',
    title: artifact.title,
    status: mapPassWarnFail(status),
    artifact,
  });
}

export function createBrowserAuthImportSummaryArtifact(
  input: BrowserAuthImportSummaryInput
): WorkflowArtifactEnvelope<BrowserAuthImportSummaryArtifact> {
  const attemptedValueExposure = input.valuesExposed === true;
  const domains = input.domains
    .map((domain) => ({
      domain: sanitizeDomain(domain.domain),
      cookieCount: Math.max(0, Math.round(domain.cookieCount)),
    }))
    .filter((domain) => domain.domain)
    .slice(0, 100);
  const artifact: BrowserAuthImportSummaryArtifact = {
    runId: randomUUID(),
    cwd: input.cwd || process.cwd(),
    browser: input.browser,
    mode: input.mode,
    domains,
    valuesExposed: false,
    generatedAt: Date.now(),
    status: attemptedValueExposure ? 'blocked' : 'pass',
    recommendations: attemptedValueExposure
      ? ['Do not persist or display cookie values; retry with domain and count summaries only.']
      : ['Cookie import summary preserved privacy boundary: domains and counts only.'],
  };

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'browser_auth_import',
    title: `Browser auth import: ${artifact.browser}`,
    status: artifact.status === 'pass' ? 'pass' : 'blocked',
    artifact,
  });
}

function normalizeScreenshot(input: VisualViewportEvidence): VisualViewportEvidence {
  return {
    viewport: input.viewport,
    path: input.path ? cleanText(input.path, 500) : undefined,
    width: input.width === undefined ? undefined : Math.max(0, Math.round(input.width)),
    height: input.height === undefined ? undefined : Math.max(0, Math.round(input.height)),
    status: input.status,
    notes: input.notes ? cleanText(input.notes, 500) : undefined,
  };
}

function normalizeCheck(input: AdvancedQaCheck): AdvancedQaCheck {
  return {
    id: cleanText(input.id, 80).replace(/[^a-zA-Z0-9_-]+/g, '-'),
    label: cleanText(input.label, 180),
    status: input.status,
    detail: input.detail ? cleanText(input.detail, 500) : undefined,
    evidencePath: input.evidencePath ? cleanText(input.evidencePath, 500) : undefined,
  };
}

function normalizeDevexStep(input: DevexAuditStep): DevexAuditStep {
  return {
    label: cleanText(input.label, 180),
    status: input.status,
    durationMs:
      input.durationMs === undefined ? undefined : Math.max(0, Math.round(input.durationMs)),
    friction: input.friction ? cleanText(input.friction, 500) : undefined,
  };
}

function normalizeBenchmarkMetric(input: BenchmarkMetricInput): BenchmarkMetricResult {
  const baseline = input.baseline;
  const deltaPercent =
    baseline === undefined || baseline === 0
      ? undefined
      : Math.round(((input.value - baseline) / Math.abs(baseline)) * 1000) / 10;
  return {
    id: cleanText(input.id, 80).replace(/[^a-zA-Z0-9_-]+/g, '-'),
    label: cleanText(input.label, 180),
    value: input.value,
    unit: cleanText(input.unit, 40),
    baseline,
    lowerIsBetter: input.lowerIsBetter,
    deltaPercent,
    status: benchmarkMetricStatus(input, deltaPercent),
  };
}

function benchmarkMetricStatus(
  input: BenchmarkMetricInput,
  deltaPercent: number | undefined
): BenchmarkMetricResult['status'] {
  if (deltaPercent === undefined) return 'pass';
  const regression = input.lowerIsBetter === false ? -deltaPercent : deltaPercent;
  if (regression > 15) return 'fail';
  if (regression > 5) return 'warn';
  return 'pass';
}

function summarizeStatus(statuses: AdvancedQaCheckStatus[]): 'pass' | 'warn' | 'fail' {
  const active = statuses.filter((status) => status !== 'skipped');
  if (active.some((status) => status === 'fail')) return 'fail';
  if (active.length === 0 || active.some((status) => status === 'warn')) return 'warn';
  return 'pass';
}

function summarizeBenchmarkStatus(metrics: BenchmarkMetricResult[]): 'pass' | 'warn' | 'fail' {
  if (metrics.some((metric) => metric.status === 'fail')) return 'fail';
  if (metrics.length === 0 || metrics.some((metric) => metric.status === 'warn')) return 'warn';
  return 'pass';
}

function scoreStatuses(statuses: AdvancedQaCheckStatus[]): number {
  const active = statuses.filter((status) => status !== 'skipped');
  if (active.length === 0) return 0;
  const weights = { pass: 1, warn: 0.6, fail: 0, skipped: 0 } as const;
  return Math.round(
    (active.reduce((sum, status) => sum + weights[status], 0) / active.length) * 100
  );
}

function applyTthwPenalty(score: number, timeToHelloWorldMs: number): number {
  if (timeToHelloWorldMs <= 5 * 60 * 1000) return score;
  if (timeToHelloWorldMs <= 15 * 60 * 1000) return Math.min(score, 80);
  return Math.min(score, 55);
}

function visualRecommendations(
  screenshots: VisualViewportEvidence[],
  checks: AdvancedQaCheck[]
): string[] {
  const recommendations: string[] = [];
  if (screenshots.length === 0)
    recommendations.push('Capture at least one visual evidence screenshot.');
  if (checks.some((check) => check.status === 'fail')) {
    recommendations.push(
      'Fix failing visual checks before treating this release as visually verified.'
    );
  }
  if (checks.some((check) => check.status === 'warn')) {
    recommendations.push('Review warning-level visual checks and attach follow-up evidence.');
  }
  return recommendations.length > 0 ? recommendations : ['Visual QA evidence is clean.'];
}

function canaryRecommendations(
  checks: CanaryMonitorArtifact['checks'],
  baselineArtifactId: string | undefined
): string[] {
  const recommendations: string[] = [];
  if (!baselineArtifactId)
    recommendations.push('Attach a baseline artifact before relying on canary drift.');
  if (checks.length === 0) recommendations.push('Record canary metrics before shipping.');
  if (checks.some((check) => check.status === 'fail'))
    recommendations.push('Stop rollout and investigate failing canary checks.');
  return recommendations.length > 0
    ? recommendations
    : ['Canary checks are within expected bounds.'];
}

function browserSkillRecommendations(
  successfulRun: boolean,
  commandCount: number,
  requiresReview: boolean
): string[] {
  if (!successfulRun)
    return ['Keep the workflow staged until a successful browser run is captured.'];
  if (commandCount <= 0)
    return ['Capture at least one replayable browser command before skillifying.'];
  if (requiresReview) return ['Review redacted arguments before committing the browser skill.'];
  return ['Browser workflow is ready to commit as a reusable skill.'];
}

function devexRecommendations(
  steps: DevexAuditStep[],
  timeToHelloWorldMs: number | undefined
): string[] {
  const recommendations: string[] = [];
  if (timeToHelloWorldMs !== undefined && timeToHelloWorldMs > 5 * 60 * 1000) {
    recommendations.push('Reduce time-to-hello-world below five minutes for first-run workflows.');
  }
  for (const step of steps.filter((item) => item.status === 'fail' || item.status === 'warn')) {
    recommendations.push(`Improve DX step: ${step.label}`);
  }
  return recommendations.length > 0 ? recommendations : ['Developer experience audit is clean.'];
}

function benchmarkRecommendations(metrics: BenchmarkMetricResult[]): string[] {
  const recommendations = metrics
    .filter((metric) => metric.status !== 'pass')
    .map((metric) => `${metric.label} regressed by ${metric.deltaPercent ?? 0}% from baseline.`);
  if (metrics.length === 0) recommendations.push('Record at least one benchmark metric.');
  return recommendations.length > 0 ? recommendations : ['Benchmark metrics are within tolerance.'];
}

function getBrowserSkillEvidenceStatus(
  successfulRun: boolean,
  commandCount: number,
  requiresReview: boolean
): BrowserSkillEvidenceArtifact['status'] {
  if (!successfulRun || commandCount <= 0) return 'blocked';
  if (requiresReview) return 'needs-review';
  return 'ready';
}

function mapPassWarnFail(status: 'pass' | 'warn' | 'fail'): WorkflowArtifactStatus {
  if (status === 'pass') return 'pass';
  if (status === 'fail') return 'fail';
  return 'warn';
}

function normalizeSkillName(value: string): string {
  const normalized = cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'browser-skill';
}

function sanitizeDomain(value: string): string {
  return cleanText(value, 240)
    .replace(/^https?:\/\//i, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
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
