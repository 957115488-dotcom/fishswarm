# FishSwarm Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild FishSwarm around one simple first-time user journey: connect a model API key, enter a group chat, describe a goal, watch the guide create a project, then inspect only the work that matters.

**Architecture:** Split the current all-in-one dashboard into small product surfaces: chat intake, project room, agent roster, task timeline, and artifact drawer. Keep the existing local Electron API where possible, but add a thin frontend view-model layer so UI screens do not know every backend object at once.

**Tech Stack:** Electron, Vite, React 18, TypeScript, local Node HTTP API, CSS modules/global CSS, lucide-react.

---

## Product Reset

The current app is too complex because it exposes the system model too early. New users see factories, agents, task graphs, artifacts, metrics, and runtime controls before they understand the basic promise.

The improved product should feel like this:

1. User connects at least one large-model API key.
2. User enters a group chat.
3. A guide explains what to do.
4. User sends one goal.
5. The guide asks at most one clarifying question, or starts directly.
6. Agents join the room as needed, using the connected model provider.
7. Work appears as a simple timeline.
8. Finished output appears in an artifact drawer.
9. Advanced factory/agent configuration stays hidden until the user asks for it.

## Core Product Assumption

Every employee is exactly one agent, and every agent is powered by exactly one user-connected large-model provider/model. FishSwarm should not pretend agents are free built-in workers. The UI must make the model connection explicit, visible, and understandable.

This means:

- The left sidebar needs a persistent "模型连接" or "API Key" entry.
- The app needs a global model-connection status.
- The model connection page is a connection pool, not a single-key settings form.
- Users can add multiple keys/providers at the same time.
- Supported provider templates should include OpenAI-compatible, Anthropic, Gemini, DeepSeek, 通义千问/DashScope, Moonshot/Kimi, OpenRouter, Ollama/local, and Custom Endpoint.
- Chat intake can be visible before a key is connected, but execution must be blocked with a helpful prompt.
- The guide should explain that agents run on the user's connected model key.
- Agent cards must show which model/provider that employee is bound to.
- Creating an employee requires selecting one connected model.
- If multiple keys exist, different employees can bind to different keys/models.
- One employee maps to one agent. Do not let a single employee switch between many agents at runtime.
- One agent maps to one model binding. Do not let a single agent dynamically choose among many model keys unless the user edits that employee configuration.
- Runtime errors from missing, invalid, or rate-limited keys should appear as normal product states, not technical crashes.

## Employee, Agent, And Model Binding

FishSwarm should use a simple mental model:

```text
Employee = Agent profile + one model binding
```

An employee contains:

- Name
- Role
- Mission
- Skills
- Tool permissions
- Bound model provider
- Bound model name
- Runtime status

The user should understand that hiring a new employee means creating one agent and choosing which connected model powers that agent.

Examples:

- "产品经理 Lin" uses OpenAI-compatible `gpt-4.1`.
- "研究员 Wen" uses Anthropic-compatible `claude-sonnet`.
- "代码工程师 Shen" uses a local OpenAI-compatible endpoint.

The system can still have factories and templates, but factories should invite employees. They should not invent anonymous agents that are not visible in the employee roster.

## New Information Architecture

### 1. Home: Group Chat Intake

This is the only default first screen.

Keep:
- Guide message
- Chat input
- Suggested prompt chips
- Lightweight list of available agents
- Current project status if one exists

Remove from first screen:
- Global metrics
- Factory management
- Manual task graph controls
- Artifact list cards
- Technical runtime buttons

Primary action:
- Send a goal to the group

Secondary actions:
- Pick an example goal
- Open latest project
- View settings

### 2. Project Room

The project room appears after the first instruction is accepted.

It should contain:
- Chat transcript
- Work timeline
- Active agents
- Current next action
- Artifact drawer

It should not expose raw factories or internal IDs.

### 3. Work Timeline

Replace the current dense task board with a vertical timeline:

- Received request
- Chose factory
- Invited agents
- Created plan
- Running task
- Review needed
- Artifact ready

Only expand into detailed tasks when the user clicks a timeline item.

### 4. Artifact Drawer

Artifacts should feel like files produced by the group, not dashboard cards.

Drawer sections:
- Latest deliverable
- Supporting notes
- Decisions
- Logs

Default view should show the latest useful artifact first.

### 5. Agent Roster

Agent management becomes a secondary page.

Default roster view:
- Agent name
- Role
- What this agent is good at
- Bound model provider and model
- Whether it can be invited automatically

Advanced configuration stays behind an edit panel.

### 6. Factory Library

Factory management becomes an advanced page.

Default factory view:
- Template name
- Best for
- Default roles
- Quality gates

Do not show workflow JSON or internal implementation details in the main UI.

---

## Implementation Tasks

### Task 1: Create Frontend View Models

**Files:**
- Create: `src/domain/view-models.ts`
- Modify: `src/main.tsx`

**Goal:** Stop rendering raw backend objects directly in every component.

**Steps:**

1. Create `src/domain/view-models.ts`.
2. Add view-model types:
   - `ChatMessageView`
   - `ProjectSummaryView`
   - `TimelineItemView`
   - `AgentMemberView`
   - `ArtifactSummaryView`
   - `ModelConnectionView`
   - `EmployeeAgentView`
3. Add mapper functions:
   - `toProjectSummary(dashboard)`
   - `toChatMessages(dashboard)`
   - `toTimelineItems(dashboard)`
   - `toAgentMembers(dashboard)`
   - `toArtifactSummaries(dashboard)`
4. Replace direct rendering in `main.tsx` gradually.
5. Run `pnpm lint`.

Expected result:
- UI components receive small, purpose-built props.
- Backend shape changes become less risky.
- Agent/employee cards can always show their model binding.

### Task 2: Replace Sidebar Navigation

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Goal:** Reduce navigation to user-facing concepts.

New nav:
- Chat
- Projects
- Agents
- Library
- API Keys
- Settings

Remove:
- Tasks as a top-level entry
- Artifacts as a top-level entry
- Factories as a top-level entry name

Expected result:
- The app reads less like an admin console.
- Advanced concepts are still reachable, but not dominant.
- Users always know where to connect or change their model key.

### Task 3: Rebuild Home As Chat Intake Only

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Goal:** Make the first screen entirely about starting work.

Home layout:
- Header: "鱼群协作群"
- Guide bubble
- Example prompt chips
- Message stream
- Composer
- Small member strip

Remove from home:
- Pipeline cards
- Task board
- Artifact panel
- Manual action strip

Expected result:
- A new user understands the app in 10 seconds.

### Task 4: Add Model Connection Page

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Optional create: `src/components/ModelConnections.tsx`

**Goal:** Give users a clear left-sidebar destination for connecting API keys.

Page layout:
- Provider list: OpenAI-compatible, Anthropic, Gemini, DeepSeek, 通义千问/DashScope, Moonshot/Kimi, OpenRouter, Ollama/local, custom endpoint
- API key input
- Base URL input for compatible providers
- Model name input or selector
- "Test connection" button
- Connection status
- Latest check time and latency
- Short note explaining that agents use this key when working

Security rules:
- Mask saved keys in UI.
- Never print API keys in events, logs, or visible errors.
- Store only the minimum required connection config.
- Make deletion obvious.

Expected result:
- A user can understand that FishSwarm needs their model key before agents can work.
- The sidebar shows connection status, such as "未连接", "已连接", or "连接异常".
- A model connection cannot be added to the usable pool until the local service has tested it successfully.

### Task 5: Redesign Employee Creation Around One Agent And One Model

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Modify: `electron/core/seed-state.cjs`
- Modify: `electron/core/services.cjs`
- Modify: `electron/core/state-store.cjs`

**Goal:** Make each employee a single agent bound to a single model.

Employee creation form:
- Employee name
- Role
- Mission
- Skills
- Model connection
- Model name

Rules:
- Cannot create an employee without at least one model connection.
- Each employee stores one `modelConnectionId`.
- Each employee stores one `modelName`.
- Runtime uses the employee's model binding.
- Agent roster displays provider and model beside role.

Expected result:
- The user sees employees as concrete model-powered workers.
- There is no ambiguity about which model powers which agent.

### Task 6: Add Key-Gated Chat Execution

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Modify: `electron/core/state-store.cjs`
- Modify: `electron/core/services.cjs`
- Modify: `electron/app-server.cjs`

**Goal:** Allow chat guidance without a key, but block real agent execution until a model provider is connected.

Behavior:
- If no key is connected, the guide says: "先连接模型 Key，我才能让智能体开始工作。"
- Chat input remains usable for drafting intent.
- Send button becomes "连接 Key 后启动" or routes user to the API Key page.
- Project creation can be disabled until a valid key exists.
- Runtime actions check connection state before running.
- Runtime actions also check that invited employees have valid model bindings.

Expected result:
- Users never wonder why agents are not working.
- The app communicates the dependency before failure.

### Task 7: Add Project Room View

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Optional create: `src/components/ProjectRoom.tsx`

**Goal:** Move execution details out of the first screen and into a project room.

Project room layout:
- Left: chat transcript
- Right: current project summary and active agents
- Bottom or drawer: artifacts
- Center secondary area: timeline

Expected result:
- After sending a task, the user lands in a room that explains what is happening.

### Task 8: Convert Task Board To Timeline

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Optional create: `src/components/WorkTimeline.tsx`

**Goal:** Make progress legible without exposing task-management complexity.

Timeline item states:
- Waiting
- Running
- Needs review
- Done
- Blocked

Each item shows:
- Title
- Agent
- Short status
- Expandable details

Expected result:
- The user sees flow, not a project management spreadsheet.

### Task 9: Simplify Execution Controls

**Files:**
- Modify: `src/main.tsx`

**Goal:** Hide manual runtime controls unless they are needed.

Rules:
- First task starts automatically after intake.
- "Run next task" appears only when automation pauses.
- "Review" appears only when a task is waiting for review.
- "Generate handoff" appears only after enough work exists.

Expected result:
- The app feels guided instead of mechanical.

### Task 10: Create Empty, Loading, And Error States

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Goal:** Make the app understandable when the local API is offline or no project exists.

States:
- API connecting
- API offline
- No model key connected
- Model key invalid
- Provider rate-limited
- Employee has no model binding
- Employee model binding was deleted
- No project yet
- No agents available
- No artifacts yet
- Task blocked

Expected result:
- The user always knows what to do next.

### Task 11: Fix Text Encoding And Product Copy

**Files:**
- Modify: `src/main.tsx`
- Modify: `electron/core/seed-state.cjs`
- Modify: `electron/core/services.cjs`
- Modify: `electron/app-server.cjs`
- Modify: `electron/main.cjs`

**Goal:** Remove mojibake and stabilize Chinese product copy.

Steps:
1. Rewrite all user-facing Chinese strings as valid UTF-8.
2. Keep backend event strings concise.
3. Avoid technical labels in primary UI.
4. Run app and inspect visible text.

Expected result:
- No broken Chinese text anywhere in the app.

### Task 12: Split Components After Behavior Stabilizes

**Files:**
- Create: `src/components/ChatHome.tsx`
- Create: `src/components/ProjectRoom.tsx`
- Create: `src/components/WorkTimeline.tsx`
- Create: `src/components/AgentRoster.tsx`
- Create: `src/components/ArtifactDrawer.tsx`
- Create: `src/components/ModelConnections.tsx`
- Create: `src/components/EmployeeEditor.tsx`
- Modify: `src/main.tsx`

**Goal:** Keep `main.tsx` from becoming the entire application.

Do this after Tasks 1-8, not before.

Expected result:
- Components match product concepts.
- Future changes become easier.

### Task 13: Verification

**Files:**
- No new files required.

**Commands:**

```bash
pnpm lint
pnpm build
pnpm dev
```

Manual checks:
- Sidebar has a clear API Key or model connection entry.
- Without a key, the guide explains the missing connection and blocks execution.
- Employee creation requires selecting a connected model.
- Each employee card shows exactly one provider/model binding.
- Deleting a model connection marks dependent employees as unavailable or requires reassignment.
- With a key, user can send a task.
- First screen is only chat intake.
- User can send a task.
- A project is created.
- Agents appear to join.
- Timeline shows progress.
- At least one artifact is created.
- No horizontal overflow at 1280x720.
- No broken Chinese text.
- Browser console has no errors.

---

## Suggested Execution Order

Phase 1: Simplify without changing backend.

1. View models
2. Navigation rename
3. Model connection page shell
4. Employee-agent-model binding model
5. Chat-only home
6. Key-gated execution
7. Project room
8. Timeline

Phase 2: Clean product polish.

1. Conditional controls
2. Empty/loading/error states
3. Encoding cleanup

Phase 3: Codebase cleanup.

1. Component extraction
2. Final visual QA
3. Documentation update

## Non-Goals For This Refactor

Do not add:
- Account system
- Marketplace
- Complex permissions
- Multi-workspace switching
- More dashboard metrics
- More top-level pages

The goal is subtraction first.
