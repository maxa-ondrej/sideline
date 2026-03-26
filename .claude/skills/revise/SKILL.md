---
name: revise
description: Fetch and implement code review comments on the current PR. Fixes issues, re-runs checks, commits, and pushes. Use when the user asks to address, revise, or fix review comments or PR feedback.
---

# Review Skill

Address code review comments on the current PR.

## Execution

Follow these steps **in order**. Stop and report if any step fails.

---

### Step 1: Fetch review comments

Get the current PR number and fetch all review comments:

```bash
gh pr view --json number -q '.number'
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

If there are no comments, tell the user and stop.

---

### Step 2: Address comments

1. Read all review comments
2. Invoke the `/developer` agent with the comments to fix relevant ones
3. Skip comments that contradict AGENTS.md conventions or add unnecessary complexity

---

### Step 3: Verify

Re-run `/formatter`, `/analyzer`, `/tester` to ensure fixes are clean.

If any fail, invoke the `/developer` agent to fix, then re-verify. Repeat until all checks pass.

---

### Step 4: Commit and push

```bash
git add -A
git commit -m "Address review feedback"
git push
```

Wait for CI to pass using `gh run watch`.

---

### Step 5: Check for new comments

If new review comments appear after pushing, repeat from Step 1 — no round limit.
