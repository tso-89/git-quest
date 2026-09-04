---
description: Generate a pull request description from the staged changes
argument-hint: [base branch]
allowed-tools: Read, Grep, Glob, Bash
---
# /pr-describe — Generate a Pull Request Description

Generate a clear, complete pull request description based on the staged changes or provided diff.

## Steps

1. Read the diff or list of changed files.
2. Understand the purpose of the change.
3. Output a PR description using the template below.

## PR Description Template

```markdown
## Summary
(What does this PR do? 2–3 sentences)

## Changes
- (Bullet list of specific changes)

## Why
(Why was this change needed? Link to issue if applicable)

## Testing
(How was this tested? What test cases were added or run?)

## Screenshots / Demo
(Optional — attach if UI changes are included)

## Checklist
- [ ] Tests pass
- [ ] Lint passes  
- [ ] No secrets committed
- [ ] Documentation updated (if needed)

Closes #(issue number, if applicable)
```
