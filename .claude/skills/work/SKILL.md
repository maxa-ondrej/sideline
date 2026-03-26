---
name: work
description: Fetches the next bug or story from the active Notion sprint (bugs always before stories, preferring in-progress work) and implements it task by task. Creates a plan, gets approval, then codes, commits, and updates Notion statuses.
---

# Work Skill

Pick up a story from the active sprint and implement it end-to-end.

## Execution

Follow these phases **in order**. Stop and report if any phase fails. Pass `$ARGUMENTS` to the agile-coach if the user specified a story.

Invoke each specialist agent directly via the Agent tool from the main thread — do NOT nest them inside a manager agent. This gives the user visibility into each step.

---

### Phase 1: Pick up work

Invoke the `/agile-coach` agent to:
- Find the active sprint
- Select the next bug or story (pass `$ARGUMENTS` if the user specified a story)
- Update all statuses to In Progress
- Create a feature branch

Review the agile-coach's work summary before proceeding.

---

### Phase 2: Implement

Invoke the `/implement` skill with the story/bug description and task list from the agile-coach.

---

### Phase 3: Ship

Invoke the `/ship` skill to commit, push, open a PR, verify CI, and address review comments.

---

### Phase 4: Done

Invoke the `/agile-coach` agent to update final statuses:
- Move completed tasks to `Done`
- Move story to `In Review` if all tasks are done

Present the final state:
- PR URL
- All tasks completed and their Notion statuses
- Any review comments that were addressed or intentionally skipped
- Any remaining blockers
