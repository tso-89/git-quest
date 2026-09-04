---
name: code-review
description: >
  Triggered when the user asks to review, audit, assess, or analyse code quality, 
  security vulnerabilities, or correctness. Also triggered for PR review requests.
  NOT triggered for writing new code or debugging.
---

# Code Review Skill

You are performing a thorough, constructive code review.

## Checklist

Work through these categories for each file:

### 1. Correctness
- Does the logic match the intended behaviour?
- Are there edge cases, off-by-one errors, or null-pointer risks?
- Are error paths handled?

### 2. Security
- Refer to the security rules in `docs/rules/security.md`.
- Look for: injection, hardcoded secrets, improper auth, insecure defaults.

### 3. Performance
- N+1 queries, missing indexes, O(n²) loops, unnecessary allocations.

### 4. Maintainability
- Are functions small and single-purpose?
- Is there unnecessary duplication (DRY)?
- Are names clear and descriptive?

### 5. Tests
- Are there tests? Do they cover edge cases?
- Are tests meaningful, not just happy-path?

### 6. Convention Adherence
- Does this code follow `docs/guides/coding-style.md`?

## Output Format

For each file reviewed:

```
## [filename]

### 🔴 Critical
- (blocking issues)

### 🟡 Suggestions  
- (recommended improvements)

### 🟢 Positives
- (at least one thing done well)
```

End with: **Overall Verdict: ✅ Ready | ⚠️ Needs Changes | 🔴 Blocked**
