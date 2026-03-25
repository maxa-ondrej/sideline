---
name: refactor
description: Refactor code with clear before/after explanation. Verifies changes with tests before completion.
argument-hint: <file> [refactoring-goal]
---

# Code Refactor

Invoke the `/refactorer` agent with the target files and refactoring goal.

## Target

Refactor: $ARGUMENTS

If no target specified, ask the user which file to refactor and what improvement they want.
