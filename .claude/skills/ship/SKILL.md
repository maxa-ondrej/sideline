---
name: ship
description: Commit, push, open a PR, verify CI, and address code review comments. The delivery loop from local changes to a reviewed PR. Use this whenever the user asks to commit, push, ship, send, or submit changes.
---

# Ship Skill

Commit local changes, push, open a PR, and handle CI + code review.

## Execution

Follow these steps **in order**. Stop and report if any step fails.

---

### Step 1: Commit and push

Invoke the `/commit` skill to:
- Create a changeset
- Run all checks (format, codegen, type check, tests)
- Commit, push, and open a PR
- Verify CI passes

**Never push directly to `main`.** All work goes through feature branches and pull requests.

---

### Step 2: Wait for code review

After the PR is created and CI passes, poll for review comments:

```bash
gh pr view --json number -q '.number'
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

Wait up to 3 minutes for review comments to appear, checking every 30 seconds. If no comments arrive, stop.

---

### Step 3: Address review comments

If comments were found, invoke the `/revise` skill to address them.
