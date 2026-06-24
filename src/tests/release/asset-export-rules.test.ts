import { describe, expect, it } from 'vitest';
import {
  detectRedactionFindings,
  getExportDenylistBlocker,
  isExportPathDenied,
  matchesExportRule,
} from '../../main/release/asset-export-rules';

describe('asset export rules', () => {
  it('blocks sensitive default denylist paths', () => {
    expect(isExportPathDenied('.env')).toBe(true);
    expect(isExportPathDenied('.git/config')).toBe(true);
    expect(isExportPathDenied('node_modules/pkg/index.js')).toBe(true);
    expect(isExportPathDenied('src/index.ts')).toBe(false);
    expect(getExportDenylistBlocker('private.key')?.code).toBe('denylist.path');
  });

  it('matches include and exclude rule patterns', () => {
    expect(matchesExportRule('src/main/index.ts', 'src/**')).toBe(true);
    expect(matchesExportRule('src/main/index.ts', 'docs/**')).toBe(false);
    expect(matchesExportRule('certs/server.pem', '**/*.pem')).toBe(true);
  });

  it('detects redaction findings without returning secret values', () => {
    const findings = detectRedactionFindings('src/config.ts', 'export const key = "sk-1234567890abcdefghijklmnop";');

    expect(findings[0]).toMatchObject({ type: 'api_key', severity: 'blocker', path: 'src/config.ts' });
    expect(JSON.stringify(findings)).not.toContain('sk-1234567890abcdefghijklmnop');
  });
});
