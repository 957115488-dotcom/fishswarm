import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { app } from 'electron';

export interface SecurityAuditEvent {
  type: string;
  severity: 'info' | 'warn' | 'block';
  source: string;
  reasons?: string[];
  metadata?: Record<string, unknown>;
}

function getAuditLogPath(): string {
  let userData: string;
  try {
    userData = app.getPath('userData');
  } catch {
    userData =
      process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'fishswarm')
        : path.join(os.homedir(), '.config', 'fishswarm');
  }
  return path.join(userData, 'security', 'attempts.jsonl');
}

function sanitizeMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/token|secret|password|api[_-]?key|auth/i.test(key)) {
      out[key] = '<REDACTED>';
    } else if (typeof value === 'string' && value.length > 500) {
      out[key] = `${value.slice(0, 500)}...`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function writeSecurityAuditEvent(event: SecurityAuditEvent): void {
  try {
    const logPath = getAuditLogPath();
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const payload = {
      ts: new Date().toISOString(),
      ...event,
      metadata: sanitizeMetadata(event.metadata),
    };
    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, { encoding: 'utf8' });
  } catch {
    // Best effort only. Security logging must not crash the app.
  }
}

