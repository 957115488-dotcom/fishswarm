import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  appendProjectTimelineEvent,
  listProjectTimelineEvents,
} from '../observability/project-timeline';
import {
  resolveGStackBrowseBinary,
  runGStackBrowseCommand,
} from '../mcp/gstack-browse-runner';

export type BrowserSkillTier = 'project' | 'global' | 'bundled';

export interface BrowserSkillArg {
  name: string;
  description?: string;
}

export interface BrowserSkillFrontmatter {
  name: string;
  description?: string;
  host?: string;
  triggers: string[];
  args: BrowserSkillArg[];
  trusted: boolean;
  enabled: boolean;
  version?: string;
  source?: 'human' | 'agent';
}

export interface BrowserSkillWorkflowStep {
  command: string;
  args: string[];
  toolName?: string;
  summary?: string;
}

export interface BrowserSkillWorkflow {
  version: 1;
  skillName: string;
  createdAt: string;
  source: 'timeline' | 'human';
  requiresReview: boolean;
  steps: BrowserSkillWorkflowStep[];
}

export interface BrowserSkillEntry {
  name: string;
  tier: BrowserSkillTier;
  dir: string;
  skillPath: string;
  workflowPath: string;
  frontmatter: BrowserSkillFrontmatter;
  bodyMd: string;
  enabled: boolean;
  trusted: boolean;
  testable: boolean;
  runnable: boolean;
  requiresReview: boolean;
  commandCount: number;
  lastModified: number;
}

export interface BrowserSkillDraft {
  stageId: string;
  skillName: string;
  stagedDir: string;
  skillPath: string;
  workflowPath: string;
  commandCount: number;
  requiresReview: boolean;
  createdAt: number;
}

export interface BrowserSkillifyInput {
  cwd: string;
  name: string;
  description?: string;
  trigger?: string;
  host?: string;
  limit?: number;
}

export interface BrowserSkillifyResult {
  skillName: string;
  skillDir: string;
  skillPath: string;
  workflowPath: string;
  stageId: string;
  commandCount: number;
  requiresReview: boolean;
  status: 'staged';
}

export interface BrowserSkillTestResult {
  ok: boolean;
  skillName: string;
  checkedAt: number;
  commandCount: number;
  browseAvailable: boolean;
  warnings: string[];
  errors: string[];
}

export interface BrowserSkillRunResult {
  ok: boolean;
  skillName: string;
  startedAt: number;
  durationMs: number;
  stepCount: number;
  stdout: string;
  stderr: string;
  warnings: string[];
  error?: string;
}

export interface BrowserSkillRuntimeSnapshot {
  skills: BrowserSkillEntry[];
  drafts: BrowserSkillDraft[];
}

interface TierPaths {
  project: string;
  global: string;
  bundled: string;
}

const SKILL_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const STAGE_ID_PATTERN = /^[a-z0-9-]{8,80}$/i;
const WORKFLOW_FILE = 'workflow.json';
const ALLOWED_COMMANDS = new Set([
  'goto',
  'snapshot',
  'text',
  'click',
  'fill',
  'type',
  'press',
  'wait',
  'screenshot',
  'status',
  'stop',
]);
const SECRET_KEY_PATTERNS = [
  /TOKEN/i,
  /KEY/i,
  /SECRET/i,
  /PASSWORD/i,
  /CREDENTIAL/i,
  /^AWS_/i,
  /^AZURE_/i,
  /^GCP_/i,
  /^GOOGLE_APPLICATION_/i,
  /^ANTHROPIC_/i,
  /^OPENAI_/i,
  /^GITHUB_/i,
  /^GH_/i,
  /^SSH_/i,
  /^GPG_/i,
  /^NPM_TOKEN/i,
  /^PYPI_/i,
];
const UNTRUSTED_ENV_ALLOWLIST = new Set([
  'PATH',
  'Path',
  'SystemRoot',
  'WINDIR',
  'TEMP',
  'TMP',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TERM',
  'TZ',
]);

export function createBrowserSkillDraft(input: BrowserSkillifyInput): BrowserSkillifyResult {
  const skillName = normalizeBrowserSkillName(input.name);
  const browseEvents = listProjectTimelineEvents({
    cwd: input.cwd,
    category: 'browse',
    limit: input.limit || 40,
  })
    .reverse()
    .filter((event) => event.command && event.status === 'ok');

  if (browseEvents.length === 0) {
    throw new Error('No successful GStack Browse timeline events found for this workspace.');
  }

  const steps = browseEvents
    .map((event): BrowserSkillWorkflowStep => ({
      command: event.command || '',
      args: arrayOfStrings(event.metadata?.args),
      toolName: event.toolName,
      summary: event.summary,
    }))
    .filter((step) => ALLOWED_COMMANDS.has(step.command));

  if (steps.length === 0) {
    throw new Error('No replayable GStack Browse commands were found in the timeline.');
  }

  const requiresReview = steps.some((step) => step.args.some(isRedactedValue));
  const description =
    input.description || 'Replay a proven GStack Browse workflow captured from the project timeline.';
  const trigger = input.trigger || input.name;
  const host = input.host || inferHost(steps) || 'local.workflow';
  const workflow: BrowserSkillWorkflow = {
    version: 1,
    skillName,
    createdAt: new Date().toISOString(),
    source: 'timeline',
    requiresReview,
    steps,
  };
  const files = new Map<string, string>([
    [
      'SKILL.md',
      buildSkillMarkdown({
        skillName,
        description,
        trigger,
        host,
        enabled: false,
        trusted: false,
        commands: steps,
        requiresReview,
      }),
    ],
    [WORKFLOW_FILE, `${JSON.stringify(workflow, null, 2)}\n`],
  ]);

  const stagedDir = stageBrowserSkillFiles({
    cwd: input.cwd,
    name: skillName,
    files,
  });
  const stageId = path.basename(path.dirname(stagedDir));
  const skillPath = path.join(stagedDir, 'SKILL.md');
  const workflowPath = path.join(stagedDir, WORKFLOW_FILE);

  appendProjectTimelineEvent({
    cwd: input.cwd,
    category: 'skillify',
    event: 'browser_skill.draft_staged',
    source: 'browser-skill-runtime',
    status: 'ok',
    summary: `Staged browser skill draft ${skillName}`,
    metadata: { skillName, stageId, commandCount: steps.length, requiresReview },
  });

  return {
    skillName,
    skillDir: stagedDir,
    skillPath,
    workflowPath,
    stageId,
    commandCount: steps.length,
    requiresReview,
    status: 'staged',
  };
}

export function listBrowserSkillRuntime(cwd: string): BrowserSkillRuntimeSnapshot {
  return {
    skills: listBrowserSkills(cwd),
    drafts: listBrowserSkillDrafts(cwd),
  };
}

export function listBrowserSkills(cwd: string): BrowserSkillEntry[] {
  const tiers = getBrowserSkillTierPaths(cwd);
  const seen = new Map<string, BrowserSkillEntry>();
  const order: Array<{ tier: BrowserSkillTier; root: string }> = [
    { tier: 'project', root: tiers.project },
    { tier: 'global', root: tiers.global },
    { tier: 'bundled', root: tiers.bundled },
  ];

  for (const { tier, root } of order) {
    if (!fs.existsSync(root)) continue;
    let entries: string[];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.startsWith('.') || seen.has(entry)) continue;
      const dir = path.join(root, entry);
      if (!isDirectory(dir)) continue;
      const parsed = readBrowserSkillFromDir(entry, tier, dir);
      if (parsed) seen.set(entry, parsed);
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function listBrowserSkillDrafts(cwd: string): BrowserSkillDraft[] {
  const root = getBrowserSkillStagingRoot(cwd);
  if (!fs.existsSync(root)) return [];
  let stageIds: string[];
  try {
    stageIds = fs.readdirSync(root);
  } catch {
    return [];
  }

  return stageIds
    .flatMap((stageId) => readDraftsInStage(cwd, stageId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function testBrowserSkillDraft(cwd: string, stageId: string): BrowserSkillTestResult {
  const draft = readBrowserSkillDraft(cwd, stageId);
  return validateBrowserSkillDir(cwd, draft.stagedDir, draft.skillName);
}

export function testBrowserSkill(cwd: string, name: string): BrowserSkillTestResult {
  const skill = requireBrowserSkill(cwd, name);
  return validateBrowserSkillDir(cwd, skill.dir, skill.name);
}

export function commitBrowserSkillDraft(
  cwd: string,
  stageId: string,
  tier: Exclude<BrowserSkillTier, 'bundled'> = 'project'
): BrowserSkillEntry {
  const draft = readBrowserSkillDraft(cwd, stageId);
  const tiers = getBrowserSkillTierPaths(cwd);
  const tierRoot = tier === 'project' ? tiers.project : tiers.global;
  fs.mkdirSync(tierRoot, { recursive: true, mode: 0o755 });
  const realTierRoot = fs.realpathSync(tierRoot);
  const dest = path.join(realTierRoot, draft.skillName);

  validateBrowserSkillName(draft.skillName);
  ensureWithinPath(dest, realTierRoot, 'committed browser skill');
  assertNotSymlink(draft.stagedDir, 'staged browser skill');
  if (fs.existsSync(dest)) {
    throw new Error(`A browser skill named "${draft.skillName}" already exists in the ${tier} tier.`);
  }

  updateSkillEnabledFlag(draft.skillPath, true);
  fs.renameSync(draft.stagedDir, dest);
  cleanupEmptyStageWrapper(path.dirname(draft.stagedDir));

  appendProjectTimelineEvent({
    cwd,
    category: 'skillify',
    event: 'browser_skill.committed',
    source: 'browser-skill-runtime',
    status: 'ok',
    summary: `Enabled browser skill ${draft.skillName}`,
    metadata: { skillName: draft.skillName, tier, commandCount: draft.commandCount },
  });

  const entry = readBrowserSkillFromDir(draft.skillName, tier, dest);
  if (!entry) throw new Error(`Committed browser skill could not be read from ${dest}`);
  return entry;
}

export function discardBrowserSkillDraft(cwd: string, stageId: string): { success: boolean } {
  const wrapperDir = resolveStageWrapper(cwd, stageId);
  fs.rmSync(wrapperDir, { recursive: true, force: true });
  appendProjectTimelineEvent({
    cwd,
    category: 'skillify',
    event: 'browser_skill.draft_discarded',
    source: 'browser-skill-runtime',
    status: 'ok',
    summary: `Discarded browser skill draft ${stageId}`,
    metadata: { stageId },
  });
  return { success: true };
}

export function setBrowserSkillEnabled(
  cwd: string,
  name: string,
  enabled: boolean
): BrowserSkillEntry {
  const skill = requireBrowserSkill(cwd, name);
  if (skill.tier === 'bundled') {
    throw new Error('Bundled browser skills are read-only.');
  }
  updateSkillEnabledFlag(skill.skillPath, enabled);
  appendProjectTimelineEvent({
    cwd,
    category: 'skillify',
    event: enabled ? 'browser_skill.enabled' : 'browser_skill.disabled',
    source: 'browser-skill-runtime',
    status: 'ok',
    summary: `${enabled ? 'Enabled' : 'Disabled'} browser skill ${skill.name}`,
    metadata: { skillName: skill.name, tier: skill.tier },
  });
  const updated = readBrowserSkillFromDir(skill.name, skill.tier, skill.dir);
  if (!updated) throw new Error(`Browser skill could not be read after updating ${skill.name}`);
  return updated;
}

export function tombstoneBrowserSkill(cwd: string, name: string): { success: boolean; tombstonePath: string } {
  const skill = requireBrowserSkill(cwd, name);
  if (skill.tier === 'bundled') {
    throw new Error('Bundled browser skills are read-only.');
  }
  const tombstoneRoot = path.join(path.dirname(skill.dir), '.tombstones');
  fs.mkdirSync(tombstoneRoot, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tombstonePath = path.join(tombstoneRoot, `${skill.name}-${stamp}`);
  fs.renameSync(skill.dir, tombstonePath);
  appendProjectTimelineEvent({
    cwd,
    category: 'skillify',
    event: 'browser_skill.tombstoned',
    source: 'browser-skill-runtime',
    status: 'ok',
    summary: `Removed browser skill ${skill.name}`,
    metadata: { skillName: skill.name, tier: skill.tier, tombstonePath },
  });
  return { success: true, tombstonePath };
}

export async function runBrowserSkill(
  cwd: string,
  name: string,
  options: { timeoutMs?: number } = {}
): Promise<BrowserSkillRunResult> {
  const skill = requireBrowserSkill(cwd, name);
  const startedAt = Date.now();
  const warnings: string[] = [];
  const output: string[] = [];

  if (!skill.enabled) {
    throw new Error(`Browser skill "${name}" is disabled.`);
  }

  const test = validateBrowserSkillDir(cwd, skill.dir, skill.name);
  if (!test.ok) {
    throw new Error(`Browser skill "${name}" failed validation: ${test.errors.join('; ')}`);
  }
  warnings.push(...test.warnings);

  const workflow = readWorkflow(skill.workflowPath);
  appendProjectTimelineEvent({
    cwd,
    category: 'skillify',
    event: 'browser_skill.run_started',
    source: 'browser-skill-runtime',
    status: 'started',
    summary: `Running browser skill ${skill.name}`,
    metadata: { skillName: skill.name, tier: skill.tier, commandCount: workflow.steps.length },
  });

  try {
    const env = buildBrowserSkillRunEnv(skill.trusted);
    for (const [index, step] of workflow.steps.entries()) {
      const text = await runGStackBrowseCommand(step.command, step.args, {
        cwd,
        timeoutMs: options.timeoutMs,
        source: 'browser-skill-runtime',
        toolName: `browser_skill:${skill.name}:${step.command}`,
        eventPrefix: 'browser_skill.step',
        env,
      });
      output.push(`## Step ${index + 1}: ${step.command}\n${text || 'OK'}`);
    }
    const result: BrowserSkillRunResult = {
      ok: true,
      skillName: skill.name,
      startedAt,
      durationMs: Date.now() - startedAt,
      stepCount: workflow.steps.length,
      stdout: output.join('\n\n'),
      stderr: '',
      warnings,
    };
    appendProjectTimelineEvent({
      cwd,
      category: 'skillify',
      event: 'browser_skill.run_completed',
      source: 'browser-skill-runtime',
      status: 'ok',
      durationMs: result.durationMs,
      summary: `Completed browser skill ${skill.name}`,
      metadata: { skillName: skill.name, commandCount: workflow.steps.length, warnings },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendProjectTimelineEvent({
      cwd,
      category: 'skillify',
      event: 'browser_skill.run_failed',
      source: 'browser-skill-runtime',
      status: 'error',
      durationMs: Date.now() - startedAt,
      summary: message,
      metadata: { skillName: skill.name },
    });
    return {
      ok: false,
      skillName: skill.name,
      startedAt,
      durationMs: Date.now() - startedAt,
      stepCount: workflow.steps.length,
      stdout: output.join('\n\n'),
      stderr: message,
      warnings,
      error: message,
    };
  }
}

export function normalizeBrowserSkillName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);
  validateBrowserSkillName(normalized);
  return normalized;
}

export function validateBrowserSkillName(name: string): void {
  if (!name) throw new Error('Browser skill name is empty.');
  if (name.length > 64) throw new Error(`Browser skill name too long (${name.length} > 64).`);
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error(
      'Browser skill name must start with a letter and contain lowercase letters, numbers, and dashes only.'
    );
  }
}

export function buildBrowserSkillRunEnv(trusted: boolean): NodeJS.ProcessEnv {
  const output: NodeJS.ProcessEnv = {};
  if (trusted) {
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      if (key === 'GSTACK_TOKEN' || key === 'GSTACK_SKILL_TOKEN') continue;
      output[key] = value;
    }
  } else {
    for (const key of UNTRUSTED_ENV_ALLOWLIST) {
      const value = process.env[key];
      if (value !== undefined) output[key] = value;
    }
  }

  for (const key of Object.keys(output)) {
    if (SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      delete output[key];
    }
  }

  output.FISHSWARM_BROWSER_SKILL_TRUSTED = trusted ? '1' : '0';
  return output;
}

function getBrowserSkillTierPaths(cwd: string): TierPaths {
  const workspace = path.resolve(cwd || process.cwd());
  const globalRoot =
    process.env.FISHSWARM_BROWSER_SKILL_GLOBAL_ROOT ||
    path.join(os.homedir(), '.fishswarm', 'browser-skills');
  const bundledRoot =
    process.env.FISHSWARM_BROWSER_SKILL_BUNDLED_ROOT ||
    path.join(projectRootFromCwd(workspace), 'resources', 'browser-skills');
  return {
    project: path.join(workspace, '.fishswarm', 'browser-skills'),
    global: globalRoot,
    bundled: bundledRoot,
  };
}

function getBrowserSkillStagingRoot(cwd: string): string {
  return path.join(path.resolve(cwd || process.cwd()), '.fishswarm', '.tmp', 'browser-skillify');
}

function stageBrowserSkillFiles(input: {
  cwd: string;
  name: string;
  files: Map<string, string | Buffer>;
}): string {
  validateBrowserSkillName(input.name);
  if (input.files.size === 0) throw new Error('Cannot stage an empty browser skill.');

  const stageId = randomUUID();
  const wrapperDir = path.join(getBrowserSkillStagingRoot(input.cwd), stageId);
  const stagedDir = path.join(wrapperDir, input.name);
  fs.mkdirSync(stagedDir, { recursive: true, mode: 0o700 });
  const realStagedDir = fs.realpathSync(stagedDir);

  for (const [relativePath, contents] of input.files.entries()) {
    if (path.isAbsolute(relativePath)) {
      throw new Error(`Invalid browser skill file path: ${relativePath}`);
    }
    const filePath = path.resolve(realStagedDir, relativePath);
    ensureWithinPath(filePath, realStagedDir, 'staged browser skill file');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }

  return stagedDir;
}

function readDraftsInStage(cwd: string, stageId: string): BrowserSkillDraft[] {
  if (!STAGE_ID_PATTERN.test(stageId)) return [];
  const wrapperDir = resolveStageWrapper(cwd, stageId);
  if (!fs.existsSync(wrapperDir) || !isDirectory(wrapperDir)) return [];
  let entries: string[];
  try {
    entries = fs.readdirSync(wrapperDir);
  } catch {
    return [];
  }
  return entries
    .map((entry) => readDraftFromDir(stageId, path.join(wrapperDir, entry)))
    .filter((draft): draft is BrowserSkillDraft => draft !== null);
}

function readDraftFromDir(stageId: string, dir: string): BrowserSkillDraft | null {
  if (!isDirectory(dir)) return null;
  const skillPath = path.join(dir, 'SKILL.md');
  const workflowPath = path.join(dir, WORKFLOW_FILE);
  if (!fs.existsSync(skillPath) || !fs.existsSync(workflowPath)) return null;
  try {
    const parsed = parseSkillFile(fs.readFileSync(skillPath, 'utf-8'), {
      skillName: path.basename(dir),
    });
    const workflow = readWorkflow(workflowPath);
    const stat = fs.statSync(skillPath);
    return {
      stageId,
      skillName: parsed.frontmatter.name,
      stagedDir: dir,
      skillPath,
      workflowPath,
      commandCount: workflow.steps.length,
      requiresReview: workflow.requiresReview,
      createdAt: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

function readBrowserSkillDraft(cwd: string, stageId: string): BrowserSkillDraft {
  const drafts = readDraftsInStage(cwd, stageId);
  if (drafts.length === 0) throw new Error(`Browser skill draft not found: ${stageId}`);
  return drafts[0];
}

function resolveStageWrapper(cwd: string, stageId: string): string {
  if (!STAGE_ID_PATTERN.test(stageId)) {
    throw new Error(`Invalid browser skill stage id: ${stageId}`);
  }
  const root = getBrowserSkillStagingRoot(cwd);
  const wrapperDir = path.resolve(root, stageId);
  ensureWithinPath(wrapperDir, path.resolve(root), 'browser skill staging wrapper');
  return wrapperDir;
}

function readBrowserSkillFromDir(
  name: string,
  tier: BrowserSkillTier,
  dir: string
): BrowserSkillEntry | null {
  const skillPath = path.join(dir, 'SKILL.md');
  const workflowPath = path.join(dir, WORKFLOW_FILE);
  if (!fs.existsSync(skillPath) || !fs.existsSync(workflowPath)) return null;
  try {
    const content = fs.readFileSync(skillPath, 'utf-8');
    const { frontmatter, bodyMd } = parseSkillFile(content, { skillName: name });
    const workflow = readWorkflow(workflowPath);
    const stat = fs.statSync(skillPath);
    return {
      name,
      tier,
      dir,
      skillPath,
      workflowPath,
      frontmatter,
      bodyMd,
      enabled: frontmatter.enabled,
      trusted: frontmatter.trusted,
      testable: true,
      runnable: frontmatter.enabled && workflow.steps.length > 0,
      requiresReview: workflow.requiresReview,
      commandCount: workflow.steps.length,
      lastModified: stat.mtimeMs,
    };
  } catch {
    return null;
  }
}

function requireBrowserSkill(cwd: string, name: string): BrowserSkillEntry {
  const normalized = normalizeBrowserSkillName(name);
  const skill = listBrowserSkills(cwd).find((item) => item.name === normalized);
  if (!skill) throw new Error(`Browser skill not found: ${normalized}`);
  return skill;
}

function validateBrowserSkillDir(cwd: string, dir: string, skillName: string): BrowserSkillTestResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const skillPath = path.join(dir, 'SKILL.md');
  const workflowPath = path.join(dir, WORKFLOW_FILE);

  if (!fs.existsSync(skillPath)) errors.push('Missing SKILL.md.');
  if (!fs.existsSync(workflowPath)) errors.push(`Missing ${WORKFLOW_FILE}.`);

  let workflow: BrowserSkillWorkflow | null = null;
  if (fs.existsSync(skillPath)) {
    try {
      const parsed = parseSkillFile(fs.readFileSync(skillPath, 'utf-8'), { skillName });
      if (parsed.frontmatter.name !== skillName) {
        errors.push(`SKILL.md name "${parsed.frontmatter.name}" does not match directory "${skillName}".`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (fs.existsSync(workflowPath)) {
    try {
      workflow = readWorkflow(workflowPath);
      if (workflow.skillName !== skillName) {
        errors.push(`workflow skillName "${workflow.skillName}" does not match "${skillName}".`);
      }
      if (workflow.steps.length === 0) errors.push('Workflow has no steps.');
      for (const [index, step] of workflow.steps.entries()) {
        if (!ALLOWED_COMMANDS.has(step.command)) {
          errors.push(`Step ${index + 1} uses unsupported command "${step.command}".`);
        }
        if (!Array.isArray(step.args) || !step.args.every((arg) => typeof arg === 'string')) {
          errors.push(`Step ${index + 1} args must be strings.`);
        }
        if (step.args.some(isRedactedValue)) {
          errors.push(`Step ${index + 1} contains redacted args; edit workflow.json before enabling.`);
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const browseAvailable = Boolean(resolveGStackBrowseBinary(cwd));
  if (!browseAvailable) {
    warnings.push('GStack Browse binary was not found; validation passed but runtime execution will fail.');
  }

  return {
    ok: errors.length === 0,
    skillName,
    checkedAt: Date.now(),
    commandCount: workflow?.steps.length || 0,
    browseAvailable,
    warnings,
    errors,
  };
}

function parseSkillFile(
  content: string,
  options: { skillName?: string } = {}
): { frontmatter: BrowserSkillFrontmatter; bodyMd: string } {
  if (!content.startsWith('---\n')) {
    throw new Error('SKILL.md missing frontmatter block.');
  }
  const fmEnd = content.indexOf('\n---', 4);
  if (fmEnd === -1) throw new Error('SKILL.md frontmatter block is not terminated.');
  const fmText = content.slice(4, fmEnd);
  const bodyMd = content.slice(fmEnd + 4).replace(/^\n+/, '');
  const raw = parseFrontmatterFields(fmText);
  const name = stringField(raw.name) || options.skillName || '';
  validateBrowserSkillName(name);

  return {
    frontmatter: {
      name,
      description: stringField(raw.description),
      host: stringField(raw.host),
      triggers: stringArrayField(raw.triggers),
      args: argArrayField(raw.args),
      trusted: raw.trusted === true,
      enabled: raw.enabled !== false,
      version: stringField(raw.version),
      source: raw.source === 'human' || raw.source === 'agent' ? raw.source : undefined,
    },
    bodyMd,
  };
}

function parseFrontmatterFields(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith('#') || line.startsWith(' ')) continue;
    const scalar = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!scalar) continue;
    const key = scalar[1];
    const value = scalar[2];
    if (value === '') {
      const items: string[] = [];
      let cursor = index + 1;
      while (cursor < lines.length) {
        const item = lines[cursor].match(/^\s+-\s+(.*)$/);
        if (!item) break;
        items.push(stripQuotes(item[1]));
        cursor++;
      }
      result[key] = items;
      index = cursor - 1;
    } else if (value === '[]') {
      result[key] = [];
    } else if (value === 'true') {
      result[key] = true;
    } else if (value === 'false') {
      result[key] = false;
    } else {
      result[key] = stripQuotes(value);
    }
  }
  return result;
}

function readWorkflow(filePath: string): BrowserSkillWorkflow {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<BrowserSkillWorkflow>;
  if (raw.version !== 1) throw new Error('Unsupported browser skill workflow version.');
  if (typeof raw.skillName !== 'string') throw new Error('workflow.json missing skillName.');
  validateBrowserSkillName(raw.skillName);
  if (!Array.isArray(raw.steps)) throw new Error('workflow.json steps must be an array.');
  return {
    version: 1,
    skillName: raw.skillName,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString(),
    source: raw.source === 'human' ? 'human' : 'timeline',
    requiresReview: raw.requiresReview === true,
    steps: raw.steps.map((step) => ({
      command: typeof step.command === 'string' ? step.command : '',
      args: arrayOfStrings(step.args),
      toolName: typeof step.toolName === 'string' ? step.toolName : undefined,
      summary: typeof step.summary === 'string' ? step.summary : undefined,
    })),
  };
}

function buildSkillMarkdown(input: {
  skillName: string;
  description: string;
  trigger: string;
  host: string;
  enabled: boolean;
  trusted: boolean;
  commands: BrowserSkillWorkflowStep[];
  requiresReview: boolean;
}): string {
  const commandList = input.commands
    .map((command, index) => {
      const label = command.toolName || command.command;
      return `${index + 1}. ${label}: ${command.summary || command.command}`;
    })
    .join('\n');
  const reviewNote = input.requiresReview
    ? '- workflow.json contains redacted args. Edit those placeholders before enabling or running.\n'
    : '';

  return `---
name: ${input.skillName}
description: ${singleLine(input.description)}
host: ${singleLine(input.host)}
triggers:
  - ${singleLine(input.trigger)}
args: []
trusted: ${input.trusted ? 'true' : 'false'}
enabled: ${input.enabled ? 'true' : 'false'}
version: 1.0.0
source: agent
---

# ${input.skillName}

This browser workflow was staged from successful FishSwarm GStack Browse timeline events.

## Replay Plan

${commandList}

## Runtime Notes

- Runtime execution reads workflow.json and replays each command through the FishSwarm GStack Browse runner.
- Drafts stay under .fishswarm/.tmp/browser-skillify until tested and explicitly enabled.
${reviewNote}- Keep credentials and one-time tokens out of SKILL.md and workflow.json.
`;
}

function updateSkillEnabledFlag(skillPath: string, enabled: boolean): void {
  const content = fs.readFileSync(skillPath, 'utf-8');
  const fmEnd = content.indexOf('\n---', 4);
  if (!content.startsWith('---\n') || fmEnd === -1) {
    throw new Error('Cannot update enabled flag: SKILL.md frontmatter is invalid.');
  }
  const frontmatter = content.slice(4, fmEnd);
  const body = content.slice(fmEnd);
  const lines = frontmatter.split('\n');
  let replaced = false;
  const nextLines = lines.map((line) => {
    if (/^enabled:\s*/.test(line)) {
      replaced = true;
      return `enabled: ${enabled ? 'true' : 'false'}`;
    }
    return line;
  });
  if (!replaced) nextLines.push(`enabled: ${enabled ? 'true' : 'false'}`);
  fs.writeFileSync(skillPath, `---\n${nextLines.join('\n')}${body}`, 'utf-8');
}

function projectRootFromCwd(cwd: string): string {
  let current = path.resolve(cwd);
  for (;;) {
    if (fs.existsSync(path.join(current, 'package.json')) || fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(cwd);
    current = parent;
  }
}

function inferHost(steps: BrowserSkillWorkflowStep[]): string | null {
  for (const step of steps) {
    if (step.command !== 'goto') continue;
    const url = step.args.find((arg) => /^https?:\/\//i.test(arg));
    if (!url) continue;
    try {
      return new URL(url).host;
    } catch {
      return null;
    }
  }
  return null;
}

function cleanupEmptyStageWrapper(wrapperDir: string): void {
  try {
    if (path.basename(path.dirname(wrapperDir)) !== 'browser-skillify') return;
    if (fs.existsSync(wrapperDir) && fs.readdirSync(wrapperDir).length === 0) {
      fs.rmdirSync(wrapperDir);
    }
  } catch {
    // best effort
  }
}

function assertNotSymlink(filePath: string, label: string): void {
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink()) throw new Error(`${label} is a symlink; refusing to use it.`);
  if (!stat.isDirectory()) throw new Error(`${label} is not a directory.`);
}

function ensureWithinPath(candidate: string, root: string, label: string): void {
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error(`${label} escapes its expected root.`);
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringArrayField(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function argArrayField(value: unknown): BrowserSkillArg[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string | BrowserSkillArg => {
      return typeof item === 'string' || (typeof item === 'object' && item !== null);
    })
    .map((item) => {
      if (typeof item === 'string') return { name: item };
      const name = typeof item.name === 'string' ? item.name : '';
      const description = typeof item.description === 'string' ? item.description : undefined;
      return { name, description };
    })
    .filter((item) => item.name.length > 0);
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isRedactedValue(value: string): boolean {
  return value === '<REDACTED>' || value.includes('<REDACTED>');
}

function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}
