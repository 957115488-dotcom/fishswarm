import { randomUUID } from 'crypto';
import type { BacklogSpecArtifact, BacklogSpecInput } from '../../shared/ipc-types';
import { scanUntrustedText } from '../security/content-security';
import { redactUnknown } from '../security/redact';
import { addDecision } from '../work-habits/decision-store';
import {
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
  type WorkflowArtifactStatus,
} from '../workflows/workflow-artifact-store';

export function createBacklogSpecArtifact(
  input: BacklogSpecInput
): WorkflowArtifactEnvelope<BacklogSpecArtifact> {
  const redacted = redactUnknown(input);
  const safeInput = redacted.value;
  const scan = scanUntrustedText(JSON.stringify(safeInput));
  const redactionStatus: BacklogSpecArtifact['redactionStatus'] =
    scan.verdict === 'block'
      ? 'blocked'
      : redacted.redacted || scan.reasons.length > 0
        ? 'redacted'
        : 'pass';
  const artifact: BacklogSpecArtifact = {
    runId: randomUUID(),
    title: cleanText(safeInput.title || 'Untitled backlog spec', 180),
    mode: safeInput.mode || 'standard',
    stakeholderContext: cleanText(safeInput.stakeholderContext || '', 2000),
    verifiedCurrentState: (safeInput.verifiedCurrentState || []).map((item) => ({
      file: cleanText(item.file, 240),
      evidence: cleanText(item.evidence, 800),
    })),
    proposedChange: cleanText(safeInput.proposedChange || '', 3000),
    implementationDetails: cleanList(safeInput.implementationDetails, 30, 1000),
    acceptanceCriteria: cleanList(safeInput.acceptanceCriteria, 30, 800),
    testingPlan: (safeInput.testingPlan || []).map((item) => ({
      level: item.level,
      target: cleanText(item.target, 500),
      count: item.count,
    })),
    rollbackPlan: safeInput.rollbackPlan ? cleanText(safeInput.rollbackPlan, 1000) : undefined,
    outOfScope: cleanList(safeInput.outOfScope, 30, 500),
    redactionStatus,
    readinessScore: 0,
    missingFields: [],
  };

  artifact.missingFields = getMissingSpecFields(artifact);
  artifact.readinessScore = getReadinessScore(artifact);

  const status = getSpecStatus(artifact);
  if (status === 'ready' && safeInput.recordDecision !== false) {
    const decision = addDecision({
      cwd: safeInput.cwd,
      decision: `Backlog spec ready: ${artifact.title}`,
      rationale: `Spec ${artifact.runId} passed readiness checks with ${artifact.acceptanceCriteria.length} acceptance criteria and ${artifact.testingPlan.length} test plan entries.`,
      alternatives:
        artifact.outOfScope.length > 0
          ? `Out of scope: ${artifact.outOfScope.join('; ')}`
          : 'No explicit out-of-scope alternatives recorded.',
      source: 'skill',
      confidence: Math.max(6, Math.round(artifact.readinessScore / 10)),
    });
    artifact.decisionId = decision.id;
  }

  return saveWorkflowArtifact({
    cwd: safeInput.cwd,
    kind: 'backlog_spec',
    title: artifact.title,
    status,
    artifact,
  });
}

function getSpecStatus(artifact: BacklogSpecArtifact): WorkflowArtifactStatus {
  if (artifact.redactionStatus === 'blocked') return 'blocked';
  return artifact.missingFields.length === 0 ? 'ready' : 'draft';
}

function getMissingSpecFields(artifact: BacklogSpecArtifact): string[] {
  const missing: string[] = [];
  if (!artifact.stakeholderContext) missing.push('stakeholderContext');
  if (artifact.verifiedCurrentState.length === 0) missing.push('verifiedCurrentState');
  if (!artifact.proposedChange) missing.push('proposedChange');
  if (artifact.implementationDetails.length === 0) missing.push('implementationDetails');
  if (artifact.acceptanceCriteria.length === 0) missing.push('acceptanceCriteria');
  if (artifact.testingPlan.length === 0) missing.push('testingPlan');
  return missing;
}

function getReadinessScore(artifact: BacklogSpecArtifact): number {
  const total = 6;
  const present = total - getMissingSpecFields(artifact).length;
  const redactionPenalty =
    artifact.redactionStatus === 'blocked' ? 30 : artifact.redactionStatus === 'redacted' ? 10 : 0;
  return Math.max(0, Math.round((present / total) * 100) - redactionPenalty);
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
