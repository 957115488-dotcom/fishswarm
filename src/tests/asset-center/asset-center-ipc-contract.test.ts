import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readProjectFile(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('asset center IPC contract', () => {
  it('exposes only the read-only snapshot IPC channel', () => {
    const preload = readProjectFile('src/preload/index.ts');
    const main = readProjectFile('src/main/index.ts');
    const forbiddenChannels = [
      'assetCenter.install',
      'assetCenter.run',
      'assetCenter.export',
      'assetCenter.apply',
      'assetCenter.openArbitraryPath',
      'command.exec',
      'network.fetch',
    ];

    expect(preload).toContain("ipcRenderer.invoke('assetCenter.getSnapshot')");
    expect(main).toContain("ipcMain.handle('assetCenter.getSnapshot'");
    expect(preload).toContain("ipcRenderer.invoke('assetExport.dryRun'");
    expect(preload).toContain("ipcRenderer.invoke('assetExport.createPackage'");
    expect(main).toContain('assetExport.dryRun');
    expect(main).toContain('assetExport.createPackage');

    for (const channel of forbiddenChannels) {
      expect(preload).not.toContain(channel);
      expect(main).not.toContain(channel);
    }
  });
});
