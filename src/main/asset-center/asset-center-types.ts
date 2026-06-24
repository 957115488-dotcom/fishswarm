export type AssetKind =
  | 'concept.lowcode'
  | 'skill.builtIn'
  | 'skill.domain'
  | 'plugin'
  | 'mcp.server'
  | 'mcp.tool'
  | 'role'
  | 'workflow.template'
  | 'workflow.artifact'
  | 'component.blueprint'
  | 'prompt.template'
  | 'dataModel.draft'
  | 'ai.provider'
  | 'ai.modelPreset'
  | 'ai.providerSetup'
  | 'ai.apiConfigSet'
  | 'export.package';

export type AssetSource = 'built-in' | 'project' | 'user' | 'plugin' | 'session' | 'generated';
export type AssetScope = 'app' | 'workspace' | 'session' | 'remote';
export type AssetStatus =
  | 'available'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'needsSetup'
  | 'requiresCredential'
  | 'requiresConnector'
  | 'unavailable'
  | 'unknown';

export type ReadOnlyAssetAction = 'viewDetails' | 'openSource' | 'preview';
export type DeferredAssetAction =
  | 'useInTask'
  | 'insertPrompt'
  | 'configure'
  | 'testConnection'
  | 'dryRunExport';
export type AssetAction = ReadOnlyAssetAction | DeferredAssetAction;

export interface AssetSourceRef {
  type: 'file' | 'directory' | 'ipc' | 'mcp' | 'plugin' | 'generated' | 'memory';
  path?: string;
  uri?: string;
  id?: string;
}

export interface AssetCenterItem {
  id: string;
  kind: AssetKind;
  source: AssetSource;
  scope: AssetScope;
  status: AssetStatus;
  title: string;
  summary: string;
  tags: string[];
  sourceRef: AssetSourceRef;
  schemaVersion: number;
  updatedAt?: string;
  contentHash?: string;
  credentialRefs?: string[];
  policyRefs?: string[];
  lineageRefs?: string[];
  actions: AssetAction[];
  warnings: string[];
}

export interface AssetCenterSnapshot {
  schemaVersion: number;
  generatedAt: string;
  items: AssetCenterItem[];
  stats: Record<string, number>;
  warnings: string[];
}

export interface AssetSourceAdapterResult {
  items: AssetCenterItem[];
  warnings: string[];
}

export interface AssetSourceAdapter {
  id: string;
  listAssets(): AssetSourceAdapterResult;
}
