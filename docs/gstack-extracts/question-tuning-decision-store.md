# Question Tuning And Decision Store Extract

Date: 2026-06-21

This note preserves the gstack lessons absorbed into FishSwarm's Work Habits layer. It is independent from `gstack-main`.

## Absorbed Ideas

1. Stable question identities
   - Recurring prompts get stable question ids such as `permission-read` and `permission-bash`.
   - Preferences are keyed by id, not by mutable UI wording.

2. One-way door safety
   - One-way questions are always asked, even if a preference says `never-ask`.
   - FishSwarm treats bash/write/edit and write-like MCP interactions as one-way.
   - Keyword fallback catches destructive ad-hoc summaries such as force push, delete, drop table, rollback, or credential rotation.

3. User-origin preference writes
   - Preferences can be written from settings, permission dialog, inline-user, or plan-tune style sources.
   - Agent/tool/file/remote-derived sources are rejected to avoid profile poisoning.

4. Permission-flow integration
   - Existing permission rules still run first.
   - Only calls that would have asked the user enter Question Policy.
   - Low-risk two-way questions can auto-decide when the user explicitly sets a preference.
   - `allow_always` on a two-way permission becomes a durable `never-ask` preference.

5. Append-only decisions
   - Decisions are stored as JSONL events: `decide`, `supersede`, and `redact`.
   - Active decisions are computed from the event stream.
   - Redaction and superseding do not mutate the original event line.

6. Content safety for decisions
   - Decision text is scanned with FishSwarm's existing content-security and redact layers.
   - Secret-shaped content is rejected.
   - Prompt-injection-like text is rejected rather than persisted.

## FishSwarm Decisions

- Storage root: `~/.fishswarm/work-habits/workspaces/<workspaceKey>/`.
- UI location: Settings -> Work Habits.
- Main APIs:
  - `questionPolicy.snapshot`
  - `questionPolicy.setPreference`
  - `questionPolicy.clearPreference`
  - `decisions.snapshot`
  - `decisions.add`
  - `decisions.supersede`
  - `decisions.redact`
- The first integration focuses on local habits and project decisions. It does not add cross-device sync or semantic recall yet.
