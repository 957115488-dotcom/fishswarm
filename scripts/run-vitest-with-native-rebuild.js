#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

const vitestArgs = process.argv.slice(2);

const nodeRebuildStatus = run('npm', ['rebuild', 'better-sqlite3']);
if (nodeRebuildStatus !== 0) {
  process.exit(nodeRebuildStatus);
}

const testStatus = run('npx', ['vitest', ...vitestArgs]);
const electronRebuildStatus = run('npm', ['run', 'rebuild']);

if (testStatus !== 0) {
  process.exit(testStatus);
}

process.exit(electronRebuildStatus);
