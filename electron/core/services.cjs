const { createAgent } = require("./seed-state.cjs");
const { createEvent, error, id, notFound, now, ok } = require("./shared.cjs");

function createServices(state, emit) {
  const findProject = (projectId) => state.projects.find((project) => project.id === projectId);
  const findAgent = (agentWorkerId) => state.agentWorkers.find((agent) => agent.id === agentWorkerId);
  const findTalent = (talentProfileId) => state.talentProfiles.find((talent) => talent.id === talentProfileId);

  function buildProjectTeam(projectId) {
    const project = findProject(projectId);
    if (!project) return notFound("Project");

    const members = state.factoryAgents
      .filter((item) => item.factoryId === project.factoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: id("team"),
        projectId,
        agentWorkerId: item.agentWorkerId,
        talentProfileId: item.talentProfileId || null,
        projectRole: item.defaultPosition,
        status: "active",
        joinedAt: now()
      }));

    state.projectTeamMembers = state.projectTeamMembers.filter((item) => item.projectId !== projectId).concat(members);
    project.phase = "planning";
    project.status = "running";
    project.updatedAt = now();

    state.events.unshift(createEvent("编排器", "团队已组建", `${members.length} 个智能体已加入「${project.name}」。`));
    emit();
    return ok({ members });
  }

  function generateTaskGraph(projectId) {
    const project = findProject(projectId);
    if (!project) return notFound("Project");

    if (!state.projectTeamMembers.some((member) => member.projectId === projectId)) {
      buildProjectTeam(projectId);
    }

    const roleToMember = Object.fromEntries(
      state.projectTeamMembers
        .filter((member) => member.projectId === projectId)
        .map((member) => [member.projectRole, member])
    );

    const graph = buildTaskGraphForProject(project);

    state.tasks = state.tasks.filter((task) => task.projectId !== projectId);
    const created = graph.map((item, index) => {
      const member = roleToMember[item.projectRole];
      const talentProfileId = item.talentProfileId || member?.talentProfileId || null;
      const candidateAgentId = member?.agentWorkerId || selectAgentForTalent(state, project, talentProfileId)?.id || null;
      return {
        id: id("task"),
        projectId,
        parentTaskId: null,
        title: item.title,
        description: `${item.role} 负责「${project.name}」的这个步骤。`,
        status: candidateAgentId ? (index === 0 ? "ready" : "draft") : "blocked",
        phase: item.phase,
        requiredTalentProfileId: talentProfileId,
        assignedTalentProfileId: talentProfileId,
        assignedAgentWorkerId: candidateAgentId,
        actionType: item.actionType,
        dependsOn: item.dependsOn,
        input: { projectGoal: project.goal },
        expectedOutput: { type: "产物", role: item.role },
        acceptanceCriteria: ["输出结构化", "下一步清晰", "风险已记录"],
        sortOrder: index + 1,
        createdAt: now(),
        updatedAt: now()
      };
    });

    state.tasks.push(...created);
    for (const task of created.filter((item) => !item.assignedAgentWorkerId)) {
      createCapabilityGap(state, project, task);
    }
    project.phase = "running";
    project.updatedAt = now();

    state.events.unshift(createEvent("编排器", "任务图已生成", `${created.length} 个任务已进入项目看板。`));
    emit();
    return ok({ tasks: created });
  }

  function runTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return notFound("Task");
    if (task.status !== "ready") return error("STATE_TRANSITION_ERROR", "只有就绪任务可以运行。");
    if (!task.assignedAgentWorkerId) return error("STATE_TRANSITION_ERROR", "任务尚未分配智能体。");

    const agent = findAgent(task.assignedAgentWorkerId);
    const project = findProject(task.projectId);
    const talent = findTalent(task.assignedTalentProfileId || task.requiredTalentProfileId);
    if (!agent || !project) return error("STATE_TRANSITION_ERROR", "任务关联数据不完整。");

    const sentinelResult = inspectSentinel(state, project, task, agent, talent);
    if (!sentinelResult.ok) {
      emit();
      return sentinelResult;
    }

    const run = {
      id: id("run"),
      projectId: task.projectId,
      taskId: task.id,
      agentWorkerId: agent.id,
      status: "succeeded",
      inputContext: {
        project: project.name,
        task: task.title,
        agent: { id: agent.id, name: agent.name, mission: agent.mission },
        talent: talent ? { id: talent.id, name: talent.name, responsibilities: talent.responsibilities } : null
      },
      model: "mock-local-runtime",
      output: {
        summary: `${agent.name} 以「${talent?.name || agent.role}」身份完成「${task.title}」。`,
        resultType: "文档",
        content: `「${task.title}」的框架说明。`,
        nextActions: [],
        blockers: []
      },
      toolCalls: [],
      error: null,
      startedAt: now(),
      finishedAt: now(),
      createdAt: now()
    };

    const artifact = {
      id: id("artifact"),
      workspaceId: state.workspace.id,
      projectId: task.projectId,
      taskId: task.id,
      agentRunId: run.id,
      createdByAgentWorkerId: agent.id,
      createdByTalentProfileId: talent?.id || null,
      type: "文档",
      name: `${task.title}产物`,
      content: run.output.content,
      path: null,
      metadata: { phase: task.phase },
      createdAt: now(),
      updatedAt: now()
    };

    task.status = "reviewing";
    task.updatedAt = now();
    agent.runtimeStatus = "reviewing";
    agent.currentTask = task.title;
    agent.runsToday += 1;
    agent.updatedAt = now();
    state.agentRuns.unshift(run);
    state.artifacts.unshift(artifact);
    state.auditLogs.unshift(createAuditLog("sentinel", "action_allowed", `哨兵已放行 ${agent.name} 的 ${task.actionType || "create"} 动作。`, {
      taskId: task.id,
      agentWorkerId: agent.id,
      talentProfileId: talent?.id || null
    }));
    state.events.unshift(createEvent(agent.name, "任务已执行", `「${task.title}」已产出「${artifact.name}」。`));
    emit();

    return ok({ run, artifact });
  }

  function reviewTask(taskId) {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return notFound("Task");
    if (task.status !== "reviewing") return error("STATE_TRANSITION_ERROR", "只有评审中的任务可以进入评审。");

    const artifact = state.artifacts.find((item) => item.taskId === taskId);
    if (!artifact) return error("STATE_TRANSITION_ERROR", "任务没有可评审的产物。");

    const review = {
      id: id("review"),
      projectId: task.projectId,
      taskId,
      artifactId: artifact.id,
      reviewerAgentWorkerId: "agent-reviewer",
      reviewerTalentProfileId: "talent-reviewer",
      status: "通过",
      summary: "产物满足框架起步阶段的验收标准。",
      issues: [],
      score: 86,
      createdAt: now()
    };

    task.status = "done";
    task.updatedAt = now();
    const agent = findAgent(task.assignedAgentWorkerId);
    if (agent) {
      agent.runtimeStatus = "idle";
      agent.currentTask = "暂无任务";
    }
    state.reviews.unshift(review);
    unlockReadyTasks(task.projectId);
    state.events.unshift(createEvent("评审智能体", "评审通过", `「${task.title}」已完成。`));
    emit();
    return ok({ review });
  }

  function generateHandoff(projectId) {
    const project = findProject(projectId);
    if (!project) return notFound("Project");

    const doneTasks = state.tasks.filter((task) => task.projectId === projectId && task.status === "done");
    const artifact = {
      id: id("artifact"),
      workspaceId: state.workspace.id,
      projectId,
      taskId: null,
      agentRunId: null,
      createdByAgentWorkerId: "agent-manager",
      type: "交付摘要",
      name: `${project.name}交付摘要`,
      content: `目标：${project.goal}\n已完成任务：${doneTasks.map((task) => task.title).join("、") || "暂无"}`,
      path: null,
      metadata: { doneTaskCount: doneTasks.length },
      createdAt: now(),
      updatedAt: now()
    };
    state.artifacts.unshift(artifact);
    state.events.unshift(createEvent("编排器", "交付摘要已生成", artifact.name));
    emit();
    return ok({ artifact });
  }

  function createProject(input) {
    const validation = validateProjectInput(input, state);
    if (!validation.ok) return validation;

    const project = {
      id: id("project"),
      workspaceId: input.workspaceId || state.workspace.id,
      factoryId: input.factoryId,
      name: input.name.trim(),
      goal: input.goal.trim(),
      background: typeof input.background === "string" ? input.background.trim() : "",
      constraints: Array.isArray(input.constraints) ? input.constraints : [],
      successCriteria: Array.isArray(input.successCriteria) ? input.successCriteria : [],
      phase: "intake",
      status: "running",
      createdAt: now(),
      updatedAt: now()
    };
    state.projects.unshift(project);
    state.events.unshift(createEvent("项目服务", "项目已创建", project.name));
    emit();
    return ok({ project });
  }

  function createAgentWorker(input) {
    const validation = validateAgentWorkerInput(input, state);
    if (!validation.ok) return validation;

    const agent = createAgent(
      id("agent"),
      input.workspaceId || state.workspace.id,
      input.name.trim(),
      input.role.trim(),
      input.mission.trim(),
      Array.isArray(input.skills) ? input.skills : [],
      Array.isArray(input.toolPermissions) ? input.toolPermissions : []
    );
    state.agentWorkers.unshift(agent);
    state.events.unshift(createEvent("智能体服务", "智能体已入职", `${agent.name} 已加入，岗位是「${agent.role}」。`));
    emit();
    return ok({ agent });
  }

  function decideGuardedAction(actionId, decision) {
    const guardedAction = state.guardedActions.find((action) => action.id === actionId);
    if (!guardedAction) return notFound("GuardedAction");
    if (!["approved", "rejected"].includes(decision)) return error("VALIDATION_ERROR", "审批结果必须是 approved 或 rejected。");

    guardedAction.status = decision;
    guardedAction.decidedAt = now();
    const approval = state.approvals.find((item) => item.payload?.guardedActionId === actionId);
    if (approval) {
      approval.status = decision === "approved" ? "approved" : "rejected";
      approval.decidedBy = "local-user";
      approval.decidedAt = now();
    }

    const task = state.tasks.find((item) => item.id === guardedAction.taskId);
    if (task) {
      task.status = decision === "approved" ? "ready" : "blocked";
      task.updatedAt = now();
    }

    state.auditLogs.unshift(createAuditLog("用户审批", decision === "approved" ? "action_approved" : "action_rejected", guardedAction.title, { actionId }));
    state.events.unshift(createEvent("用户审批", decision === "approved" ? "风险动作已批准" : "风险动作已拒绝", guardedAction.title));
    emit();
    return ok({ guardedAction });
  }

  function createFactory(input) {
    const validation = validateFactoryInput(input, state);
    if (!validation.ok) return validation;

    const factory = {
      id: id("factory"),
      workspaceId: input.workspaceId || state.workspace.id,
      name: input.name.trim(),
      description: input.description.trim(),
      domain: input.domain.trim(),
      workflowDefinition: input.workflowDefinition && typeof input.workflowDefinition === "object" ? input.workflowDefinition : { phases: [] },
      qualityGates: Array.isArray(input.qualityGates) ? input.qualityGates : [],
      status: "active",
      createdAt: now(),
      updatedAt: now()
    };
    state.factories.unshift(factory);
    state.events.unshift(createEvent("工厂服务", "工厂已创建", factory.name));
    emit();
    return ok({ factory });
  }

  function unlockReadyTasks(projectId) {
    const doneTitles = new Set(
      state.tasks.filter((task) => task.projectId === projectId && task.status === "done").map((task) => task.title)
    );
    for (const task of state.tasks.filter((item) => item.projectId === projectId && item.status === "draft")) {
      if (task.dependsOn.every((title) => doneTitles.has(title))) {
        task.status = "ready";
        task.updatedAt = now();
      }
    }
  }

  return {
    buildProjectTeam,
    createAgentWorker,
    createFactory,
    createProject,
    decideGuardedAction,
    generateHandoff,
    generateTaskGraph,
    reviewTask,
    runTask
  };
}

function buildTaskGraphForProject(project) {
  const wantsResearch = project.factoryId === "factory-research" || ["研究", "调研", "分析", "报告", "竞品", "市场"].some((word) => project.goal.includes(word));
  const wantsChromeExtension = ["Chrome", "浏览器插件", "扩展程序", "插件"].some((word) => project.goal.includes(word));

  if (wantsResearch) {
    return [
      { phase: "规划", title: "明确研究问题和口径", role: "项目经理", projectRole: "管理", talentProfileId: "talent-manager", actionType: "create", dependsOn: [] },
      { phase: "研究", title: "收集关键资料和证据", role: "研究分析师", projectRole: "分析", talentProfileId: "talent-researcher", actionType: "external", dependsOn: ["明确研究问题和口径"] },
      { phase: "分析", title: "形成可追溯结论", role: "研究分析师", projectRole: "分析", talentProfileId: "talent-researcher", actionType: "create", dependsOn: ["收集关键资料和证据"] },
      { phase: "评审", title: "核查结论和来源", role: "评审员", projectRole: "事实核查", talentProfileId: "talent-reviewer", actionType: "suggest", dependsOn: ["形成可追溯结论"] }
    ];
  }

  const graph = [
    { phase: "规划", title: "明确最小可行版本范围", role: "项目经理", projectRole: "管理", talentProfileId: "talent-manager", actionType: "create", dependsOn: [] },
    { phase: "架构", title: "定义模块边界", role: "架构师", projectRole: "架构", talentProfileId: "talent-architect", actionType: "create", dependsOn: ["明确最小可行版本范围"] }
  ];

  if (wantsChromeExtension) {
    graph.push({ phase: "进化", title: "培养 Chrome 插件工程师", role: "Chrome 插件工程师", projectRole: "浏览器插件", talentProfileId: "talent-chrome-extension", actionType: "external", dependsOn: ["定义模块边界"] });
  }

  graph.push(
    { phase: "实现", title: "构建本地应用服务骨架", role: "后端工程师", projectRole: "后端", talentProfileId: "talent-backend", actionType: "modify", dependsOn: ["定义模块边界"] },
    { phase: "实现", title: "构建运营仪表盘界面", role: "前端工程师", projectRole: "前端", talentProfileId: "talent-frontend", actionType: "modify", dependsOn: ["定义模块边界"] },
    { phase: "评审", title: "评审框架就绪度", role: "评审员", projectRole: "评审", talentProfileId: "talent-reviewer", actionType: "suggest", dependsOn: ["构建本地应用服务骨架", "构建运营仪表盘界面"] }
  );

  return graph;
}

function selectAgentForTalent(state, project, talentProfileId) {
  if (!talentProfileId) return null;
  const projectMemberIds = new Set(state.projectTeamMembers.filter((member) => member.projectId === project.id).map((member) => member.agentWorkerId));
  const assignments = state.agentRoleAssignments
    .filter((assignment) => assignment.active && assignment.talentProfileId === talentProfileId)
    .filter((assignment) => {
      if (assignment.scopeType === "workspace" && assignment.scopeId === project.workspaceId) return true;
      if (assignment.scopeType === "factory" && assignment.scopeId === project.factoryId) return true;
      if (assignment.scopeType === "project" && assignment.scopeId === project.id) return true;
      return projectMemberIds.has(assignment.agentWorkerId);
    })
    .sort((a, b) => a.priority - b.priority);
  const assignment = assignments.find((item) => state.agentWorkers.some((agent) => agent.id === item.agentWorkerId && agent.status === "active"));
  return assignment ? state.agentWorkers.find((agent) => agent.id === assignment.agentWorkerId) : null;
}

function inspectSentinel(state, project, task, agent, talent) {
  const actionType = task.actionType || "create";
  const riskLevel = inferRiskLevel(actionType);
  const approved = state.guardedActions.some((action) => action.taskId === task.id && action.agentWorkerId === agent.id && action.status === "approved");
  if (!shouldEscalate(actionType, riskLevel) || approved) return ok({ allowed: true });

  const existing = state.guardedActions.find((action) => action.taskId === task.id && action.agentWorkerId === agent.id && ["needs_management_review", "needs_user_approval"].includes(action.status));
  if (existing) {
    return error("ACTION_NEEDS_APPROVAL", "该动作已被哨兵拦截，等待管理层简报和用户审批。", { guardedActionId: existing.id });
  }

  const guardedAction = {
    id: id("action"),
    projectId: project.id,
    taskId: task.id,
    agentWorkerId: agent.id,
    talentProfileId: talent?.id || null,
    actionType,
    target: task.title,
    title: buildActionTitle(task, agent, talent),
    reason: `任务「${task.title}」需要执行 ${actionType} 动作。`,
    riskLevel,
    impactSummary: buildImpactSummary(actionType, talent),
    proposedChanges: { taskTitle: task.title, phase: task.phase },
    status: "needs_user_approval",
    createdAt: now(),
    updatedAt: now()
  };
  const brief = {
    id: id("brief"),
    actionId: guardedAction.id,
    title: `管理层简报：${guardedAction.title}`,
    requestedBy: agent.name,
    target: task.title,
    reason: guardedAction.reason,
    expectedBenefit: "完成当前任务并推动项目继续流转。",
    riskSummary: guardedAction.impactSummary,
    affectedScope: talent?.scope?.allowedFilePatterns || [task.phase],
    rollbackPlan: actionType === "delete" ? "删除动作需要额外人工备份和恢复方案。" : "保留审计日志和任务产物，可按任务版本回退。",
    managementRecommendation: actionType === "delete" ? "reject" : "approve",
    createdAt: now()
  };
  const approval = {
    id: id("approval"),
    projectId: project.id,
    taskId: task.id,
    type: "guarded_action",
    title: brief.title,
    description: `${brief.riskSummary} 建议：${brief.managementRecommendation}`,
    payload: { guardedActionId: guardedAction.id, briefId: brief.id },
    status: "pending",
    decidedBy: null,
    decidedAt: null,
    createdAt: now()
  };

  task.status = "blocked";
  task.updatedAt = now();
  state.guardedActions.unshift(guardedAction);
  state.actionReviewBriefs.unshift(brief);
  state.approvals.unshift(approval);
  state.auditLogs.unshift(createAuditLog("sentinel", "action_blocked", guardedAction.title, { actionId: guardedAction.id, riskLevel }));
  state.events.unshift(createEvent("哨兵", "风险动作已拦截", guardedAction.title));
  return error("ACTION_NEEDS_APPROVAL", "该动作已被哨兵拦截，等待管理层简报和用户审批。", { guardedActionId: guardedAction.id });
}

function buildImpactSummary(actionType, talent) {
  if (actionType === "delete") return "删除动作会移除现有内容，必须由用户最终确认。";
  if (actionType === "external") return "外部访问会引入来源可信度和数据边界风险，需要记录来源并确认用途。";
  if (actionType === "execute") return "命令执行可能改变环境状态，需要确认命令、范围和回滚方式。";
  if (actionType === "modify") return `修改动作会影响 ${talent?.scope?.allowedFilePatterns?.join("、") || "当前任务范围"}，需要管理层确认边界。`;
  return "低风险动作，哨兵记录审计后放行。";
}

function createCapabilityGap(state, project, task) {
  const existing = state.capabilityGaps.find((gap) => gap.projectId === project.id && gap.taskId === task.id);
  if (existing) return existing;
  const missingCapability = task.expectedOutput?.role || "未知人才";
  const gap = {
    id: id("gap"),
    projectId: project.id,
    taskId: task.id,
    missingCapability,
    requiredOutputs: [task.expectedOutput?.type || "产物"],
    requiredTools: ["公开资料检索", "官方文档阅读"],
    acceptanceCriteria: task.acceptanceCriteria,
    riskLevel: "medium",
    status: "open",
    createdAt: now(),
    updatedAt: now()
  };
  const source = {
    id: id("source"),
    gapId: gap.id,
    sourceType: "official_docs",
    url: "https://github.com/search",
    title: `${missingCapability} 公开资料检索入口`,
    summary: "进化层需要检索官方文档、GitHub 示例项目和最佳实践资料后再培养候选人才。",
    trustScore: 70,
    extractedPatterns: ["先读取官方文档", "保存引用来源", "生成试用任务"],
    createdAt: now()
  };
  const candidate = {
    id: id("candidate"),
    sourceGapId: gap.id,
    name: missingCapability,
    domain: project.factoryId === "factory-research" ? "研究分析" : "软件开发",
    responsibilities: [`补齐「${task.title}」所需能力`],
    requiredSkills: [missingCapability],
    outputContract: null,
    toolNeeds: ["公开资料检索", "写入产物"],
    reviewCriteria: task.acceptanceCriteria,
    learningSources: [source.id],
    status: "trial",
    createdAt: now(),
    updatedAt: now()
  };
  const trainingRun = {
    id: id("training"),
    candidateTalentProfileId: candidate.id,
    gapId: gap.id,
    status: "queued",
    trialTask: `学习并完成「${task.title}」的最小可行试用产物。`,
    createdAt: now(),
    updatedAt: now()
  };
  state.capabilityGaps.unshift(gap);
  state.learningSources.unshift(source);
  state.candidateTalentProfiles.unshift(candidate);
  state.talentTrainingRuns.unshift(trainingRun);
  state.auditLogs.unshift(createAuditLog("进化层", "capability_gap_created", `发现缺失人才：${missingCapability}`, { gapId: gap.id }));
  state.events.unshift(createEvent("进化层", "发现能力缺口", `需要培养「${missingCapability}」。`));
  return gap;
}

function createAuditLog(actor, action, detail, metadata = {}) {
  return {
    id: id("audit"),
    actor,
    action,
    detail,
    metadata,
    createdAt: now()
  };
}

function inferRiskLevel(actionType) {
  if (["delete", "execute", "external"].includes(actionType)) return "high";
  if (actionType === "modify") return "medium";
  return "low";
}

function shouldEscalate(actionType, riskLevel) {
  return ["modify", "delete", "execute", "external"].includes(actionType) || riskLevel === "high";
}

function buildActionTitle(task, agent, talent) {
  return `${agent.name} 请求以「${talent?.name || agent.role}」身份执行「${task.title}」`;
}

function validateProjectInput(input, state) {
  if (!input || typeof input !== "object") return error("VALIDATION_ERROR", "请求体必须是 JSON 对象。");
  if (typeof input.name !== "string" || input.name.trim().length < 2) return error("VALIDATION_ERROR", "项目名称不能为空。");
  if (typeof input.goal !== "string" || input.goal.trim().length < 5) return error("VALIDATION_ERROR", "项目目标不能为空。");
  if (typeof input.factoryId !== "string" || !state.factories.some((factory) => factory.id === input.factoryId)) {
    return error("VALIDATION_ERROR", "必须提供有效的工厂 ID。");
  }
  return ok({});
}

function validateAgentWorkerInput(input, state) {
  if (!input || typeof input !== "object") return error("VALIDATION_ERROR", "请求体必须是 JSON 对象。");
  if (typeof input.name !== "string" || input.name.trim().length < 2) return error("VALIDATION_ERROR", "智能体名称不能为空。");
  if (typeof input.role !== "string" || input.role.trim().length < 2) return error("VALIDATION_ERROR", "智能体岗位不能为空。");
  if (typeof input.mission !== "string" || input.mission.trim().length < 5) return error("VALIDATION_ERROR", "智能体使命不能为空。");
  if (input.workspaceId && input.workspaceId !== state.workspace.id) return error("VALIDATION_ERROR", "未知的工作区 ID。");
  return ok({});
}

function validateFactoryInput(input, state) {
  if (!input || typeof input !== "object") return error("VALIDATION_ERROR", "请求体必须是 JSON 对象。");
  if (typeof input.name !== "string" || input.name.trim().length < 2) return error("VALIDATION_ERROR", "工厂名称不能为空。");
  if (typeof input.description !== "string" || input.description.trim().length < 5) return error("VALIDATION_ERROR", "工厂描述不能为空。");
  if (typeof input.domain !== "string" || input.domain.trim().length < 2) return error("VALIDATION_ERROR", "工厂领域不能为空。");
  if (input.workspaceId && input.workspaceId !== state.workspace.id) return error("VALIDATION_ERROR", "未知的工作区 ID。");
  return ok({});
}

module.exports = {
  createServices
};
