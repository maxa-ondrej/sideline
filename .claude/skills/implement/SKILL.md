---
name: implement
description: Research, plan, write tests, implement, verify, review, and refactor a story or bug. The full development loop from plan to clean code. Use this whenever the user asks to implement, build, code, fix, or do any development work.
---

# Implement Skill

Develop a story or bug end-to-end: research, plan, TDD, implement, verify, review, refactor.

## Execution

Follow these phases **in order**. Stop and report if any phase fails. The caller provides the story/bug description and task list via `$ARGUMENTS`.

Invoke each specialist agent directly via the Agent tool from the main thread — do NOT nest them inside a manager agent. This gives the user visibility into each step.

---

### Phase 1: Research (optional)

If the story involves unfamiliar APIs, libraries, or Effect-TS patterns, invoke the `/researcher` agent with the relevant topics.

Skip this phase if the story uses well-known patterns already present in the codebase.

---

### Phase 2: Plan

Iterate until the plan is fool-proof:

1. Invoke the `/architect` agent with:
   - The story description and task list
   - Any research findings (from the researcher)

2. Invoke the `/hater` agent with the architect's plan to critique it.

3. If the hater finds **blockers**, send the critique back to the `/architect` agent for revision. Repeat architect -> hater until no blockers remain.

4. Present the final plan to the user for approval. Wait for user input before proceeding.

---

### Phase 3: Write tests first (TDD)

Invoke the `/tester` agent in **TDD mode** with the architect's test specification. The tester writes all test files before any implementation begins. These tests should fail initially — that's expected and correct.

---

### Phase 3b: Verify tests

After tests are written, verify they are clean:

1. Invoke the `/formatter` agent to run `pnpm format` and stage fixes
2. Invoke the `/analyzer` agent to run `pnpm check` and report type errors
3. If the analyzer reports failures, invoke the `/tester` agent to fix them, then re-run `/formatter` and `/analyzer` until clean.

Then review the test code:

4. Invoke the `/reviewer` agent on the new test files
5. Invoke the `/hater` agent on the new test files

If **must-fix** issues are found, invoke the `/tester` agent with the feedback, then re-run `/formatter` and `/analyzer`. Repeat until no must-fix issues remain.

---

### Phase 4: Implement

After tests are written:

1. Invoke the `/developer` agent with:
   - The approved implementation plan
   - The task list
   - Note: tests already exist and must pass after implementation

2. The developer implements all tasks and reports what was changed.

---

### Phase 5: Verify

Run verification agents:

1. Invoke the `/formatter` agent to run `pnpm format` and stage fixes
2. Invoke the `/analyzer` agent to run `pnpm check` and report type errors
3. Invoke the `/tester` agent in **verify mode** to run `pnpm test` and fill any remaining coverage gaps

If the analyzer or tester report failures, invoke the `/developer` agent with the errors to fix them. Then re-run the failing verification agent. Repeat until all checks pass — no round limit.

---

### Phase 6: Review

1. Invoke the `/reviewer` agent on the changed files
2. Invoke the `/hater` agent on the final code

If **must-fix** issues are found:
1. Invoke the `/developer` agent with the combined feedback
2. Re-run `/formatter`, `/analyzer`, `/tester` to verify fixes
3. Repeat until no must-fix issues remain — no round limit.

---

### Phase 7: Refactor

Invoke the `/refactorer` agent with the list of changed files (from `git diff --name-only main`).

Focus on:
- Ensuring Effect-TS code style compliance (see AGENTS.md)
- Removing unnecessary complexity introduced during implementation
- Keeping changes minimal — don't refactor unrelated code

After refactoring, re-run `/formatter`, `/analyzer`, `/tester` to verify nothing broke.
