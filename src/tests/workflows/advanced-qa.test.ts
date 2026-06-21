import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createBenchmarkRunArtifact,
  createBrowserAuthImportSummaryArtifact,
  createBrowserSkillEvidenceArtifact,
  createCanaryMonitorArtifact,
  createDevexAuditArtifact,
  createVisualQaArtifact,
} from '../../main/advanced-qa/advanced-qa-service';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-advanced-qa-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(path.join(cwd, 'screenshots'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'screenshots', 'desktop.png'), 'placeholder');
  return cwd;
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv('FISHSWARM_TIMELINE_ROOT', previousTimelineRoot);
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('advanced QA workflow artifacts', () => {
  it('creates visual QA and canary monitor artifacts', () => {
    const cwd = makeWorkspace();

    const visual = createVisualQaArtifact({
      cwd,
      title: 'Homepage visual QA',
      targetUrl: 'http://localhost:3000',
      screenshots: [
        {
          viewport: 'desktop',
          path: 'screenshots/desktop.png',
          width: 1440,
          height: 900,
          status: 'pass',
        },
        {
          viewport: 'mobile',
          width: 390,
          height: 844,
          status: 'fail',
          notes: 'CTA overlaps footer.',
        },
      ],
      checks: [{ id: 'text-overlap', label: 'No text overlap', status: 'fail' }],
    });
    const canary = createCanaryMonitorArtifact({
      cwd,
      title: 'Homepage canary',
      targetUrl: 'http://localhost:3000',
      baselineArtifactId: visual.id,
      checks: [
        {
          label: 'error rate',
          metric: 'errorRate',
          value: 0.001,
          threshold: 0.005,
          status: 'pass',
        },
      ],
    });

    expect(visual.kind).toBe('visual_qa');
    expect(visual.status).toBe('fail');
    expect(visual.artifact.recommendations).toContain(
      'Fix failing visual checks before treating this release as visually verified.'
    );
    expect(canary.kind).toBe('canary_monitor');
    expect(canary.status).toBe('pass');
    expect(canary.artifact.baselineArtifactId).toBe(visual.id);
  });

  it('records browser skill evidence and preserves cookie import privacy boundaries', () => {
    const cwd = makeWorkspace();

    const evidence = createBrowserSkillEvidenceArtifact({
      cwd,
      skillName: 'Checkout Flow',
      stageId: 'stage-12345678',
      host: 'shop.example.com',
      source: 'timeline',
      successfulRun: true,
      commandCount: 5,
      requiresReview: true,
      evidence: ['Captured from successful browse timeline events.'],
    });
    const authImport = createBrowserAuthImportSummaryArtifact({
      cwd,
      browser: 'chrome',
      mode: 'picker',
      domains: [{ domain: 'https://shop.example.com/account', cookieCount: 12 }],
      valuesExposed: true,
    });

    expect(evidence.kind).toBe('browser_skill_evidence');
    expect(evidence.status).toBe('warn');
    expect(evidence.artifact.status).toBe('needs-review');
    expect(evidence.artifact.skillName).toBe('checkout-flow');
    expect(authImport.kind).toBe('browser_auth_import');
    expect(authImport.status).toBe('blocked');
    expect(authImport.artifact.valuesExposed).toBe(false);
    expect(authImport.artifact.domains[0]).toEqual({ domain: 'shop.example.com', cookieCount: 12 });
  });

  it('creates DevEx and benchmark artifacts with regression signals', () => {
    const cwd = makeWorkspace();

    const devex = createDevexAuditArtifact({
      cwd,
      workflowName: 'First local run',
      startedAtMs: 0,
      completedAtMs: 20 * 60 * 1000,
      steps: [
        { label: 'Install dependencies', status: 'pass', durationMs: 120000 },
        {
          label: 'Start app',
          status: 'warn',
          durationMs: 600000,
          friction: 'Native rebuild warning.',
        },
      ],
    });
    const benchmark = createBenchmarkRunArtifact({
      cwd,
      title: 'Browser flow benchmark',
      target: 'workflow',
      metrics: [
        {
          id: 'checkout-latency',
          label: 'Checkout latency',
          value: 1300,
          unit: 'ms',
          baseline: 1000,
          lowerIsBetter: true,
        },
      ],
    });
    const kinds = listWorkflowArtifacts({ cwd }).map((artifact) => artifact.kind);

    expect(devex.kind).toBe('devex_audit');
    expect(devex.status).toBe('fail');
    expect(devex.artifact.timeToHelloWorldMs).toBe(20 * 60 * 1000);
    expect(benchmark.kind).toBe('benchmark_run');
    expect(benchmark.status).toBe('fail');
    expect(benchmark.artifact.metrics[0].deltaPercent).toBe(30);
    expect(kinds).toEqual(expect.arrayContaining(['devex_audit', 'benchmark_run']));
  });
});
