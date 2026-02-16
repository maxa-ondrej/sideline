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

## Steps

Follow these steps **in order**. Stop and report if any step fails.

### 1. Find the active sprint

Use `notion-search` to find the sprint with Status = "Active". Fetch the sprint page to get its linked stories.

If no active sprint exists, tell the user and stop.

### 2. Select a story

From the active sprint's stories, fetch each story to check its status. Pick a story using this priority order:

1. **In Progress** — resume work already started (highest priority)
2. **TODO** — start new work

Skip stories with status Done, In Review, or In Test.

If multiple candidates exist at the same priority level, prefer higher priority stories (Critical > High > Medium > Low).

If `$ARGUMENTS` is provided, use it to match a specific story by name or keyword instead of auto-selecting.

If no actionable stories remain, tell the user the sprint is complete and stop.

### 3. Fetch story details and tasks

Fetch the selected story page to get:
- The story description (page content) for context
- The linked tasks

Fetch each task to get its title, status, type, notes, and estimate.

### 4. Update story status

If the story is in TODO status, update it to **In Progress** using `notion-update-page`.

### 5. Present the work summary

Show the user:
- Sprint name
- Story title and description
- List of tasks with their status, type, and estimate
- Which tasks are already done vs remaining

### 6. Plan implementation

Enter plan mode. For each remaining task (not Done), analyze what code changes are needed by exploring the codebase. Write a concrete implementation plan that covers all remaining tasks.

Present the plan to the user for approval via `ExitPlanMode`.

### 7. Implement tasks

After the plan is approved, work through each remaining task **in order**. For each task:

1. Update the task status to **In Progress** in Notion using `notion-update-page`
2. Implement the changes described in the plan
3. Run `pnpm check` and `pnpm test` to verify the changes compile and pass tests
4. Update the task status to **Done** in Notion

If a task fails (tests break, types don't pass), fix the issue before moving on. If you cannot fix it, leave the task as In Progress and report the blocker to the user.

### 8. Commit

After all tasks are complete (or as many as possible), invoke the `/commit` skill to commit, push, and verify CI.

### 9. Update story status

If all tasks in the story are Done, update the story status to **In Review** in Notion.
