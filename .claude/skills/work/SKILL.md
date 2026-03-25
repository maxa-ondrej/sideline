---
name: work
description: Fetches the next bug or story from the active Notion sprint (bugs always before stories, preferring in-progress work) and implements it task by task. Creates a plan, gets approval, then codes, commits, and updates Notion statuses.
---

# Work Skill

Pick up a story from the active sprint and implement it end-to-end using specialist agents.

## Steps

Follow these steps **in order**. Stop and report if any step fails.

---

### Phase 1: Pick up work

Invoke the `/manager` agent to:
- Find the active sprint
- Select the next bug or story (pass `$ARGUMENTS` if the user specified a story)
- Check if work is already finished (if so, update statuses and stop)
- Update all statuses to In Progress
- Create a feature branch

Review the manager's work summary before proceeding.

---

### Phase 2: Research (optional)

If the story involves unfamiliar APIs, libraries, or Effect-TS patterns, invoke the `/researcher` agent with the relevant topics.

Skip this phase if the story uses well-known patterns already present in the codebase.

---

### Phase 3: Plan

1. Invoke the `/architect` agent with:
   - The story description and task list (from the manager)
   - Any research findings (from the researcher)

2. Invoke the `/hater` agent with the architect's plan to critique it.

3. If the hater finds **blockers**, send the critique back to the `/architect` agent for revision. Max 1 revision round.

4. Present the final plan to the user for approval via `ExitPlanMode`.

---

### Phase 4: Write tests first (TDD)

Invoke the `/tester` agent in **TDD mode** with the architect's test specification. The tester writes all test files before any implementation begins. These tests should fail initially — that's expected and correct.

---

### Phase 5: Implement

After tests are written:

1. Invoke the `/developer` agent with:
   - The approved implementation plan
   - The task list
   - Note: tests already exist and must pass after implementation

2. The developer implements all tasks and reports what was changed.

---

### Phase 6: Verify

Run verification agents:

1. Invoke the `/formatter` agent to run `pnpm format` and stage fixes
2. Invoke the `/analyzer` agent to run `pnpm check` and report type errors
3. Invoke the `/tester` agent in **verify mode** to run `pnpm test` and fill any remaining coverage gaps

If the analyzer or tester report failures, invoke the `/developer` agent with the errors to fix them. Then re-run the failing verification agent. Max 2 fix rounds.

---

### Phase 7: Review

1. Invoke the `/reviewer` agent on the changed files
2. Invoke the `/hater` agent on the final code

If **must-fix** issues are found:
1. Invoke the `/developer` agent with the combined feedback
2. Re-run `/formatter`, `/analyzer`, `/tester` to verify fixes
3. Max 1 review-fix round

---

### Phase 8: Refactor

Invoke the `/refactor` skill on each file that was changed during implementation. Use `git diff --name-only` to identify changed files.

Focus on:
- Ensuring Effect-TS code style compliance (see AGENTS.md)
- Removing unnecessary complexity introduced during implementation
- Keeping changes minimal — don't refactor unrelated code

After refactoring, re-run `/formatter`, `/analyzer`, `/tester` to verify nothing broke.

---

### Phase 9: Commit and push

Invoke the `/commit` skill to:
- Create a changeset
- Run all checks (format, codegen, type check, tests)
- Commit, push, and open a PR
- Verify CI passes

**Never push directly to `main`.** All work goes through feature branches and pull requests.

---

### Phase 10: Wait for CI and code review

After the PR is created and CI passes:

1. Wait for GitHub Actions pipelines to finish (the `/commit` skill already does this)
2. Poll for Copilot code review comments on the PR:

```bash
gh pr view --json number -q '.number'
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

Wait up to 3 minutes for review comments to appear, checking every 30 seconds. If no comments arrive, proceed.

---

### Phase 11: Address review comments

If Copilot or other reviewers left comments:

1. Read all review comments
2. Invoke the `/developer` agent with the comments to fix relevant ones
3. Skip comments that contradict AGENTS.md conventions or add unnecessary complexity
4. Re-run `/formatter`, `/analyzer`, `/tester`
5. Commit and push the fixes:

```bash
git add -A
git commit -m "Address review feedback"
git push
```

6. Wait for CI to pass again using `gh run watch`
7. If new review comments appear, repeat (up to 2 additional rounds)

---

### Phase 12: Done

Invoke the `/manager` agent to update final Notion statuses (tasks → Done, story → In Review if all tasks done).

Report the final state:
- PR URL
- All tasks completed and their Notion statuses
- Any review comments that were addressed or intentionally skipped
- Any remaining blockers
