import { randomUUID } from 'crypto';
import { appendProjectTimelineEvent } from '../observability/project-timeline';
import { detectRoleIntent } from './intent-detector';
import { assessRoleCapabilityAdequacy } from './role-capability-assessor';
import { buildCandidateRoleFromGap } from './role-candidate-builder';
import { appendRoleCandidate } from './role-candidate-store';
import { detectRoleCapabilityGap } from './role-gap-detector';
import {
  createDefaultControlledRoleResearchProvider,
  LocalRoleResearchProvider,
  type RoleResearchProvider,
} from './role-research-provider';
import { routeRolesForIntent } from './role-router';
import type { IncubateRoleInput, IncubateRoleResult, RoleDefinition } from './role-types';

export async function incubateRoleForGap(
  input: IncubateRoleInput,
  provider?: RoleResearchProvider
): Promise<IncubateRoleResult> {
  const taskId = input.taskId || randomUUID();
  const intent = detectRoleIntent(input.taskText);
  const routed = routeRolesForIntent({
    cwd: input.cwd,
    text: input.taskText,
    intent,
  });
  const assessment = assessRoleCapabilityAdequacy({
    sessionId: input.sessionId,
    taskId,
    taskText: input.taskText,
    routedRoles: routed.roles.map((role) => ({
      id: role.id,
      name: role.name,
      triggerKeywords: role.triggerKeywords,
      triggerScopes: role.triggerScopes,
      handbookText: roleHandbookText(role),
      routingReasons: routed.reasons[role.id] || [],
    })),
  });

  if (assessment.adequate) {
    appendProjectTimelineEvent({
      cwd: input.cwd,
      category: 'role',
      event: 'role.incubation_skipped',
      source: 'role-incubation',
      status: 'info',
      summary: 'Existing routed roles are sufficiently capable.',
      metadata: { taskId, bestScore: assessment.bestScore, threshold: assessment.threshold },
    });
    return {
      gap: null,
      assessment,
      candidate: null,
      reason: 'existing roles are sufficiently capable',
    };
  }

  const gap = detectRoleCapabilityGap({
    sessionId: input.sessionId,
    taskId,
    taskText: input.taskText,
    assessment,
    attemptedRoleIds: input.attemptedRoleIds || routed.roles.map((role) => role.id),
  });

  if (!gap) {
    appendProjectTimelineEvent({
      cwd: input.cwd,
      category: 'role',
      event: 'role.incubation_skipped',
      source: 'role-incubation',
      status: 'info',
      summary: 'No executable role capability gap detected.',
      metadata: { taskId },
    });
    return {
      gap: null,
      assessment,
      candidate: null,
      reason: 'no executable role capability gap detected',
    };
  }

  const researchProvider = input.allowResearch
    ? provider || createDefaultControlledRoleResearchProvider(input.cwd)
    : new LocalRoleResearchProvider();
  const research = await researchProvider.researchRoleCapability(gap);
  const candidate = appendRoleCandidate(
    input.cwd,
    buildCandidateRoleFromGap({
      cwd: input.cwd,
      gap,
      research,
    })
  );
  appendProjectTimelineEvent({
    cwd: input.cwd,
    category: 'role',
    event: 'role.incubation_completed',
    source: 'role-incubation',
    status: candidate.status === 'blocked' ? 'blocked' : 'ok',
    summary: `Role candidate ${candidate.role.name} created for capability gap.`,
    metadata: {
      taskId,
      candidateId: candidate.candidateId,
      roleId: candidate.role.id,
      riskLevel: candidate.riskLevel,
      candidateStatus: candidate.status,
    },
  });

  return {
    gap,
    assessment,
    candidate,
    reason:
      candidate.status === 'blocked'
        ? 'candidate blocked by safety validation'
        : 'candidate role created',
  };
}

function roleHandbookText(role: RoleDefinition): string {
  return [
    role.description,
    role.handbook.identity,
    ...role.handbook.responsibilities,
    ...role.handbook.boundaries,
    ...role.handbook.outputFormat,
    ...role.handbook.completionCriteria,
  ].join(' ');
}
