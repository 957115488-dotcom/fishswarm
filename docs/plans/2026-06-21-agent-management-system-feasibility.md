# FishSwarm Agent Management System Feasibility Plan

Last updated: 2026-06-21

## Goal

Turn FishSwarm from an AI desktop agent workspace into a reusable agent management system:

- Users can describe a goal in natural language.
- FishSwarm can decompose the goal, choose roles, mount role handbooks, run checks, and ask for approval before risky actions.
- Useful workflows become reusable skills, roles, templates, and memory.
- Humans can see who is doing what, what was approved, what was blocked, and what should be improved next.

This plan combines the 06-13 livestream notes with open-source patterns found on GitHub.

## GitHub References

### Agent Kanban

Repository: https://github.com/saltbo/agent-kanban

Useful ideas:

- Agent-first task board.
- Agents have identity, roles, and loadable skills.
- A leader agent decomposes work, assigns tasks, dispatches workers, reviews PRs, and moves tasks through states.
- Task lifecycle is visible: Todo, In Progress, In Review, Done.
- Agents can create subtasks, assign by role, review each other, and self-organize.

FishSwarm takeaway:

Use a visible "Agent Workboard" inside the app, not just hidden chat text. This fits FishSwarm's Trace Panel, role runtime, and session timeline.

### ClawTeam

Repository: https://github.com/HKUDS/ClawTeam

Useful ideas:

- Leader agents spawn and coordinate worker agents.
- Works with Claude Code, Codex, OpenCode, and custom CLI agents.
- Each worker can run in its own git worktree.
- Workers self-report status and results.

FishSwarm takeaway:

For v1, FishSwarm should keep the current single-runtime role simulation. For v2, add optional real worker sessions only for coding-heavy tasks and isolate them by worktree or sandbox.

### Claude Codex Bridge

Repository: https://github.com/SeemSeam/claude_codex_bridge

Useful ideas:

- Visible multi-agent CLI workspace.
- Mixes real CLIs such as Codex, Claude, Gemini, Kimi, Qwen, Cursor, Copilot, Pi, and OpenCode.
- Keeps users in control through visible panes, status, and communication.

FishSwarm takeaway:

FishSwarm can differentiate by making the multi-agent workspace desktop-native, safer, and friendlier for non-terminal users.

### Preloop

Repository: https://github.com/preloop/preloop

Useful ideas:

- Fine-grained access policies.
- Approval workflows before protected operations.
- Per-tool justification.
- Full audit trail with attempted action, matched policy, duration, and approver.
- Policy-as-code in YAML.

FishSwarm takeaway:

FishSwarm should treat approval and audit as product features, not only backend safety checks. This maps directly to the PDF's "sentinel" idea.

### Cordum

Repository: https://github.com/cordum-io/cordum

Useful ideas:

- Agent control plane with deterministic governance around probabilistic agents.
- Pre-execution policy enforcement.
- Human-in-the-loop approval gates.
- Audit trails.
- Framework-agnostic governance.

FishSwarm takeaway:

FishSwarm does not need to copy Cordum's architecture, but should adopt the same mental model: agent runtime plus control plane.

### BMAD Method

Repository: https://github.com/bmad-code-org/BMAD-METHOD

Useful ideas:

- Structured agile workflows.
- Specialized agents such as PM, architect, developer, UX, and others.
- Planning depth adapts to project complexity.
- Agents guide the human through a process instead of replacing human judgment.

FishSwarm takeaway:

FishSwarm roles should not be generic prompts. They should be workflow-aware collaborators with clear inputs, outputs, boundaries, and acceptance criteria.

### MultiCLI

Repository: https://github.com/osanoai/multicli

Useful ideas:

- Exposes Gemini, Codex, Claude, and OpenCode as one MCP tool.
- Structured logs are used to reconstruct requests after crashes or disconnects.

FishSwarm takeaway:

FishSwarm's MCP layer can eventually expose model-specific helpers behind one unified "ask specialist" interface, with structured logs for recovery.

## Product Positioning

Recommended product narrative:

FishSwarm is a personal AI agent management system. It helps users turn their workflows into roles, skills, memories, templates, and guarded automations.

This is stronger than "AI desktop client" because it explains why FishSwarm matters:

- It lowers the threshold for non-technical users.
- It gives technical users safer and more observable agent workflows.
- It lets repeated work compound into reusable assets.
- It can become a system people use to deliver services, not only complete one-off chats.

## Target Architecture

### 1. Agent Workboard

A visible board for every complex task.

Core entities:

- `Goal`: the user's original intent.
- `Plan`: decomposed execution plan.
- `Task`: an actionable unit.
- `RoleRun`: one role's structured contribution.
- `Approval`: human decision for risky actions.
- `Artifact`: file, document, patch, report, or generated output.
- `Review`: acceptance result and follow-up notes.

Suggested task states:

- `draft`
- `ready`
- `in_progress`
- `blocked`
- `needs_approval`
- `in_review`
- `done`
- `archived`

MVP UI:

- Add an "Agent Workboard" tab to the right panel or session detail view.
- Show task cards with role, status, risk level, last update, and next action.
- Allow users to approve, reject, pause, or ask for revision.

### 2. Role Registry and Role Tiers

Use the PDF's "first team, reserve team, candidate pool" idea.

Role tiers:

- `core`: built-in high-frequency roles.
- `workspace`: user-approved roles for this workspace.
- `candidate`: temporary roles proposed by FishSwarm.
- `external`: roles provided by plugin or community packages.

Each role should include:

- identity
- responsibilities
- capability boundaries
- required context
- allowed outputs
- risk boundaries
- acceptance criteria
- model preference
- tool preference
- memory policy

MVP built-in roles:

- Product Strategist
- Engineering Architect
- Product Designer
- Developer Experience
- Security Officer
- QA / Release Steward
- Workflow Librarian
- Cost Controller

### 3. Task Router and Planner

The planner should run before execution for non-trivial tasks.

Inputs:

- user message
- current workspace state
- available roles
- available skills
- known memories
- tool permissions
- project risk profile

Outputs:

- task decomposition
- selected roles
- required files or context
- risk classification
- approval requirements
- expected artifacts
- acceptance criteria

Important rule:

The planner recommends. It should not bypass user approvals or tool permissions.

### 4. Sentinel and Approval System

This is the highest-value safety upgrade.

Sentinel checks:

- destructive file operation
- cross-workspace path access
- secret or credential access
- network operation
- install script
- remote control action
- production deployment keyword
- bulk file rewrite
- suspicious prompt injection content
- role attempting to bypass denied action

Approval record:

- attempted action
- matched policy
- risk level
- role or runtime that requested it
- model/provider
- command/tool arguments
- justification
- user decision
- timestamp
- result

MVP:

- Start with rule-based policy checks.
- Store approval events in SQLite.
- Show them in Trace Panel and session timeline.

Later:

- Add policy-as-code YAML import/export.
- Add per-workspace policy templates.

### 5. Workflow-to-Skill Incubation

This is how FishSwarm absorbs the PDF's "self-iteration" lesson.

When FishSwarm detects repeated work or missing capability, it can suggest:

- create a new skill
- create a new role
- save a workflow template
- save a checklist
- add a memory
- create a reusable project template

MVP trigger rules:

- the same instruction pattern appears 3+ times
- a task repeatedly asks for the same files and outputs
- a role gap is detected
- a user manually marks an answer as reusable

Suggested UI:

- "Save as workflow"
- "Create role from this task"
- "Create skill draft"
- "Add checklist to memory"

### 6. Project Onboarding / Takeover Flow

Add a first-class command: "接手这个项目" / "Onboard this workspace".

The flow should:

- read README, ROADMAP, package metadata, docs, and recent git status
- identify tech stack
- identify scripts and test commands
- summarize current architecture
- list active risks
- propose next 3 actions
- initialize workspace memory
- recommend relevant roles and skills

This directly maps to the PDF's "上岗交接" scenario.

### 7. Model and Cost Router

FishSwarm already supports many models. The missing layer is task-aware recommendation.

Routing dimensions:

- task complexity
- context length
- required tool use
- vision/GUI requirement
- cost sensitivity
- latency sensitivity
- safety/risk level

Example routing:

- simple edit: cheap fast coding model
- architecture planning: stronger reasoning model
- repo-wide analysis: long-context model
- GUI automation: vision-capable model
- high-risk change: stronger model plus QA role plus approval

MVP:

- Add model preset tags.
- Let roles specify preferred model families.
- Show a cost/risk hint before long tasks.

## Implementation Phases

### Phase 0: Documentation and Product Alignment

Scope:

- Add this feasibility plan.
- Update Roadmap language from "role runtime" to "agent management system".
- Define MVP success criteria.

Effort:

- 0.5-1 day.

Risk:

- Low.

### Phase 1: Workboard MVP

Scope:

- Add task/plan data model.
- Persist tasks in SQLite or existing session store.
- Render a read-only Agent Workboard in the right panel.
- Connect existing role runtime lifecycle events to task cards.

Effort:

- 3-5 days.

Risk:

- Medium because UI state and session persistence need care.

Acceptance:

- A complex user request produces a visible plan.
- Role events appear under task cards.
- Task state survives app refresh.

### Phase 2: Sentinel Approval MVP

Scope:

- Add policy rules for destructive and sensitive operations.
- Add approval event schema.
- Display approval requests in the app.
- Block execution until approval or rejection.

Effort:

- 4-7 days.

Risk:

- Medium-high because it touches tool execution and remote control.

Acceptance:

- Deleting or bulk-overwriting files requires approval.
- Denied actions cannot be bypassed by renaming the operation.
- Audit log records attempted action, policy, justification, user decision, and result.

### Phase 3: Role Tiers and Candidate Incubation

Scope:

- Formalize `core`, `workspace`, `candidate`, and `external` role tiers.
- Add candidate promotion flow.
- Add "missing role" suggestions.
- Add role risk validation before saving.

Effort:

- 3-6 days.

Risk:

- Medium.

Acceptance:

- FishSwarm can propose a candidate role.
- User can edit, approve, or reject it.
- Approved role is reused in later similar tasks.

### Phase 4: Workflow-to-Skill

Scope:

- Add "Save as workflow" and "Create skill draft".
- Generate skill drafts with README/SKILL structure.
- Store source task and acceptance criteria.
- Add repeated-pattern detection.

Effort:

- 5-8 days.

Risk:

- Medium because generated skills must be safe and reviewable.

Acceptance:

- A completed session can become a reusable workflow draft.
- Drafts never auto-install without user approval.
- The source and reason for creation are visible.

### Phase 5: Real Multi-Agent Execution

Scope:

- Optional worker sessions for coding-heavy tasks.
- Worktree isolation per worker.
- Merge/review workflow.
- Worker status streaming.

Effort:

- 2-4 weeks.

Risk:

- High. This should come after the control plane and approval system are solid.

Acceptance:

- A lead runtime can split coding work into isolated worker tasks.
- Workers cannot overwrite each other's files.
- Human can review before merge.

## Data Model Sketch

```ts
type AgentTaskStatus =
  | 'draft'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'needs_approval'
  | 'in_review'
  | 'done'
  | 'archived';

interface AgentTask {
  id: string;
  sessionId: string;
  goalId: string;
  title: string;
  description: string;
  status: AgentTaskStatus;
  assignedRoleId?: string;
  riskLevel: 'low' | 'medium' | 'high';
  dependsOn: string[];
  expectedArtifacts: string[];
  acceptanceCriteria: string[];
  createdAt: string;
  updatedAt: string;
}

interface ApprovalEvent {
  id: string;
  sessionId: string;
  taskId?: string;
  requestedBy: string;
  toolName: string;
  attemptedAction: string;
  matchedPolicy: string;
  riskLevel: 'low' | 'medium' | 'high';
  justification?: string;
  decision: 'pending' | 'approved' | 'rejected' | 'expired';
  decidedBy?: string;
  createdAt: string;
  decidedAt?: string;
}
```

## Feasibility Verdict

Highly feasible if implemented incrementally.

Reasons:

- FishSwarm already has core building blocks: Electron UI, role runtime, skills, MCP connectors, memory foundation, Trace Panel, SQLite, sandboxing, WSL2/Lima, and remote control.
- The open-source projects validate the direction: task boards, role-based agents, worker isolation, policy enforcement, approvals, and audit logs are all emerging as repeated patterns.
- The riskiest part is not role prompts. The riskiest part is safe execution, approvals, and state consistency.

Recommended sequence:

1. Workboard visibility.
2. Approval and audit.
3. Role tiering and candidate promotion.
4. Workflow-to-skill incubation.
5. Real multi-agent worker execution.

## What Not To Do Yet

- Do not start with 100+ roles. Start with 6-8 excellent roles.
- Do not auto-create permanent roles without approval.
- Do not let roles execute tools directly.
- Do not introduce real parallel worker agents before approvals and audit are stable.
- Do not copy source code from projects with restrictive licenses without legal review.

## MVP Success Metrics

- A user can ask for a complex task and see a clear plan before execution.
- At least 80% of role selections are understandable from the UI.
- Destructive operations are blocked and auditable.
- A completed workflow can be saved as a reusable draft.
- A new user can run "接手这个项目" and get a useful project state report within 2 minutes.

