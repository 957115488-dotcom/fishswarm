export type ExportPackageMode = 'audit-source' | 'deployable-source';

export interface ExportFileCandidate {
  path: string;
  size: number;
  sha256: string;
}

export interface ExportBlocker {
  code: string;
  message: string;
  path?: string;
  severity: 'blocker';
}

export interface RedactionFinding {
  type: 'api_key' | 'token' | 'private_key' | 'cookie' | 'credential' | 'unknown';
  path: string;
  line?: number;
  severity: 'warning' | 'blocker';
  message: string;
}

export interface ExportPackageManifest {
  schemaVersion: 1;
  packageId: string;
  mode: ExportPackageMode;
  createdAt: string;
  fishSwarmVersion?: string;
  git: {
    commit: string;
    branch: string;
    dirty: boolean;
  };
  includeRules: string[];
  excludeRules: string[];
  files: ExportFileCandidate[];
  artifactRefs: string[];
  warnings: string[];
  blockers: ExportBlocker[];
}

export interface ExportDryRunInput {
  cwd: string;
  mode?: ExportPackageMode;
  includeRules?: string[];
  excludeRules?: string[];
  artifactRefs?: string[];
  fishSwarmVersion?: string;
  now?: Date;
}

export interface ExportDryRunResult {
  dryRun: true;
  ok: boolean;
  manifest: ExportPackageManifest;
  candidates: ExportFileCandidate[];
  redactionFindings: RedactionFinding[];
  warnings: string[];
  blockers: ExportBlocker[];
}
