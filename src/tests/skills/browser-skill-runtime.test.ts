import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendProjectTimelineEvent } from '../../main/observability/project-timeline';
import {
  buildBrowserSkillRunEnv,
  commitBrowserSkillDraft,
  createBrowserSkillDraft,
  discardBrowserSkillDraft,
  listBrowserSkillRuntime,
  testBrowserSkillDraft,
  validateBrowserSkillName,
} from '../../main/skills/browser-skill-runtime';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const previousGlobalRoot = process.env.FISHSWARM_BROWSER_SKILL_GLOBAL_ROOT;
const previousBundledRoot = process.env.FISHSWARM_BROWSER_SKILL_BUNDLED_ROOT;
const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-browser-skill-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  process.env.FISHSWARM_BROWSER_SKILL_GLOBAL_ROOT = path.join(root, 'global-browser-skills');
  process.env.FISHSWARM_BROWSER_SKILL_BUNDLED_ROOT = path.join(root, 'bundled-browser-skills');
  fs.mkdirSync(process.env.FISHSWARM_BROWSER_SKILL_BUNDLED_ROOT, { recursive: true });
  return path.join(root, 'workspace');
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnv('FISHSWARM_TIMELINE_ROOT', previousTimelineRoot);
  restoreEnv('FISHSWARM_BROWSER_SKILL_GLOBAL_ROOT', previousGlobalRoot);
  restoreEnv('FISHSWARM_BROWSER_SKILL_BUNDLED_ROOT', previousBundledRoot);
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('browser skill runtime', () => {
  it('stages a browser skill from browse timeline and commits it into project runtime', () => {
    const cwd = makeWorkspace();
    fs.mkdirSync(cwd, { recursive: true });
    appendProjectTimelineEvent({
      cwd,
      category: 'browse',
      event: 'gstack_browse.command_completed',
      source: 'test',
      status: 'ok',
      command: 'goto',
      toolName: 'gstack_browse_open',
      metadata: { args: ['https://example.com'] },
    });

    const draft = createBrowserSkillDraft({ cwd, name: 'Example Flow', trigger: 'example flow' });

    expect(draft.status).toBe('staged');
    expect(fs.existsSync(draft.skillPath)).toBe(true);
    expect(listBrowserSkillRuntime(cwd).skills).toHaveLength(0);
    expect(listBrowserSkillRuntime(cwd).drafts[0].skillName).toBe('example-flow');

    const test = testBrowserSkillDraft(cwd, draft.stageId);
    expect(test.ok).toBe(true);
    expect(test.commandCount).toBe(1);

    const committed = commitBrowserSkillDraft(cwd, draft.stageId);
    expect(committed.name).toBe('example-flow');
    expect(committed.enabled).toBe(true);
    expect(committed.frontmatter.host).toBe('example.com');
    expect(listBrowserSkillRuntime(cwd).drafts).toHaveLength(0);
    expect(listBrowserSkillRuntime(cwd).skills[0].name).toBe('example-flow');
  });

  it('blocks drafts that contain redacted replay args', () => {
    const cwd = makeWorkspace();
    fs.mkdirSync(cwd, { recursive: true });
    appendProjectTimelineEvent({
      cwd,
      category: 'browse',
      event: 'gstack_browse.command_completed',
      source: 'test',
      status: 'ok',
      command: 'fill',
      toolName: 'gstack_browse_fill',
      metadata: { args: ['@e1', '<REDACTED>'] },
    });

    const draft = createBrowserSkillDraft({ cwd, name: 'Login Flow' });
    const test = testBrowserSkillDraft(cwd, draft.stageId);

    expect(draft.requiresReview).toBe(true);
    expect(test.ok).toBe(false);
    expect(test.errors.join('\n')).toContain('redacted args');
  });

  it('discards staged drafts without creating runtime entries', () => {
    const cwd = makeWorkspace();
    fs.mkdirSync(cwd, { recursive: true });
    appendProjectTimelineEvent({
      cwd,
      category: 'browse',
      event: 'gstack_browse.command_completed',
      source: 'test',
      status: 'ok',
      command: 'snapshot',
      toolName: 'gstack_browse_snapshot',
      metadata: { args: ['-i'] },
    });

    const draft = createBrowserSkillDraft({ cwd, name: 'Snapshot Flow' });
    discardBrowserSkillDraft(cwd, draft.stageId);

    const runtime = listBrowserSkillRuntime(cwd);
    expect(runtime.drafts).toHaveLength(0);
    expect(runtime.skills).toHaveLength(0);
  });

  it('validates skill names and scrubs untrusted runtime env', () => {
    expect(() => validateBrowserSkillName('safe-skill-1')).not.toThrow();
    expect(() => validateBrowserSkillName('../escape')).toThrow();

    const originalOpenAi = process.env.OPENAI_API_KEY;
    const originalGStack = process.env.GSTACK_TOKEN;
    process.env.OPENAI_API_KEY = 'secret';
    process.env.GSTACK_TOKEN = 'root-token';
    try {
      const env = buildBrowserSkillRunEnv(false);
      expect(env.OPENAI_API_KEY).toBeUndefined();
      expect(env.GSTACK_TOKEN).toBeUndefined();
      expect(env.FISHSWARM_BROWSER_SKILL_TRUSTED).toBe('0');
    } finally {
      restoreEnv('OPENAI_API_KEY', originalOpenAi);
      restoreEnv('GSTACK_TOKEN', originalGStack);
    }
  });
});
