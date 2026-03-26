---
name: complete
description: Mark a story or bug as complete after its PR has been merged. Moves stories to Done and bugs to Fixed. Use when the user says a PR was merged or asks to complete/close a work item.
---

# Complete Skill

Mark work as complete after its PR has been merged.

## Execution

1. Verify the PR is actually merged:

```bash
gh pr view --json state -q '.state'
```

If the PR is not merged, tell the user and stop.

2. Invoke the `/agile-coach` agent to update statuses (PR merged):
   - Move the **story** to `Done`
   - Move the **bug** to `✅ Fixed`
   - Switch back to `main` and pull latest
