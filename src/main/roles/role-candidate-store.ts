import * as path from 'path';
import { appendProjectTimelineEvent, getWorkspaceKey } from '../observability/project-timeline';
import { enrichGeneratedRoleLocales } from './role-candidate-builder';
import { ensureRolesWorkspaceDir, readJsonObject, writeJsonObject } from './role-paths';
import { saveRoleOverride } from './role-registry-store';
import { validateRoleDefinition } from './role-definition-validator';
import type {
  RejectRoleCandidateInput,
  RoleCandidate,
  RoleCandidateSnapshot,
  SaveRoleCandidateInput,
} from './role-types';

export function getRoleCandidateSnapshot(cwd?: string): RoleCandidateSnapshot {
  const candidates = readRoleCandidates(cwd);
  if (candidates.some((candidate) => candidate.role.locales?.zh)) {
    writeCandidates(cwd, candidates);
  }
  return {
    workspaceKey: getWorkspaceKey(cwd),
    cwd,
    candidates: candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  };
}

export function appendRoleCandidate(
  cwd: string | undefined,
  candidate: RoleCandidate
): RoleCandidate {
  const now = new Date().toISOString();
  const normalized = normalizeCandidate(cwd, {
    ...candidate,
    createdAt: candidate.createdAt || now,
    updatedAt: now,
  });
  const candidates = readRoleCandidates(cwd).filter(
    (item) => item.candidateId !== normalized.candidateId && !isActiveDuplicate(item, normalized)
  );
  const saved = { ...normalized, updatedAt: now };
  writeCandidates(cwd, [saved, ...candidates]);
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.candidate_created',
    source: 'role-candidate-store',
    status: saved.status === 'blocked' ? 'blocked' : 'ok',
    summary: `Created role candidate: ${saved.role.name}`,
    metadata: {
      candidateId: saved.candidateId,
      roleId: saved.role.id,
      riskLevel: saved.riskLevel,
      status: saved.status,
    },
  });
  return saved;
}

export function updateRoleCandidate(
  cwd: string | undefined,
  candidate: RoleCandidate
): RoleCandidate {
  const candidates = readRoleCandidates(cwd);
  const now = new Date().toISOString();
  const saved = normalizeCandidate(cwd, { ...candidate, updatedAt: now });
  writeCandidates(
    cwd,
    [saved, ...candidates.filter((item) => item.candidateId !== saved.candidateId)].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
  );
  return saved;
}

export function markRoleCandidateUsedOnce(
  cwd: string | undefined,
  candidateId: string
): RoleCandidate {
  const candidate = findCandidate(cwd, candidateId);
  return updateRoleCandidate(cwd, {
    ...candidate,
    status: 'used_once',
    usedAt: new Date().toISOString(),
  });
}

export function acceptRoleCandidate(
  cwd: string | undefined,
  input: SaveRoleCandidateInput
): RoleCandidate {
  const candidate = findCandidate(cwd, input.candidateId);
  const role = validateRoleDefinition({
    ...(input.editedRole || candidate.role),
    builtIn: false,
    enabled: true,
  });
  saveRoleOverride(cwd, { ...role, builtIn: false });
  const saved = updateRoleCandidate(cwd, {
    ...candidate,
    role,
    status: 'accepted',
    acceptedAt: new Date().toISOString(),
  });
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.candidate_accepted',
    source: 'role-candidate-store',
    status: 'ok',
    summary: `Accepted role candidate: ${saved.role.name}`,
    metadata: { candidateId: saved.candidateId, roleId: saved.role.id },
  });
  return saved;
}

export function rejectRoleCandidate(
  cwd: string | undefined,
  input: RejectRoleCandidateInput
): RoleCandidate {
  const candidate = findCandidate(cwd, input.candidateId);
  const saved = updateRoleCandidate(cwd, {
    ...candidate,
    status: 'rejected',
    rejectedAt: new Date().toISOString(),
  });
  appendProjectTimelineEvent({
    cwd,
    category: 'role',
    event: 'role.candidate_rejected',
    source: 'role-candidate-store',
    status: 'ok',
    summary: `Rejected role candidate: ${saved.role.name}`,
    metadata: {
      candidateId: saved.candidateId,
      roleId: saved.role.id,
      reason: input.reason || '',
    },
  });
  return saved;
}

function findCandidate(cwd: string | undefined, candidateId: string): RoleCandidate {
  const candidate = readRoleCandidates(cwd).find((item) => item.candidateId === candidateId);
  if (!candidate) throw new Error(`Role candidate not found: ${candidateId}`);
  return candidate;
}

function readRoleCandidates(cwd?: string): RoleCandidate[] {
  const parsed = readJsonObject<Record<string, unknown>>(candidatesPath(cwd), { candidates: [] });
  const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  return candidates.filter(isRoleCandidate).map((candidate) => normalizeCandidate(cwd, candidate));
}

function writeCandidates(cwd: string | undefined, candidates: RoleCandidate[]): void {
  writeJsonObject(candidatesPath(cwd), { candidates });
}

function candidatesPath(cwd?: string): string {
  return path.join(ensureRolesWorkspaceDir(cwd), 'role-candidates.json');
}

function normalizeCandidate(cwd: string | undefined, candidate: RoleCandidate): RoleCandidate {
  const now = new Date().toISOString();
  const role = enrichGeneratedRoleLocales(candidate.role);
  return {
    ...candidate,
    workspaceKey: getWorkspaceKey(cwd),
    cwd,
    role: candidate.status === 'blocked' ? role : validateRoleDefinition(role),
    status: candidate.status || 'draft',
    sources: Array.isArray(candidate.sources) ? candidate.sources : [],
    blockedReasons: Array.isArray(candidate.blockedReasons) ? candidate.blockedReasons : [],
    createdAt: candidate.createdAt || now,
    updatedAt: candidate.updatedAt || now,
  };
}

function isActiveDuplicate(existing: RoleCandidate, candidate: RoleCandidate): boolean {
  if (!['draft', 'ready', 'used_once'].includes(existing.status)) return false;
  if (existing.workspaceKey !== candidate.workspaceKey) return false;
  if (existing.role.id !== candidate.role.id) return false;
  return (
    normalizeCapabilities(existing.gap.missingCapabilities) ===
    normalizeCapabilities(candidate.gap.missingCapabilities)
  );
}

function normalizeCapabilities(values: string[]): string {
  return [...new Set(values.map((value) => value.toLowerCase().trim()).filter(Boolean))]
    .sort()
    .join('|');
}

function isRoleCandidate(value: unknown): value is RoleCandidate {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as RoleCandidate).candidateId === 'string' &&
    (value as RoleCandidate).role &&
    (value as RoleCandidate).gap
  );
}
