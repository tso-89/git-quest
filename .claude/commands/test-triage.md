---
description: Investigate failing tests and produce a root-cause fix plan
argument-hint: [test path]
allowed-tools: Read, Edit, Grep, Glob, Bash
---
# /test-triage — Investigate and Fix Failing Tests

Systematically identify why tests are failing and produce a fix plan.

## Steps

1. Run the test suite: `pnpm test` (or the project's test command from `CLAUDE.md`).
2. Collect all failing tests and their error messages.
3. For each failing test:
   a. Read the test file to understand what it expects.
   b. Read the source file it tests.
   c. Identify the root cause (changed API, missing mock, wrong assertion, etc.).
4. Group failures by root cause.
5. Fix each group, starting with the root-cause fixes that unblock the most tests.
6. Re-run tests after each batch of fixes to confirm improvement.

## Output Format

```
## Failing Tests Summary
Total: N failing

## Root Causes Found
1. [Cause A] — affects tests: [list]
2. [Cause B] — affects tests: [list]

## Fix Plan
1. [Fix for Cause A]
2. [Fix for Cause B]

## After Fixes
(Run tests and report final status)
```
