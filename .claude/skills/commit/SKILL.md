---
name: commit
description: Use when the user asks to "commit", "commit and push", "ship it", or wants to commit their changes. Runs changeset creation, all checks, commits, pushes, and verifies CI.
---

# Commit Skill

This skill handles the full commit-and-push workflow for the sideline monorepo.

## Steps

Follow these steps **in order**. Stop and report if any step fails.

### 1. Check for changes

Run `git status` and `git diff` to understand what changed. If there are no changes, tell the user and stop.

### 2. Create a changeset (if code changed)

If any package source code changed (not just docs/config), create a changeset file in `.changeset/`:

- Determine which packages were affected (`@sideline/bot`, `@sideline/server`, `@sideline/domain`, `@sideline/migrations`)
- Apply bump rules:
  - **patch** — small features, bug fixes, refactors
  - **minor** — larger features, significant new functionality
  - **major** — NEVER. Do not bump major.
- Write a short summary of the changes in the changeset body
- The `@sideline/web` package is private and should NOT be included in changesets

### 3. Run all checks

Run these commands and make sure they all pass:

```bash
pnpm format        # Biome formatting and linting
pnpm codegen       # Regenerate generated code
pnpm check         # TypeScript type checking
pnpm test          # Run all tests
```

Stage any files modified by format/codegen before proceeding.

### 4. Commit

- Stage all relevant files (avoid secrets like `.env`, credentials)
- Write a concise commit message describing **why**, not what
- If the user provided a message via `$ARGUMENTS`, use that as the commit message
- Never add `Co-Authored-By`, `Generated-By`, or any AI attribution footers
- Use a HEREDOC for the commit message to preserve formatting

### 5. Push

Run `git push` to push the commit to the remote.

### 6. Verify CI

After pushing, check that CI pipelines pass:

```bash
gh run list --limit 1
```

If the latest run is still in progress, wait and check again with `gh run watch`. If it fails, investigate the logs with `gh run view --log-failed`, fix the issue, and restart from step 3.

### 7. Update Notion task statuses (if applicable)

If the work being committed is associated with Notion tasks (e.g. from the `/work` skill or user-specified tasks), update statuses following the lifecycle in AGENTS.md:

- **Pushing to a feature branch:** Move completed tasks to `In Review`. If no tasks for the parent story remain in `TODO` or `In Progress`, also move the story to `In Review`.
- **Never** move anything to `Done` — that is done manually by the user.
