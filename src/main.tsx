import React from "react";
import ReactDOM from "react-dom/client";
import {
  ArrowUp,
  Archive,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileText,
  ImageIcon,
  KeyRound,
  Layers,
  Loader2,
  MessageSquareText,
  Mic,
  Plus,
  Send,
  Sparkles,
  UsersRound
} from "lucide-react";
import "./styles.css";

type Page = "chat" | "projects" | "keys" | "governance" | "rolepool";
type TaskStatus = "draft" | "ready" | "assigned" | "running" | "reviewing" | "needs_rework" | "blocked" | "done" | "cancelled";
type RuntimeStatus = "idle" | "queued" | "running" | "reviewing" | "waiting_for_user" | "blocked" | "failed";
type ModelProviderKind = "openai_compatible" | "anthropic" | "gemini" | "deepseek" | "qwen" | "moonshot" | "minimax" | "openrouter" | "ollama" | "custom";
type ApiFormat = "openai_chat" | "anthropic_messages" | "gemini_generate_content" | "ollama_openai" | "custom_http";
type RunMode = "plan" | "plan_and_dev" | "full_auto";

type ModelConnection = {
  id: string;
  providerKind: ModelProviderKind;
  apiFormat: ApiFormat;
  provider: string;
  baseUrl: string;
  modelName: string;
  keyPreview: string;
  status: "connected" | "error" | "untested";
  statusMessage?: string;
  checkedAt?: string;
  latencyMs?: number;
};

type AgentWorker = {
  id: string;
  name: string;
  role: string;
  mission: string;
  skills: string[];
  runtimeStatus: RuntimeStatus;
  currentTask: string;
  runsToday: number;
  modelConnectionId?: string;
  modelName?: string;
};

type FactoryTemplate = {
  id: string;
  name: string;
  description: string;
  domain: string;
  qualityGates: string[];
};

type Project = {
  id: string;
  factoryId?: string;
  name: string;
  goal: string;
  phase: string;
  status: string;
};

type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  phase: string;
  requiredTalentProfileId?: string | null;
  assignedTalentProfileId?: string | null;
  assignedAgentWorkerId: string | null;
  actionType?: "read" | "suggest" | "create" | "modify" | "delete" | "external" | "execute";
  dependsOn: string[];
};

type TalentProfile = {
  id: string;
  name: string;
  domain: string;
  responsibilities: string[];
  requiredSkills: string[];
  outputTypes: string[];
  toolNeeds: string[];
  reviewCriteria: string[];
  status: string;
  scope?: {
    allowedDomains?: string[];
    allowedFilePatterns?: string[];
    allowedTools?: string[];
    maxRiskLevel?: string;
  };
};

type AgentRoleAssignment = {
  id: string;
  agentWorkerId: string;
  talentProfileId: string;
  scopeType: "workspace" | "factory" | "project";
  scopeId: string;
  priority: number;
  active: boolean;
  trial?: boolean;
};

type GuardedAction = {
  id: string;
  taskId: string;
  agentWorkerId: string;
  talentProfileId: string | null;
  actionType: string;
  title: string;
  target: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  impactSummary: string;
  status: string;
};

type ActionReviewBrief = {
  id: string;
  actionId: string;
  title: string;
  requestedBy: string;
  target: string;
  reason: string;
  expectedBenefit: string;
  riskSummary: string;
  affectedScope: string[];
  rollbackPlan?: string;
  managementRecommendation: "approve" | "reject" | "revise";
};

type CapabilityGap = {
  id: string;
  taskId: string;
  missingCapability: string;
  requiredOutputs: string[];
  requiredTools: string[];
  acceptanceCriteria: string[];
  riskLevel: string;
  status: string;
};

type CandidateTalentProfile = {
  id: string;
  sourceGapId: string;
  name: string;
  domain: string;
  responsibilities: string[];
  requiredSkills: string[];
  toolNeeds: string[];
  reviewCriteria: string[];
  status: string;
};

type AuditLog = {
  id: string;
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
};

type Artifact = {
  id: string;
  type: string;
  name: string;
  createdByAgentWorkerId: string | null;
  createdAt: string;
};

type EventItem = {
  id: string;
  actor: string;
  event: string;
  detail: string;
  time: string;
};

type Dashboard = {
  factories: FactoryTemplate[];
  activeProject?: Project;
  agents: AgentWorker[];
  talentProfiles: TalentProfile[];
  agentRoleAssignments: AgentRoleAssignment[];
  tasks: Task[];
  artifacts: Artifact[];
  guardedActions: GuardedAction[];
  actionReviewBriefs: ActionReviewBrief[];
  capabilityGaps: CapabilityGap[];
  candidateTalentProfiles: CandidateTalentProfile[];
  auditLogs: AuditLog[];
  events: EventItem[];
  metrics: {
    factories: number;
    agents: number;
    talents: number;
    teamMembers: number;
    readyTasks: number;
    runningTasks: number;
    blockedTasks: number;
    pendingApprovals: number;
    capabilityGaps: number;
    guardedActions: number;
    artifacts: number;
  };
};

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

const emptyDashboard: Dashboard = {
  factories: [],
  agents: [],
  talentProfiles: [],
  agentRoleAssignments: [],
  tasks: [],
  artifacts: [],
  guardedActions: [],
  actionReviewBriefs: [],
  capabilityGaps: [],
  candidateTalentProfiles: [],
  auditLogs: [],
  events: [],
  metrics: {
    factories: 0,
    agents: 0,
    talents: 0,
    teamMembers: 0,
    readyTasks: 0,
    runningTasks: 0,
    blockedTasks: 0,
    pendingApprovals: 0,
    capabilityGaps: 0,
    guardedActions: 0,
    artifacts: 0
  }
};

const navItems: Array<{ id: Page; label: string; icon: React.ReactNode }> = [
  { id: "chat", label: "协作群", icon: <MessageSquareText size={18} /> },
  { id: "projects", label: "项目", icon: <CheckCircle2 size={18} /> },
  { id: "rolepool", label: "角色库", icon: <Layers size={18} /> },
  { id: "keys", label: "模型连接", icon: <KeyRound size={18} /> },
  { id: "governance", label: "治理", icon: <CircleAlert size={18} /> }
];

const taskStatusText: Record<TaskStatus, string> = {
  draft: "等待",
  ready: "就绪",
  assigned: "已分派",
  running: "执行中",
  reviewing: "待评审",
  needs_rework: "需返工",
  blocked: "受阻",
  done: "完成",
  cancelled: "取消"
};

const providerPresets: Array<{
  kind: ModelProviderKind;
  apiFormat: ApiFormat;
  provider: string;
  baseUrl: string;
  modelName: string;
  keyLabel: string;
  note: string;
}> = [
  {
    kind: "openai_compatible",
    apiFormat: "openai_chat",
    provider: "OpenAI Compatible",
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4.1",
    keyLabel: "OpenAI / compatible API Key",
    note: "适合 OpenAI 或任何兼容 OpenAI Chat Completions 的服务。"
  },
  {
    kind: "anthropic",
    apiFormat: "anthropic_messages",
    provider: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    modelName: "claude-sonnet-4",
    keyLabel: "Anthropic API Key",
    note: "适合 Claude 系列模型。"
  },
  {
    kind: "gemini",
    apiFormat: "gemini_generate_content",
    provider: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelName: "gemini-2.5-pro",
    keyLabel: "Gemini API Key",
    note: "适合 Google Gemini 模型。"
  },
  {
    kind: "deepseek",
    apiFormat: "openai_chat",
    provider: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    modelName: "deepseek-chat",
    keyLabel: "DeepSeek API Key",
    note: "DeepSeek 提供 OpenAI-compatible 接口。"
  },
  {
    kind: "qwen",
    apiFormat: "openai_chat",
    provider: "通义千问 / DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelName: "qwen-plus",
    keyLabel: "DashScope API Key",
    note: "通义千问兼容 OpenAI 风格调用。"
  },
  {
    kind: "moonshot",
    apiFormat: "openai_chat",
    provider: "Moonshot Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    modelName: "moonshot-v1-32k",
    keyLabel: "Moonshot API Key",
    note: "Kimi / Moonshot 兼容 OpenAI 风格调用。"
  },
  {
    kind: "minimax",
    apiFormat: "anthropic_messages",
    provider: "MiniMax",
    baseUrl: "https://api.minimaxi.com/anthropic/v1",
    modelName: "MiniMax-M2.7",
    keyLabel: "MiniMax API Key",
    note: "适合 MiniMax 的 Anthropic 兼容接口；如果填 https://api.minimaxi.com/anthropic，系统会自动补齐 /v1。"
  },
  {
    kind: "openrouter",
    apiFormat: "openai_chat",
    provider: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelName: "openai/gpt-4.1",
    keyLabel: "OpenRouter API Key",
    note: "一个 Key 可路由到多个模型供应商。"
  },
  {
    kind: "ollama",
    apiFormat: "ollama_openai",
    provider: "Ollama / Local",
    baseUrl: "http://127.0.0.1:11434/v1",
    modelName: "llama3.1",
    keyLabel: "本地模型可留空或填占位 Key",
    note: "适合本地 Ollama 或其他本地 OpenAI-compatible 服务。"
  },
  {
    kind: "custom",
    apiFormat: "custom_http",
    provider: "Custom Endpoint",
    baseUrl: "https://your-provider.example/v1",
    modelName: "your-model-name",
    keyLabel: "Custom API Key",
    note: "用于任何自定义或私有部署的模型网关。"
  }
];

function getApiBaseUrl() {
  return window.fishswarm?.getApiBaseUrl() ?? "";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, options);
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) throw new Error(payload.error.message);
  return payload.data;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function loadModelConnections(): ModelConnection[] {
  try {
    const parsed = JSON.parse(localStorage.getItem("fishswarm.modelConnections") || "[]") as Array<Partial<ModelConnection>>;
    return parsed
      .filter((item) => item.id && item.provider && item.baseUrl && item.modelName)
      .map((item) => ({
        id: item.id || `model-${Date.now()}`,
        providerKind: item.providerKind || "openai_compatible",
        apiFormat: item.apiFormat || defaultApiFormat(item.providerKind || "openai_compatible"),
        provider: item.provider || "OpenAI Compatible",
        baseUrl: item.baseUrl || "https://api.openai.com/v1",
        modelName: item.modelName || "gpt-4.1",
        keyPreview: item.keyPreview || "已保存",
        status: item.status || "connected",
        statusMessage: item.statusMessage,
        checkedAt: item.checkedAt,
        latencyMs: item.latencyMs
      }));
  } catch {
    return [];
  }
}

function saveModelConnections(value: ModelConnection[]) {
  localStorage.setItem("fishswarm.modelConnections", JSON.stringify(value));
}

function App() {
  const [page, setPage] = React.useState<Page>("chat");
  const [dashboard, setDashboard] = React.useState<Dashboard>(emptyDashboard);
  const [connections, setConnections] = React.useState<ModelConnection[]>(loadModelConnections);
  const [connectionState, setConnectionState] = React.useState<"connecting" | "online" | "offline">("connecting");
  const [leftCollapsed, setLeftCollapsed] = React.useState(false);
  const [rightCollapsed, setRightCollapsed] = React.useState(false);
  const [activeModelId, setActiveModelId] = React.useState("");
  const [notice, setNotice] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const [runMode, setRunMode] = React.useState<RunMode>("plan_and_dev");
  const [chatMessages, setChatMessages] = React.useState<Array<{ from: "user" | "assistant"; text: string; time: string }>>([]);

  const hasModel = connections.some((item) => item.status === "connected");
  const activeModel = connections.find((connection) => connection.id === activeModelId) || connections[0];

  const refresh = React.useCallback(async () => {
    try {
      const data = await request<Dashboard>("/api/dashboard");
      const withModels = attachModelBindings(data, connections);
      setDashboard(withModels);
      setConnectionState("online");
      return withModels;
    } catch {
      setConnectionState("offline");
      return null;
    }
  }, [connections]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    saveModelConnections(connections);
    setDashboard((current) => attachModelBindings(current, connections));
    setActiveModelId((current) => (connections.some((connection) => connection.id === current) ? current : connections[0]?.id || ""));
  }, [connections]);

  async function launchWork(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (!prompt.trim()) {
      setNotice({ tone: "error", text: "先告诉小鱼你想完成什么目标。" });
      return;
    }
    if (!hasModel) {
      setPage("keys");
      setNotice({ tone: "error", text: "请先连接一个大模型 API Key。员工需要模型连接后才能开始工作。" });
      return;
    }

    const userMsg = { from: "user" as const, text: prompt.trim(), time: new Date().toISOString() };
    setChatMessages((msgs) => [...msgs, userMsg]);
    setPrompt("");
    setBusy(true);

    try {
      const latest = (await refresh()) ?? dashboard;
      const factory = chooseFactory(prompt, latest.factories);

      await new Promise((r) => setTimeout(r, 800));

      let assistantText = "";
      if (!factory) {
        assistantText = "我还没太明白你想做什么，可以再描述详细一点吗？比如你想完成什么产品、做什么研究或解决什么问题。";
      } else {
        assistantText = `好的，我理解你想做的是"${userMsg.text.slice(0, 80)}"。这个目标我会安排团队帮你推进，预计需要拆解成几个阶段。你希望我现在就开始制定计划，还是还有其他想法想先补充？`;
      }

      setChatMessages((msgs) => [...msgs, { from: "assistant", text: assistantText, time: new Date().toISOString() }]);
    } catch (reason) {
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : "启动失败。" });
    } finally {
      setBusy(false);
    }
  }

  function addConnection(input: Omit<ModelConnection, "id" | "keyPreview"> & { apiKey: string }) {
    const key = input.apiKey.trim();
    const connection: ModelConnection = {
      id: `model-${Date.now()}`,
      providerKind: input.providerKind,
      apiFormat: input.apiFormat,
      provider: input.provider.trim(),
      baseUrl: input.baseUrl.trim(),
      modelName: input.modelName.trim(),
      keyPreview: key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : "已保存",
      status: input.status,
      statusMessage: input.statusMessage,
      checkedAt: input.checkedAt,
      latencyMs: input.latencyMs
    };
    setConnections((items) => [connection, ...items]);
    setNotice({ tone: "success", text: "模型连接已加入连接池。你可以继续添加更多 Key，并把不同员工绑定到不同模型。" });
  }

  function removeConnection(id: string) {
    setConnections((items) => items.filter((item) => item.id !== id));
  }

  async function decideGuardedAction(actionId: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      await request(`/api/guarded-actions/${actionId}/${decision}`, { method: "POST" });
      await refresh();
      setNotice({ tone: "success", text: decision === "approve" ? "风险动作已批准，任务已回到就绪状态。" : "风险动作已拒绝，任务保持受阻。" });
    } catch (reason) {
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : "审批失败。" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`app-shell ${leftCollapsed ? "left-collapsed" : ""} ${rightCollapsed ? "right-collapsed" : ""}`}>
      <aside className="sidebar">
        <button className="collapse-button" onClick={() => setLeftCollapsed((value) => !value)} title={leftCollapsed ? "展开侧边栏" : "收起侧边栏"} type="button">
          {leftCollapsed ? ">" : "<"}
        </button>
        <div className="brand">
          <div className="brand-mark">鱼</div>
          <div>
            <strong>鱼群</strong>
            <span>模型驱动的 Agent 员工协作群</span>
          </div>
        </div>
        <div className={`key-status ${hasModel ? "ready" : "missing"}`}>
          <KeyRound size={17} />
          <div>
            <strong>{hasModel ? "模型已连接" : "未连接模型"}</strong>
            <span>{hasModel ? `${connections.length} 个连接可用` : "先连接 API Key"}</span>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <button className={page === item.id ? "active" : ""} key={item.id} onClick={() => setPage(item.id)} type="button">
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="server-card">
          <div className={`server-light ${connectionState}`} />
          <div>
            <strong>本地服务</strong>
            <span>{connectionState === "online" ? "在线" : connectionState === "offline" ? "离线" : "连接中"}</span>
          </div>
        </div>
      </aside>

      <main className={`workspace workspace-${page}`}>
        {page === "chat" ? null : (
          <header className="topbar">
            <div>
              <p className="eyebrow">FishSwarm</p>
              <h1>{titleForPage(page)}</h1>
            </div>
            <button className="ghost-button" onClick={() => void refresh()} type="button">
              刷新
            </button>
          </header>
        )}

        {notice ? <div className={`notice notice-${notice.tone}`}>{notice.text}</div> : null}

        {page === "chat" ? (
          <ChatHome
            activeModel={activeModel}
            activeModelId={activeModel?.id || ""}
            busy={busy}
            chatMessages={chatMessages}
            connections={connections}
            dashboard={dashboard}
            hasModel={hasModel}
            modeOptions={runMode}
            prompt={prompt}
            setActiveModelId={setActiveModelId}
            setModeOptions={setRunMode}
            setPage={setPage}
            setPrompt={setPrompt}
            onLaunch={launchWork}
          />
        ) : null}
        {page === "projects" ? <ProjectRoom dashboard={dashboard} /> : null}
        {page === "rolepool" ? <RolePool dashboard={dashboard} /> : null}
        {page === "keys" ? <ModelConnections connections={connections} onAdd={addConnection} onRemove={removeConnection} /> : null}
        {page === "governance" ? <GovernanceView busy={busy} dashboard={dashboard} onDecision={decideGuardedAction} /> : null}
      </main>
      <RightInspector collapsed={rightCollapsed} dashboard={dashboard} setCollapsed={setRightCollapsed} setPage={setPage} />
    </div>
  );
}

function ChatHome({
  activeModel,
  activeModelId,
  busy,
  chatMessages,
  connections,
  dashboard,
  hasModel,
  prompt,
  modeOptions,
  setActiveModelId,
  setModeOptions,
  setPage,
  setPrompt,
  onLaunch
}: {
  activeModel: ModelConnection | undefined;
  activeModelId: string;
  busy: boolean;
  chatMessages: Array<{ from: "user" | "assistant"; text: string; time: string }>;
  connections: ModelConnection[];
  dashboard: Dashboard;
  hasModel: boolean;
  prompt: string;
  modeOptions: RunMode;
  setActiveModelId: (value: string) => void;
  setModeOptions: (value: RunMode) => void;
  setPage: (page: Page) => void;
  setPrompt: (value: string) => void;
  onLaunch: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [showAttachPanel, setShowAttachPanel] = React.useState(false);
  const [showModePanel, setShowModePanel] = React.useState(false);
  const attachWrapRef = React.useRef<HTMLDivElement>(null);
  const modeWrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (showAttachPanel && attachWrapRef.current && !attachWrapRef.current.contains(target)) setShowAttachPanel(false);
      if (showModePanel && modeWrapRef.current && !modeWrapRef.current.contains(target)) setShowModePanel(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAttachPanel, showModePanel]);

  const modeLabels: Record<RunMode, string> = { plan: "计划", plan_and_dev: "计划+开发", full_auto: "全流程" };
  return (
    <section className="swarm-chat">
      <div className="swarm-thread">
        {chatMessages.length === 0 && (
          <ChatMessage name="小鱼" role="助理" text="有什么想法或目标直接跟我说，我会帮你安排下去。" tone={hasModel ? "guide" : "warning"} />
        )}
        {chatMessages.map((msg, index) => (
          <ChatMessage
            key={index}
            name={msg.from === "user" ? "你" : "小鱼"}
            role={msg.from === "user" ? "用户" : "助理"}
            tone={msg.from === "user" ? "user" : "assistant"}
            text={msg.text}
          />
        ))}
      </div>
      <form className="swarm-composer" onSubmit={onLaunch}>
        <textarea
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onLaunch(event as unknown as React.FormEvent<HTMLFormElement>);
            }
          }}
          placeholder="输入你的想法或目标..."
          value={prompt}
        />
        <div className="composer-toolbar">
          <div className="toolbar-left">
            <div className="toolbar-popup-wrap" ref={attachWrapRef}>
              <button className="toolbar-icon" onClick={() => setShowAttachPanel((v) => !v)} title="添加附件" type="button">
                <Plus size={18} />
              </button>
              {showAttachPanel ? (
                <div className="attach-panel">
                  <button className="attach-row" onClick={() => setShowAttachPanel(false)} type="button">
                    <ImageIcon size={16} />
                    <span>添加图片</span>
                  </button>
                  <button className="attach-row" onClick={() => setShowAttachPanel(false)} type="button">
                    <FileText size={16} />
                    <span>添加文件</span>
                  </button>
                </div>
              ) : null}
            </div>
            <div className="access-dropdown" ref={modeWrapRef}>
              <button className="toolbar-access" onClick={() => setShowModePanel(!showModePanel)} title="切换权限模式" type="button">
                <CircleAlert size={14} className={`access-icon access-${modeOptions === "full_auto" ? "high" : modeOptions === "plan_and_dev" ? "medium" : "low"}`} />
                <span className="access-label">
                  {modeLabels[modeOptions]}
                </span>
                <ChevronDown size={14} />
              </button>
              {showModePanel ? (
                <div className="mode-panel">
                  {(["plan", "plan_and_dev", "full_auto"] as RunMode[]).map((mode) => (
                    <button className={`mode-row ${modeOptions === mode ? "mode-row-active" : ""}`} key={mode} onClick={() => { setModeOptions(mode); setShowModePanel(false); }} type="button">
                      <CircleAlert size={14} className={`access-icon access-${mode === "full_auto" ? "high" : mode === "plan_and_dev" ? "medium" : "low"}`} />
                      <span>{modeLabels[mode]}</span>
                      {modeOptions === mode ? <CheckCircle2 size={14} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="toolbar-right">
            <button className="toolbar-model" title="切换模型" type="button">
              <span className="model-badge">{activeModel?.modelName?.slice(0, 8) || "-"}</span>
              <ChevronDown size={14} />
            </button>
            <button className="toolbar-icon" title="语音输入" type="button">
              <Mic size={18} />
            </button>
            <button className="send-circle" disabled={busy || !hasModel} type={hasModel ? "submit" : "button"} onClick={!hasModel ? () => setPage("keys") : undefined}>
              {busy ? <Loader2 className="spin" size={20} /> : <ArrowUp size={20} />}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function RightInspector({
  collapsed,
  dashboard,
  setCollapsed,
  setPage
}: {
  collapsed: boolean;
  dashboard: Dashboard;
  setCollapsed: (value: boolean) => void;
  setPage: (page: Page) => void;
}) {
  const pendingActions = dashboard.guardedActions.filter((action) => ["needs_management_review", "needs_user_approval"].includes(action.status));
  const openGaps = dashboard.capabilityGaps.filter((gap) => gap.status === "open");
  const activeTasks = dashboard.tasks.filter((task) => ["ready", "assigned", "running", "reviewing", "blocked"].includes(task.status));
  const latestArtifact = dashboard.artifacts[0];
  const snapshotTime = new Date().toISOString();
  const systemMessages = [
    ...(dashboard.activeProject ? [{ id: `project-${dashboard.activeProject.id}`, title: "项目状态", detail: `${dashboard.activeProject.name} · ${dashboard.activeProject.status}`, time: snapshotTime, tone: "normal" as const, page: "projects" as Page }] : []),
    ...pendingActions.map((action) => ({ id: `action-${action.id}`, title: "哨兵拦截", detail: `${action.title} · ${action.target}`, time: snapshotTime, tone: "urgent" as const, page: "governance" as Page })),
    ...openGaps.map((gap) => ({ id: `gap-${gap.id}`, title: "能力缺口", detail: gap.missingCapability, time: snapshotTime, tone: "warn" as const, page: "governance" as Page })),
    ...activeTasks.map((task) => ({ id: `task-${task.id}`, title: taskStatusText[task.status], detail: task.title, time: snapshotTime, tone: task.status === "blocked" ? "urgent" as const : "normal" as const, page: "projects" as Page })),
    ...(latestArtifact ? [{ id: `artifact-${latestArtifact.id}`, title: "最新产物", detail: latestArtifact.name, time: latestArtifact.createdAt, tone: "normal" as const, page: "projects" as Page }] : []),
    ...dashboard.events.map((event) => ({ id: `event-${event.id}`, title: event.actor, detail: `${event.event}：${event.detail}`, time: event.time, tone: "normal" as const, page: "projects" as Page }))
  ].sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());

  return (
    <aside className="inspector">
      <button className="collapse-button inspector-toggle" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "展开项目监察" : "收起项目监察"} type="button">
        {collapsed ? "<" : ">"}
      </button>
      {collapsed ? null : (
        <div className="inspector-content">
          <section className="system-feed">
            <div className="system-feed-head">
              <strong>系统消息</strong>
              <span>{systemMessages.length}</span>
            </div>
            <div className="mini-progress">
              <span style={{ width: `${progressPercent(dashboard.tasks)}%` }} />
            </div>
            <div className="system-feed-list">
              {systemMessages.length === 0 ? <EmptyState text="系统消息会在项目启动后出现。" /> : null}
              {systemMessages.slice(0, 24).map((message) => (
                <button className={`system-message ${message.tone}`} key={message.id} onClick={() => setPage(message.page)} type="button">
                  <span>{formatTime(message.time)}</span>
                  <strong>{message.title}</strong>
                  <small>{message.detail}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}

function progressPercent(tasks: Task[]) {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((task) => task.status === "done").length / tasks.length) * 100);
}

function SystemReadiness({ dashboard, hasModel }: { dashboard: Dashboard; hasModel: boolean }) {
  const pendingActions = dashboard.guardedActions.filter((action) => ["needs_management_review", "needs_user_approval"].includes(action.status)).length;
  const openGaps = dashboard.capabilityGaps.filter((gap) => gap.status === "open").length;
  const projectStatus = dashboard.activeProject ? dashboard.activeProject.status : "暂无";
  return (
    <section className="readiness-band">
      <div>
        <p className="eyebrow">Command center</p>
        <h2>交给鱼群处理</h2>
      </div>
      <div className="readiness-grid">
        <StatusTile label="模型连接" value={hasModel ? "已连接" : "未连接"} tone={hasModel ? "good" : "warn"} />
        <StatusTile label="可用人才" value={`${dashboard.talentProfiles.length}`} />
        <StatusTile label="待审批" value={`${pendingActions}`} tone={pendingActions ? "warn" : "good"} />
        <StatusTile label="能力缺口" value={`${openGaps}`} tone={openGaps ? "warn" : "good"} />
        <StatusTile label="当前项目" value={projectStatus} />
      </div>
    </section>
  );
}

function StatusTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  return (
    <article className={`status-tile status-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function GoalComposer({
  busy,
  hasModel,
  prompt,
  setPage,
  setPrompt,
  onLaunch
}: {
  busy: boolean;
  hasModel: boolean;
  prompt: string;
  setPage: (page: Page) => void;
  setPrompt: (value: string) => void;
  onLaunch: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const examples = [
    "做一个 SaaS MVP：输出需求、技术方案和第一版交付计划。",
    "写一份竞品调研：输出关键竞品、差异点和机会判断。",
    "培养一个 Chrome 插件工程师，并完成插件 MVP 的任务拆解。",
    "审查当前项目风险：输出架构、权限、交付和缺口问题。"
  ];
  return (
    <section className="goal-card">
      <div className="goal-copy">
        <p className="eyebrow">Goal dispatch</p>
        <h2>描述目标，鱼群会自动拆解、匹配人才并启动第一步</h2>
        <p>缺少人才会进入进化队列；涉及修改、外部访问或高风险动作时，会先生成管理简报交给你批准。</p>
      </div>
      <form className="goal-form" onSubmit={onLaunch}>
        <label>
          <span>目标</span>
          <textarea onChange={(event) => setPrompt(event.target.value)} placeholder="描述你想完成的目标..." value={prompt} />
        </label>
        <div className="examples goal-examples">
          {examples.map((text) => (
            <button key={text} onClick={() => setPrompt(text)} type="button">{text}</button>
          ))}
        </div>
        {hasModel ? (
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
            <span>{busy ? "接单中" : "交给鱼群处理"}</span>
          </button>
        ) : (
          <button className="primary-button" onClick={() => setPage("keys")} type="button">
            <KeyRound size={18} />
            <span>先连接模型</span>
          </button>
        )}
      </form>
    </section>
  );
}

function AttentionQueue({
  latestArtifact,
  openGaps,
  pendingActions,
  runningTasks,
  setPage
}: {
  latestArtifact?: Artifact;
  openGaps: CapabilityGap[];
  pendingActions: GuardedAction[];
  runningTasks: Task[];
  setPage: (page: Page) => void;
}) {
  return (
    <section className="panel attention-card">
      <PanelTitle icon={<CircleAlert size={18} />} title="需要你注意" />
      <div className="attention-list">
        {pendingActions.length === 0 && openGaps.length === 0 && runningTasks.length === 0 && !latestArtifact ? <EmptyState text="系统空闲，可以派发新目标。" /> : null}
        {pendingActions.slice(0, 2).map((action) => (
          <button className="attention-item urgent" key={action.id} onClick={() => setPage("governance")} type="button">
            <strong>待审批动作</strong>
            <span>{action.target}</span>
          </button>
        ))}
        {openGaps.slice(0, 2).map((gap) => (
          <button className="attention-item" key={gap.id} onClick={() => setPage("governance")} type="button">
            <strong>能力缺口</strong>
            <span>{gap.missingCapability}</span>
          </button>
        ))}
        {runningTasks.slice(0, 2).map((task) => (
          <button className="attention-item" key={task.id} onClick={() => setPage("projects")} type="button">
            <strong>{taskStatusText[task.status]}</strong>
            <span>{task.title}</span>
          </button>
        ))}
        {latestArtifact ? (
          <button className="attention-item" onClick={() => setPage("projects")} type="button">
            <strong>最新产物</strong>
            <span>{latestArtifact.name}</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function RecentActivity({ events }: { events: EventItem[] }) {
  return (
    <section className="panel activity-card">
      <PanelTitle icon={<Archive size={18} />} title="最近动态" />
      <div className="activity-list">
        {events.length === 0 ? <EmptyState text="系统动态会出现在这里。" /> : null}
        {events.slice(0, 6).map((event) => (
          <article className="activity-row" key={event.id}>
            <strong>{event.actor}</strong>
            <span>{event.event}：{event.detail}</span>
            <small>{formatTime(event.time)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectRoom({ dashboard }: { dashboard: Dashboard }) {
  const project = dashboard.activeProject;
  return (
    <section className="project-grid">
      <div className="panel project-summary">
        <PanelTitle icon={<Sparkles size={18} />} title="当前项目" />
        {project ? (
          <>
            <h2>{project.name}</h2>
            <p>{project.goal}</p>
          </>
        ) : (
          <EmptyState text="还没有项目。在协作群里发送第一条任务后，这里会出现项目房间。" />
        )}
      </div>
      <WorkTimeline tasks={dashboard.tasks} agents={dashboard.agents} talents={dashboard.talentProfiles} />
      <ArtifactDrawer artifacts={dashboard.artifacts} agents={dashboard.agents} />
    </section>
  );
}

function WorkTimeline({ tasks, agents, talents }: { tasks: Task[]; agents: AgentWorker[]; talents: TalentProfile[] }) {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  const talentNames = new Map(talents.map((talent) => [talent.id, talent.name]));
  return (
    <section className="panel timeline-panel">
      <PanelTitle icon={<CheckCircle2 size={18} />} title="工作时间线" />
      <div className="timeline">
        {tasks.length === 0 ? <EmptyState text="任务会以时间线形式出现，而不是复杂看板。" /> : null}
        {tasks.map((task) => (
          <article className={`timeline-item task-${task.status}`} key={task.id}>
            <div className="timeline-dot" />
            <div>
              <div className="timeline-head">
                <strong>{task.title}</strong>
                <span>{taskStatusText[task.status]}</span>
              </div>
              <p>{task.description}</p>
              <small>{task.assignedAgentWorkerId ? names.get(task.assignedAgentWorkerId) : "等待分派"} · {talentNames.get(task.assignedTalentProfileId || "") || "缺少人才"} · {task.actionType || "create"}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Employees({ agents, connections }: { agents: AgentWorker[]; connections: ModelConnection[] }) {
  return (
    <section className="panel">
      <PanelTitle icon={<Bot size={18} />} title="员工 = Agent + 一个模型" />
      <div className="employee-grid">
        {agents.map((agent) => {
          const binding = connections.find((item) => item.id === agent.modelConnectionId) ?? connections[0];
          return (
            <article className="employee-card" key={agent.id}>
              <div className="employee-top">
                <div className="employee-avatar">{agent.name.slice(0, 1)}</div>
                <div>
                  <strong>{agent.name}</strong>
                  <span>{agent.role}</span>
                </div>
              </div>
              <p>{agent.mission}</p>
              <div className={`model-binding ${binding ? "bound" : "unbound"}`}>
                <KeyRound size={15} />
                <span>{binding ? `${binding.provider} · ${agent.modelName || binding.modelName}` : "未绑定模型，不能工作"}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RolePool({ dashboard }: { dashboard: Dashboard }) {
  const agents = new Map(dashboard.agents.map((agent) => [agent.id, agent]));
  const assignmentsByTalent = new Map<string, AgentRoleAssignment[]>();
  for (const assignment of dashboard.agentRoleAssignments) {
    assignmentsByTalent.set(assignment.talentProfileId, [...(assignmentsByTalent.get(assignment.talentProfileId) || []), assignment]);
  }

  const layerGroups = dashboard.talentProfiles.reduce((groups, talent) => {
    if (talent.domain === "管理") groups.manager.push(talent);
    else if (talent.domain === "治理") groups.sentinel.push(talent);
    else groups.talent.push(talent);
    return groups;
  }, { manager: [] as TalentProfile[], sentinel: [] as TalentProfile[], talent: [] as TalentProfile[] });

  const layerMeta: Array<{ key: string; label: string; icon: React.ReactNode; items: TalentProfile[]; color: string }> = [
    { key: "manager", label: "管理层", icon: <UsersRound size={18} />, items: layerGroups.manager, color: "#1a7a54" },
    { key: "sentinel", label: "哨兵层", icon: <CircleAlert size={18} />, items: layerGroups.sentinel, color: "#dd695b" },
    { key: "talent", label: "人才层", icon: <Bot size={18} />, items: layerGroups.talent, color: "#5d5749" }
  ];

  return (
    <section className="role-pool">
      {layerMeta.map((layer) => (
        <section className="panel role-layer" key={layer.key}>
          <div className="layer-title" style={{ color: layer.color }}>
            {layer.icon}
            <strong>{layer.label}</strong>
            <span>{layer.items.length}</span>
          </div>
          <div className="role-grid">
            {layer.items.length === 0 ? <EmptyState text={`${layer.label}暂无角色。`} /> : null}
            {layer.items.map((talent) => {
              const assignments = assignmentsByTalent.get(talent.id) || [];
              const candidateAgents = assignments.map((a) => agents.get(a.agentWorkerId)?.name).filter(Boolean);
              return (
                <article className="role-card" key={talent.id}>
                  <div className="role-head">
                    <strong>{talent.name}</strong>
                    <span>{talent.domain}</span>
                  </div>
                  <p>{talent.responsibilities.join("、")}</p>
                  <div className="chip-row">
                    {talent.requiredSkills.slice(0, 4).map((skill) => <span className="chip" key={skill}>{skill}</span>)}
                  </div>
                  {candidateAgents.length > 0 ? <small>候选员工：{candidateAgents.join("、")}</small> : <EmptyState text="暂无候选员工" />}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}

function TalentLayer({ dashboard }: { dashboard: Dashboard }) {
  const agents = new Map(dashboard.agents.map((agent) => [agent.id, agent]));
  const assignmentsByTalent = new Map<string, AgentRoleAssignment[]>();
  for (const assignment of dashboard.agentRoleAssignments) {
    assignmentsByTalent.set(assignment.talentProfileId, [...(assignmentsByTalent.get(assignment.talentProfileId) || []), assignment]);
  }

  return (
    <section className="org-grid">
      <section className="panel">
        <PanelTitle icon={<Bot size={18} />} title={`人才层（${dashboard.talentProfiles.length}）`} />
        <div className="talent-grid">
          {dashboard.talentProfiles.map((talent) => {
            const assignments = assignmentsByTalent.get(talent.id) || [];
            return (
              <article className="talent-card" key={talent.id}>
                <div className="talent-head">
                  <strong>{talent.name}</strong>
                  <span>{talent.domain}</span>
                </div>
                <p>{talent.responsibilities.join("、")}</p>
                <div className="chip-row">
                  {talent.requiredSkills.slice(0, 4).map((skill) => <span className="chip" key={skill}>{skill}</span>)}
                </div>
                <small>候选 Agent：{assignments.map((assignment) => agents.get(assignment.agentWorkerId)?.name).filter(Boolean).join("、") || "暂无"}</small>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={<UsersRound size={18} />} title="员工-人才矩阵" />
        <div className="matrix">
          <div className="matrix-row matrix-head-row">
            <span>员工</span>
            {dashboard.talentProfiles.slice(0, 6).map((talent) => <span key={talent.id}>{talent.name}</span>)}
          </div>
          {dashboard.agents.map((agent) => (
            <div className="matrix-row" key={agent.id}>
              <strong>{agent.name}</strong>
              {dashboard.talentProfiles.slice(0, 6).map((talent) => {
                const assigned = dashboard.agentRoleAssignments.some((assignment) => assignment.agentWorkerId === agent.id && assignment.talentProfileId === talent.id && assignment.active);
                return <span className={assigned ? "matrix-on" : "matrix-off"} key={talent.id}>{assigned ? "可承担" : ""}</span>;
              })}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function GovernanceView({
  busy,
  dashboard,
  onDecision
}: {
  busy: boolean;
  dashboard: Dashboard;
  onDecision: (actionId: string, decision: "approve" | "reject") => void;
}) {
  return (
    <section className="governance-stack">
      <section className="panel">
        <PanelTitle icon={<Sparkles size={18} />} title="系统治理" />
        <div className="governance-summary">
          <SummaryMetric label="可用人才" value={dashboard.talentProfiles.length} />
          <SummaryMetric label="待审批动作" value={dashboard.guardedActions.filter((action) => ["needs_management_review", "needs_user_approval"].includes(action.status)).length} />
          <SummaryMetric label="能力缺口" value={dashboard.capabilityGaps.filter((gap) => gap.status === "open").length} />
          <SummaryMetric label="审计记录" value={dashboard.auditLogs.length} />
        </div>
      </section>
      <SentinelLayer busy={busy} dashboard={dashboard} onDecision={onDecision} />
      <EvolutionLayer dashboard={dashboard} />
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <article className="summary-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function SentinelLayer({
  busy,
  dashboard,
  onDecision
}: {
  busy: boolean;
  dashboard: Dashboard;
  onDecision: (actionId: string, decision: "approve" | "reject") => void;
}) {
  const briefs = new Map(dashboard.actionReviewBriefs.map((brief) => [brief.actionId, brief]));
  return (
    <section className="org-grid">
      <section className="panel">
        <PanelTitle icon={<CircleAlert size={18} />} title={`待审批动作（${dashboard.guardedActions.length}）`} />
        <div className="approval-list">
          {dashboard.guardedActions.length === 0 ? <EmptyState text="当前没有被哨兵拦截的风险动作。" /> : null}
          {dashboard.guardedActions.map((action) => {
            const brief = briefs.get(action.id);
            const pending = ["needs_management_review", "needs_user_approval"].includes(action.status);
            return (
              <article className="approval-card" key={action.id}>
                <div className="approval-head">
                  <strong>{action.title}</strong>
                  <span className={`risk risk-${action.riskLevel}`}>{action.riskLevel}</span>
                </div>
                <p>{brief?.riskSummary || action.impactSummary}</p>
                <small>目标：{action.target} · 动作：{action.actionType} · 状态：{action.status}</small>
                {brief ? <div className="brief-box">建议：{brief.managementRecommendation}。收益：{brief.expectedBenefit} 回滚：{brief.rollbackPlan}</div> : null}
                {pending ? (
                  <div className="approval-actions">
                    <button className="secondary-button" disabled={busy} onClick={() => onDecision(action.id, "reject")} type="button">拒绝</button>
                    <button className="primary-button" disabled={busy} onClick={() => onDecision(action.id, "approve")} type="button">批准</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={<Archive size={18} />} title="审计日志" />
        <div className="audit-list">
          {dashboard.auditLogs.length === 0 ? <EmptyState text="哨兵和管理层的关键决策会记录在这里。" /> : null}
          {dashboard.auditLogs.map((log) => (
            <article className="audit-row" key={log.id}>
              <strong>{log.actor} · {log.action}</strong>
              <span>{log.detail}</span>
              <small>{formatTime(log.createdAt)}</small>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function EvolutionLayer({ dashboard }: { dashboard: Dashboard }) {
  const candidates = new Map(dashboard.candidateTalentProfiles.map((candidate) => [candidate.sourceGapId, candidate]));
  return (
    <section className="panel">
      <PanelTitle icon={<Sparkles size={18} />} title={`进化队列（${dashboard.capabilityGaps.length}）`} />
      <div className="evolution-list">
        {dashboard.capabilityGaps.length === 0 ? <EmptyState text="当任务找不到合适人才时，能力缺口和候选人才会出现在这里。" /> : null}
        {dashboard.capabilityGaps.map((gap) => {
          const candidate = candidates.get(gap.id);
          return (
            <article className="evolution-card" key={gap.id}>
              <div className="talent-head">
                <strong>{gap.missingCapability}</strong>
                <span>{gap.status}</span>
              </div>
              <p>缺口要求：{gap.acceptanceCriteria.join("、")}</p>
              <div className="chip-row">
                {gap.requiredTools.map((tool) => <span className="chip" key={tool}>{tool}</span>)}
              </div>
              {candidate ? <small>候选人才：{candidate.name} · {candidate.status} · {candidate.responsibilities.join("、")}</small> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ModelConnections({
  connections,
  onAdd,
  onRemove
}: {
  connections: ModelConnection[];
  onAdd: (input: Omit<ModelConnection, "id" | "keyPreview"> & { apiKey: string }) => void;
  onRemove: (id: string) => void;
}) {
  const [form, setForm] = React.useState({
    providerKind: providerPresets[0].kind,
    apiFormat: providerPresets[0].apiFormat,
    provider: providerPresets[0].provider,
    baseUrl: providerPresets[0].baseUrl,
    modelName: providerPresets[0].modelName,
    apiKey: ""
  });
  const [testState, setTestState] = React.useState<
    | { status: "idle" }
    | { status: "testing" }
    | { status: "connected"; message: string; latencyMs: number; checkedAt: string }
    | { status: "saved"; message: string; latencyMs: number; checkedAt: string }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const activePreset = providerPresets.find((preset) => preset.kind === form.providerKind) ?? providerPresets[0];

  function applyPreset(kind: ModelProviderKind) {
    const preset = providerPresets.find((item) => item.kind === kind) ?? providerPresets[0];
    setForm((current) => ({
      ...current,
      providerKind: preset.kind,
      apiFormat: preset.apiFormat,
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      modelName: preset.modelName
    }));
    setTestState({ status: "idle" });
  }

  function updateForm(value: typeof form) {
    setForm(value);
    setTestState({ status: "idle" });
  }

  async function testConnection() {
    setTestState({ status: "testing" });
    try {
      const result = await request<{ status: "connected"; message: string; latencyMs: number; checkedAt: string }>("/api/model-connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      onAdd({
        ...form,
        status: "connected",
        statusMessage: result.message,
        checkedAt: result.checkedAt,
        latencyMs: result.latencyMs
      });
      setForm((current) => ({ ...current, apiKey: "" }));
      setTestState({
        status: "saved",
        message: "连接成功，已加入模型连接池。",
        latencyMs: result.latencyMs,
        checkedAt: result.checkedAt
      });
    } catch (reason) {
      setTestState({ status: "error", message: reason instanceof Error ? reason.message : "连接检测失败。" });
    }
  }

  return (
    <section className="keys-grid">
      <form
        className="panel key-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (testState.status !== "connected") return;
          onAdd({
            ...form,
            status: "connected",
            statusMessage: testState.message,
            checkedAt: testState.checkedAt,
            latencyMs: testState.latencyMs
          });
          setForm((current) => ({ ...current, apiKey: "" }));
          setTestState({ status: "idle" });
        }}
      >
        <PanelTitle icon={<KeyRound size={18} />} title="新增一个模型连接" />
        <p className="form-help">可以添加多个 API Key。每个员工只绑定其中一个模型连接，执行任务时使用自己的绑定。</p>
        <label>
          <span>模型供应商</span>
          <select value={form.providerKind} onChange={(event) => applyPreset(event.target.value as ModelProviderKind)}>
            {providerPresets.map((preset) => (
              <option key={preset.kind} value={preset.kind}>{preset.provider}</option>
            ))}
          </select>
        </label>
        <div className="provider-note">{activePreset.note}</div>
        <label>
          <span>API 格式</span>
          <select value={form.apiFormat} onChange={(event) => updateForm({ ...form, apiFormat: event.target.value as ApiFormat })}>
            <option value="openai_chat">OpenAI-compatible Chat Completions</option>
            <option value="anthropic_messages">Anthropic Messages</option>
            <option value="gemini_generate_content">Gemini Generative Language</option>
            <option value="ollama_openai">Ollama OpenAI-compatible</option>
            <option value="custom_http">Custom HTTP</option>
          </select>
        </label>
        <label>
          <span>Provider 名称</span>
          <input value={form.provider} onChange={(event) => updateForm({ ...form, provider: event.target.value })} />
        </label>
        <label>
          <span>Base URL</span>
          <input value={form.baseUrl} onChange={(event) => updateForm({ ...form, baseUrl: event.target.value })} />
        </label>
        <label>
          <span>模型 ID</span>
          <input value={form.modelName} onChange={(event) => updateForm({ ...form, modelName: event.target.value })} />
        </label>
        <label>
          <span>{activePreset.keyLabel}</span>
          <input required={form.providerKind !== "ollama"} type="password" value={form.apiKey} onChange={(event) => updateForm({ ...form, apiKey: event.target.value })} />
        </label>
        <div className="test-actions">
          <button className="secondary-button" disabled={testState.status === "testing"} onClick={testConnection} type="button">
            {testState.status === "testing" ? <Loader2 className="spin" size={18} /> : <CheckCircle2 size={18} />}
            检测连接
          </button>
          <button className="primary-button" disabled={testState.status !== "connected"} type="submit"><Plus size={18} />{testState.status === "saved" ? "已加入连接池" : "添加到连接池"}</button>
        </div>
        {testState.status !== "idle" ? (
          <div className={`test-result test-${testState.status}`}>
            {testState.status === "testing" ? "正在检测模型服务..." : null}
            {testState.status === "connected" || testState.status === "saved" ? `${testState.message} 延迟 ${testState.latencyMs}ms。` : null}
            {testState.status === "error" ? testState.message : null}
          </div>
        ) : null}
      </form>
      <section className="panel">
        <PanelTitle icon={<CheckCircle2 size={18} />} title={`模型连接池（${connections.length}）`} />
        <div className="connection-list">
          {connections.length === 0 ? <EmptyState text="还没有模型连接。可以同时添加多个 Key；没有 Key 时，员工不能执行任务。" /> : null}
          {connections.map((connection, index) => (
            <article className="connection-card" key={connection.id}>
              <div className="connection-index">{index + 1}</div>
              <div>
                <strong>{connection.provider}</strong>
                <span>{connection.modelName} · {formatApiFormat(connection.apiFormat)} · {connection.keyPreview}</span>
                <small>{connection.baseUrl}</small>
                <small>{connectionStatusText(connection)}</small>
              </div>
              <button className="text-button" onClick={() => onRemove(connection.id)} type="button">删除</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function ArtifactDrawer({ artifacts, agents }: { artifacts: Artifact[]; agents: AgentWorker[] }) {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  return (
    <section className="panel artifact-panel">
      <PanelTitle icon={<Archive size={18} />} title="产物抽屉" />
      <div className="artifact-list">
        {artifacts.length === 0 ? <EmptyState text="员工产出的文件会放在这里。" /> : null}
        {artifacts.map((artifact) => (
          <article className="artifact-row" key={artifact.id}>
            <Archive size={17} />
            <div>
              <strong>{artifact.name}</strong>
              <span>{artifact.createdByAgentWorkerId ? names.get(artifact.createdByAgentWorkerId) : "系统"} · {formatTime(artifact.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChatMessage({ name, role, text, tone = "guide" }: { name: string; role: string; text: string; tone?: "guide" | "warning" | "event" | "user" | "assistant" }) {
  return (
    <article className={`chat-message ${tone}`}>
      <div className="chat-avatar">{name.slice(0, 1)}</div>
      <div className="chat-bubble">
        <div className="chat-meta"><strong>{name}</strong><span>{role}</span></div>
        <p>{text}</p>
      </div>
    </article>
  );
}

function EmployeeMini({ agent }: { agent: AgentWorker }) {
  return (
    <article className="member-row">
      <div className="member-avatar">{agent.name.slice(0, 1)}</div>
      <div>
        <strong>{agent.name}</strong>
        <span>{agent.role}</span>
      </div>
    </article>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="panel-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <CircleAlert size={17} />
      <span>{text}</span>
    </div>
  );
}

function titleForPage(page: Page) {
  const titles: Record<Page, string> = {
    chat: "进入协作群，先连接模型，再派员工工作",
    projects: "项目房间",
    rolepool: "角色库",
    keys: "模型连接",
    governance: "治理与成长"
  };
  return titles[page];
}

function chooseFactory(input: string, factories: FactoryTemplate[]) {
  const wantsResearch = ["研究", "调研", "分析", "报告", "竞品", "市场"].some((word) => input.includes(word));
  const research = factories.find((factory) => factory.name.includes("研究") || factory.domain.includes("research"));
  const software = factories.find((factory) => factory.name.includes("软件") || factory.domain.includes("software"));
  return (wantsResearch ? research : software) || factories[0];
}

function attachModelBindings(dashboard: Dashboard, connections: ModelConnection[]): Dashboard {
  if (connections.length === 0) {
    return {
      ...dashboard,
      agents: dashboard.agents.map((agent) => ({
        ...agent,
        modelConnectionId: undefined,
        modelName: undefined
      }))
    };
  }

  return {
    ...dashboard,
    agents: dashboard.agents.map((agent, index) => {
      const existing = connections.find((connection) => connection.id === agent.modelConnectionId);
      const fallback = connections[index % connections.length];
      const binding = existing || fallback;
      return {
        ...agent,
        modelConnectionId: binding.id,
        modelName: binding.modelName
      };
    })
  };
}

function defaultApiFormat(providerKind: ModelProviderKind): ApiFormat {
  if (providerKind === "anthropic") return "anthropic_messages";
  if (providerKind === "gemini") return "gemini_generate_content";
  if (providerKind === "ollama") return "ollama_openai";
  if (providerKind === "custom") return "custom_http";
  return "openai_chat";
}

function formatApiFormat(value: ApiFormat) {
  const labels: Record<ApiFormat, string> = {
    openai_chat: "OpenAI-compatible",
    anthropic_messages: "Anthropic Messages",
    gemini_generate_content: "Gemini API",
    ollama_openai: "Ollama",
    custom_http: "Custom HTTP"
  };
  return labels[value] || value;
}

function connectionStatusText(connection: ModelConnection) {
  if (connection.status === "connected") {
    const checked = connection.checkedAt ? ` · ${formatTime(connection.checkedAt)}` : "";
    const latency = typeof connection.latencyMs === "number" ? ` · ${connection.latencyMs}ms` : "";
    return `已检测${latency}${checked}`;
  }
  if (connection.status === "error") return connection.statusMessage || "连接异常";
  return "尚未检测";
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
