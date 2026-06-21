import { randomUUID } from 'crypto';
import type { InvestigationArtifact, InvestigationInput } from '../../shared/ipc-types';
import { appendProjectLearning } from '../observability/project-timeline';
import {
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
  type WorkflowArtifactStatus,
} from '../workflows/workflow-artifact-store';

export function createInvestigationArtifact(
  input: InvestigationInput
): WorkflowArtifactEnvelope<InvestigationArtifact> {
  const hypotheses = (input.hypotheses || []).map((hypothesis, index) => ({
    id: cleanId(hypothesis.id || `h${index + 1}`),
    claim: cleanText(hypothesis.claim, 1000),
    evidence: cleanList(hypothesis.evidence, 30, 800),
    verdict: hypothesis.verdict || 'untested',
  }));
  const artifact: InvestigationArtifact = {
    runId: randomUUID(),
    symptom: cleanText(input.symptom, 2000),
    reproduction: input.reproduction ? cleanText(input.reproduction, 2000) : undefined,
    hypotheses,
    rootCause: input.rootCause ? cleanText(input.rootCause, 2000) : undefined,
    affectedFiles: cleanList(input.affectedFiles, 80, 240),
    fixSummary: input.fixSummary ? cleanText(input.fixSummary, 2000) : undefined,
    regressionTests: (input.regressionTests || []).map((test) => ({
      command: cleanText(test.command, 500),
      failedBefore: test.failedBefore === true,
      passedAfter: test.passedAfter === true,
    })),
    status: 'needs-more-evidence',
  };

  artifact.status = getInvestigationStatus(artifact);
  if (artifact.rootCause) {
    const learning = appendProjectLearning({
      cwd: input.cwd,
      type: 'investigation',
      key: `root-cause-${artifact.runId.slice(0, 8)}`,
      insight: artifact.rootCause,
      confidence: artifact.status === 'fixed' ? 9 : 7,
      source: 'observed',
      files: artifact.affectedFiles,
      tags: ['investigation', artifact.status],
    });
    artifact.learningId = learning.id;
  }

  return saveWorkflowArtifact({
    cwd: input.cwd,
    kind: 'investigation',
    title: artifact.symptom,
    status: mapInvestigationStatus(artifact.status),
    artifact,
  });
}

function getInvestigationStatus(artifact: InvestigationArtifact): InvestigationArtifact['status'] {
  if (!artifact.symptom) return 'blocked';
  const rejected = artifact.hypotheses.filter(
    (hypothesis) => hypothesis.verdict === 'rejected'
  ).length;
  const confirmed = artifact.hypotheses.some((hypothesis) => hypothesis.verdict === 'confirmed');
  const regressionsPassed =
    artifact.regressionTests.length > 0 &&
    artifact.regressionTests.every((test) => test.failedBefore && test.passedAfter);

  if (artifact.rootCause && artifact.fixSummary && regressionsPassed) return 'fixed';
  if (artifact.rootCause || confirmed) return 'root-cause-found';
  if (rejected >= 3) return 'blocked';
  return 'needs-more-evidence';
}

function mapInvestigationStatus(status: InvestigationArtifact['status']): WorkflowArtifactStatus {
  if (status === 'fixed') return 'pass';
  if (status === 'root-cause-found') return 'ready';
  if (status === 'blocked') return 'blocked';
  return 'needs-more-evidence';
}

function cleanId(value: string): string {
  const id = value
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return id || 'hypothesis';
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
