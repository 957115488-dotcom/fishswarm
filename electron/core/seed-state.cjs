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

function createTalent(idValue, workspaceId, name, domain, responsibilities, requiredSkills, outputTypes, toolNeeds, reviewCriteria, scope) {
  return {
    id: idValue,
    workspaceId,
    name,
    domain,
    responsibilities,
    requiredSkills,
    outputTypes,
    inputContract: null,
    outputContract: null,
    toolNeeds,
    reviewCriteria,
    handoffRules: [],
    difficultyLevel: "standard",
    status: "active",
    scope,
    createdAt: now(),
    updatedAt: now()
  };
}

function assignTalent(idValue, agentWorkerId, talentProfileId, scopeType, scopeId, priority = 1) {
  return {
    id: idValue,
    agentWorkerId,
    talentProfileId,
    scopeType,
    scopeId,
    priority,
    active: true,
    trial: false,
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
    createAgent("agent-assistant", workspace.id, "小鱼", "助理", "作为用户的直接沟通人和任务中转站，接收用户指令、确认细节、安排人才并汇总进展反馈给用户。", ["沟通", "理解意图", "任务中转", "状态汇报"], ["读取产物", "写入产物"]),
    createAgent("agent-manager", workspace.id, "林澜", "管理层", "接收目标、拆解任务、匹配人才、分派执行、跟踪进度并做评审裁决。", ["规划", "协调", "决策"], ["写入产物"]),
    createAgent("agent-sentinel", workspace.id, "哨兵", "拦截越权和高风险操作，审查动作合规性并生成管理简报。", ["风险审查", "权限校验", "合规审计"], ["读取产物"]),
    createAgent("agent-architect", workspace.id, "乔岚", "架构师", "守住系统边界，设计可靠的技术骨架。", ["架构", "风险评审"], ["写入产物"]),
    createAgent("agent-frontend", workspace.id, "宁川", "前端工程师", "构建清晰可用、状态明确的界面。", ["React", "界面"], ["写入产物"]),
    createAgent("agent-backend", workspace.id, "沈砚", "后端工程师", "构建本地接口、持久化边界和运行时契约。", ["接口", "运行时"], ["写入产物"]),
    createAgent("agent-reviewer", workspace.id, "周稼", "评审员", "在交付前根据验收标准评估输出质量。", ["评审", "质量"], ["读取产物"]),
    createAgent("agent-researcher", workspace.id, "晏舟", "研究分析师", "收集事实并整理为可追溯的研究结论。", ["研究", "综合分析"], ["写入产物"])
  ];

  const talentProfiles = [
    createTalent("talent-assistant", workspace.id, "助理", "管理", ["理解用户意图", "澄清任务细节", "中转用户指令", "汇总进展反馈", "确认交付结果"], ["沟通", "理解意图", "任务中转"], ["任务摘要", "进展报告", "用户沟通记录"], ["写入产物", "读取产物"], ["准确理解用户需求", "反馈清晰可追溯"], {
      allowedDomains: ["user_communication", "dispatch", "report"],
      allowedArtifactTypes: ["任务摘要", "进展报告", "文档", "用户沟通记录"],
      allowedTools: ["写入产物", "读取产物"],
      maxRiskLevel: "medium"
    }),
    createTalent("talent-manager", workspace.id, "项目经理", "管理", ["拆解目标", "制定计划", "分派任务", "跟踪进度", "评审裁决"], ["规划", "沟通", "决策"], ["任务图", "交付摘要", "管理简报"], ["写入产物"], ["目标被拆解为可执行任务", "依赖关系清晰", "评审结论可追溯"], {
      allowedDomains: ["planning", "coordination", "dispatch", "review"],
      allowedArtifactTypes: ["任务图", "交付摘要", "文档", "管理简报"],
      allowedTools: ["写入产物"],
      maxRiskLevel: "high"
    }),
    createTalent("talent-sentinel", workspace.id, "哨兵", "治理", ["拦截越权操作", "检查权限范围", "生成风险简报", "提交审批", "审计日志"], ["风险审查", "权限校验", "合规审计"], ["风险简报", "审计记录"], ["读取产物"], ["拦截结论有明确依据", "风险评级客观"], {
      allowedDomains: ["sentinel", "audit"],
      allowedArtifactTypes: ["风险简报", "审计记录"],
      allowedTools: ["读取产物"],
      maxRiskLevel: "high"
    }),
    createTalent("talent-architect", workspace.id, "架构师", "软件开发", ["定义模块边界", "识别技术风险", "评审关键设计"], ["架构", "风险评审"], ["技术方案", "风险清单"], ["写入产物"], ["边界清晰", "风险和取舍明确"], {
      allowedDomains: ["architecture", "review"],
      allowedArtifactTypes: ["技术方案", "文档"],
      allowedTools: ["写入产物"],
      maxRiskLevel: "medium"
    }),
    createTalent("talent-frontend", workspace.id, "前端工程师", "软件开发", ["实现界面", "优化交互", "维护前端状态"], ["React", "界面"], ["前端实现", "交互说明"], ["写入产物"], ["界面状态明确", "交互路径完整"], {
      allowedDomains: ["frontend"],
      allowedFilePatterns: ["src/**", "index.html", "vite.config.ts"],
      allowedArtifactTypes: ["前端实现", "文档"],
      allowedTools: ["写入产物"],
      maxRiskLevel: "medium"
    }),
    createTalent("talent-backend", workspace.id, "后端工程师", "软件开发", ["设计 API", "实现服务逻辑", "维护状态模型"], ["接口", "运行时"], ["API 设计", "服务实现"], ["写入产物"], ["接口契约清晰", "状态流转可靠"], {
      allowedDomains: ["backend"],
      allowedFilePatterns: ["electron/**"],
      allowedArtifactTypes: ["API 设计", "服务实现", "文档"],
      allowedTools: ["写入产物"],
      maxRiskLevel: "medium"
    }),
    createTalent("talent-reviewer", workspace.id, "评审员", "管理", ["验证产物", "指出风险", "给出返工建议"], ["评审", "质量"], ["评审报告"], ["读取产物"], ["验收标准逐项检查", "风险结论明确"], {
      allowedDomains: ["review"],
      allowedArtifactTypes: ["评审报告"],
      allowedTools: ["读取产物"],
      maxRiskLevel: "low"
    }),
    createTalent("talent-researcher", workspace.id, "研究分析师", "研究分析", ["检索资料", "交叉验证", "沉淀结论"], ["研究", "综合分析"], ["研究报告", "资料清单"], ["写入产物"], ["来源可追溯", "结论与证据匹配"], {
      allowedDomains: ["research"],
      allowedArtifactTypes: ["研究报告", "资料清单", "文档"],
      allowedTools: ["写入产物"],
      maxRiskLevel: "medium"
    })
  ];

  const agentRoleAssignments = [
    assignTalent("assign-assistant", "agent-assistant", "talent-assistant", "workspace", workspace.id, 1),
    assignTalent("assign-manager", "agent-manager", "talent-manager", "workspace", workspace.id, 2),
    assignTalent("assign-sentinel", "agent-sentinel", "talent-sentinel", "workspace", workspace.id, 1),
    assignTalent("assign-architect", "agent-architect", "talent-architect", "workspace", workspace.id, 1),
    assignTalent("assign-frontend", "agent-frontend", "talent-frontend", "workspace", workspace.id, 1),
    assignTalent("assign-backend", "agent-backend", "talent-backend", "workspace", workspace.id, 1),
    assignTalent("assign-reviewer", "agent-reviewer", "talent-reviewer", "workspace", workspace.id, 1),
    assignTalent("assign-researcher", "agent-researcher", "talent-researcher", "workspace", workspace.id, 1)
  ];

  const factoryAgents = [
    { ...linkFactoryAgent("factory-software", "agent-assistant", "助理", true, 1), talentProfileId: "talent-assistant" },
    { ...linkFactoryAgent("factory-software", "agent-manager", "管理", true, 2), talentProfileId: "talent-manager" },
    { ...linkFactoryAgent("factory-software", "agent-sentinel", "哨兵", true, 3), talentProfileId: "talent-sentinel" },
    { ...linkFactoryAgent("factory-software", "agent-architect", "架构", false, 4), talentProfileId: "talent-architect" },
    { ...linkFactoryAgent("factory-software", "agent-frontend", "前端", false, 5), talentProfileId: "talent-frontend" },
    { ...linkFactoryAgent("factory-software", "agent-backend", "后端", false, 6), talentProfileId: "talent-backend" },
    { ...linkFactoryAgent("factory-software", "agent-reviewer", "评审", false, 7), talentProfileId: "talent-reviewer" },
    { ...linkFactoryAgent("factory-research", "agent-assistant", "助理", true, 1), talentProfileId: "talent-assistant" },
    { ...linkFactoryAgent("factory-research", "agent-manager", "管理", true, 2), talentProfileId: "talent-manager" },
    { ...linkFactoryAgent("factory-research", "agent-sentinel", "哨兵", true, 3), talentProfileId: "talent-sentinel" },
    { ...linkFactoryAgent("factory-research", "agent-researcher", "分析", false, 4), talentProfileId: "talent-researcher" }
  ];

  const managementPolicies = [
    {
      id: "policy-default-management",
      workspaceId: workspace.id,
      name: "默认管理层",
      planningRules: ["先识别需要的人才角色", "任务必须带验收标准"],
      dispatchRules: ["优先选择同工厂人才绑定", "同一角色多人可用时选择优先级最高且空闲的 Agent"],
      reviewRules: ["修改和删除动作必须先由哨兵生成简报", "评审结论必须可追溯到验收标准"],
      escalationRules: ["缺少人才时触发进化层", "高风险动作提交用户审批"],
      growthRules: ["候选人才先试用", "通过评审后进入人才层"],
      active: true,
      createdAt: now(),
      updatedAt: now()
    }
  ];

  const sentinelPolicies = [
    {
      id: "sentinel-default",
      workspaceId: workspace.id,
      name: "默认哨兵策略",
      rules: ["人才只能在职责范围内执行动作", "modify/delete/execute/external 需要风险检查", "delete 必须交由管理层生成简报并提交用户确认"],
      active: true,
      createdAt: now(),
      updatedAt: now()
    }
  ];

  const projects = [];

  return {
    workspace,
    factories,
    agentWorkers,
    talentProfiles,
    agentRoleAssignments,
    managementPolicies,
    sentinelPolicies,
    factoryAgents,
    projects,
    projectTeamMembers: [],
    tasks: [],
    agentRuns: [],
    artifacts: [],
    reviews: [],
    guardedActions: [],
    actionReviewBriefs: [],
    auditLogs: [],
    capabilityGaps: [],
    learningSources: [],
    candidateTalentProfiles: [],
    talentTrainingRuns: [],
    talentEvaluations: [],
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
    events: []
  };
}

module.exports = {
  createAgent,
  createTalent,
  createSeedState
};
