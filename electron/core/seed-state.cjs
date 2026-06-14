const { createEvent, now } = require("./shared.cjs");

function createAgent(idValue, workspaceId, name, role, mission, skills, toolPermissions) {
  return {
    id: idValue,
    workspaceId,
    name,
    role,
    mission,
    responsibilities: [],
    skills,
    constraints: ["高风险操作前必须请求用户确认"],
    systemPrompt: `${role}: ${mission}`,
    toolPermissions,
    knowledgeSources: [],
    inputSchema: null,
    outputSchema: null,
    handoffRules: [],
    reviewCriteria: [],
    status: "active",
    runtimeStatus: "idle",
    currentTask: "暂无任务",
    runsToday: 0,
    createdAt: now(),
    updatedAt: now()
  };
}

function linkFactoryAgent(factoryId, agentWorkerId, defaultPosition, required, sortOrder) {
  return {
    id: `${factoryId}-${agentWorkerId}`,
    factoryId,
    agentWorkerId,
    defaultPosition,
    required,
    sortOrder
  };
}

function createSeedState() {
  const workspace = {
    id: "workspace-local",
    name: "本地鱼群工作区",
    ownerId: "local-user",
    createdAt: now(),
    updatedAt: now()
  };

  const factories = [
    {
      id: "factory-software",
      workspaceId: workspace.id,
      name: "软件交付工厂",
      description: "用于规划、构建、评审和交付软件项目的智能体团队。",
      domain: "软件开发",
      workflowDefinition: {
        phases: ["需求接收", "组建团队", "任务规划", "执行中", "评审中", "交付"]
      },
      qualityGates: ["任务图已确认", "产物已评审", "交付摘要已生成"],
      status: "active",
      createdAt: now(),
      updatedAt: now()
    },
    {
      id: "factory-research",
      workspaceId: workspace.id,
      name: "研究分析工厂",
      description: "用于检索、综合分析、事实核查和报告交付的研究团队。",
      domain: "研究分析",
      workflowDefinition: {
        phases: ["理解需求", "资料映射", "分析", "评审", "报告"]
      },
      qualityGates: ["资料已记录", "关键结论已核查", "报告已汇总"],
      status: "active",
      createdAt: now(),
      updatedAt: now()
    }
  ];

  const agentWorkers = [
    createAgent("agent-pm", workspace.id, "林澜", "项目经理", "把项目目标拆成任务图，并推动团队持续交付。", ["规划", "协调"], ["写入产物"]),
    createAgent("agent-architect", workspace.id, "乔岚", "架构师", "守住系统边界，设计可靠的技术骨架。", ["架构", "风险评审"], ["写入产物"]),
    createAgent("agent-frontend", workspace.id, "宁川", "前端工程师", "构建清晰可用、状态明确的界面。", ["React", "界面"], ["写入产物"]),
    createAgent("agent-backend", workspace.id, "沈砚", "后端工程师", "构建本地接口、持久化边界和运行时契约。", ["接口", "运行时"], ["写入产物"]),
    createAgent("agent-reviewer", workspace.id, "周稼", "评审智能体", "在交付前根据验收标准评估输出质量。", ["评审", "质量"], ["读取产物"]),
    createAgent("agent-researcher", workspace.id, "晏舟", "研究分析师", "收集事实，并整理为可追溯的研究结论。", ["研究", "综合分析"], ["写入产物"])
  ];

  const factoryAgents = [
    linkFactoryAgent("factory-software", "agent-pm", "管理", true, 1),
    linkFactoryAgent("factory-software", "agent-architect", "架构", true, 2),
    linkFactoryAgent("factory-software", "agent-frontend", "前端", false, 3),
    linkFactoryAgent("factory-software", "agent-backend", "后端", false, 4),
    linkFactoryAgent("factory-software", "agent-reviewer", "评审", true, 5),
    linkFactoryAgent("factory-research", "agent-researcher", "分析", true, 1),
    linkFactoryAgent("factory-research", "agent-reviewer", "事实核查", true, 2)
  ];

  const projects = [
    {
      id: "project-framework",
      workspaceId: workspace.id,
      factoryId: "factory-software",
      name: "鱼群项目框架",
      goal: "构建第一个可运行的多智能体工作工厂桌面框架。",
      background: "项目参考 Codex 的工作区体验：本地优先、可运营、可检查。",
      constraints: ["本地优先", "桌面外壳", "清晰模块边界"],
      successCriteria: ["仪表盘可加载", "可以组建团队", "可以生成任务图", "至少一个任务可运行并评审"],
      phase: "规划中",
      status: "运行中",
      createdAt: now(),
      updatedAt: now()
    }
  ];

  return {
    workspace,
    factories,
    agentWorkers,
    factoryAgents,
    projects,
    projectTeamMembers: [],
    tasks: [],
    agentRuns: [],
    artifacts: [],
    reviews: [],
    approvals: [
      {
        id: "approval-search-tool",
        projectId: "project-framework",
        taskId: null,
        type: "tool_permission",
        title: "批准研究智能体使用外部搜索",
        description: "研究分析工厂在使用外部网络搜索前需要明确批准。",
        payload: { toolName: "网络搜索" },
        status: "pending",
        decidedBy: null,
        decidedAt: null,
        createdAt: now()
      }
    ],
    events: [createEvent("系统", "工作区已初始化", "本地应用服务已创建工厂、智能体和第一个项目。")]
  };
}

module.exports = {
  createAgent,
  createSeedState
};
