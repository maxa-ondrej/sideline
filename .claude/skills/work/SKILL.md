---
name: work
description: Fetches the next bug or story from the active Notion sprint (bugs always before stories, preferring in-progress work) and implements it task by task. Creates a plan, gets approval, then codes, commits, and updates Notion statuses.
---

# Work Skill

Pick up a story from the active sprint and implement it end-to-end.

## Execution

Invoke the `/manager` agent with the full workflow. Pass `$ARGUMENTS` if the user specified a story.

**The manager and all agents it invokes MUST run as subagents (via the Agent tool), never in the main conversation thread.** The main thread should only receive summaries and ask for user decisions.
