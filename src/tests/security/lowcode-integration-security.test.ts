import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildAssetCenterSnapshot } from '../../main/asset-center/asset-center-service';
import { indexMcpAssets } from '../../main/asset-center/mcp-asset-index';
import { runAssetExportDryRun } from '../../main/release/asset-export-dry-run';
import {
  computeExportDryRunSnapshotSha256,
  createAssetExportPackage,
} from '../../main/release/asset-export-package';

const tempRoots: string[] = [];

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function git(cwd: string, args: string[]): void {
  execFileSync('git', ['-C', cwd, ...args], { stdio: 'ignore' });
}

function makeExportWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-security-export-'));
  tempRoots.push(root);
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(path.join(cwd, 'src'), { recursive: true });
  git(root, ['init', 'workspace']);
  git(cwd, ['config', 'user.email', 'security@example.com']);
  git(cwd, ['config', 'user.name', 'Security Test']);
  fs.writeFileSync(path.join(cwd, 'src', 'index.ts'), 'export const safe = true;\n');
  fs.writeFileSync(path.join(cwd, '.env'), 'OPENAI_API_KEY=sk-1234567890abcdefghijklmnop\n');
  git(cwd, ['add', 'src/index.ts']);
  git(cwd, ['commit', '-m', 'initial']);
  return cwd;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('low-code integration security regressions', () => {
  it('does not expose renderer command execution or generic network fetch bridges', () => {
    const preload = readProjectFile('src/preload/index.ts');
    const main = readProjectFile('src/main/index.ts');
    const forbiddenFragments = [
      "ipcRenderer.invoke('command.exec'",
      'ipcRenderer.invoke("command.exec"',
      "ipcRenderer.invoke('network.fetch'",
      'ipcRenderer.invoke("network.fetch"',
      "'command.exec'",
      '"command.exec"',
      "'network.fetch'",
      '"network.fetch"',
    ];

    for (const fragment of forbiddenFragments) {
      expect(preload).not.toContain(fragment);
    }

    expect(preload).toContain("ipcRenderer.invoke('assetCenter.getSnapshot')");
    expect(preload).toContain("ipcRenderer.invoke('assetExport.dryRun'");
    expect(preload).toContain("ipcRenderer.invoke('assetExport.createPackage'");
    expect(main).not.toContain("ipcMain.handle('command.exec'");
    expect(main).not.toContain("ipcMain.handle('network.fetch'");
  });

  it('keeps Electron browser capabilities hardened for the resource library flow', () => {
    const main = readProjectFile('src/main/index.ts');
    const preload = readProjectFile('src/preload/index.ts');
    const rendererSettings = readProjectFile('src/renderer/components/settings/SettingsAssets.tsx');
    const combined = [main, preload, rendererSettings].join('\n');

    expect(main).toMatch(/nodeIntegration:\s*false/);
    expect(main).toMatch(/contextIsolation:\s*true/);
    expect(main).toMatch(/sandbox:\s*true/);
    expect(combined).not.toMatch(/webviewTag\s*:\s*true/);
    expect(combined).not.toMatch(/certificate-error/);
    expect(combined).not.toMatch(/ignore-certificate-errors/);
    expect(combined).not.toMatch(/setCertificateVerifyProc/);
    expect(combined).not.toMatch(/allowRunningInsecureContent\s*:\s*true/);
  });

  it('blocks .env files during export dry-run and refuses package creation', async () => {
    const cwd = makeExportWorkspace();
    const stagingDir = path.join(path.dirname(cwd), 'packages');
    const dryRun = runAssetExportDryRun({
      cwd,
      includeRules: ['**'],
      now: new Date('2026-06-25T00:00:00.000Z'),
    });
    const dryRunSha256 = computeExportDryRunSnapshotSha256(dryRun);

    expect(dryRun.ok).toBe(false);
    expect(dryRun.blockers.some((blocker) => blocker.path === '.env')).toBe(true);
    expect(dryRun.candidates.map((candidate) => candidate.path)).not.toContain('.env');
    expect(JSON.stringify(dryRun)).not.toContain('sk-1234567890abcdefghijklmnop');

    await expect(
      createAssetExportPackage({
        cwd,
        dryRun,
        expectedDryRunSha256: dryRunSha256,
        stagingDir,
        packageFileName: 'blocked.zip',
      })
    ).rejects.toThrow(/blockers exist/);
    expect(fs.existsSync(path.join(stagingDir, 'blocked.zip'))).toBe(false);
  });

  it('does not include provider API keys or token-shaped values in the asset snapshot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-security-assets-'));
    tempRoots.push(root);
    const snapshot = buildAssetCenterSnapshot({
      domainSkillsRoot: path.join(root, 'missing-domain-skills'),
      builtInSkillsRoot: path.join(root, 'missing-built-in-skills'),
      workflowArtifacts: false,
      now: new Date('2026-06-25T00:00:00.000Z'),
    });
    const providerItems = snapshot.items.filter((item) => item.kind.startsWith('ai.'));
    const serialized = JSON.stringify(providerItems);

    expect(providerItems.some((item) => item.id === 'ai.provider:openai')).toBe(true);
    expect(serialized).not.toMatch(/apiKey/i);
    expect(serialized).not.toMatch(/\bsk-[A-Za-z0-9_-]{3,}\b/);
    expect(serialized).not.toMatch(/\bAIza[0-9A-Za-z_-]{3,}\b/);
    expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._~+/=-]+/i);
  });

  it('indexes MCP connector credential references without leaking env values', () => {
    const secret = 'ghp_1234567890abcdefghijklmnopqrstuvwx';
    const result = indexMcpAssets({
      presets: {
        github: {
          name: 'GitHub MCP',
          type: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-github'],
          env: { GITHUB_TOKEN: secret },
          requiresEnv: ['GITHUB_TOKEN'],
        },
      },
    });
    const serialized = JSON.stringify(result.items);

    expect(result.items[0]?.credentialRefs).toEqual(['credential:mcp.server:github:GITHUB_TOKEN']);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{20,}/);
  });
});
