# Browser Skill Runtime Extract

Date: 2026-06-21

This note preserves the gstack browser-skill runtime lessons that FishSwarm now owns natively. It is intentionally independent from `gstack-main`, so the reference repository can be removed later.

## Absorbed Ideas

1. Three-tier lookup
   - Project tier: `<workspace>/.fishswarm/browser-skills`
   - Global tier: `~/.fishswarm/browser-skills`
   - Bundled tier: `resources/browser-skills`
   - Lookup is first-wins: project overrides global, global overrides bundled.

2. Draft staging before enablement
   - Generated skills are first written under `<workspace>/.fishswarm/.tmp/browser-skillify/<stageId>/<name>`.
   - A staged draft is not part of runtime lookup until explicitly committed.
   - Commit uses safe name validation, symlink refusal, destination containment checks, and no-clobber semantics.

3. Deterministic workflow runtime
   - FishSwarm stores replayable browser workflows as `workflow.json`.
   - `SKILL.md` remains the human-readable description and frontmatter.
   - Runtime execution replays the workflow through the FishSwarm GStack Browse runner, not through arbitrary shell code.

4. Safety checks
   - Browser skill names are restricted to lowercase letters, digits, and dashes.
   - Workflow commands are allowlisted to the FishSwarm browse command surface.
   - Redacted args block validation until the user edits `workflow.json`.
   - Untrusted runtime execution uses a scrubbed environment.

5. Observability
   - Draft, commit, test, run, disable, and tombstone actions write timeline events.
   - Browse command execution keeps the existing redaction and output sanitizer path.

## FishSwarm Decisions

- FishSwarm uses `.fishswarm/browser-skills` instead of `.gstack/browser-skills`.
- Phase 1 executes JSON workflows, not arbitrary `script.ts` files. This keeps the first integration close to the existing GStack Browse MCP adapter and avoids adding Bun as a runtime dependency.
- The existing `browserSkillify.createDraft` IPC entry stays as the generation API, while `browserSkills.*` owns runtime lifecycle operations.
