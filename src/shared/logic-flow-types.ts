export type LogicFlowNodeType = 'role' | 'asset' | 'tool' | 'decision' | 'artifact' | 'manual';

export interface LogicFlowNode {
  id: string;
  type: LogicFlowNodeType;
  title: string;
  description?: string;
  roleRef?: string;
  assetRef?: string;
  prompt?: string;
  allowedPaths?: string[];
  deniedPaths?: string[];
  data?: Record<string, unknown>;
}

export interface LogicFlowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

export interface LogicFlowDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  description?: string;
  allowCycles?: boolean;
  nodes: LogicFlowNode[];
  edges: LogicFlowEdge[];
  metadata?: Record<string, unknown>;
}

export interface LogicFlowDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface LogicFlowPreview {
  valid: boolean;
  executable: false;
  nodeCount: number;
  edgeCount: number;
  orderedNodeIds: string[];
  diagnostics: LogicFlowDiagnostic[];
}
