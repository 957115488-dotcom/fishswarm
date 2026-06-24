import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  appendProjectTimelineEvent,
  getWorkspaceKey,
  getWorkspaceTimelineDir,
} from '../observability/project-timeline';

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

export interface WorkflowArtifactListOptions {
  cwd?: string;
  workspaceKey?: string;
  kind?: WorkflowArtifactKind;
  limit?: number;
}

export function saveWorkflowArtifact<T>(input: {
  cwd?: string;
  workspaceKey?: string;
  kind: WorkflowArtifactKind;
  title: string;
  status: WorkflowArtifactStatus;
  artifact: T;
}): WorkflowArtifactEnvelope<T> {
  const workspaceKey = input.workspaceKey || getWorkspaceKey(input.cwd);
  const envelope: WorkflowArtifactEnvelope<T> = {
    id: randomUUID(),
    kind: input.kind,
    ts: new Date().toISOString(),
    workspaceKey,
    cwd: input.cwd,
    title: trimTitle(input.title),
    status: input.status,
    artifact: input.artifact,
  };
  const filePath = getArtifactPath(input.cwd, workspaceKey, envelope.kind, envelope.id);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf-8');
  appendProjectTimelineEvent({
    cwd: input.cwd,
    workspaceKey,
    category: 'workflow',
    event: 'workflow.artifact_saved',
    source: 'workflow-artifact-store',
    status: 'ok',
    summary: `${envelope.kind}: ${envelope.title}`,
    metadata: {
      artifactId: envelope.id,
      artifactKind: envelope.kind,
      artifactStatus: envelope.status,
    },
  });
  return envelope;
}

export function listWorkflowArtifacts(
  options: WorkflowArtifactListOptions = {}
): WorkflowArtifactEnvelope[] {
  const workspaceKey = options.workspaceKey || getWorkspaceKey(options.cwd);
  const root = getArtifactsRoot(options.cwd, workspaceKey);
  if (!fs.existsSync(root)) return [];
  const kinds = options.kind
    ? [options.kind]
    : (fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name) as WorkflowArtifactKind[]);
  const artifacts = kinds.flatMap((kind) => readKindArtifacts(options.cwd, workspaceKey, kind));
  return artifacts
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, Math.max(1, options.limit || artifacts.length || 1));
}

export function readWorkflowArtifact<T = unknown>(options: {
  cwd?: string;
  workspaceKey?: string;
  kind: WorkflowArtifactKind;
  id: string;
}): WorkflowArtifactEnvelope<T> | null {
  const workspaceKey = options.workspaceKey || getWorkspaceKey(options.cwd);
  const filePath = getArtifactPath(options.cwd, workspaceKey, options.kind, options.id);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as WorkflowArtifactEnvelope<T>;
  } catch {
    return null;
  }
}

function readKindArtifacts(
  cwd: string | undefined,
  workspaceKey: string,
  kind: WorkflowArtifactKind
): WorkflowArtifactEnvelope[] {
  const dir = path.join(getArtifactsRoot(cwd, workspaceKey), kind);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      try {
        return JSON.parse(
          fs.readFileSync(path.join(dir, file), 'utf-8')
        ) as WorkflowArtifactEnvelope;
      } catch {
        return null;
      }
    })
    .filter((artifact): artifact is WorkflowArtifactEnvelope => artifact !== null);
}

function getArtifactsRoot(cwd: string | undefined, workspaceKey: string): string {
  return path.join(getWorkspaceTimelineDir(cwd, workspaceKey), 'workflow-artifacts');
}

function getArtifactPath(
  cwd: string | undefined,
  workspaceKey: string,
  kind: WorkflowArtifactKind,
  id: string
): string {
  return path.join(getArtifactsRoot(cwd, workspaceKey), kind, `${sanitizeId(id)}.json`);
}

function sanitizeId(value: string): string {
  const id = value.trim();
  if (!/^[a-z0-9-]{8,80}$/i.test(id)) {
    throw new Error('Invalid workflow artifact id.');
  }
  return id;
}

function trimTitle(value: string): string {
  const title = value.replace(/\s+/g, ' ').trim();
  if (!title) return 'Untitled workflow artifact';
  return title.length > 160 ? `${title.slice(0, 160)}...[truncated]` : title;
}
