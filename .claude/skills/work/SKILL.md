---
name: work
description: Fetches the next story from the active Notion sprint (preferring in-progress work) and implements it task by task. Creates a plan, gets approval, then codes, commits, and updates Notion statuses.
---

# Work Skill

Pick up a story from the active sprint and implement it end-to-end.

## Notion IDs

| Database   | Data Source ID                                |
|------------|-----------------------------------------------|
| Sprints    | `collection://0bb5bd1a-500c-4b2c-b482-cc6be3986a81` |
| Stories    | `collection://6ae03d12-a6d6-45b1-bead-094f0c225e42` |
| Tasks      | `collection://df8fe05e-456c-429d-a6da-f45fb3303dcf` |
| Epics      | `collection://2020f137-79a6-43b7-9609-309d0aaa8450` |
| Bugs       | `collection://798a152b-94f1-4fef-b5c1-f171f031d248` |

## Steps

Follow these steps **in order**. Stop and report if any step fails.

---

### Phase 1: Reconcile

Invoke the `/reconcile` skill to sync Notion statuses with the current git/GitHub state before starting new work. This ensures stale statuses from previous work are cleaned up.

---

### Phase 2: Pick up work

#### 2.1 Find the active sprint

Use `notion-search` to find the sprint with Status = "Active". Fetch the sprint page to get its linked stories.

If no active sprint exists, tell the user and stop.

#### 2.2 Select a story

From the active sprint's stories, fetch each story to check its status and type. Pick a story using this priority order:

1. **In Progress** — resume work already started (highest priority)
2. **TODO Bug** — bugs take priority over features
3. **TODO** — start new work

Skip stories with status Done, In Review, or In Test.

Within the same priority level, prefer higher priority stories (Critical > High > Medium > Low).

If `$ARGUMENTS` is provided, use it to match a specific story by name or keyword instead of auto-selecting.

If no actionable stories remain, tell the user the sprint is complete and stop.

#### 2.3 Fetch story details and tasks

Fetch the selected story page to get:
- The story description (page content) for context
- The linked tasks

Fetch each task to get its title, status, type, notes, and estimate.

#### 2.4 Update statuses to In Progress

Update **ALL** statuses **immediately** when starting work — including during planning, not just coding.

1. Move **every task** in the story from `TODO` → `In Progress` using `notion-update-page`
2. Move the **story** from `TODO` → `In Progress`
3. If the parent **epic** is in `TODO` or `Not Started`, move it to `In Progress`
4. If the parent **milestone** is in `TODO` or `Not Started`, move it to `In Progress`

**Do not skip updating tasks.** All tasks must be marked In Progress before proceeding to the next step.

#### 2.5 Present the work summary

Show the user:
- Sprint name
- Story title and description
- List of tasks with their status, type, and estimate
- Which tasks are already done vs remaining

---

### Phase 3: Plan and implement

#### 3.1 Create a feature branch

Before writing any code, ensure you're starting from a clean, up-to-date `main`:

```bash
git checkout main
git pull origin main
git checkout -b feat/story-name
```

**Branch rules:**
- Always create a **new branch from `main`** for each story. Never reuse an old feature branch for a new story.
- If you're resuming in-progress work that already has an **unmerged branch for the same story**, switch to that branch and rebase on main instead.
- If a previous branch for a different story exists, ignore it — start fresh from `main`.

#### 3.2 Plan implementation

Enter plan mode. For each remaining task (not Done), analyze what code changes are needed by exploring the codebase. Write a concrete implementation plan that covers all remaining tasks.

Present the plan to the user for approval via `ExitPlanMode`.

#### 3.3 Implement tasks

After the plan is approved, work through each remaining task **in order**. For each task:

1. Update the task status to **In Progress** in Notion using `notion-update-page`
2. Implement the changes described in the plan
3. Run `pnpm check` and `pnpm test` to verify the changes compile and pass tests

Leave tasks in **In Progress** after implementation — the commit step handles pushing and moving them to **Done**.

If a task fails (tests break, types don't pass), fix the issue before moving on. If you cannot fix it, leave the task as In Progress and report the blocker to the user.

---

### Phase 4: Refactor

Invoke the `/refactor` skill on each file that was changed during implementation. Use `git diff --name-only` to identify changed files.

Focus on:
- Ensuring Effect-TS code style compliance (see AGENTS.md)
- Removing unnecessary complexity introduced during implementation
- Keeping changes minimal — don't refactor unrelated code

---

### Phase 5: Commit and push

Invoke the `/commit` skill to:
- Create a changeset
- Run all checks (format, codegen, type check, tests)
- Commit, push, and open a PR
- Verify CI passes

**Never push directly to `main`.** All work goes through feature branches and pull requests.

---

### Phase 6: Wait for CI and code review

After the PR is created and CI passes:

1. Wait for GitHub Actions pipelines to finish (the `/commit` skill already does this)
2. Poll for Copilot code review comments on the PR:

```bash
gh pr view --json number -q '.number'
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

Wait up to 3 minutes for review comments to appear, checking every 30 seconds. If no comments arrive, proceed to the summary.

---

### Phase 7: Address review comments

If Copilot or other reviewers left comments:

1. Read all review comments
2. Evaluate each comment — fix comments that are:
   - Pointing out real bugs or issues
   - Suggesting improvements aligned with AGENTS.md conventions
   - Highlighting missing error handling or type safety issues
3. Skip comments that are:
   - Stylistic preferences that contradict AGENTS.md
   - Suggestions to add unnecessary complexity
   - False positives or irrelevant to the change
4. For each relevant comment, make the fix

Report which comments were addressed and which were skipped (with reasons).

---

### Phase 8: Final refactor and push

If any changes were made in Phase 7:

1. Invoke the `/refactor` skill on the newly changed files
2. Run all checks: `pnpm format`, `pnpm check`, `pnpm test`
3. Commit and push the fixes:

```bash
git add -A
git commit -m "Address review feedback"
git push
```

4. Wait for CI to pass again using `gh run watch`
5. If new review comments appear, repeat Phase 7-8 (up to 2 additional rounds to avoid infinite loops)

If no changes were made in Phase 7, skip this phase.

---

### Phase 9: Done

Report the final state:
- PR URL
- All tasks completed and their Notion statuses
- Any review comments that were addressed or intentionally skipped
- Any remaining blockers
