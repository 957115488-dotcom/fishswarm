const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createEvent } = require("./shared.cjs");
const { createSeedState } = require("./seed-state.cjs");

function createStateStore(options = {}) {
  const homeDir = options.homeDir || process.env.FISHSWARM_HOME || path.join(os.homedir(), ".fishswarm");
  const stateFile = options.stateFile || path.join(homeDir, "state.json");

  function load() {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    if (!fs.existsSync(stateFile)) {
      const seeded = createSeedState();
      save(seeded);
      return seeded;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      const migrated = migrateState(parsed);
      save(migrated);
      return migrated;
    } catch {
      const backupFile = `${stateFile}.corrupt-${Date.now()}`;
      fs.renameSync(stateFile, backupFile);
      const seeded = createSeedState();
      seeded.events.unshift(createEvent("本地持久化", "状态已重置", `损坏的状态文件已备份到 ${backupFile}。`));
      save(seeded);
      return seeded;
    }
  }

  function save(state) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const tempFile = `${stateFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tempFile, stateFile);
  }

  return { load, save, stateFile };
}

function migrateState(value) {
  const seeded = createSeedState();
  return {
    ...seeded,
    ...value,
    workspace: value.workspace || seeded.workspace,
    factories: Array.isArray(value.factories) ? value.factories : seeded.factories,
    agentWorkers: Array.isArray(value.agentWorkers) ? value.agentWorkers : seeded.agentWorkers,
    talentProfiles: Array.isArray(value.talentProfiles) ? value.talentProfiles : seeded.talentProfiles,
    agentRoleAssignments: Array.isArray(value.agentRoleAssignments) ? value.agentRoleAssignments : seeded.agentRoleAssignments,
    managementPolicies: Array.isArray(value.managementPolicies) ? value.managementPolicies : seeded.managementPolicies,
    sentinelPolicies: Array.isArray(value.sentinelPolicies) ? value.sentinelPolicies : seeded.sentinelPolicies,
    factoryAgents: Array.isArray(value.factoryAgents) ? value.factoryAgents : seeded.factoryAgents,
    projects: Array.isArray(value.projects) && value.projects.length ? value.projects : seeded.projects,
    projectTeamMembers: Array.isArray(value.projectTeamMembers) ? value.projectTeamMembers : [],
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    agentRuns: Array.isArray(value.agentRuns) ? value.agentRuns : [],
    artifacts: Array.isArray(value.artifacts) ? value.artifacts : [],
    reviews: Array.isArray(value.reviews) ? value.reviews : [],
    guardedActions: Array.isArray(value.guardedActions) ? value.guardedActions : [],
    actionReviewBriefs: Array.isArray(value.actionReviewBriefs) ? value.actionReviewBriefs : [],
    auditLogs: Array.isArray(value.auditLogs) ? value.auditLogs : [],
    capabilityGaps: Array.isArray(value.capabilityGaps) ? value.capabilityGaps : [],
    learningSources: Array.isArray(value.learningSources) ? value.learningSources : [],
    candidateTalentProfiles: Array.isArray(value.candidateTalentProfiles) ? value.candidateTalentProfiles : [],
    talentTrainingRuns: Array.isArray(value.talentTrainingRuns) ? value.talentTrainingRuns : [],
    talentEvaluations: Array.isArray(value.talentEvaluations) ? value.talentEvaluations : [],
    approvals: Array.isArray(value.approvals) ? value.approvals : seeded.approvals,
    events: Array.isArray(value.events) ? value.events : seeded.events
  };
}

module.exports = {
  createStateStore,
  migrateState
};
