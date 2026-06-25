import { createHash, randomUUID } from 'node:crypto';
import type {
  AgentTaskBoardArtifact,
  AgentTaskBoardTask,
  AgentTaskBoardTaskStatus,
} from '../../shared/development-artifact-types';
import { buildArtifactLineage } from '../../shared/development-artifact-types';
import {
  saveWorkflowArtifact,
  type WorkflowArtifactEnvelope,
  type WorkflowArtifactStatus,
} from '../workflows/workflow-artifact-store';

export interface CreateAgentWorkboardInput {
  cwd?: string;
  title: string;
  goal: string;
  assetRefs?: string[];
  roleRefs?: string[];
  artifactRefs?: string[];
  createdBy?: string;
  now?: Date;
}

export interface AddAgentWorkboardTaskInput {
  id?: string;
  title: string;
  description?: string;
  status?: AgentTaskBoardTaskStatus;
  assetRefs?: string[];
  roleRefs?: string[];
  artifactRefs?: string[];
  approvalRefs?: string[];
  now?: Date;
}

export interface UpdateAgentWorkboardTaskInput {
  title?: string;
  description?: string;
  status?: AgentTaskBoardTaskStatus;
  assetRefs?: string[];
  roleRefs?: string[];
  artifactRefs?: string[];
  approvalRefs?: string[];
  now?: Date;
}

export interface RecordAgentWorkboardApprovalInput {
  taskId?: string;
  approvalRef: string;
  artifactRef?: string;
  now?: Date;
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function statusFromTasks(tasks: AgentTaskBoardTask[]): AgentTaskBoardArtifact['status'] {
  if (tasks.length === 0) return 'draft';
  if (tasks.some((task) => task.status === 'blocked' || task.status === 'failed')) return 'blocked';
  if (tasks.every((task) => task.status === 'done' || task.status === 'approved')) {
    return 'complete';
  }
  if (tasks.some((task) => task.status === 'ready_for_review')) return 'ready_for_review';
  return 'active';
}

function boardContentHash(input: {
  boardId: string;
  title: string;
  goal: string;
  status: AgentTaskBoardArtifact['status'];
  assetRefs: string[];
  roleRefs: string[];
  artifactRefs: string[];
  approvalRefs: string[];
  tasks: AgentTaskBoardTask[];
}): string {
  return sha256Json(input);
}

function rebuildBoard(
  board: AgentTaskBoardArtifact,
  updates: Partial<AgentTaskBoardArtifact>
): AgentTaskBoardArtifact {
  const next: AgentTaskBoardArtifact = {
    ...board,
    ...updates,
    assetRefs: unique([...(updates.assetRefs || board.assetRefs)]),
    roleRefs: unique([...(updates.roleRefs || board.roleRefs)]),
    artifactRefs: unique([...(updates.artifactRefs || board.artifactRefs)]),
    approvalRefs: unique([...(updates.approvalRefs || board.approvalRefs)]),
    tasks: updates.tasks || board.tasks,
  };
  next.status = updates.status || statusFromTasks(next.tasks);
  next.lineage = buildArtifactLineage({
    ...next.lineage,
    taskBoardId: next.boardId,
    assetRefs: next.assetRefs,
    roleRefs: next.roleRefs,
    contentSha256: boardContentHash(next),
    reviewState: next.status === 'complete' ? 'approved' : next.lineage.reviewState,
  });
  return next;
}

export function createAgentWorkboardArtifact(
  input: CreateAgentWorkboardInput
): AgentTaskBoardArtifact {
  if (!input.title.trim()) throw new Error('Agent workboard title is required.');
  if (!input.goal.trim()) throw new Error('Agent workboard goal is required.');

  const createdAt = (input.now || new Date()).toISOString();
  const boardId = `agent-board:${randomUUID()}`;
  const assetRefs = unique(input.assetRefs || []);
  const roleRefs = unique(input.roleRefs || []);
  const artifactRefs = unique(input.artifactRefs || []);
  const approvalRefs: string[] = [];
  const tasks: AgentTaskBoardTask[] = [];
  const status: AgentTaskBoardArtifact['status'] = 'draft';
  const contentSha256 = boardContentHash({
    boardId,
    title: input.title,
    goal: input.goal,
    status,
    assetRefs,
    roleRefs,
    artifactRefs,
    approvalRefs,
    tasks,
  });

  return {
    kind: 'agent_task_board',
    title: input.title,
    lineage: buildArtifactLineage({
      parentArtifactIds: [],
      sourceRefs: assetRefs.map((id) => ({ type: 'asset' as const, id })),
      roleRefs,
      assetRefs,
      conceptRefs: ['lowcode-concept:agent-workboard'],
      taskBoardId: boardId,
      createdBy: input.createdBy || 'agent',
      createdAt,
      contentSha256,
      allowedPaths: [],
      deniedPaths: ['.env', '.git/**', 'node_modules/**'],
      reviewState: 'draft',
    }),
    boardId,
    goal: input.goal,
    status,
    assetRefs,
    roleRefs,
    artifactRefs,
    approvalRefs,
    tasks,
    createdAt,
    updatedAt: createdAt,
  };
}

export function addAgentWorkboardTask(
  board: AgentTaskBoardArtifact,
  input: AddAgentWorkboardTaskInput
): AgentTaskBoardArtifact {
  if (!input.title.trim()) throw new Error('Agent workboard task title is required.');
  const updatedAt = (input.now || new Date()).toISOString();
  const task: AgentTaskBoardTask = {
    id: input.id || `agent-task:${randomUUID()}`,
    title: input.title,
    description: input.description,
    status: input.status || 'queued',
    assetRefs: unique(input.assetRefs || []),
    roleRefs: unique(input.roleRefs || []),
    artifactRefs: unique(input.artifactRefs || []),
    approvalRefs: unique(input.approvalRefs || []),
    createdAt: updatedAt,
    updatedAt,
  };

  return rebuildBoard(board, {
    updatedAt,
    assetRefs: unique([...board.assetRefs, ...task.assetRefs]),
    roleRefs: unique([...board.roleRefs, ...task.roleRefs]),
    artifactRefs: unique([...board.artifactRefs, ...task.artifactRefs]),
    approvalRefs: unique([...board.approvalRefs, ...task.approvalRefs]),
    tasks: [...board.tasks, task],
  });
}

export function updateAgentWorkboardTask(
  board: AgentTaskBoardArtifact,
  taskId: string,
  input: UpdateAgentWorkboardTaskInput
): AgentTaskBoardArtifact {
  const updatedAt = (input.now || new Date()).toISOString();
  let found = false;
  const tasks = board.tasks.map((task) => {
    if (task.id !== taskId) return task;
    found = true;
    return {
      ...task,
      title: input.title ?? task.title,
      description: input.description ?? task.description,
      status: input.status ?? task.status,
      assetRefs: unique([...(input.assetRefs || task.assetRefs)]),
      roleRefs: unique([...(input.roleRefs || task.roleRefs)]),
      artifactRefs: unique([...(input.artifactRefs || task.artifactRefs)]),
      approvalRefs: unique([...(input.approvalRefs || task.approvalRefs)]),
      updatedAt,
    };
  });
  if (!found) throw new Error(`Agent workboard task not found: ${taskId}`);

  return rebuildBoard(board, {
    updatedAt,
    assetRefs: unique([...board.assetRefs, ...tasks.flatMap((task) => task.assetRefs)]),
    roleRefs: unique([...board.roleRefs, ...tasks.flatMap((task) => task.roleRefs)]),
    artifactRefs: unique([...board.artifactRefs, ...tasks.flatMap((task) => task.artifactRefs)]),
    approvalRefs: unique([...board.approvalRefs, ...tasks.flatMap((task) => task.approvalRefs)]),
    tasks,
  });
}

export function recordAgentWorkboardApproval(
  board: AgentTaskBoardArtifact,
  input: RecordAgentWorkboardApprovalInput
): AgentTaskBoardArtifact {
  if (!input.approvalRef.trim()) throw new Error('approvalRef is required.');
  const updatedAt = (input.now || new Date()).toISOString();
  const approvalRefs = unique([...board.approvalRefs, input.approvalRef]);
  const artifactRefs = unique([...board.artifactRefs, input.artifactRef]);
  const tasks = input.taskId
    ? board.tasks.map((task) =>
        task.id === input.taskId
          ? {
              ...task,
              approvalRefs: unique([...task.approvalRefs, input.approvalRef]),
              artifactRefs: unique([...task.artifactRefs, input.artifactRef]),
              status: task.status === 'ready_for_review' ? 'approved' : task.status,
              updatedAt,
            }
          : task
      )
    : board.tasks;

  return rebuildBoard(board, { updatedAt, approvalRefs, artifactRefs, tasks });
}

export function saveAgentWorkboardArtifact(input: {
  cwd?: string;
  board: AgentTaskBoardArtifact;
  status?: WorkflowArtifactStatus;
}): WorkflowArtifactEnvelope<AgentTaskBoardArtifact> {
  return saveWorkflowArtifact<AgentTaskBoardArtifact>({
    cwd: input.cwd,
    kind: 'agent_task_board',
    title: input.board.title,
    status: input.status || (input.board.status === 'blocked' ? 'blocked' : 'ready'),
    artifact: input.board,
  });
}

export function createAgentWorkboard(
  input: CreateAgentWorkboardInput
): WorkflowArtifactEnvelope<AgentTaskBoardArtifact> {
  return saveAgentWorkboardArtifact({
    cwd: input.cwd,
    board: createAgentWorkboardArtifact(input),
  });
}
