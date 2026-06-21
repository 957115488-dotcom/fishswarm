import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getWorkspaceKey } from '../observability/project-timeline';

export function getWorkHabitsRoot(): string {
  return process.env.FISHSWARM_WORK_HABITS_ROOT || path.join(os.homedir(), '.fishswarm', 'work-habits');
}

export function getWorkHabitsWorkspaceDir(cwd?: string): string {
  const workspaceKey = getWorkspaceKey(cwd);
  return path.join(getWorkHabitsRoot(), 'workspaces', workspaceKey);
}

export function ensureWorkHabitsWorkspaceDir(cwd?: string): string {
  const dir = getWorkHabitsWorkspaceDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function appendJsonLine(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf-8');
}

export function readJsonLines<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf-8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    })
    .filter((item): item is T => item !== null);
}

export function readJsonObject<T extends Record<string, unknown>>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJsonObject(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  fs.renameSync(tmp, filePath);
}
