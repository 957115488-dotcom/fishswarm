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
      talents: state.talentProfiles.length,
      teamMembers: team.length,
      readyTasks: tasks.filter((task) => task.status === "ready").length,
      runningTasks: tasks.filter((task) => ["assigned", "running", "reviewing"].includes(task.status)).length,
      blockedTasks: tasks.filter((task) => task.status === "blocked").length,
      pendingApprovals: pendingApprovals.length,
      capabilityGaps: state.capabilityGaps.filter((gap) => gap.status === "open").length,
      guardedActions: state.guardedActions.filter((action) => ["needs_management_review", "needs_user_approval"].includes(action.status)).length,
      artifacts: state.artifacts.length
    },
    agents: state.agentWorkers,
    talentProfiles: state.talentProfiles,
    agentRoleAssignments: state.agentRoleAssignments,
    managementPolicies: state.managementPolicies,
    sentinelPolicies: state.sentinelPolicies,
    team,
    tasks,
    agentRuns: state.agentRuns.slice(0, 8),
    artifacts: state.artifacts.slice(0, 8),
    guardedActions: state.guardedActions.slice(0, 8),
    actionReviewBriefs: state.actionReviewBriefs.slice(0, 8),
    auditLogs: state.auditLogs.slice(0, 10),
    capabilityGaps: state.capabilityGaps.slice(0, 8),
    learningSources: state.learningSources.slice(0, 8),
    candidateTalentProfiles: state.candidateTalentProfiles.slice(0, 8),
    talentTrainingRuns: state.talentTrainingRuns.slice(0, 8),
    approvals: pendingApprovals,
    events: state.events.slice(0, 10)
  };
}

module.exports = {
  createDashboard
};
