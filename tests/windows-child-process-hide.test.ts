import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Windows child process console behavior', () => {
  it('hides startup and runtime child process consoles where FishSwarm owns spawn options', () => {
    expect(read('src/main/mcp/mcp-manager.ts')).toContain(
      "windowsHide: process.platform === 'win32'"
    );
    expect(read('src/main/claude/agent-runner.ts')).toContain(
      "windowsHide: process.platform === 'win32'"
    );
    expect(read('src/main/sandbox/native-executor.ts')).toContain(
      "windowsHide: process.platform === 'win32'"
    );
    expect(read('src/main/tools/tool-executor.ts')).toContain(
      "windowsHide: process.platform === 'win32'"
    );
    expect(read('src/main/sandbox/wsl-bridge.ts')).toContain(
      "windowsHide: process.platform === 'win32'"
    );
  });
});
