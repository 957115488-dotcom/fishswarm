import { contextBridge, ipcRenderer } from 'electron';
import type {
  ClientEvent,
  ServerEvent,
  AppConfig,
  CreateSetPayload,
  ProviderPresets,
  Skill,
  ApiTestInput,
  ApiTestResult,
  PluginCatalogItemV2,
  InstalledPlugin,
  PluginInstallResultV2,
  PluginToggleResult,
  PluginComponentKind,
  ScheduleTask,
  ScheduleCreateInput,
  ScheduleUpdateInput,
  ProviderModelInfo,
  LocalOllamaDiscoveryResult,
  MemoryOverview,
  MemorySearchResult,
  MemoryReadResult,
  MemorySearchScope,
  MemoryDebugFileInfo,
  MemoryDebugFileContent,
  MemoryInspectSessionResult,
} from '../renderer/types';
import type { DiagnosticInput, DiagnosticResult } from '../renderer/types';
import type {
  ContextSnapshot,
  AddDecisionInput,
  ActiveDecision,
  AssetCenterSnapshot,
  BacklogSpecArtifact,
  BacklogSpecInput,
  BenchmarkRunArtifact,
  BenchmarkRunInput,
  BrowserAuthImportSummaryArtifact,
  BrowserAuthImportSummaryInput,
  BrowserSkillEntry,
  BrowserSkillEvidenceArtifact,
  BrowserSkillEvidenceInput,
  BrowserSkillifyInput,
  BrowserSkillifyResult,
  BrowserSkillRuntimeSnapshot,
  BrowserSkillRunResult,
  BrowserSkillTestResult,
  CanaryMonitorArtifact,
  CanaryMonitorInput,
  ChangeScopeReport,
  CodeHealthSnapshot,
  DecisionEvent,
  DecisionStoreSnapshot,
  DevexAuditArtifact,
  DevexAuditInput,
  DocumentReleaseCoverageSnapshot,
  HealthSummary,
  ImplementationTasksArtifact,
  ImplementationTasksInput,
  IncubateRoleInput,
  IncubateRoleResult,
  InvestigationArtifact,
  InvestigationInput,
  McpServerConfig,
  McpTool,
  McpServerStatus,
  McpPresetsMap,
  ProjectLearning,
  ProjectLearningExportInput,
  ProjectLearningMaintenanceReport,
  ProjectLearningPruneInput,
  ProjectLearningPruneResult,
  ProjectLearningSearchInput,
  ProjectLearningStats,
  ProjectTimelineCategory,
  ProjectTimelineEvent,
  QuestionPolicySnapshot,
  QuestionPreference,
  QuestionPreferenceRecord,
  ReleaseSummaryArtifact,
  ReleaseSummaryInput,
  RemoteConfig,
  ResetRoleInput,
  RejectRoleCandidateInput,
  ReviewGateArtifact,
  ReviewGateInput,
  RoleCandidate,
  RoleCandidateSnapshot,
  RoleDefinition,
  RoleRegistrySnapshot,
  RoleRuntimeSnapshot,
  SaveRoleCandidateInput,
  SaveRoleInput,
  GatewayConfig,
  FeishuChannelConfig,
  PairedUser,
  PairingRequest,
  RemoteSessionMapping,
  SessionGuardState,
  SessionGuardUpdate,
  ShipGateArtifact,
  ShipGateInput,
  VisualQaArtifact,
  VisualQaInput,
  WorkflowArtifactEnvelope,
  WorkflowArtifactListInput,
} from '../shared/ipc-types';

// Track registered callbacks to prevent duplicate listeners
let registeredCallback: ((event: ServerEvent) => void) | null = null;
let ipcListener: ((event: Electron.IpcRendererEvent, data: ServerEvent) => void) | null = null;

// Allowlist of valid ClientEvent types to prevent spoofing arbitrary IPC channels
const ALLOWED_CLIENT_EVENTS: ReadonlySet<string> = new Set<ClientEvent['type']>([
  'session.start',
  'session.continue',
  'session.stop',
  'session.delete',
  'session.batchDelete',
  'session.list',
  'session.getMessages',
  'session.getTraceSteps',
  'permission.response',
  'sudo.password.response',
  'settings.update',
  'folder.select',
  'workdir.get',
  'workdir.set',
  'workdir.select',
]);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Send events to main process
  send: (event: ClientEvent) => {
    if (!ALLOWED_CLIENT_EVENTS.has(event.type)) {
      console.warn('[Preload] Blocked unauthorized event type:', event.type);
      return;
    }
    console.log('[Preload] Sending event:', event.type);
    ipcRenderer.send('client-event', event);
  },

  // Receive events from main process - ensures only ONE listener
  on: (callback: (event: ServerEvent) => void) => {
    // Remove previous listener if exists
    if (ipcListener) {
      console.log('[Preload] Removing previous listener');
      ipcRenderer.removeListener('server-event', ipcListener);
    }

    registeredCallback = callback;
    ipcListener = (_: Electron.IpcRendererEvent, data: ServerEvent) => {
      console.log('[Preload] Received event:', data.type);
      if (registeredCallback) {
        registeredCallback(data);
      }
    };

    console.log('[Preload] Registering new listener');
    ipcRenderer.on('server-event', ipcListener);

    // Return cleanup function
    return () => {
      console.log('[Preload] Cleanup called');
      if (ipcListener) {
        ipcRenderer.removeListener('server-event', ipcListener);
        ipcListener = null;
        registeredCallback = null;
      }
    };
  },

  // Invoke and wait for response
  invoke: async <T>(event: ClientEvent): Promise<T> => {
    if (!ALLOWED_CLIENT_EVENTS.has(event.type)) {
      console.warn('[Preload] Blocked unauthorized invoke type:', event.type);
      throw new Error(`Unauthorized event type: ${event.type}`);
    }
    console.log('[Preload] Invoking:', event.type);
    return ipcRenderer.invoke('client-invoke', event);
  },

  // Platform info
  platform: process.platform,

  // System theme
  getSystemTheme: () => ipcRenderer.invoke('system.getTheme'),

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Open links in default browser
  openExternal: (url: string) => {
    // Sanitize mailto: URLs to strip dangerous query params that could attach files
    let safeUrl = url;
    if (/^mailto:/i.test(url)) {
      try {
        const parsed = new URL(url);
        parsed.searchParams.delete('attach');
        parsed.searchParams.delete('attachment');
        safeUrl = parsed.toString();
      } catch {
        // If URL parsing fails, block the call
        return Promise.resolve(false);
      }
    }
    return ipcRenderer.invoke('shell.openExternal', safeUrl);
  },
  showItemInFolder: (filePath: string, cwd?: string) =>
    ipcRenderer.invoke('shell.showItemInFolder', filePath, cwd),

  // Select files using native dialog
  selectFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog.selectFiles'),

  artifacts: {
    listRecentFiles: (
      cwd: string,
      sinceMs: number,
      limit = 50
    ): Promise<Array<{ path: string; modifiedAt: number; size: number }>> =>
      ipcRenderer.invoke('artifacts.listRecentFiles', cwd, sinceMs, Math.min(limit, 500)),
  },

  assetCenter: {
    getSnapshot: (): Promise<AssetCenterSnapshot> => ipcRenderer.invoke('assetCenter.getSnapshot'),
  },

  // Config methods
  config: {
    get: (): Promise<AppConfig> => ipcRenderer.invoke('config.get'),
    getPresets: (): Promise<ProviderPresets> => ipcRenderer.invoke('config.getPresets'),
    save: (config: Partial<AppConfig>): Promise<{ success: boolean; config: AppConfig }> =>
      ipcRenderer.invoke('config.save', config),
    createSet: (payload: CreateSetPayload): Promise<{ success: boolean; config: AppConfig }> =>
      ipcRenderer.invoke('config.createSet', payload),
    renameSet: (payload: {
      id: string;
      name: string;
    }): Promise<{ success: boolean; config: AppConfig }> =>
      ipcRenderer.invoke('config.renameSet', payload),
    deleteSet: (payload: { id: string }): Promise<{ success: boolean; config: AppConfig }> =>
      ipcRenderer.invoke('config.deleteSet', payload),
    switchSet: (payload: { id: string }): Promise<{ success: boolean; config: AppConfig }> =>
      ipcRenderer.invoke('config.switchSet', payload),
    isConfigured: (): Promise<boolean> => ipcRenderer.invoke('config.isConfigured'),
    test: (config: ApiTestInput): Promise<ApiTestResult> =>
      ipcRenderer.invoke('config.test', config),
    listModels: (payload: {
      provider: AppConfig['provider'];
      apiKey: string;
      baseUrl?: string;
    }): Promise<ProviderModelInfo[]> => ipcRenderer.invoke('config.listModels', payload),
    diagnose: (input: DiagnosticInput): Promise<DiagnosticResult> =>
      ipcRenderer.invoke('config.diagnose', input),
    discoverLocal: (payload?: { baseUrl?: string }): Promise<LocalOllamaDiscoveryResult> =>
      ipcRenderer.invoke('config.discover-local', payload),
  },

  // Window control methods
  window: {
    minimize: () => ipcRenderer.send('window.minimize'),
    maximize: () => ipcRenderer.send('window.maximize'),
    close: () => ipcRenderer.send('window.close'),
  },

  // MCP methods
  mcp: {
    getServers: (): Promise<McpServerConfig[]> => ipcRenderer.invoke('mcp.getServers'),
    getServer: (serverId: string): Promise<McpServerConfig | undefined> =>
      ipcRenderer.invoke('mcp.getServer', serverId),
    saveServer: (config: McpServerConfig): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('mcp.saveServer', config),
    deleteServer: (serverId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('mcp.deleteServer', serverId),
    getTools: (): Promise<McpTool[]> => ipcRenderer.invoke('mcp.getTools'),
    getServerStatus: (): Promise<McpServerStatus[]> => ipcRenderer.invoke('mcp.getServerStatus'),
    getPresets: (): Promise<McpPresetsMap> => ipcRenderer.invoke('mcp.getPresets'),
    createFromPreset: (presetKey: string, enabled = false): Promise<McpServerConfig | null> =>
      ipcRenderer.invoke('mcp.createFromPreset', presetKey, enabled),
  },

  contextState: {
    save: (sessionId: string): Promise<ContextSnapshot> =>
      ipcRenderer.invoke('context.save', sessionId),
    restoreLatest: (sessionId: string): Promise<ContextSnapshot | null> =>
      ipcRenderer.invoke('context.restoreLatest', sessionId),
  },

  sessionGuard: {
    get: (sessionId: string): Promise<SessionGuardState> =>
      ipcRenderer.invoke('session.guard.get', sessionId),
    set: (sessionId: string, update: SessionGuardUpdate): Promise<SessionGuardState> =>
      ipcRenderer.invoke('session.guard.set', sessionId, update),
    clear: (sessionId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('session.guard.clear', sessionId),
  },

  timeline: {
    list: (payload?: {
      cwd?: string;
      limit?: number;
      category?: ProjectTimelineCategory;
    }): Promise<ProjectTimelineEvent[]> => ipcRenderer.invoke('timeline.list', payload),
  },

  workflowArtifacts: {
    list: (payload?: WorkflowArtifactListInput): Promise<WorkflowArtifactEnvelope[]> =>
      ipcRenderer.invoke('workflowArtifacts.list', payload),
  },

  spec: {
    createArtifact: (
      payload: BacklogSpecInput
    ): Promise<WorkflowArtifactEnvelope<BacklogSpecArtifact>> =>
      ipcRenderer.invoke('spec.createArtifact', payload),
  },

  investigation: {
    createArtifact: (
      payload: InvestigationInput
    ): Promise<WorkflowArtifactEnvelope<InvestigationArtifact>> =>
      ipcRenderer.invoke('investigation.createArtifact', payload),
  },

  reviewGate: {
    createArtifact: (
      payload: ReviewGateInput
    ): Promise<WorkflowArtifactEnvelope<ReviewGateArtifact>> =>
      ipcRenderer.invoke('reviewGate.createArtifact', payload),
  },

  implementationTasks: {
    aggregate: (
      payload?: ImplementationTasksInput
    ): Promise<WorkflowArtifactEnvelope<ImplementationTasksArtifact>> =>
      ipcRenderer.invoke('implementationTasks.aggregate', payload),
  },

  releaseSummary: {
    createArtifact: (
      payload?: ReleaseSummaryInput
    ): Promise<WorkflowArtifactEnvelope<ReleaseSummaryArtifact>> =>
      ipcRenderer.invoke('releaseSummary.createArtifact', payload),
  },

  shipGate: {
    evaluate: (payload?: ShipGateInput): Promise<WorkflowArtifactEnvelope<ShipGateArtifact>> =>
      ipcRenderer.invoke('shipGate.evaluate', payload),
  },

  visualQa: {
    createArtifact: (payload: VisualQaInput): Promise<WorkflowArtifactEnvelope<VisualQaArtifact>> =>
      ipcRenderer.invoke('visualQa.createArtifact', payload),
  },

  canaryMonitor: {
    createArtifact: (
      payload: CanaryMonitorInput
    ): Promise<WorkflowArtifactEnvelope<CanaryMonitorArtifact>> =>
      ipcRenderer.invoke('canaryMonitor.createArtifact', payload),
  },

  browserSkillEvidence: {
    createArtifact: (
      payload: BrowserSkillEvidenceInput
    ): Promise<WorkflowArtifactEnvelope<BrowserSkillEvidenceArtifact>> =>
      ipcRenderer.invoke('browserSkillEvidence.createArtifact', payload),
  },

  devexAudit: {
    createArtifact: (
      payload: DevexAuditInput
    ): Promise<WorkflowArtifactEnvelope<DevexAuditArtifact>> =>
      ipcRenderer.invoke('devexAudit.createArtifact', payload),
  },

  benchmarkRun: {
    createArtifact: (
      payload: BenchmarkRunInput
    ): Promise<WorkflowArtifactEnvelope<BenchmarkRunArtifact>> =>
      ipcRenderer.invoke('benchmarkRun.createArtifact', payload),
  },

  browserAuthImport: {
    createSummary: (
      payload: BrowserAuthImportSummaryInput
    ): Promise<WorkflowArtifactEnvelope<BrowserAuthImportSummaryArtifact>> =>
      ipcRenderer.invoke('browserAuthImport.createSummary', payload),
  },

  learnings: {
    list: (payload?: { cwd?: string; limit?: number }): Promise<ProjectLearning[]> =>
      ipcRenderer.invoke('learnings.list', payload),
    search: (payload?: ProjectLearningSearchInput): Promise<ProjectLearning[]> =>
      ipcRenderer.invoke('learnings.search', payload),
    add: (
      payload: Omit<ProjectLearning, 'id' | 'ts' | 'workspaceKey' | 'trusted'> & { cwd?: string }
    ): Promise<ProjectLearning> => ipcRenderer.invoke('learnings.add', payload),
    stats: (payload?: { cwd?: string; workspaceKey?: string }): Promise<ProjectLearningStats> =>
      ipcRenderer.invoke('learnings.stats', payload),
    maintenanceReport: (payload?: {
      cwd?: string;
      workspaceKey?: string;
    }): Promise<ProjectLearningMaintenanceReport> =>
      ipcRenderer.invoke('learnings.maintenanceReport', payload),
    exportMarkdown: (payload?: ProjectLearningExportInput): Promise<string> =>
      ipcRenderer.invoke('learnings.exportMarkdown', payload),
    prune: (payload?: ProjectLearningPruneInput): Promise<ProjectLearningPruneResult> =>
      ipcRenderer.invoke('learnings.prune', payload),
  },

  changeScope: {
    analyze: (cwd?: string): Promise<ChangeScopeReport> =>
      ipcRenderer.invoke('changeScope.analyze', cwd),
  },

  health: {
    summary: (cwd?: string): Promise<HealthSummary> => ipcRenderer.invoke('health.summary', cwd),
  },

  codeHealth: {
    snapshot: (cwd?: string): Promise<WorkflowArtifactEnvelope<CodeHealthSnapshot>> =>
      ipcRenderer.invoke('codeHealth.snapshot', cwd),
  },

  documentRelease: {
    coverage: (cwd?: string): Promise<WorkflowArtifactEnvelope<DocumentReleaseCoverageSnapshot>> =>
      ipcRenderer.invoke('documentRelease.coverage', cwd),
  },

  browserSkillify: {
    createDraft: (payload: BrowserSkillifyInput): Promise<BrowserSkillifyResult> =>
      ipcRenderer.invoke('browserSkillify.createDraft', payload),
  },

  browserSkills: {
    list: (cwd?: string): Promise<BrowserSkillRuntimeSnapshot> =>
      ipcRenderer.invoke('browserSkills.list', cwd),
    testDraft: (payload: { cwd?: string; stageId: string }): Promise<BrowserSkillTestResult> =>
      ipcRenderer.invoke('browserSkills.testDraft', payload),
    commitDraft: (payload: { cwd?: string; stageId: string }): Promise<BrowserSkillEntry> =>
      ipcRenderer.invoke('browserSkills.commitDraft', payload),
    discardDraft: (payload: { cwd?: string; stageId: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('browserSkills.discardDraft', payload),
    setEnabled: (payload: {
      cwd?: string;
      name: string;
      enabled: boolean;
    }): Promise<BrowserSkillEntry> => ipcRenderer.invoke('browserSkills.setEnabled', payload),
    remove: (payload: {
      cwd?: string;
      name: string;
    }): Promise<{ success: boolean; tombstonePath: string }> =>
      ipcRenderer.invoke('browserSkills.remove', payload),
    test: (payload: { cwd?: string; name: string }): Promise<BrowserSkillTestResult> =>
      ipcRenderer.invoke('browserSkills.test', payload),
    run: (payload: {
      cwd?: string;
      name: string;
      timeoutMs?: number;
    }): Promise<BrowserSkillRunResult> => ipcRenderer.invoke('browserSkills.run', payload),
  },

  questionPolicy: {
    snapshot: (cwd?: string): Promise<QuestionPolicySnapshot> =>
      ipcRenderer.invoke('questionPolicy.snapshot', cwd),
    setPreference: (payload: {
      cwd?: string;
      questionId: string;
      preference: QuestionPreference;
      source?: 'settings';
      note?: string;
    }): Promise<QuestionPreferenceRecord> =>
      ipcRenderer.invoke('questionPolicy.setPreference', payload),
    clearPreference: (payload?: {
      cwd?: string;
      questionId?: string;
    }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('questionPolicy.clearPreference', payload),
  },

  decisions: {
    snapshot: (cwd?: string): Promise<DecisionStoreSnapshot> =>
      ipcRenderer.invoke('decisions.snapshot', cwd),
    add: (payload: AddDecisionInput): Promise<ActiveDecision> =>
      ipcRenderer.invoke('decisions.add', payload),
    supersede: (payload: { cwd?: string; id: string }): Promise<DecisionEvent> =>
      ipcRenderer.invoke('decisions.supersede', payload),
    redact: (payload: { cwd?: string; id: string }): Promise<DecisionEvent> =>
      ipcRenderer.invoke('decisions.redact', payload),
  },

  roles: {
    snapshot: (cwd?: string): Promise<RoleRegistrySnapshot> =>
      ipcRenderer.invoke('roles.snapshot', cwd),
    save: (payload: SaveRoleInput): Promise<RoleDefinition> =>
      ipcRenderer.invoke('roles.save', payload),
    reset: (payload: ResetRoleInput): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('roles.reset', payload),
    runtimeSnapshot: (payload?: {
      cwd?: string;
      sessionId?: string;
      limit?: number;
    }): Promise<RoleRuntimeSnapshot> => ipcRenderer.invoke('roles.runtimeSnapshot', payload),
    candidatesSnapshot: (cwd?: string): Promise<RoleCandidateSnapshot> =>
      ipcRenderer.invoke('roles.candidates.snapshot', cwd),
    incubateCandidate: (payload: IncubateRoleInput): Promise<IncubateRoleResult> =>
      ipcRenderer.invoke('roles.candidates.incubate', payload),
    acceptCandidate: (payload: SaveRoleCandidateInput): Promise<RoleCandidate> =>
      ipcRenderer.invoke('roles.candidates.accept', payload),
    rejectCandidate: (payload: RejectRoleCandidateInput): Promise<RoleCandidate> =>
      ipcRenderer.invoke('roles.candidates.reject', payload),
  },

  // Skills methods
  skills: {
    getAll: (): Promise<Skill[]> => ipcRenderer.invoke('skills.getAll'),
    install: (skillPath: string): Promise<{ success: boolean; skill: Skill }> =>
      ipcRenderer.invoke('skills.install', skillPath),
    installBundledDomainSkill: (
      skillFolderName: string
    ): Promise<{ success: boolean; skill: Skill }> =>
      ipcRenderer.invoke('skills.installBundledDomainSkill', skillFolderName),
    delete: (skillId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('skills.delete', skillId),
    setEnabled: (skillId: string, enabled: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('skills.setEnabled', skillId, enabled),
    validate: (skillPath: string): Promise<{ valid: boolean; errors: string[] }> =>
      ipcRenderer.invoke('skills.validate', skillPath),
    getStoragePath: (): Promise<string> => ipcRenderer.invoke('skills.getStoragePath'),
    setStoragePath: (
      targetPath: string,
      migrate = true
    ): Promise<{
      success: boolean;
      path: string;
      migratedCount: number;
      skippedCount: number;
      error?: string;
    }> => ipcRenderer.invoke('skills.setStoragePath', targetPath, migrate),
    openStoragePath: (): Promise<{ success: boolean; path: string; error?: string }> =>
      ipcRenderer.invoke('skills.openStoragePath'),
  },

  plugins: {
    listCatalog: (options?: { installableOnly?: boolean }): Promise<PluginCatalogItemV2[]> =>
      ipcRenderer.invoke('plugins.listCatalog', options),
    listInstalled: (): Promise<InstalledPlugin[]> => ipcRenderer.invoke('plugins.listInstalled'),
    install: (pluginName: string): Promise<PluginInstallResultV2> =>
      ipcRenderer.invoke('plugins.install', pluginName),
    setEnabled: (pluginId: string, enabled: boolean): Promise<PluginToggleResult> =>
      ipcRenderer.invoke('plugins.setEnabled', pluginId, enabled),
    setComponentEnabled: (
      pluginId: string,
      component: PluginComponentKind,
      enabled: boolean
    ): Promise<PluginToggleResult> =>
      ipcRenderer.invoke('plugins.setComponentEnabled', pluginId, component, enabled),
    uninstall: (pluginId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('plugins.uninstall', pluginId),
  },

  // Sandbox methods
  sandbox: {
    getStatus: (): Promise<{
      platform: string;
      mode: string;
      initialized: boolean;
      wsl?: {
        available: boolean;
        distro?: string;
        nodeAvailable?: boolean;
        version?: string;
        pythonAvailable?: boolean;
        pythonVersion?: string;
        pipAvailable?: boolean;
        claudeCodeAvailable?: boolean;
      };
      lima?: {
        available: boolean;
        instanceExists?: boolean;
        instanceRunning?: boolean;
        instanceName?: string;
        nodeAvailable?: boolean;
        version?: string;
        pythonAvailable?: boolean;
        pythonVersion?: string;
        pipAvailable?: boolean;
        claudeCodeAvailable?: boolean;
      };
      error?: string;
    }> => ipcRenderer.invoke('sandbox.getStatus'),
    checkWSL: (): Promise<{
      available: boolean;
      distro?: string;
      nodeAvailable?: boolean;
      version?: string;
      pythonAvailable?: boolean;
      pythonVersion?: string;
      pipAvailable?: boolean;
      claudeCodeAvailable?: boolean;
    }> => ipcRenderer.invoke('sandbox.checkWSL'),
    checkLima: (): Promise<{
      available: boolean;
      instanceExists?: boolean;
      instanceRunning?: boolean;
      instanceName?: string;
      nodeAvailable?: boolean;
      version?: string;
      pythonAvailable?: boolean;
      pythonVersion?: string;
      pipAvailable?: boolean;
      claudeCodeAvailable?: boolean;
    }> => ipcRenderer.invoke('sandbox.checkLima'),
    installNodeInWSL: (distro: string): Promise<boolean> =>
      ipcRenderer.invoke('sandbox.installNodeInWSL', distro),
    installPythonInWSL: (distro: string): Promise<boolean> =>
      ipcRenderer.invoke('sandbox.installPythonInWSL', distro),
    installNodeInLima: (): Promise<boolean> => ipcRenderer.invoke('sandbox.installNodeInLima'),
    installPythonInLima: (): Promise<boolean> => ipcRenderer.invoke('sandbox.installPythonInLima'),
    startLimaInstance: (): Promise<boolean> => ipcRenderer.invoke('sandbox.startLimaInstance'),
    stopLimaInstance: (): Promise<boolean> => ipcRenderer.invoke('sandbox.stopLimaInstance'),
    retrySetup: (): Promise<{ success: boolean; error?: string; result?: unknown }> =>
      ipcRenderer.invoke('sandbox.retrySetup'),
    retryLimaSetup: (): Promise<{ success: boolean; error?: string; result?: unknown }> =>
      ipcRenderer.invoke('sandbox.retryLimaSetup'),
  },

  // Logs methods
  logs: {
    getPath: (): Promise<string | null> => ipcRenderer.invoke('logs.getPath'),
    getDirectory: (): Promise<string> => ipcRenderer.invoke('logs.getDirectory'),
    getAll: (): Promise<Array<{ name: string; path: string; size: number; mtime: Date }>> =>
      ipcRenderer.invoke('logs.getAll'),
    export: (): Promise<{ success: boolean; path?: string; size?: number; error?: string }> =>
      ipcRenderer.invoke('logs.export'),
    open: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('logs.open'),
    clear: (): Promise<{ success: boolean; deletedCount?: number; error?: string }> =>
      ipcRenderer.invoke('logs.clear'),
    setEnabled: (
      enabled: boolean
    ): Promise<{ success: boolean; enabled?: boolean; error?: string }> =>
      ipcRenderer.invoke('logs.setEnabled', enabled),
    isEnabled: (): Promise<{ success: boolean; enabled?: boolean; error?: string }> =>
      ipcRenderer.invoke('logs.isEnabled'),
    write: (
      level: 'info' | 'warn' | 'error',
      ...args: unknown[]
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('logs.write', level, ...args),
  },

  // Remote control methods
  remote: {
    getConfig: (): Promise<RemoteConfig> => ipcRenderer.invoke('remote.getConfig'),
    getStatus: (): Promise<{
      running: boolean;
      port?: number;
      publicUrl?: string;
      channels: Array<{ type: string; connected: boolean; error?: string }>;
      activeSessions: number;
      pendingPairings: number;
    }> => ipcRenderer.invoke('remote.getStatus'),
    setEnabled: (enabled: boolean): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remote.setEnabled', enabled),
    updateGatewayConfig: (
      config: Partial<GatewayConfig>
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remote.updateGatewayConfig', config),
    updateFeishuConfig: (
      config: FeishuChannelConfig
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remote.updateFeishuConfig', config),
    getPairedUsers: (): Promise<PairedUser[]> => ipcRenderer.invoke('remote.getPairedUsers'),
    getPendingPairings: (): Promise<PairingRequest[]> =>
      ipcRenderer.invoke('remote.getPendingPairings'),
    approvePairing: (
      channelType: string,
      userId: string
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remote.approvePairing', channelType, userId),
    revokePairing: (
      channelType: string,
      userId: string
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remote.revokePairing', channelType, userId),
    rejectPairing: (
      channelType: string,
      userId: string
    ): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remote.rejectPairing', channelType, userId),
    getRemoteSessions: (): Promise<RemoteSessionMapping[]> =>
      ipcRenderer.invoke('remote.getRemoteSessions'),
    clearRemoteSession: (sessionId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remote.clearRemoteSession', sessionId),
    getTunnelStatus: (): Promise<{
      connected: boolean;
      url: string | null;
      provider: string;
      error?: string;
    }> => ipcRenderer.invoke('remote.getTunnelStatus'),
    getWebhookUrl: (): Promise<string | null> => ipcRenderer.invoke('remote.getWebhookUrl'),
    restart: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('remote.restart'),
  },

  schedule: {
    list: (): Promise<ScheduleTask[]> => ipcRenderer.invoke('schedule.list'),
    create: (payload: ScheduleCreateInput): Promise<ScheduleTask> =>
      ipcRenderer.invoke('schedule.create', payload),
    update: (id: string, updates: ScheduleUpdateInput): Promise<ScheduleTask | null> =>
      ipcRenderer.invoke('schedule.update', id, updates),
    delete: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('schedule.delete', id),
    toggle: (id: string, enabled: boolean): Promise<ScheduleTask | null> =>
      ipcRenderer.invoke('schedule.toggle', id, enabled),
    runNow: (id: string): Promise<ScheduleTask | null> => ipcRenderer.invoke('schedule.runNow', id),
  },

  memory: {
    getOverview: (cwd?: string): Promise<MemoryOverview> =>
      ipcRenderer.invoke('memory.getOverview', cwd),
    search: (payload: {
      query: string;
      cwd?: string;
      sourceWorkspace?: string | null;
      scope?: MemorySearchScope;
      limit?: number;
    }): Promise<MemorySearchResult[]> => ipcRenderer.invoke('memory.search', payload),
    read: (id: string): Promise<MemoryReadResult | null> => ipcRenderer.invoke('memory.read', id),
    rebuildWorkspace: (cwd: string): Promise<{ success: boolean; workspaceKey: string }> =>
      ipcRenderer.invoke('memory.rebuildWorkspace', cwd),
    clearWorkspace: (cwd: string): Promise<{ success: boolean; workspaceKey: string }> =>
      ipcRenderer.invoke('memory.clearWorkspace', cwd),
    clearCoreMemory: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('memory.clearCoreMemory'),
    rebuildAll: (): Promise<{ success: boolean; workspaceCount: number; sessionCount: number }> =>
      ipcRenderer.invoke('memory.rebuildAll'),
    listFiles: (): Promise<MemoryDebugFileInfo[]> => ipcRenderer.invoke('memory.listFiles'),
    readFile: (filePath: string): Promise<MemoryDebugFileContent> =>
      ipcRenderer.invoke('memory.readFile', filePath),
    inspectSession: (
      sessionId: string,
      workspaceKey?: string
    ): Promise<MemoryInspectSessionResult | null> =>
      ipcRenderer.invoke('memory.inspectSession', sessionId, workspaceKey),
    setEnabled: (enabled: boolean): Promise<{ success: boolean; enabled: boolean }> =>
      ipcRenderer.invoke('memory.setEnabled', enabled),
  },
});

// Type declaration for the renderer process
declare global {
  interface Window {
    electronAPI: {
      send: (event: ClientEvent) => void;
      on: (callback: (event: ServerEvent) => void) => () => void;
      invoke: <T>(event: ClientEvent) => Promise<T>;
      platform: NodeJS.Platform;
      getSystemTheme: () => Promise<{ shouldUseDarkColors: boolean }>;
      getVersion: () => Promise<string>;
      openExternal: (url: string) => Promise<boolean>;
      showItemInFolder: (filePath: string, cwd?: string) => Promise<boolean>;
      selectFiles: () => Promise<string[]>;
      artifacts: {
        listRecentFiles: (
          cwd: string,
          sinceMs: number,
          limit?: number
        ) => Promise<Array<{ path: string; modifiedAt: number; size: number }>>;
      };
      assetCenter: {
        getSnapshot: () => Promise<AssetCenterSnapshot>;
      };
      config: {
        get: () => Promise<AppConfig>;
        getPresets: () => Promise<ProviderPresets>;
        save: (config: Partial<AppConfig>) => Promise<{ success: boolean; config: AppConfig }>;
        createSet: (payload: CreateSetPayload) => Promise<{ success: boolean; config: AppConfig }>;
        renameSet: (payload: {
          id: string;
          name: string;
        }) => Promise<{ success: boolean; config: AppConfig }>;
        deleteSet: (payload: { id: string }) => Promise<{ success: boolean; config: AppConfig }>;
        switchSet: (payload: { id: string }) => Promise<{ success: boolean; config: AppConfig }>;
        isConfigured: () => Promise<boolean>;
        test: (config: ApiTestInput) => Promise<ApiTestResult>;
        listModels: (payload: {
          provider: AppConfig['provider'];
          apiKey: string;
          baseUrl?: string;
        }) => Promise<ProviderModelInfo[]>;
        diagnose: (input: DiagnosticInput) => Promise<DiagnosticResult>;
        discoverLocal: (payload?: { baseUrl?: string }) => Promise<LocalOllamaDiscoveryResult>;
      };
      window: {
        minimize: () => void;
        maximize: () => void;
        close: () => void;
      };
      mcp: {
        getServers: () => Promise<McpServerConfig[]>;
        getServer: (serverId: string) => Promise<McpServerConfig | undefined>;
        saveServer: (config: McpServerConfig) => Promise<{ success: boolean; error?: string }>;
        deleteServer: (serverId: string) => Promise<{ success: boolean }>;
        getTools: () => Promise<McpTool[]>;
        getServerStatus: () => Promise<McpServerStatus[]>;
        getPresets: () => Promise<McpPresetsMap>;
        createFromPreset: (presetKey: string, enabled?: boolean) => Promise<McpServerConfig | null>;
      };
      contextState: {
        save: (sessionId: string) => Promise<ContextSnapshot>;
        restoreLatest: (sessionId: string) => Promise<ContextSnapshot | null>;
      };
      sessionGuard: {
        get: (sessionId: string) => Promise<SessionGuardState>;
        set: (sessionId: string, update: SessionGuardUpdate) => Promise<SessionGuardState>;
        clear: (sessionId: string) => Promise<{ success: boolean }>;
      };
      timeline: {
        list: (payload?: {
          cwd?: string;
          limit?: number;
          category?: ProjectTimelineCategory;
        }) => Promise<ProjectTimelineEvent[]>;
      };
      workflowArtifacts: {
        list: (payload?: WorkflowArtifactListInput) => Promise<WorkflowArtifactEnvelope[]>;
      };
      spec: {
        createArtifact: (
          payload: BacklogSpecInput
        ) => Promise<WorkflowArtifactEnvelope<BacklogSpecArtifact>>;
      };
      investigation: {
        createArtifact: (
          payload: InvestigationInput
        ) => Promise<WorkflowArtifactEnvelope<InvestigationArtifact>>;
      };
      reviewGate: {
        createArtifact: (
          payload: ReviewGateInput
        ) => Promise<WorkflowArtifactEnvelope<ReviewGateArtifact>>;
      };
      implementationTasks: {
        aggregate: (
          payload?: ImplementationTasksInput
        ) => Promise<WorkflowArtifactEnvelope<ImplementationTasksArtifact>>;
      };
      releaseSummary: {
        createArtifact: (
          payload?: ReleaseSummaryInput
        ) => Promise<WorkflowArtifactEnvelope<ReleaseSummaryArtifact>>;
      };
      shipGate: {
        evaluate: (payload?: ShipGateInput) => Promise<WorkflowArtifactEnvelope<ShipGateArtifact>>;
      };
      visualQa: {
        createArtifact: (
          payload: VisualQaInput
        ) => Promise<WorkflowArtifactEnvelope<VisualQaArtifact>>;
      };
      canaryMonitor: {
        createArtifact: (
          payload: CanaryMonitorInput
        ) => Promise<WorkflowArtifactEnvelope<CanaryMonitorArtifact>>;
      };
      browserSkillEvidence: {
        createArtifact: (
          payload: BrowserSkillEvidenceInput
        ) => Promise<WorkflowArtifactEnvelope<BrowserSkillEvidenceArtifact>>;
      };
      devexAudit: {
        createArtifact: (
          payload: DevexAuditInput
        ) => Promise<WorkflowArtifactEnvelope<DevexAuditArtifact>>;
      };
      benchmarkRun: {
        createArtifact: (
          payload: BenchmarkRunInput
        ) => Promise<WorkflowArtifactEnvelope<BenchmarkRunArtifact>>;
      };
      browserAuthImport: {
        createSummary: (
          payload: BrowserAuthImportSummaryInput
        ) => Promise<WorkflowArtifactEnvelope<BrowserAuthImportSummaryArtifact>>;
      };
      learnings: {
        list: (payload?: { cwd?: string; limit?: number }) => Promise<ProjectLearning[]>;
        search: (payload?: ProjectLearningSearchInput) => Promise<ProjectLearning[]>;
        add: (
          payload: Omit<ProjectLearning, 'id' | 'ts' | 'workspaceKey' | 'trusted'> & {
            cwd?: string;
          }
        ) => Promise<ProjectLearning>;
        stats: (payload?: { cwd?: string; workspaceKey?: string }) => Promise<ProjectLearningStats>;
        maintenanceReport: (payload?: {
          cwd?: string;
          workspaceKey?: string;
        }) => Promise<ProjectLearningMaintenanceReport>;
        exportMarkdown: (payload?: ProjectLearningExportInput) => Promise<string>;
        prune: (payload?: ProjectLearningPruneInput) => Promise<ProjectLearningPruneResult>;
      };
      changeScope: {
        analyze: (cwd?: string) => Promise<ChangeScopeReport>;
      };
      health: {
        summary: (cwd?: string) => Promise<HealthSummary>;
      };
      codeHealth: {
        snapshot: (cwd?: string) => Promise<WorkflowArtifactEnvelope<CodeHealthSnapshot>>;
      };
      documentRelease: {
        coverage: (
          cwd?: string
        ) => Promise<WorkflowArtifactEnvelope<DocumentReleaseCoverageSnapshot>>;
      };
      browserSkillify: {
        createDraft: (payload: BrowserSkillifyInput) => Promise<BrowserSkillifyResult>;
      };
      browserSkills: {
        list: (cwd?: string) => Promise<BrowserSkillRuntimeSnapshot>;
        testDraft: (payload: { cwd?: string; stageId: string }) => Promise<BrowserSkillTestResult>;
        commitDraft: (payload: { cwd?: string; stageId: string }) => Promise<BrowserSkillEntry>;
        discardDraft: (payload: { cwd?: string; stageId: string }) => Promise<{ success: boolean }>;
        setEnabled: (payload: {
          cwd?: string;
          name: string;
          enabled: boolean;
        }) => Promise<BrowserSkillEntry>;
        remove: (payload: {
          cwd?: string;
          name: string;
        }) => Promise<{ success: boolean; tombstonePath: string }>;
        test: (payload: { cwd?: string; name: string }) => Promise<BrowserSkillTestResult>;
        run: (payload: {
          cwd?: string;
          name: string;
          timeoutMs?: number;
        }) => Promise<BrowserSkillRunResult>;
      };
      questionPolicy: {
        snapshot: (cwd?: string) => Promise<QuestionPolicySnapshot>;
        setPreference: (payload: {
          cwd?: string;
          questionId: string;
          preference: QuestionPreference;
          source?: 'settings';
          note?: string;
        }) => Promise<QuestionPreferenceRecord>;
        clearPreference: (payload?: {
          cwd?: string;
          questionId?: string;
        }) => Promise<{ success: boolean }>;
      };
      decisions: {
        snapshot: (cwd?: string) => Promise<DecisionStoreSnapshot>;
        add: (payload: AddDecisionInput) => Promise<ActiveDecision>;
        supersede: (payload: { cwd?: string; id: string }) => Promise<DecisionEvent>;
        redact: (payload: { cwd?: string; id: string }) => Promise<DecisionEvent>;
      };
      roles: {
        snapshot: (cwd?: string) => Promise<RoleRegistrySnapshot>;
        save: (payload: SaveRoleInput) => Promise<RoleDefinition>;
        reset: (payload: ResetRoleInput) => Promise<{ success: boolean }>;
        runtimeSnapshot: (payload?: {
          cwd?: string;
          sessionId?: string;
          limit?: number;
        }) => Promise<RoleRuntimeSnapshot>;
        candidatesSnapshot: (cwd?: string) => Promise<RoleCandidateSnapshot>;
        incubateCandidate: (payload: IncubateRoleInput) => Promise<IncubateRoleResult>;
        acceptCandidate: (payload: SaveRoleCandidateInput) => Promise<RoleCandidate>;
        rejectCandidate: (payload: RejectRoleCandidateInput) => Promise<RoleCandidate>;
      };
      skills: {
        getAll: () => Promise<Skill[]>;
        install: (skillPath: string) => Promise<{ success: boolean; skill: Skill }>;
        installBundledDomainSkill: (
          skillFolderName: string
        ) => Promise<{ success: boolean; skill: Skill }>;
        delete: (skillId: string) => Promise<{ success: boolean }>;
        setEnabled: (skillId: string, enabled: boolean) => Promise<{ success: boolean }>;
        validate: (skillPath: string) => Promise<{ valid: boolean; errors: string[] }>;
        getStoragePath: () => Promise<string>;
        setStoragePath: (
          targetPath: string,
          migrate?: boolean
        ) => Promise<{
          success: boolean;
          path: string;
          migratedCount: number;
          skippedCount: number;
          error?: string;
        }>;
        openStoragePath: () => Promise<{ success: boolean; path: string; error?: string }>;
      };
      plugins: {
        listCatalog: (options?: { installableOnly?: boolean }) => Promise<PluginCatalogItemV2[]>;
        listInstalled: () => Promise<InstalledPlugin[]>;
        install: (pluginName: string) => Promise<PluginInstallResultV2>;
        setEnabled: (pluginId: string, enabled: boolean) => Promise<PluginToggleResult>;
        setComponentEnabled: (
          pluginId: string,
          component: PluginComponentKind,
          enabled: boolean
        ) => Promise<PluginToggleResult>;
        uninstall: (pluginId: string) => Promise<{ success: boolean }>;
      };
      sandbox: {
        getStatus: () => Promise<{
          platform: string;
          mode: string;
          initialized: boolean;
          wsl?: {
            available: boolean;
            distro?: string;
            nodeAvailable?: boolean;
            version?: string;
            pythonAvailable?: boolean;
            pythonVersion?: string;
            pipAvailable?: boolean;
            claudeCodeAvailable?: boolean;
          };
          lima?: {
            available: boolean;
            instanceExists?: boolean;
            instanceRunning?: boolean;
            instanceName?: string;
            nodeAvailable?: boolean;
            version?: string;
            pythonAvailable?: boolean;
            pythonVersion?: string;
            pipAvailable?: boolean;
            claudeCodeAvailable?: boolean;
          };
          error?: string;
        }>;
        checkWSL: () => Promise<{
          available: boolean;
          distro?: string;
          nodeAvailable?: boolean;
          version?: string;
          pythonAvailable?: boolean;
          pythonVersion?: string;
          pipAvailable?: boolean;
          claudeCodeAvailable?: boolean;
        }>;
        checkLima: () => Promise<{
          available: boolean;
          instanceExists?: boolean;
          instanceRunning?: boolean;
          instanceName?: string;
          nodeAvailable?: boolean;
          version?: string;
          pythonAvailable?: boolean;
          pythonVersion?: string;
          pipAvailable?: boolean;
          claudeCodeAvailable?: boolean;
        }>;
        installNodeInWSL: (distro: string) => Promise<boolean>;
        installPythonInWSL: (distro: string) => Promise<boolean>;
        installNodeInLima: () => Promise<boolean>;
        installPythonInLima: () => Promise<boolean>;
        startLimaInstance: () => Promise<boolean>;
        stopLimaInstance: () => Promise<boolean>;
        retrySetup: () => Promise<{ success: boolean; error?: string; result?: unknown }>;
        retryLimaSetup: () => Promise<{ success: boolean; error?: string; result?: unknown }>;
      };
      logs: {
        getPath: () => Promise<string | null>;
        getDirectory: () => Promise<string>;
        getAll: () => Promise<Array<{ name: string; path: string; size: number; mtime: Date }>>;
        export: () => Promise<{ success: boolean; path?: string; size?: number; error?: string }>;
        open: () => Promise<{ success: boolean; error?: string }>;
        clear: () => Promise<{ success: boolean; deletedCount?: number; error?: string }>;
        setEnabled: (
          enabled: boolean
        ) => Promise<{ success: boolean; enabled?: boolean; error?: string }>;
        isEnabled: () => Promise<{ success: boolean; enabled?: boolean; error?: string }>;
        write: (
          level: 'info' | 'warn' | 'error',
          ...args: unknown[]
        ) => Promise<{ success: boolean; error?: string }>;
      };
      remote: {
        getConfig: () => Promise<RemoteConfig>;
        getStatus: () => Promise<{
          running: boolean;
          port?: number;
          publicUrl?: string;
          channels: Array<{ type: string; connected: boolean; error?: string }>;
          activeSessions: number;
          pendingPairings: number;
        }>;
        setEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
        updateGatewayConfig: (
          config: Partial<GatewayConfig>
        ) => Promise<{ success: boolean; error?: string }>;
        updateFeishuConfig: (
          config: FeishuChannelConfig
        ) => Promise<{ success: boolean; error?: string }>;
        getPairedUsers: () => Promise<PairedUser[]>;
        getPendingPairings: () => Promise<PairingRequest[]>;
        approvePairing: (
          channelType: string,
          userId: string
        ) => Promise<{ success: boolean; error?: string }>;
        revokePairing: (
          channelType: string,
          userId: string
        ) => Promise<{ success: boolean; error?: string }>;
        rejectPairing: (
          channelType: string,
          userId: string
        ) => Promise<{ success: boolean; error?: string }>;
        getRemoteSessions: () => Promise<RemoteSessionMapping[]>;
        clearRemoteSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
        getTunnelStatus: () => Promise<{
          connected: boolean;
          url: string | null;
          provider: string;
          error?: string;
        }>;
        getWebhookUrl: () => Promise<string | null>;
        restart: () => Promise<{ success: boolean; error?: string }>;
      };
      schedule: {
        list: () => Promise<ScheduleTask[]>;
        create: (payload: ScheduleCreateInput) => Promise<ScheduleTask>;
        update: (id: string, updates: ScheduleUpdateInput) => Promise<ScheduleTask | null>;
        delete: (id: string) => Promise<{ success: boolean }>;
        toggle: (id: string, enabled: boolean) => Promise<ScheduleTask | null>;
        runNow: (id: string) => Promise<ScheduleTask | null>;
      };
      memory: {
        getOverview: (cwd?: string) => Promise<MemoryOverview>;
        search: (payload: {
          query: string;
          cwd?: string;
          sourceWorkspace?: string | null;
          scope?: MemorySearchScope;
          limit?: number;
        }) => Promise<MemorySearchResult[]>;
        read: (id: string) => Promise<MemoryReadResult | null>;
        rebuildWorkspace: (cwd: string) => Promise<{ success: boolean; workspaceKey: string }>;
        clearWorkspace: (cwd: string) => Promise<{ success: boolean; workspaceKey: string }>;
        clearCoreMemory: () => Promise<{ success: boolean }>;
        rebuildAll: () => Promise<{
          success: boolean;
          workspaceCount: number;
          sessionCount: number;
        }>;
        listFiles: () => Promise<MemoryDebugFileInfo[]>;
        readFile: (filePath: string) => Promise<MemoryDebugFileContent>;
        inspectSession: (
          sessionId: string,
          workspaceKey?: string
        ) => Promise<MemoryInspectSessionResult | null>;
        setEnabled: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>;
      };
    };
  }
}
