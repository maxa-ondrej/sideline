---
name: ship
description: Commit, push, open a PR, verify CI, and address code review comments. The delivery loop from local changes to a reviewed PR. Use this whenever the user asks to commit, push, ship, send, or submit changes.
---

# Ship Skill

Commit local changes, push, open a PR, and handle CI + code review.

## Execution

Follow these steps **in order**. Stop and report if any step fails.

**Never push directly to `main`.** All work goes through feature branches and pull requests.

---

### Step 1: Check for changes

Run `git status` and `git diff` to understand what changed. If there are no changes, tell the user and stop.

---

### Step 2: Create a changeset (if code changed)

If any package source code changed (not just docs/config), create a changeset file in `.changeset/`:

- Determine which packages were affected — include all `@sideline/*` packages with meaningful code changes (e.g. `@sideline/web`, `@sideline/bot`, `@sideline/server`, `@sideline/proxy`, `@sideline/migrations`, `@sideline/domain`, `@sideline/effect-lib`, `@sideline/i18n`). Private packages are NOT excluded.
- Apply bump rules:
  - **patch** — small features, bug fixes, refactors
  - **minor** — larger features, significant new functionality
  - **major** — NEVER. Do not bump major.
- Write a short summary of the changes in the changeset body

---

### Step 3: Run all checks

Run these commands and make sure they all pass:

```bash
pnpm format        # Biome formatting and linting
pnpm codegen       # Regenerate generated code
pnpm check         # TypeScript type checking
pnpm test          # Run all tests
```

Stage any files modified by format/codegen before proceeding.

---

### Step 4: Commit

- Stage all relevant files (avoid secrets like `.env`, credentials)
- Write a concise commit message describing **why**, not what
- If the user provided a message via `$ARGUMENTS`, use that as the commit message
- Never add `Co-Authored-By`, `Generated-By`, or any AI attribution footers
- Use a HEREDOC for the commit message to preserve formatting

---

### Step 5: Push and open PR

Run `git push` to push the commit to the remote. If the branch has no upstream yet, use `git push -u origin <branch>`.

Then open a pull request with `gh pr create` (skip if a PR already exists):

```bash
gh pr create --title "<short title>" --body "$(cat <<'EOF'
## Summary
- <bullet points>

## Test plan
- <test plan>
EOF
)"
```

Return the PR URL to the user.

---

### Step 6: Verify CI

After pushing, check that CI pipelines pass:

```bash
gh run list --limit 1
```

If the latest run is still in progress, wait and check again with `gh run watch`. If it fails, investigate the logs with `gh run view --log-failed`, fix the issue, and restart from Step 3.

---

### Step 7: Wait for code review

After CI passes, poll for review comments:

```bash
gh pr view --json number -q '.number'
gh api repos/{owner}/{repo}/pulls/{pr_number}/reviews
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments
```

Wait up to 3 minutes for review comments to appear, checking every 30 seconds. If no comments arrive, stop.

---

### Step 8: Address review comments

If comments were found, invoke the `/revise` skill to address them.

---

### Step 9: Done

Report the PR URL and CI status. Do **not** update Notion statuses — that is the `/agile-coach` agent's responsibility.
