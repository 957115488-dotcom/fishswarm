import path from 'node:path';
import type {
  LogicFlowDiagnostic,
  LogicFlowDocument,
  LogicFlowEdge,
  LogicFlowNode,
  LogicFlowPreview,
} from '../../shared/logic-flow-types';

const ROLE_REF_PATTERN = /^[a-z0-9][a-z0-9-]{1,80}$/i;

function diagnostic(input: LogicFlowDiagnostic): LogicFlowDiagnostic {
  return input;
}

function isSafeRelativePathPattern(value: string): boolean {
  const normalized = path.posix.normalize(value.replace(/\\/g, '/').replace(/^\.\//, ''));
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    return false;
  }
  if (path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) return false;
  return !normalized.includes('\x00');
}

function validateDocumentShape(document: LogicFlowDocument): LogicFlowDiagnostic[] {
  const diagnostics: LogicFlowDiagnostic[] = [];
  if (document.schemaVersion !== 1) {
    diagnostics.push(
      diagnostic({ severity: 'error', code: 'schema.version', message: 'schemaVersion must be 1.' })
    );
  }
  if (!document.id?.trim()) {
    diagnostics.push(
      diagnostic({ severity: 'error', code: 'document.id', message: 'id is required.' })
    );
  }
  if (!document.title?.trim()) {
    diagnostics.push(
      diagnostic({ severity: 'error', code: 'document.title', message: 'title is required.' })
    );
  }
  if (!Array.isArray(document.nodes) || document.nodes.length === 0) {
    diagnostics.push(
      diagnostic({
        severity: 'error',
        code: 'nodes.empty',
        message: 'at least one node is required.',
      })
    );
  }
  if (!Array.isArray(document.edges)) {
    diagnostics.push(
      diagnostic({ severity: 'error', code: 'edges.invalid', message: 'edges must be an array.' })
    );
  }
  return diagnostics;
}

function validateNodes(nodes: LogicFlowNode[]): LogicFlowDiagnostic[] {
  const diagnostics: LogicFlowDiagnostic[] = [];
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id?.trim()) {
      diagnostics.push(
        diagnostic({ severity: 'error', code: 'node.id', message: 'node id is required.' })
      );
      continue;
    }
    if (ids.has(node.id)) {
      diagnostics.push(
        diagnostic({
          severity: 'error',
          code: 'node.duplicate',
          message: `duplicate node id: ${node.id}`,
          nodeId: node.id,
        })
      );
    }
    ids.add(node.id);

    if (node.type === 'role' && node.roleRef && !ROLE_REF_PATTERN.test(node.roleRef)) {
      diagnostics.push(
        diagnostic({
          severity: 'error',
          code: 'node.roleRef',
          message: `invalid roleRef: ${node.roleRef}`,
          nodeId: node.id,
        })
      );
    }

    for (const [kind, values] of [
      ['allowedPaths', node.allowedPaths || []],
      ['deniedPaths', node.deniedPaths || []],
    ] as const) {
      for (const value of values) {
        if (!isSafeRelativePathPattern(value)) {
          diagnostics.push(
            diagnostic({
              severity: 'error',
              code: `node.${kind}`,
              message: `unsafe ${kind} entry: ${value}`,
              nodeId: node.id,
            })
          );
        }
      }
    }
  }
  return diagnostics;
}

function validateEdges(nodes: LogicFlowNode[], edges: LogicFlowEdge[]): LogicFlowDiagnostic[] {
  const diagnostics: LogicFlowDiagnostic[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (!edge.id?.trim()) {
      diagnostics.push(
        diagnostic({ severity: 'error', code: 'edge.id', message: 'edge id is required.' })
      );
      continue;
    }
    if (edgeIds.has(edge.id)) {
      diagnostics.push(
        diagnostic({
          severity: 'error',
          code: 'edge.duplicate',
          message: `duplicate edge id: ${edge.id}`,
          edgeId: edge.id,
        })
      );
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) {
      diagnostics.push(
        diagnostic({
          severity: 'error',
          code: 'edge.source',
          message: `edge source does not exist: ${edge.source}`,
          edgeId: edge.id,
        })
      );
    }
    if (!nodeIds.has(edge.target)) {
      diagnostics.push(
        diagnostic({
          severity: 'error',
          code: 'edge.target',
          message: `edge target does not exist: ${edge.target}`,
          edgeId: edge.id,
        })
      );
    }
  }
  return diagnostics;
}

function detectCycle(nodes: LogicFlowNode[], edges: LogicFlowEdge[]): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) {
    if (adjacency.has(edge.source) && adjacency.has(edge.target)) {
      adjacency.get(edge.source)?.push(edge.target);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(nodeId: string): string[] | null {
    if (visiting.has(nodeId)) {
      const index = stack.indexOf(nodeId);
      return index >= 0 ? stack.slice(index).concat(nodeId) : [nodeId];
    }
    if (visited.has(nodeId)) return null;
    visiting.add(nodeId);
    stack.push(nodeId);
    for (const next of adjacency.get(nodeId) || []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
    return null;
  }

  for (const node of nodes) {
    const cycle = visit(node.id);
    if (cycle) return cycle;
  }
  return null;
}

function topologicalOrder(nodes: LogicFlowNode[], edges: LogicFlowEdge[]): string[] {
  const indegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
  }
  const queue = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort((a, b) => a.localeCompare(b));
  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    ordered.push(current);
    for (const next of adjacency.get(current) || []) {
      const nextCount = (indegree.get(next) || 0) - 1;
      indegree.set(next, nextCount);
      if (nextCount === 0) {
        queue.push(next);
        queue.sort((a, b) => a.localeCompare(b));
      }
    }
  }
  return ordered.length === nodes.length ? ordered : nodes.map((node) => node.id);
}

export function validateLogicFlowDocument(document: LogicFlowDocument): LogicFlowDiagnostic[] {
  const diagnostics = [
    ...validateDocumentShape(document),
    ...validateNodes(document.nodes || []),
    ...validateEdges(document.nodes || [], document.edges || []),
  ];

  if (diagnostics.some((item) => item.severity === 'error')) {
    return diagnostics;
  }

  if (!document.allowCycles) {
    const cycle = detectCycle(document.nodes, document.edges);
    if (cycle) {
      diagnostics.push(
        diagnostic({
          severity: 'error',
          code: 'graph.cycle',
          message: `logic flow contains a cycle: ${cycle.join(' -> ')}`,
        })
      );
    }
  }

  return diagnostics;
}

export function previewLogicFlowDocument(document: LogicFlowDocument): LogicFlowPreview {
  const diagnostics = validateLogicFlowDocument(document);
  const valid = !diagnostics.some((item) => item.severity === 'error');
  return {
    valid,
    executable: false,
    nodeCount: document.nodes?.length || 0,
    edgeCount: document.edges?.length || 0,
    orderedNodeIds: valid ? topologicalOrder(document.nodes, document.edges) : [],
    diagnostics,
  };
}
