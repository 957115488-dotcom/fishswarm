import { randomUUID } from 'crypto';
import { capabilityLabelsFromText } from './role-capability-assessor';
import type { RoleCapabilityAssessment, RoleCapabilityGap } from './role-types';

export interface DetectRoleCapabilityGapInput {
  sessionId?: string;
  taskId: string;
  taskText: string;
  assessment: RoleCapabilityAssessment | null;
  attemptedRoleIds?: string[];
}

const ACTION_PATTERN =
  /\b(build|create|design|implement|fix|review|analyze|migrate|deploy|configure|generate|plan)\b|帮我|设计|实现|开发|检查|修复|生成|分析|整理|部署|配置|迁移/i;

export function detectRoleCapabilityGap(
  input: DetectRoleCapabilityGapInput
): RoleCapabilityGap | null {
  const taskText = String(input.taskText || '').trim();
  if (!taskText || !ACTION_PATTERN.test(taskText)) return null;
  if (input.assessment?.adequate) return null;

  const missingCapabilities =
    input.assessment?.requiredCapabilities?.length
      ? input.assessment.requiredCapabilities
      : capabilityLabelsFromText(taskText);
  const recognized = missingCapabilities.some((capability) => capability !== 'task specialist');
  const confidence = recognized ? 0.75 : 0.55;
  if (confidence < 0.5) return null;

  return {
    id: `gap-${randomUUID()}`,
    taskId: input.taskId,
    sessionId: input.sessionId,
    taskTextPreview: taskText.slice(0, 300),
    missingCapabilities,
    attemptedRoleIds: input.attemptedRoleIds || [],
    adequacyScore: input.assessment?.bestScore || 0,
    confidence,
    reason:
      input.assessment && input.assessment.routedRoleScores.length > 0
        ? `Best routed role adequacy score ${input.assessment.bestScore.toFixed(2)} is below ${input.assessment.threshold.toFixed(2)}.`
        : 'No sufficiently capable role was routed for this executable task.',
    createdAt: new Date().toISOString(),
  };
}
