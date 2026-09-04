---
description: Code review of the current file, selection, or staged diff
argument-hint: [files or diff]
allowed-tools: Read, Grep, Glob, Bash
---
# /review — Code Review Command

You are performing a structured code review. Follow the code-reviewer agent's format.

## Steps

1. Identify what files or diff to review (from the user's message or staged changes).
2. Read each file carefully using available tools.
3. Check against:
   - `.claude/rules/coding-style.md` — style conventions
   - `.claude/rules/security.md` — security requirements
   - `.claude/rules/git-workflow.md` — commit/PR expectations
4. Output a structured review per file using the format below.
5. Finish with an overall **Merge Readiness** verdict: ✅ Ready | ⚠️ Needs Changes | 🔴 Blocked

## Output Format

```
## Review: [filename or PR title]

### 🔴 Critical (must fix)
### 🟡 Suggestions (recommended)  
### 🟢 Positives

### Merge Readiness: ✅ | ⚠️ | 🔴
```
