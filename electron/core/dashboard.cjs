function createDashboard(state) {
  const activeProject = state.projects[0];
  const tasks = activeProject ? state.tasks.filter((task) => task.projectId === activeProject.id) : [];
  const team = activeProject ? state.projectTeamMembers.filter((member) => member.projectId === activeProject.id) : [];
  const pendingApprovals = state.approvals.filter((approval) => approval.status === "pending");

  return {
    workspace: state.workspace,
    factories: state.factories,
    activeProject,
    metrics: {
      factories: state.factories.length,
      agents: state.agentWorkers.length,
      teamMembers: team.length,
      readyTasks: tasks.filter((task) => task.status === "ready").length,
      runningTasks: tasks.filter((task) => ["assigned", "running", "reviewing"].includes(task.status)).length,
      blockedTasks: tasks.filter((task) => task.status === "blocked").length,
      pendingApprovals: pendingApprovals.length,
      artifacts: state.artifacts.length
    },
    agents: state.agentWorkers,
    team,
    tasks,
    agentRuns: state.agentRuns.slice(0, 8),
    artifacts: state.artifacts.slice(0, 8),
    approvals: pendingApprovals,
    events: state.events.slice(0, 10)
  };
}

module.exports = {
  createDashboard
};
