import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { app } from 'electron';
import type { Message, Session } from '../../renderer/types';

export interface ContextSnapshot {
  id: string;
  sessionId: string;
  title: string;
  cwd?: string;
  model?: string;
  savedAt: number;
  branch?: string;
  gitStatus?: string;
  recentMessages: Array<{
    role: Message['role'];
    text: string;
    timestamp: number;
  }>;
}

function getSnapshotRoot(): string {
  return path.join(app.getPath('userData'), 'context-state');
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'workspace';
}

function textFromMessage(message: Message): string {
  const chunks = message.content
    .map((block) => {
      if (block.type === 'text') return block.text;
      if (block.type === 'tool_use') return `[tool_use:${block.name}]`;
      if (block.type === 'tool_result') return '[tool_result]';
      if (block.type === 'file_attachment') return `[file:${block.filename}]`;
      return `[${block.type}]`;
    })
    .filter(Boolean);
  return chunks.join('\n').slice(0, 8000);
}

function readGit(cwd: string | undefined, args: string[]): string | undefined {
  if (!cwd || !fs.existsSync(cwd)) return undefined;
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

export class ContextStateService {
  saveSnapshot(session: Session, messages: Message[]): ContextSnapshot {
    const now = Date.now();
    const snapshot: ContextSnapshot = {
      id: `${now}-${safeSegment(session.id)}`,
      sessionId: session.id,
      title: session.title,
      cwd: session.cwd,
      model: session.model,
      savedAt: now,
      branch: readGit(session.cwd, ['branch', '--show-current']),
      gitStatus: readGit(session.cwd, ['status', '--short']),
      recentMessages: messages.slice(-24).map((message) => ({
        role: message.role,
        text: textFromMessage(message),
        timestamp: message.timestamp,
      })),
    };

    const dir = this.getSessionDir(session);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${snapshot.id}.json`),
      JSON.stringify(snapshot, null, 2),
      'utf-8'
    );
    fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(snapshot, null, 2), 'utf-8');
    return snapshot;
  }

  restoreLatest(session: Session): ContextSnapshot | null {
    const latestPath = path.join(this.getSessionDir(session), 'latest.json');
    if (!fs.existsSync(latestPath)) return null;
    return JSON.parse(fs.readFileSync(latestPath, 'utf-8')) as ContextSnapshot;
  }

  private getSessionDir(session: Session): string {
    const workspaceKey = safeSegment(session.cwd ?? session.id);
    return path.join(getSnapshotRoot(), workspaceKey, safeSegment(session.id));
  }
}
