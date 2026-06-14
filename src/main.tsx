import React from "react";
import ReactDOM from "react-dom/client";
import {
  Archive,
  Bot,
  CheckCircle2,
  CircleAlert,
  Factory,
  KeyRound,
  Library,
  Loader2,
  MessageSquareText,
  Plus,
  Send,
  Settings,
  Sparkles,
  UsersRound
} from "lucide-react";
import "./styles.css";

type Page = "chat" | "projects" | "employees" | "library" | "keys" | "settings";
type TaskStatus = "draft" | "ready" | "assigned" | "running" | "reviewing" | "needs_rework" | "blocked" | "done" | "cancelled";
type RuntimeStatus = "idle" | "queued" | "running" | "reviewing" | "waiting_for_user" | "blocked" | "failed";
type ModelProviderKind = "openai_compatible" | "anthropic" | "gemini" | "deepseek" | "qwen" | "moonshot" | "openrouter" | "ollama" | "custom";

type ModelConnection = {
  id: string;
  providerKind: ModelProviderKind;
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
  assignedAgentWorkerId: string | null;
  dependsOn: string[];
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
  tasks: Task[];
  artifacts: Artifact[];
  events: EventItem[];
  metrics: {
    factories: number;
    agents: number;
    teamMembers: number;
    readyTasks: number;
    runningTasks: number;
    blockedTasks: number;
    pendingApprovals: number;
    artifacts: number;
  };
};

type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

const emptyDashboard: Dashboard = {
  factories: [],
  agents: [],
  tasks: [],
  artifacts: [],
  events: [],
  metrics: {
    factories: 0,
    agents: 0,
    teamMembers: 0,
    readyTasks: 0,
    runningTasks: 0,
    blockedTasks: 0,
    pendingApprovals: 0,
    artifacts: 0
  }
};

const navItems: Array<{ id: Page; label: string; icon: React.ReactNode }> = [
  { id: "chat", label: "协作群", icon: <MessageSquareText size={18} /> },
  { id: "projects", label: "项目", icon: <CheckCircle2 size={18} /> },
  { id: "employees", label: "员工", icon: <UsersRound size={18} /> },
  { id: "library", label: "工厂库", icon: <Library size={18} /> },
  { id: "keys", label: "模型连接", icon: <KeyRound size={18} /> },
  { id: "settings", label: "设置", icon: <Settings size={18} /> }
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
  provider: string;
  baseUrl: string;
  modelName: string;
  keyLabel: string;
  note: string;
}> = [
  {
    kind: "openai_compatible",
    provider: "OpenAI Compatible",
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4.1",
    keyLabel: "OpenAI / compatible API Key",
    note: "适合 OpenAI 或任何兼容 OpenAI Chat Completions 的服务。"
  },
  {
    kind: "anthropic",
    provider: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    modelName: "claude-sonnet-4",
    keyLabel: "Anthropic API Key",
    note: "适合 Claude 系列模型。"
  },
  {
    kind: "gemini",
    provider: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelName: "gemini-2.5-pro",
    keyLabel: "Gemini API Key",
    note: "适合 Google Gemini 模型。"
  },
  {
    kind: "deepseek",
    provider: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    modelName: "deepseek-chat",
    keyLabel: "DeepSeek API Key",
    note: "DeepSeek 提供 OpenAI-compatible 接口。"
  },
  {
    kind: "qwen",
    provider: "通义千问 / DashScope",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelName: "qwen-plus",
    keyLabel: "DashScope API Key",
    note: "通义千问兼容 OpenAI 风格调用。"
  },
  {
    kind: "moonshot",
    provider: "Moonshot Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    modelName: "moonshot-v1-32k",
    keyLabel: "Moonshot API Key",
    note: "Kimi / Moonshot 兼容 OpenAI 风格调用。"
  },
  {
    kind: "openrouter",
    provider: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelName: "openai/gpt-4.1",
    keyLabel: "OpenRouter API Key",
    note: "一个 Key 可路由到多个模型供应商。"
  },
  {
    kind: "ollama",
    provider: "Ollama / Local",
    baseUrl: "http://127.0.0.1:11434/v1",
    modelName: "llama3.1",
    keyLabel: "本地模型可留空或填占位 Key",
    note: "适合本地 Ollama 或其他本地 OpenAI-compatible 服务。"
  },
  {
    kind: "custom",
    provider: "Custom Endpoint",
    baseUrl: "https://your-provider.example/v1",
    modelName: "your-model-name",
    keyLabel: "Custom API Key",
    note: "用于任何自定义或私有部署的模型网关。"
  }
];

function getApiBaseUrl() {
  return window.fishswarm?.getApiBaseUrl() ?? "http://127.0.0.1:3767";
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
  const [notice, setNotice] = React.useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [prompt, setPrompt] = React.useState("帮我设计一个面向小团队的项目管理 SaaS MVP，输出需求、原型结构、技术方案和第一版交付计划。");

  const hasModel = connections.some((item) => item.status === "connected");

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
  }, [connections]);

  async function launchWork(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (!hasModel) {
      setPage("keys");
      setNotice({ tone: "error", text: "请先连接一个大模型 API Key。员工需要模型连接后才能开始工作。" });
      return;
    }
    const latest = (await refresh()) ?? dashboard;
    const factory = chooseFactory(prompt, latest.factories);
    if (!factory) {
      setNotice({ tone: "error", text: "还没有可用工厂模板，无法启动项目。" });
      return;
    }

    setBusy(true);
    try {
      const { project } = await request<{ project: Project }>("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: prompt.length > 22 ? `${prompt.slice(0, 22)}...` : prompt,
          goal: prompt,
          factoryId: factory.id
        })
      });
      await request(`/api/projects/${project.id}/build-team`, { method: "POST" });
      const { tasks } = await request<{ tasks: Task[] }>(`/api/projects/${project.id}/generate-task-graph`, { method: "POST" });
      const ready = tasks.find((task) => task.status === "ready");
      if (ready) await request(`/api/tasks/${ready.id}/run`, { method: "POST" });
      await refresh();
      setPage("projects");
      setNotice({ tone: "success", text: "项目已经启动，员工已入群并开始处理第一步。" });
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

  return (
    <div className="app-shell">
      <aside className="sidebar">
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

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">FishSwarm</p>
            <h1>{titleForPage(page)}</h1>
          </div>
          <button className="ghost-button" onClick={() => void refresh()} type="button">
            刷新
          </button>
        </header>

        {notice ? <div className={`notice notice-${notice.tone}`}>{notice.text}</div> : null}

        {page === "chat" ? (
          <ChatHome
            busy={busy}
            dashboard={dashboard}
            hasModel={hasModel}
            prompt={prompt}
            setPage={setPage}
            setPrompt={setPrompt}
            onLaunch={launchWork}
          />
        ) : null}
        {page === "projects" ? <ProjectRoom dashboard={dashboard} /> : null}
        {page === "employees" ? <Employees agents={dashboard.agents} connections={connections} /> : null}
        {page === "library" ? <FactoryLibrary factories={dashboard.factories} /> : null}
        {page === "keys" ? <ModelConnections connections={connections} onAdd={addConnection} onRemove={removeConnection} /> : null}
        {page === "settings" ? <SettingsView /> : null}
      </main>
    </div>
  );
}

function ChatHome({
  busy,
  dashboard,
  hasModel,
  prompt,
  setPage,
  setPrompt,
  onLaunch
}: {
  busy: boolean;
  dashboard: Dashboard;
  hasModel: boolean;
  prompt: string;
  setPage: (page: Page) => void;
  setPrompt: (value: string) => void;
  onLaunch: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="chat-layout">
      <div className="chat-panel">
        <div className="chat-room-header">
          <div>
            <p className="eyebrow">Group chat intake</p>
            <h2>鱼群协作群</h2>
          </div>
          <span className={`pill ${hasModel ? "pill-good" : "pill-warn"}`}>{hasModel ? "可以派活" : "需要模型 Key"}</span>
        </div>
        <div className="message-list">
          <ChatMessage name="引导者" role="群管" text="欢迎来到鱼群。这里不是管理后台，你只需要像在群里派活一样，说清楚想完成什么。" />
          <ChatMessage
            name="引导者"
            role="模型提醒"
            tone={hasModel ? "guide" : "warning"}
            text={hasModel ? "模型连接已就绪。我会按你的目标邀请合适员工入群，并启动第一步。" : "先连接一个大模型 API Key，我才能让员工真正开始工作。每个员工都是一个固定 Agent，并绑定一个模型。"}
          />
          {dashboard.events.slice(0, 4).map((event) => (
            <ChatMessage key={event.id} name={event.actor} role={formatTime(event.time)} tone="event" text={`${event.event}：${event.detail}`} />
          ))}
        </div>
        <div className="examples">
          {["做一个 SaaS MVP 方案", "写一份竞品分析报告", "规划一个内容营销活动"].map((text) => (
            <button key={text} onClick={() => setPrompt(text)} type="button">{text}</button>
          ))}
        </div>
        <form className="composer" onSubmit={onLaunch}>
          <textarea onChange={(event) => setPrompt(event.target.value)} placeholder="在群里发送任务..." value={prompt} />
          {hasModel ? (
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
              <span>{busy ? "接单中" : "发送任务"}</span>
            </button>
          ) : (
            <button className="primary-button" onClick={() => setPage("keys")} type="button">
              <KeyRound size={18} />
              <span>连接 Key</span>
            </button>
          )}
        </form>
      </div>
      <aside className="room-side">
        <PanelTitle icon={<UsersRound size={18} />} title="群内员工" />
        <div className="member-list">
          {dashboard.agents.slice(0, 6).map((agent) => (
            <EmployeeMini key={agent.id} agent={agent} />
          ))}
        </div>
      </aside>
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
      <WorkTimeline tasks={dashboard.tasks} agents={dashboard.agents} />
      <ArtifactDrawer artifacts={dashboard.artifacts} agents={dashboard.agents} />
    </section>
  );
}

function WorkTimeline({ tasks, agents }: { tasks: Task[]; agents: AgentWorker[] }) {
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
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
              <small>{task.assignedAgentWorkerId ? names.get(task.assignedAgentWorkerId) : "等待分派"} · {task.phase}</small>
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
    provider: providerPresets[0].provider,
    baseUrl: providerPresets[0].baseUrl,
    modelName: providerPresets[0].modelName,
    apiKey: ""
  });
  const [testState, setTestState] = React.useState<
    | { status: "idle" }
    | { status: "testing" }
    | { status: "connected"; message: string; latencyMs: number; checkedAt: string }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const activePreset = providerPresets.find((preset) => preset.kind === form.providerKind) ?? providerPresets[0];

  function applyPreset(kind: ModelProviderKind) {
    const preset = providerPresets.find((item) => item.kind === kind) ?? providerPresets[0];
    setForm((current) => ({
      ...current,
      providerKind: preset.kind,
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
      setTestState({
        status: "connected",
        message: result.message,
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
          <button className="primary-button" disabled={testState.status !== "connected"} type="submit"><Plus size={18} />添加到连接池</button>
        </div>
        {testState.status !== "idle" ? (
          <div className={`test-result test-${testState.status}`}>
            {testState.status === "testing" ? "正在检测模型服务..." : null}
            {testState.status === "connected" ? `${testState.message} 延迟 ${testState.latencyMs}ms。` : null}
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
                <span>{connection.modelName} · {connection.keyPreview}</span>
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

function FactoryLibrary({ factories }: { factories: FactoryTemplate[] }) {
  return (
    <section className="panel">
      <PanelTitle icon={<Factory size={18} />} title="工厂库" />
      <div className="factory-grid">
        {factories.map((factory) => (
          <article className="factory-card" key={factory.id}>
            <strong>{factory.name}</strong>
            <p>{factory.description}</p>
            <div className="chip-row">{factory.qualityGates.map((gate) => <span className="chip" key={gate}>{gate}</span>)}</div>
          </article>
        ))}
      </div>
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

function SettingsView() {
  return (
    <section className="panel settings-panel">
      <PanelTitle icon={<Settings size={18} />} title="设置" />
      <EmptyState text="当前版本只保留必要设置。复杂权限、市场和多工作区暂不加入。" />
    </section>
  );
}

function ChatMessage({ name, role, text, tone = "guide" }: { name: string; role: string; text: string; tone?: "guide" | "warning" | "event" }) {
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
    employees: "员工档案",
    library: "工厂模板库",
    keys: "模型连接",
    settings: "设置"
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
