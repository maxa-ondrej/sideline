---
name: refactor
description: Refactor code with clear before/after explanation. Verifies changes with tests before completion.
argument-hint: <file> [refactoring-goal]
---

# Code Refactor

Refactor the specified code while maintaining functionality.

## Target

Refactor: $ARGUMENTS

If no target specified, ask the user which file to refactor and what improvement they want.

## Workflow

Follow these steps in order:

### Step 1: Analyze
- Read the target file(s) and any related files they import/depend on
- Understand current structure and functionality
- Identify the refactoring opportunity
- Check for existing tests covering the code

### Step 2: Plan
Explain what you will change:
- What code will be modified
- Why this change improves the code
- Any risks or considerations

Ask for confirmation before proceeding if the changes are substantial.

### Step 3: Refactor
- Make the code changes
- Keep changes focused and minimal
- Only modify files explicitly in scope
- Follow all project code style rules from AGENTS.md:
  - **Never use `Effect.gen(function* () {`** — use `Effect.Do.pipe(...)` with `Effect.bind`/`Effect.let`/`Effect.tap`
  - **Never cast types** (`as X`) and **never use `any`**
  - **Use `Effect.asVoid`** instead of `Effect.map(() => undefined as undefined)`
  - **Never use `Schema.optional`** — use `Schema.optionalWith({ as: 'Option' })` or `Schema.OptionFromNullOr(...)`
  - Use `pipe` for linear transformations and chaining
  - Repository pattern: start from `SqlClient.SqlClient.pipe(Effect.bindTo('sql'), ...)`, use `Bind.remove` to strip internals

### Step 4: Verify

Run verification in this order:

```bash
# 1. Format (fixes biome-fixable issues)
pnpm format

# 2. Type check
pnpm check
```

If type check fails, fix the issues and re-run.

If `packages/domain` source files were changed, rebuild before testing:
```bash
cd packages/domain && pnpm build && cd -
```

Then run tests:
```bash
# Run tests for affected package(s) — prefer scoped runs over full suite
cd <affected-package> && pnpm test

# Or from root if multiple packages changed
pnpm test
```

**CRITICAL:** If tests fail:
1. Analyze the failure
2. Fix the issue
3. Re-run tests
4. Repeat until tests pass

Do NOT report completion until all checks pass.

### Step 5: Report

Provide the refactoring summary:

## Refactoring Complete

### Changes Made

#### File: [filename]

**Before:**
```typescript
[original code - relevant section only]
```

**After:**
```typescript
[refactored code - same section]
```

**Why:** [Explanation of the improvement]

### Verification
- Type check: passed
- Tests: [number] passed

### Summary
[Brief description of what was improved: performance, readability, maintainability, etc.]

## Scope Rules
- Only modify files explicitly specified or directly required for the refactor
- If refactoring requires changes to other files, explain and ask for permission
- Keep changes minimal and focused on the stated goal
- Do not add docstrings, comments, or type annotations to code you didn't change
- Do not "improve" surrounding code beyond the stated refactoring goal
