const { createAgent } = require("./seed-state.cjs");
const { createEvent, error, id, notFound, now, ok } = require("./shared.cjs");

function createServices(state, emit) {
  const findProject = (projectId) => state.projects.find((project) => project.id === projectId);
  const findAgent = (agentWorkerId) => state.agentWorkers.find((agent) => agent.id === agentWorkerId);

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

    const roleToAgent = Object.fromEntries(
      state.projectTeamMembers
        .filter((member) => member.projectId === projectId)
        .map((member) => [member.projectRole, member.agentWorkerId])
    );

    const graph = [
      ["规划", "明确最小可行版本范围", "项目经理", "管理", []],
      ["架构", "定义模块边界", "架构师", "架构", ["明确最小可行版本范围"]],
      ["实现", "构建本地应用服务骨架", "后端工程师", "后端", ["定义模块边界"]],
      ["实现", "构建运营仪表盘界面", "前端工程师", "前端", ["定义模块边界"]],
      ["评审", "评审框架就绪度", "评审智能体", "评审", ["构建本地应用服务骨架", "构建运营仪表盘界面"]]
    ];

    state.tasks = state.tasks.filter((task) => task.projectId !== projectId);
    const created = graph.map(([phase, title, role, projectRole, dependsOn], index) => ({
      id: id("task"),
      projectId,
      parentTaskId: null,
      title,
      description: `${role} 负责「${project.name}」的这个步骤。`,
      status: index === 0 ? "ready" : "draft",
      phase,
      assignedAgentWorkerId: roleToAgent[projectRole] || null,
      dependsOn,
      input: { projectGoal: project.goal },
      expectedOutput: { type: "产物", role },
      acceptanceCriteria: ["输出结构化", "下一步清晰", "风险已记录"],
      sortOrder: index + 1,
      createdAt: now(),
      updatedAt: now()
    }));

    state.tasks.push(...created);
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
    if (!agent || !project) return error("STATE_TRANSITION_ERROR", "任务关联数据不完整。");

    const run = {
      id: id("run"),
      projectId: task.projectId,
      taskId: task.id,
      agentWorkerId: agent.id,
      status: "succeeded",
      inputContext: { project: project.name, task: task.title, agent: agent.role },
      model: "mock-local-runtime",
      output: {
        summary: `${agent.name} 已完成「${task.title}」。`,
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
      createdByAgentWorkerId: "agent-pm",
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
    generateHandoff,
    generateTaskGraph,
    reviewTask,
    runTask
  };
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
