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

### Step 2: Wait for CI and code review

After the PR is created and CI passes:

1. Wait for GitHub Actions pipelines to finish (the `/commit` skill already does this)
2. Poll for Copilot code review comments on the PR:

```bash
gh pr view --json number -q '.number'
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

Wait up to 3 minutes for review comments to appear, checking every 30 seconds. If no comments arrive, proceed.

---

### Step 3: Address review comments

If Copilot or other reviewers left comments:

1. Read all review comments
2. Invoke the `/developer` agent with the comments to fix relevant ones
3. Skip comments that contradict AGENTS.md conventions or add unnecessary complexity
4. Re-run `/formatter`, `/analyzer`, `/tester`
5. Commit and push the fixes:

```bash
git add -A
git commit -m "Address review feedback"
git push
```

6. Wait for CI to pass again using `gh run watch`
7. If new review comments appear, repeat — no round limit.
