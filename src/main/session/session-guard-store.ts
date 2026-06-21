import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { app } from 'electron';
import { isPathWithinRoot } from '../tools/path-containment';

export interface SessionGuardState {
  sessionId: string;
  frozen: boolean;
  freezeRoot?: string;
  destructiveCommandGuard: boolean;
  updatedAt: number;
}

export interface SessionGuardUpdate {
  frozen?: boolean;
  freezeRoot?: string | null;
  destructiveCommandGuard?: boolean;
}

function getStorePath(): string {
  if (process.env.FISHSWARM_GUARD_STORE_PATH) {
    return process.env.FISHSWARM_GUARD_STORE_PATH;
  }

  try {
    return path.join(app.getPath('userData'), 'session-guards.json');
  } catch {
    return path.join(os.homedir(), '.fishswarm', 'session-guards.json');
  }
}

function defaultGuard(sessionId: string): SessionGuardState {
  return {
    sessionId,
    frozen: false,
    destructiveCommandGuard: true,
    updatedAt: Date.now(),
  };
}

const destructiveCommandPatterns: RegExp[] = [
  /\brm\s+-[^\n\r;|&]*[rf][^\n\r;|&]*\s+(?:\/|~|\.)/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[^\n\r;|&]*[fdx]/i,
  /\bRemove-Item\b[^\n\r;|&]*\b-Recurse\b/i,
  /\bdel\s+\/[sfq]/i,
  /\brmdir\s+\/[sq]/i,
  /\bformat\s+[A-Za-z]:/i,
  /\bdd\s+if=/i,
  /\bmkfs(?:\.\w+)?\b/i,
  />\s*\/dev\//i,
  /\bcurl\b[^\n\r;|&]*\|\s*(?:ba)?sh\b/i,
  /\bwget\b[^\n\r;|&]*\|\s*(?:ba)?sh\b/i,
  /\breg\s+(?:add|delete)\b/i,
  /\bSet-ExecutionPolicy\b/i,
  /\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b/i,
  /\bTRUNCATE\s+TABLE\b/i,
];

export function getDestructiveCommandReason(command: string): string | null {
  return destructiveCommandPatterns.some((pattern) => pattern.test(command))
    ? 'destructive command pattern'
    : null;
}

export class SessionGuardStore {
  private guards = new Map<string, SessionGuardState>();
  private loaded = false;

  get(sessionId: string): SessionGuardState {
    this.ensureLoaded();
    return this.guards.get(sessionId) ?? defaultGuard(sessionId);
  }

  set(sessionId: string, update: SessionGuardUpdate): SessionGuardState {
    this.ensureLoaded();
    const existing = this.get(sessionId);
    const next: SessionGuardState = {
      ...existing,
      frozen: update.frozen ?? existing.frozen,
      freezeRoot:
        update.freezeRoot === null
          ? undefined
          : update.freezeRoot !== undefined
            ? path.normalize(update.freezeRoot)
            : existing.freezeRoot,
      destructiveCommandGuard:
        update.destructiveCommandGuard ?? existing.destructiveCommandGuard,
      updatedAt: Date.now(),
    };
    this.guards.set(sessionId, next);
    this.save();
    return next;
  }

  clear(sessionId: string): void {
    this.ensureLoaded();
    this.guards.delete(sessionId);
    this.save();
  }

  assertWriteAllowed(sessionId: string, targetPath: string): void {
    const guard = this.get(sessionId);
    if (!guard.frozen || !guard.freezeRoot) return;

    const isWindows = process.platform === 'win32';
    const normalizedTarget = path.normalize(targetPath);
    const normalizedRoot = path.normalize(guard.freezeRoot);
    if (!isPathWithinRoot(normalizedTarget, normalizedRoot, isWindows)) {
      throw new Error(`Session is frozen: write outside freeze root blocked (${normalizedRoot})`);
    }
  }

  assertCommandAllowed(sessionId: string, command: string, cwd?: string): void {
    const guard = this.get(sessionId);
    if (guard.frozen && guard.freezeRoot && cwd) {
      const isWindows = process.platform === 'win32';
      if (!isPathWithinRoot(path.normalize(cwd), path.normalize(guard.freezeRoot), isWindows)) {
        throw new Error(`Session is frozen: command cwd outside freeze root blocked (${guard.freezeRoot})`);
      }
    }

    if (guard.destructiveCommandGuard) {
      const reason = getDestructiveCommandReason(command);
      if (reason) {
        throw new Error(`Command blocked by session guard: ${reason}`);
      }
    }
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    const storePath = getStorePath();
    if (!fs.existsSync(storePath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8')) as Record<
        string,
        SessionGuardState
      >;
      for (const [sessionId, state] of Object.entries(parsed)) {
        this.guards.set(sessionId, { ...defaultGuard(sessionId), ...state, sessionId });
      }
    } catch {
      this.guards.clear();
    }
  }

  private save(): void {
    const storePath = getStorePath();
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(
      storePath,
      JSON.stringify(Object.fromEntries(this.guards.entries()), null, 2),
      'utf-8'
    );
  }
}

export const sessionGuardStore = new SessionGuardStore();
