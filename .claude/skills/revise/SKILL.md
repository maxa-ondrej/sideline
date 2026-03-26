---
name: revise
description: Fetch and implement code review comments on the current PR. Fixes issues, re-runs checks, commits, and pushes. Use when the user asks to address, revise, or fix review comments or PR feedback.
---

# Revise Skill

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

### Step 2: Triage comments

Invoke the `/architect` agent with all fetched review comments and the current diff (`git diff main`).

The architect must:
1. Read each comment and understand what it asks for
2. Decide which comments are **relevant** — actionable feedback that improves the code
3. Skip comments that contradict AGENTS.md conventions, add unnecessary complexity, or are purely cosmetic/subjective
4. Return a list of relevant comments with a brief implementation note for each

---

### Step 3: Implement fixes

Invoke the `/implement` skill with the architect's list of relevant comments as the task description. Each relevant comment becomes a task to address.

---

### Step 4: Ship

Invoke the `/ship` skill to commit, push, and verify CI passes.

