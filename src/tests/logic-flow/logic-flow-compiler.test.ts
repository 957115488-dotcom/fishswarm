import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as compiler from '../../main/logic-flow/logic-flow-compiler';
import { listWorkflowArtifacts } from '../../main/workflows/workflow-artifact-store';
import type { LogicFlowDocument } from '../../shared/logic-flow-types';

const previousTimelineRoot = process.env.FISHSWARM_TIMELINE_ROOT;
const tempRoots: string[] = [];

function makeWorkspace(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fishswarm-logic-flow-'));
  tempRoots.push(root);
  process.env.FISHSWARM_TIMELINE_ROOT = path.join(root, 'timeline');
  const cwd = path.join(root, 'workspace');
  fs.mkdirSync(cwd, { recursive: true });
  return cwd;
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
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const document: LogicFlowDocument = {
  schemaVersion: 1,
  id: 'flow-1',
  title: 'Plan then review',
  nodes: [
    {
      id: 'plan',
      type: 'role',
      title: 'Plan',
      roleRef: 'engineering-architect',
      allowedPaths: ['src/**'],
    },
    { id: 'review', type: 'manual', title: 'Review', deniedPaths: ['.env'] },
  ],
  edges: [{ id: 'edge-1', source: 'plan', target: 'review' }],
};

describe('logic flow compiler', () => {
  it('lists built-in preview templates as defensive copies', () => {
    const first = compiler.listBuiltInLogicFlows();
    first[0].document.title = 'mutated';
    const second = compiler.listBuiltInLogicFlows();

    expect(second[0].document.title).not.toBe('mutated');
    expect(second[0].document.allowCycles).toBeUndefined();
  });

  it('previews and validates logic flows without execution', () => {
    const preview = compiler.previewLogicFlow(document);

    expect(preview.valid).toBe(true);
    expect(preview.executable).toBe(false);
    expect(compiler.validateLogicFlow(document)).toEqual([]);
  });

  it('creates a logic_flow_draft artifact for valid flow documents', () => {
    const cwd = makeWorkspace();
    const envelope = compiler.createPlanArtifactFromLogicFlow({
      cwd,
      document,
      sessionId: 'session-1',
      roleRefs: ['engineering-architect'],
    });
    const artifacts = listWorkflowArtifacts({ cwd, kind: 'logic_flow_draft' });

    expect(envelope.kind).toBe('logic_flow_draft');
    expect(envelope.status).toBe('ready');
    expect(envelope.artifact.executable).toBe(false);
    expect(envelope.artifact.lineage.allowedPaths).toEqual(['src/**']);
    expect(envelope.artifact.lineage.deniedPaths).toEqual(['.env']);
    expect(envelope.artifact.lineage.conceptRefs).toEqual(['lowcode-concept:logic-design']);
    expect(artifacts).toHaveLength(1);
  });

  it('refuses invalid flows and exposes no run or execute API', () => {
    const invalid = { ...document, edges: [{ id: 'edge-1', source: 'plan', target: 'missing' }] };

    expect(() => compiler.createPlanArtifactFromLogicFlow({ document: invalid })).toThrow(
      /validation errors/i
    );
    expect(Object.keys(compiler).some((key) => /run|execute/i.test(key))).toBe(false);
  });
});
