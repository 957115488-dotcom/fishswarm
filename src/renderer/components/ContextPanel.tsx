import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { resolveArtifactPath } from '../utils/artifact-path';
import {
  extractFilePathFromToolInput,
  extractFilePathFromToolOutput,
} from '../utils/tool-output-path';
import {
  getArtifactLabel,
  getArtifactIconComponent,
  getArtifactSteps,
} from '../utils/artifact-steps';
import { useIPC } from '../hooks/useIPC';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileSpreadsheet,
  FilePieChart,
  FileCode2,
  FileArchive,
  FileAudio2,
  FileVideo,
  Image as ImageIcon,
  FolderOpen,
  FolderSync,
  File,
  Check,
  X,
  AlertTriangle,
  Shield,
  Clock,
  Loader2,
  Plug,
  Wrench,
  MessageSquare,
  Cpu,
  Copy,
  Layers,
} from 'lucide-react';
import type {
  TraceStep,
  MCPServerInfo,
  ContentBlock,
  ToolUseContent,
  PermissionRequest,
  PermissionResult,
  Message,
} from '../types';
import { getMcpToolDisplayName } from './message/toolHelpers';
import { RoleActivitySection } from './context/RoleActivitySection';
import { ValidationLogsSection } from './context/ValidationLogsSection';

const EMPTY_STEPS: TraceStep[] = [];

interface PermissionLogEntry {
  id: string;
  toolName: string;
  result: PermissionResult;
  timestamp: number;
}

interface AcceptanceEntry {
  messageId: string;
  timestamp: number;
  content: string;
}

function getMessageText(message: Message): string {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');
}

function extractAcceptanceSection(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const headingPattern = /^(#{2,3})\s*(?:(?:交付)?验收(?:清单|标准|结果)?|acceptance)\s*[:：]?.*$/i;

  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(headingPattern);
    if (!match) {
      continue;
    }

    const level = match[1].length;
    const content: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const nextHeading = lines[j].match(/^(#{1,6})\s+\S/);
      if (nextHeading && nextHeading[1].length <= level) {
        break;
      }
      content.push(lines[j]);
    }

    const section = content.join('\n').trim();
    return section || null;
  }

  return null;
}

export function ContextPanel() {
  const { t } = useTranslation();
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const sessions = useAppStore((s) => s.sessions);
  const sessionStates = useAppStore((s) => s.sessionStates);
  const appConfig = useAppStore((s) => s.appConfig);
  const contextPanelCollapsed = useAppStore((s) => s.contextPanelCollapsed);
  const toggleContextPanel = useAppStore((s) => s.toggleContextPanel);
  const workingDir = useAppStore((s) => s.workingDir);
  const pendingPermission = useAppStore((s) => s.pendingPermission);
  const setGlobalNotice = useAppStore((s) => s.setGlobalNotice);
  const setRoleRuntimeState = useAppStore((s) => s.setRoleRuntimeState);
  const { getMCPServers, changeWorkingDir, respondToPermission } = useIPC();
  const [contextOpen, setContextOpen] = useState(true);
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [acceptanceOpen, setAcceptanceOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [hooksOpen, setHooksOpen] = useState(true);
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [mcpServers, setMcpServers] = useState<MCPServerInfo[]>([]);
  const [copiedPath, setCopiedPath] = useState(false);
  const [isChangingDir, setIsChangingDir] = useState(false);
  const [permissionLogs, setPermissionLogs] = useState<PermissionLogEntry[]>([]);
  const [recentWorkspaceFiles, setRecentWorkspaceFiles] = useState<
    Array<{
      path: string;
      modifiedAt: number;
      size: number;
    }>
  >([]);

  const handleCopyPath = async (path: string) => {
    try {
      // Escape spaces for shell usage so the path can be pasted into terminal
      let shellPath = path;
      if (path.includes(' ')) {
        const isWindows = window.electronAPI?.platform === 'win32';
        shellPath = isWindows ? `"${path}"` : path.replace(/ /g, '\\ ');
      }
      await navigator.clipboard.writeText(shellPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (err) {
      console.error('Failed to copy path:', err);
    }
  };

  const ss = activeSessionId ? sessionStates[activeSessionId] : undefined;
  const steps = ss?.traceSteps ?? EMPTY_STEPS;
  const roleEvents = ss?.roleEvents ?? [];
  const validationLogs = ss?.validationLogs ?? [];
  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null;
  const currentWorkingDir = activeSession?.cwd || workingDir;
  const { displayArtifactSteps } = getArtifactSteps(steps);
  const canShowItemInFolder =
    typeof window !== 'undefined' && !!window.electronAPI?.showItemInFolder;

  const handlePermissionResponse = (permission: PermissionRequest, result: PermissionResult) => {
    setPermissionLogs((current) =>
      [
        {
          id: `${permission.toolUseId}-${result}-${Date.now()}`,
          toolName: permission.toolName,
          result,
          timestamp: Date.now(),
        },
        ...current,
      ].slice(0, 20)
    );
    respondToPermission(permission.toolUseId, result);
  };

  // Session info computations
  const messages = useMemo(
    () => (activeSessionId ? sessionStates[activeSessionId]?.messages || [] : []),
    [activeSessionId, sessionStates]
  );

  const acceptanceEntry = useMemo<AcceptanceEntry | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role !== 'assistant') {
        continue;
      }

      const content = extractAcceptanceSection(getMessageText(message));
      if (content) {
        return {
          messageId: message.id,
          timestamp: message.timestamp,
          content,
        };
      }
    }

    return null;
  }, [messages]);

  useEffect(() => {
    if (acceptanceEntry?.messageId || validationLogs.length > 0) {
      setAcceptanceOpen(true);
    }
  }, [acceptanceEntry?.messageId, validationLogs.length]);

  useEffect(() => {
    if (
      contextPanelCollapsed ||
      !activeSessionId ||
      typeof window === 'undefined' ||
      !window.electronAPI?.roles?.runtimeSnapshot
    ) {
      return;
    }

    let cancelled = false;
    window.electronAPI.roles
      .runtimeSnapshot({
        cwd: currentWorkingDir || undefined,
        sessionId: activeSessionId,
        limit: 100,
      })
      .then((snapshot) => {
        if (cancelled) return;
        setRoleRuntimeState(activeSessionId, {
          roleEvents: snapshot.activeEvents,
          validationLogs: snapshot.validationLogs,
        });
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load role runtime snapshot:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, contextPanelCollapsed, currentWorkingDir, setRoleRuntimeState]);

  const messageCount = messages.length;
  const toolCallCount = steps.filter((s) => s.type === 'tool_call').length;
  const modelName = activeSession?.model || appConfig?.model || '—';

  // Token usage aggregation
  const tokenUsage = useMemo(() => {
    let input = 0;
    let output = 0;
    for (const msg of messages) {
      if (msg.tokenUsage) {
        input += msg.tokenUsage.input || 0;
        output += msg.tokenUsage.output || 0;
      }
    }
    return { input, output, total: input + output };
  }, [messages]);

  // Context usage: last message's input tokens ≈ current context occupation
  const contextUsage = useMemo(() => {
    const contextWindow = activeSessionId
      ? sessionStates[activeSessionId]?.contextWindow
      : undefined;
    if (!contextWindow) return null;

    let lastInput = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].tokenUsage?.input) {
        lastInput = messages[i].tokenUsage!.input;
        break;
      }
    }
    if (lastInput === 0) return null;

    const percentage = Math.min((lastInput / contextWindow) * 100, 100);
    return { used: lastInput, total: contextWindow, percentage };
  }, [activeSessionId, sessionStates, messages]);

  const completedStepCount = useMemo(
    () => steps.reduce((n, s) => n + (s.status === 'completed' ? 1 : 0), 0),
    [steps]
  );

  const mcpToolDisplayNames = useMemo(() => {
    const displayNames = new Map<string, string>();

    for (const msg of messages) {
      if (!Array.isArray(msg.content)) {
        continue;
      }

      for (const block of msg.content as ContentBlock[]) {
        if (block.type !== 'tool_use') {
          continue;
        }

        const toolUse = block as ToolUseContent;
        if (!toolUse.name.startsWith('mcp__')) {
          continue;
        }

        displayNames.set(toolUse.name, getMcpToolDisplayName(toolUse.name, toolUse.displayName));
      }
    }

    for (const step of steps) {
      if (step.type !== 'tool_call' || !step.toolName?.startsWith('mcp__')) {
        continue;
      }

      if (!displayNames.has(step.toolName)) {
        displayNames.set(step.toolName, getMcpToolDisplayName(step.toolName, step.title));
      }
    }

    return displayNames;
  }, [messages, steps]);

  useEffect(() => {
    if (contextPanelCollapsed) {
      return;
    }
    if (
      typeof window === 'undefined' ||
      !window.electronAPI?.artifacts?.listRecentFiles ||
      !currentWorkingDir ||
      !activeSession?.createdAt
    ) {
      setRecentWorkspaceFiles([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const files = await window.electronAPI.artifacts.listRecentFiles(
          currentWorkingDir,
          activeSession.createdAt,
          50
        );
        if (!cancelled) {
          setRecentWorkspaceFiles(files || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load recent workspace files:', error);
          setRecentWorkspaceFiles([]);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    activeSession?.createdAt,
    activeSessionId,
    steps.length,
    completedStepCount,
    contextPanelCollapsed,
    currentWorkingDir,
  ]);

  const displayArtifacts = useMemo(() => {
    const seenPaths = new Set<string>();
    const items: Array<{ label: string; path: string }> = [];

    for (const step of displayArtifactSteps) {
      const fallbackPath =
        extractFilePathFromToolOutput(step.toolOutput) ||
        extractFilePathFromToolInput(step.toolInput);
      if (!fallbackPath) {
        continue;
      }

      const resolvedPath = resolveArtifactPath(fallbackPath, currentWorkingDir);
      const key = resolvedPath.trim();
      if (!key || seenPaths.has(key)) {
        continue;
      }

      seenPaths.add(key);
      items.push({
        label: getArtifactLabel(fallbackPath),
        path: resolvedPath,
      });
    }

    for (const file of recentWorkspaceFiles) {
      const resolvedPath = resolveArtifactPath(file.path, currentWorkingDir);
      const key = resolvedPath.trim();
      if (!key || seenPaths.has(key)) {
        continue;
      }

      seenPaths.add(key);
      items.push({
        label: getArtifactLabel(file.path),
        path: resolvedPath,
      });
    }

    return items;
  }, [currentWorkingDir, displayArtifactSteps, recentWorkspaceFiles]);

  useEffect(() => {
    if (contextPanelCollapsed) {
      return;
    }
    const loadMCPServers = async () => {
      try {
        const servers = await getMCPServers();
        setMcpServers(servers || []);
      } catch (error) {
        console.error('Failed to load MCP servers:', error);
      }
    };
    loadMCPServers();
    const interval = setInterval(loadMCPServers, 30000);
    return () => clearInterval(interval);
  }, [contextPanelCollapsed, getMCPServers]);

  if (contextPanelCollapsed) {
    return (
      <div className="w-10 bg-background border-l border-border-muted flex items-start justify-center pt-3">
        <button
          onClick={toggleContextPanel}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          title={t('context.expandPanel')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 h-full min-h-0 bg-background border-l border-border-muted flex flex-col overflow-hidden text-sm">
      {/* Working Directory */}
      <div className="border-b border-border-muted shrink-0">
        <div className="px-3 py-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleContextPanel}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors shrink-0"
              title={t('context.collapsePanel')}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider truncate">
              {t('context.workingDirectory')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 pl-7">
            <FolderOpen className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span
              className={`text-xs truncate flex-1 ${currentWorkingDir ? 'text-text-primary cursor-pointer hover:text-accent-primary transition-colors' : 'text-text-muted'}`}
              title={currentWorkingDir ? t('context.openInFileManager') : ''}
              onClick={() =>
                currentWorkingDir && window.electronAPI?.showItemInFolder(currentWorkingDir)
              }
            >
              {currentWorkingDir ? formatPath(currentWorkingDir) : t('context.noFolderSelected')}
            </span>
            {currentWorkingDir && (
              <button
                onClick={() => handleCopyPath(currentWorkingDir)}
                className="text-text-muted hover:text-text-primary transition-colors shrink-0 ml-1"
                title={t('context.copyPath')}
              >
                {copiedPath ? (
                  <Check className="w-3 h-3 text-success" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            )}
            <button
              onClick={async () => {
                setIsChangingDir(true);
                try {
                  const result = await changeWorkingDir(
                    activeSessionId || undefined,
                    currentWorkingDir || undefined
                  );
                  if (!result.success && result.error && result.error !== 'User cancelled') {
                    setGlobalNotice({
                      id: `change-dir-failed-${Date.now()}`,
                      type: 'warning',
                      message: `${t('context.changeDirFailed')}: ${result.error}`,
                    });
                  }
                } catch (error) {
                  setGlobalNotice({
                    id: `change-dir-failed-${Date.now()}`,
                    type: 'error',
                    message:
                      error instanceof Error && error.message
                        ? `${t('context.changeDirFailed')}: ${error.message}`
                        : t('context.changeDirFailed'),
                  });
                } finally {
                  setIsChangingDir(false);
                }
              }}
              disabled={isChangingDir}
              className="text-text-muted hover:text-text-primary disabled:opacity-50 transition-colors shrink-0"
              title={t('context.changeDir')}
            >
              {isChangingDir ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FolderSync className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {/* Context Section */}
        <div className="border-b border-border-muted">
          <button
            onClick={() => setContextOpen(!contextOpen)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors"
          >
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              {t('context.context')}
            </span>
            {contextOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>

          {contextOpen && (
            <div>
              {/* Session Stats */}
              {activeSession && (
                <div className="px-4 pb-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-text-primary font-medium">
                    <Cpu className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="truncate">{modelName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted pl-5">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {messageCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      {toolCallCount}
                    </span>
                    {tokenUsage.total > 0 && (
                      <span className="ml-auto text-text-muted/70">
                        {t('context.inputTokens')} {formatTokenCount(tokenUsage.input)} ·{' '}
                        {t('context.outputTokens')} {formatTokenCount(tokenUsage.output)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Context Usage */}
              {activeSession && contextUsage && (
                <div className="px-4 pb-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                      {t('context.contextUsage')}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        contextUsage.percentage > 95
                          ? 'text-error'
                          : contextUsage.percentage > 80
                            ? 'text-warning'
                            : 'text-text-primary'
                      }`}
                    >
                      {Math.round(contextUsage.percentage)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        contextUsage.percentage > 95
                          ? 'bg-error'
                          : contextUsage.percentage > 80
                            ? 'bg-warning'
                            : 'bg-gradient-to-r from-accent to-accent-hover'
                      }`}
                      style={{ width: `${contextUsage.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-text-muted">
                    {t('context.contextUsageLabel', {
                      used: formatTokenCount(contextUsage.used),
                      total: formatTokenCount(contextUsage.total),
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <RoleActivitySection events={roleEvents} sessionId={activeSessionId} />

        {/* Artifacts Section */}
        <div className="border-b border-border-muted">
          <button
            onClick={() => setArtifactsOpen(!artifactsOpen)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors"
          >
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              {t('context.artifacts')}
            </span>
            {artifactsOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>

          {artifactsOpen && (
            <div className="pb-2 max-h-64 overflow-y-auto">
              {displayArtifacts.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-text-muted">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('context.noArtifactsYet')}</span>
                </div>
              ) : (
                <div>
                  {displayArtifacts.map((artifact, index) => {
                    const label = artifact.label || t('context.fileCreated');
                    const artifactPath = artifact.path;
                    const canClick = Boolean(artifactPath && canShowItemInFolder);
                    const iconComponent = getArtifactIconComponent(label);
                    const IconComponent =
                      iconComponent === 'presentation'
                        ? FilePieChart
                        : iconComponent === 'table'
                          ? FileSpreadsheet
                          : iconComponent === 'document'
                            ? FileText
                            : iconComponent === 'code'
                              ? FileCode2
                              : iconComponent === 'image'
                                ? ImageIcon
                                : iconComponent === 'audio'
                                  ? FileAudio2
                                  : iconComponent === 'video'
                                    ? FileVideo
                                    : iconComponent === 'archive'
                                      ? FileArchive
                                      : iconComponent === 'text'
                                        ? File
                                        : File;

                    return (
                      <div
                        key={artifact.path || artifact.label || `artifact-${index}`}
                        className={`flex items-center gap-2 px-4 py-1.5 transition-colors ${canClick ? 'cursor-pointer hover:bg-surface-hover' : ''}`}
                        onClick={async () => {
                          if (!canClick) return;
                          const revealed = await window.electronAPI.showItemInFolder(
                            artifactPath,
                            currentWorkingDir ?? undefined
                          );
                          if (!revealed) {
                            setGlobalNotice({
                              id: `artifact-reveal-failed-${Date.now()}`,
                              type: 'warning',
                              message: t('context.revealFailed'),
                            });
                          }
                        }}
                        title={artifactPath || undefined}
                      >
                        <IconComponent className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span className="text-xs text-text-primary truncate">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <ValidationLogsSection
          logs={validationLogs}
          fallbackAcceptance={acceptanceEntry}
          open={acceptanceOpen}
          onToggle={() => setAcceptanceOpen(!acceptanceOpen)}
        />

        {/* MCP Connectors */}
        <div className="border-b border-border-muted">
          <button
            onClick={() => setMcpOpen(!mcpOpen)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors"
          >
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              {t('context.mcpConnectors')}
            </span>
            {mcpOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>

          {mcpOpen && (
            <div className="px-4 pb-2">
              {mcpServers.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-text-muted py-1">
                  <Plug className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('mcp.noConnectors')}</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {mcpServers.map((server) => (
                    <ConnectorItem
                      key={server.id}
                      server={server}
                      steps={steps}
                      mcpToolDisplayNames={mcpToolDisplayNames}
                      expanded={expandedConnector === server.id}
                      onToggle={() =>
                        setExpandedConnector(expandedConnector === server.id ? null : server.id)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hooks / Permissions */}
        <div className="border-b border-border-muted">
          <button
            onClick={() => setHooksOpen(!hooksOpen)}
            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-surface-hover transition-colors"
          >
            <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
              {t('context.hooks')}
            </span>
            {hooksOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-text-muted" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            )}
          </button>

          {hooksOpen && (
            <div className="pb-2">
              {permissionLogs.length > 0 && <PermissionLogList logs={permissionLogs} />}
              {pendingPermission ? (
                <PermissionHookCard
                  permission={pendingPermission}
                  onRespond={handlePermissionResponse}
                />
              ) : (
                <div className="px-4 py-2">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('context.noPendingHooks')}</span>
                  </div>
                  <p className="mt-1 pl-5 text-[11px] leading-4 text-text-muted">
                    {t('context.hooksHint')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermissionHookCard({
  permission,
  onRespond,
}: {
  permission: PermissionRequest;
  onRespond: (permission: PermissionRequest, result: PermissionResult) => void;
}) {
  const { t } = useTranslation();
  const [confirmAlwaysAllow, setConfirmAlwaysAllow] = useState(false);

  const isHighRisk = [
    'bash',
    'write',
    'edit',
    'execute_command',
    'write_file',
    'edit_file',
  ].includes(permission.toolName);

  const getToolDescription = (toolName: string): string => {
    const key = `permission.toolDescriptions.${toolName}`;
    const translated = t(key);
    return translated !== key ? translated : t('permission.useTool', { toolName });
  };

  const respond = (result: PermissionResult) => {
    setConfirmAlwaysAllow(false);
    onRespond(permission, result);
  };

  const inputSummary =
    typeof permission.input === 'object' &&
    permission.input !== null &&
    'command' in permission.input
      ? String((permission.input as { command?: unknown }).command ?? '')
      : JSON.stringify(permission.input);

  return (
    <div className="mx-4 mt-2 rounded-lg border border-border-subtle bg-surface/80 p-2.5">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
            isHighRisk ? 'bg-warning/10' : 'bg-accent-muted'
          }`}
        >
          {isHighRisk ? (
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          ) : (
            <Shield className="h-3.5 w-3.5 text-accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-text-primary">
            {t('permission.permissionRequired')}
          </div>
          <p className="truncate text-[11px] leading-4 text-text-muted">
            {getToolDescription(permission.toolName)}
          </p>
        </div>
      </div>

      <div className="mt-2 space-y-1 rounded-md bg-surface-muted px-2 py-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">{t('permission.tool')}</span>
          <span className="truncate font-mono text-accent">{permission.toolName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-text-muted">{t('permission.input')}</span>
          <span className="truncate font-mono text-text-secondary" title={inputSummary}>
            {inputSummary}
          </span>
        </div>
      </div>

      {isHighRisk && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md border border-warning/20 bg-warning/10 px-2 py-1.5 text-[11px] leading-4 text-warning">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{t('permission.warning')}</span>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          onClick={() => respond('deny')}
          className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover"
        >
          <X className="h-3.5 w-3.5" />
          {t('permission.deny')}
        </button>
        <button
          onClick={() => respond('allow')}
          className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-background transition-colors hover:bg-accent-hover"
        >
          <Check className="h-3.5 w-3.5" />
          {t('permission.allow')}
        </button>
      </div>

      {!confirmAlwaysAllow ? (
        <button
          onClick={() => setConfirmAlwaysAllow(true)}
          className="mt-1.5 w-full rounded-md px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          {t('permission.alwaysAllow')}
        </button>
      ) : (
        <div className="mt-2 rounded-md border border-warning/20 bg-warning/10 p-2">
          <p className="text-[11px] leading-4 text-warning">
            {t('permission.alwaysAllowConfirm', { toolName: permission.toolName })}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirmAlwaysAllow(false)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-[11px] text-text-primary hover:bg-surface-hover"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => respond('allow_always')}
              className="rounded-md bg-accent px-2 py-1.5 text-[11px] font-medium text-background hover:bg-accent-hover"
            >
              {t('permission.alwaysAllow')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionLogList({ logs }: { logs: PermissionLogEntry[] }) {
  const { t, i18n } = useTranslation();

  const formatTime = (timestamp: number) =>
    new Intl.DateTimeFormat(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(timestamp);

  const getResultMeta = (result: PermissionResult) => {
    if (result === 'allow') {
      return {
        label: t('permission.logAllowed'),
        className: 'text-accent',
        Icon: Check,
      };
    }
    if (result === 'allow_always') {
      return {
        label: t('permission.logAlwaysAllowed'),
        className: 'text-accent',
        Icon: Shield,
      };
    }
    return {
      label: t('permission.logDenied'),
      className: 'text-error',
      Icon: X,
    };
  };

  return (
    <div className="mx-4 mb-2 rounded-lg border border-border-subtle bg-background/55">
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-[11px] font-medium text-text-muted">
        <Clock className="h-3.5 w-3.5" />
        <span>{t('permission.logTitle')}</span>
      </div>
      <div className="max-h-28 overflow-y-auto py-1">
        {logs.map((log) => {
          const meta = getResultMeta(log.result);
          const Icon = meta.Icon;
          return (
            <div key={log.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px]">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.className}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={meta.className}>{meta.label}</span>
                  <span className="truncate font-mono text-text-primary">{log.toolName}</span>
                </div>
              </div>
              <span className="shrink-0 text-text-muted">{formatTime(log.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConnectorItem({
  server,
  steps,
  mcpToolDisplayNames,
  expanded,
  onToggle,
}: {
  server: MCPServerInfo;
  steps: TraceStep[];
  mcpToolDisplayNames: Map<string, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  // Get MCP tools used from this server
  // Tool names are in format: mcp__ServerName__toolname (with double underscores)
  // Server name preserves original case and spaces are replaced with underscores
  const serverNamePattern = server.name.replace(/\s+/g, '_');

  const mcpToolsUsed = steps
    .filter((s) => s.toolName?.startsWith('mcp__'))
    .map((s) => s.toolName!)
    .filter((name, index, self) => self.indexOf(name) === index)
    .filter((name) => {
      // Check if this tool belongs to this server
      // Format: mcp__ServerName__toolname
      const match = name.match(/^mcp__(.+?)__(.+)$/);
      if (match) {
        const toolServerName = match[1];
        return toolServerName === serverNamePattern;
      }
      return false;
    });

  const usageCount = steps.filter(
    (s) => s.toolName?.startsWith('mcp__') && mcpToolsUsed.includes(s.toolName)
  ).length;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full px-3 py-2 flex items-center gap-2 transition-colors ${
          server.connected ? 'bg-mcp/10 hover:bg-mcp/20' : 'bg-surface-muted hover:bg-surface-hover'
        }`}
      >
        <div
          className={`w-6 h-6 rounded flex items-center justify-center ${
            server.connected ? 'bg-mcp/20' : 'bg-surface-muted'
          }`}
        >
          <Plug className={`w-3.5 h-3.5 ${server.connected ? 'text-mcp' : 'text-text-muted'}`} />
        </div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">{server.name}</span>
            {!server.connected && (
              <span className="text-xs text-text-muted">({t('mcp.notConnected')})</span>
            )}
          </div>
          {server.connected && (
            <p className="text-xs text-text-muted">
              {t('mcp.toolCount', { count: server.toolCount })}
              {usageCount > 0 && ` • ${t('mcp.callCount', { count: usageCount })}`}
            </p>
          )}
        </div>
        {server.connected &&
          (expanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          ))}
      </button>

      {expanded && server.connected && (
        <div className="px-3 pb-2 space-y-1 bg-surface">
          {mcpToolsUsed.length > 0 ? (
            <>
              <p className="text-xs text-text-muted px-2 py-1">{t('context.toolsUsedLabel')}</p>
              {mcpToolsUsed.map((toolName, index) => {
                const count = steps.filter((s) => s.toolName === toolName).length;
                const readableName =
                  mcpToolDisplayNames.get(toolName) || getMcpToolDisplayName(toolName);

                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-mcp/5 hover:bg-mcp/10 transition-colors"
                  >
                    <Wrench className="w-3.5 h-3.5 text-mcp" />
                    <span className="text-xs text-text-primary flex-1">{readableName}</span>
                    <span className="text-xs text-text-muted">{count}x</span>
                  </div>
                );
              })}
            </>
          ) : (
            <p className="text-xs text-text-muted px-2 py-1">{t('context.noToolsUsedYet')}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Format long paths to show abbreviated version
function formatPath(path: string): string {
  if (!path) return '';

  // Windows: Replace C:\Users\username with ~
  const winHome = /^[A-Z]:\\Users\\[^\\]+/i;
  const winMatch = path.match(winHome);
  if (winMatch) {
    return '~' + path.slice(winMatch[0].length).replace(/\\/g, '/');
  }

  // macOS/Linux: Replace /Users/username or /home/username with ~
  const unixHome = /^\/(?:Users|home)\/[^/]+/;
  const unixMatch = path.match(unixHome);
  if (unixMatch) {
    return '~' + path.slice(unixMatch[0].length);
  }

  return path;
}

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
