---
name: reconcile
description: Checks the active sprint for merged PRs and cascades Notion task/story/epic statuses according to the lifecycle rules. Use after merging PRs or to sync stale statuses.
---

# Reconcile Skill

Scan the active sprint and reconcile Notion statuses based on git/GitHub state and the task lifecycle rules in AGENTS.md.

## Notion IDs

| Database   | Data Source ID                                |
|------------|-----------------------------------------------|
| Sprints    | `collection://0bb5bd1a-500c-4b2c-b482-cc6be3986a81` |
| Stories    | `collection://6ae03d12-a6d6-45b1-bead-094f0c225e42` |
| Tasks      | `collection://df8fe05e-456c-429d-a6da-f45fb3303dcf` |
| Epics      | `collection://2020f137-79a6-43b7-9609-309d0aaa8450` |

## Steps

Follow these steps **in order**.

### 1. Find the active sprint

Use `notion-search` to find the sprint with Status = "Active". Fetch it to get linked stories.

If no active sprint exists, tell the user and stop.

### 2. Gather sprint data

For each story in the sprint:
1. Fetch the story to get its status and linked tasks
2. Fetch each task to get its status

Build a map of: `story → [tasks]` with statuses for each.

### 3. Check merged PRs

Run `gh pr list --state merged --base main --limit 50 --json number,title,mergedAt,headRefName` to find recently merged PRs.

### 4. Apply lifecycle rules

Walk through each story and its tasks, applying these rules **in order**. Collect all needed updates, then report them before making changes.

#### Rule 1: In Review → In Test (after merge)

For each task in `In Review`:
- Check if its feature branch has been merged (match branch name or PR title to task/story)
- If merged, mark the task for `In Test`

#### Rule 2: Story → In Test

For each story where **all tasks** are in `In Test` or `Done`:
- If the story is not already in `In Test` or `Done`, mark it for `In Test`

#### Rule 3: Story → In Review

For each story where **no tasks** remain in `TODO` or `In Progress`:
- If the story is still in `In Progress`, mark it for `In Review`

#### Rule 4: Epic → In Review

For each parent epic of the sprint's stories:
- Fetch the epic and all its stories
- If **all stories** are in `In Test` or `Done`, mark the epic for `In Review`

#### Rule 5: Cascade In Progress

For each story in `In Progress`:
- If parent epic is in `TODO`, mark it for `In Progress`
- If parent milestone is in `TODO`, mark it for `In Progress`

### 5. Report proposed changes

Present all proposed status changes to the user in a table:

```
| Entity       | Current Status | New Status  | Reason                     |
|--------------|---------------|-------------|----------------------------|
| Task: ...    | In Review     | In Test     | PR #42 merged              |
| Story: ...   | In Progress   | In Review   | No tasks in TODO/Progress  |
| Epic: ...    | In Progress   | In Review   | All stories in Test/Done   |
```

If no changes are needed, tell the user everything is in sync and stop.

### 6. Apply changes

After the user confirms (or if no ambiguity exists), apply all updates via `notion-update-page`.

**Never** move anything to `Done` — that is done manually by the user.

### 7. Summary

Report what was updated and the final state of the sprint.
