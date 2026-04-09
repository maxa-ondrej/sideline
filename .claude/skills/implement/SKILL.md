---
name: implement
description: Research, plan, write tests, implement, verify, review, and refactor a story or bug. The full development loop from plan to clean code. Use this whenever the user asks to implement, build, code, fix, or do any development work.
---

# Implement Skill

Develop a story or bug end-to-end: research, plan, design, TDD, implement, verify, review, refactor.

## Execution

Follow these phases **in order**. Stop and report if any phase fails. The caller provides the story/bug description and task list via `$ARGUMENTS`.

Invoke each specialist agent directly via the Agent tool from the main thread — do NOT nest them inside a manager agent. This gives the user visibility into each step.

### User input via chat

Whenever this skill needs user input (plan approval, confirmation, feedback):

1. **Render the plan visually** using the `/canvas-design` skill. Pass the full plan content (architecture, design spec, task breakdown) to canvas-design so it produces a polished visual document (PNG/PDF) that the user can review at a glance.
2. **Provide the file link** to the plan file (e.g., the plan markdown file path) so the user can review in their editor if they prefer
3. **Ask the user** to choose one of:
   - **Accept** — proceed as-is
   - **Suggest changes** — provide feedback for revision
   - **Decline** — stop the skill

Use this pattern for ALL plan presentations — always render via `/canvas-design` before asking for feedback.

---

### Phase 1: Research (optional)

If the story involves unfamiliar APIs, libraries, or Effect-TS patterns, invoke the `/researcher` agent with the relevant topics.

Skip this phase if the story uses well-known patterns already present in the codebase.

---

### Phase 2: Plan & Design (parallel)

Run the architect and designer **in parallel** (launch both Agent calls in one message):

1. **Invoke the `/architect` agent** with:
   - The story description and task list
   - Any research findings (from the researcher)

2. **Invoke the `/designer` agent** with:
   - The story description and task list
   - Focus: design specifications for any UI/UX changes (web pages, components, Discord embeds/commands)

   **Skip the designer** if the story has **no user-facing changes** (e.g., pure backend logic, database migrations, internal refactors with no UI).

3. **Invoke the `/hater` agent** with the architect's plan **and** the designer's design specification (if produced). The hater critiques both for logical flaws, missing edge cases, UX issues, and architectural problems.

4. If the hater finds **blockers**, send the critique back to the `/architect` and/or `/designer` agent for revision. Repeat architect/designer -> hater until no blockers remain.

5. Present the final plan and design to the user for approval using the **chat pattern** described above. Use the `/canvas-design` skill to render the architect's plan and the designer's design spec as a polished visual document. Provide a link to the plan file, and ask the user to **Accept**, **Suggest changes**, or **Decline**. If the user provides feedback, send it back to the relevant agent(s) for revision, re-render the updated plan via `/canvas-design`, and repeat.

---

### Phase 3: Prepare domain package

Before writing tests, the domain package must be ready:

1. **Invoke the `/developer` agent** with:
   - The approved implementation plan (domain-related tasks only)
   - Instruction: implement only `@sideline/domain` files — API contracts, schemas, models, types
   - After changes, rebuild: `pnpm build`

2. This ensures that tests and application code can import the new domain types.

**Skip this phase** if the plan has no domain package changes.

---

### Phase 4: Write tests first (TDD)

Invoke the `/tester` agent in **TDD mode** with the architect's test specification. The tester writes all test files before any implementation begins. These tests should fail initially — that's expected and correct.

---

### Phase 4b: Verify tests

After tests are written, verify they are clean:

1. Invoke the `/formatter` agent to run `pnpm format` and stage fixes
2. Invoke the `/analyzer` agent to run `pnpm check` and report type errors
3. If the analyzer reports failures, invoke the `/tester` agent to fix them, then re-run `/formatter` and `/analyzer` until clean.

Then review the test code:

4. Invoke the `/reviewer` agent on the new test files
5. Invoke the `/hater` agent on the new test files

If **must-fix** issues are found, invoke the `/tester` agent with the feedback, then re-run `/formatter` and `/analyzer`. Repeat until no must-fix issues remain.

---

### Phase 5: Implement (parallel per application)

After tests are written, implement application code **in parallel** — one `/developer` agent per affected application:

1. Determine which applications are affected by the plan (any combination of: `bot`, `server`, `web`).

2. **Launch one `/developer` agent per application in parallel** (all in one message). Each receives:
   - The approved implementation plan (filtered to tasks relevant to that application)
   - The designer's design specification (for `web` and `bot` agents, if applicable)
   - The task list scoped to that application
   - Note: domain package is already built, tests already exist and must pass after implementation

3. Each developer implements its application's tasks independently and reports what was changed.

If only one application is affected, run a single developer agent (no need to parallelize).

---

### Phase 6: Verify

Run verification agents:

1. Invoke the `/formatter` agent to run `pnpm format` and stage fixes
2. Invoke the `/analyzer` agent to run `pnpm check` and report type errors
3. Invoke the `/tester` agent in **verify mode** to run `pnpm test` and fill any remaining coverage gaps

If the analyzer or tester report failures, invoke the `/developer` agent with the errors to fix them. Then re-run the failing verification agent. Repeat until all checks pass — no round limit.

---

### Phase 7: Review

1. Invoke the `/reviewer` agent on the changed files
2. Invoke the `/hater` agent on the final code

If **must-fix** issues are found:
1. Invoke the `/developer` agent with the combined feedback
2. Re-run `/formatter`, `/analyzer`, `/tester` to verify fixes
3. Repeat until no must-fix issues remain — no round limit.

---

### Phase 8: Refactor

Invoke the `/refactorer` agent with the list of changed files (from `git diff --name-only main`).

Focus on:
- Ensuring Effect-TS code style compliance (see AGENTS.md)
- Removing unnecessary complexity introduced during implementation
- Keeping changes minimal — don't refactor unrelated code

After refactoring, re-run `/formatter`, `/analyzer`, `/tester` to verify nothing broke.
