---
name: refactor
description: >
  Triggered when the user asks to refactor, restructure, clean up, simplify, 
  or improve existing code without changing its behaviour. Also triggered for 
  "extract this into a function", "make this more readable", "reduce duplication".
  NOT triggered for adding new features or fixing bugs.
---

# Refactor Skill

You are refactoring code to improve quality without changing observable behaviour.

## The Refactoring Contract

> **CRITICAL:** Refactoring must NEVER change behaviour. Tests must pass before AND after.

## Procedure

1. **Understand current behaviour** — read the code and its tests thoroughly.
2. **Run tests** — confirm the baseline (all tests must be green before starting).
3. **Identify the improvement** — be specific about what problem you are solving:
   - Duplication (DRY violation)
   - Long function (extract)
   - Poor naming (rename)
   - Excessive complexity (simplify)
   - Coupling (decouple / inject dependencies)
   - Magic numbers/strings (extract constants)
4. **Apply refactoring incrementally** — one small step at a time.
5. **Run tests after each step** — never let tests go red during a refactor.
6. **Document significant changes** — update comments and docstrings if they're stale.

## Common Refactoring Patterns

| Pattern              | When to use                                          |
|----------------------|------------------------------------------------------|
| Extract Function     | Block of code that can be named and reused           |
| Rename Variable      | Name doesn't clearly communicate intent              |
| Introduce Parameter  | Magic value hardcoded inside a function              |
| Replace Conditional with Polymorphism | Long if/switch on type |
| Extract Module/Class | Group of related functions with shared state         |
| Inline Function      | Function body is as clear as its name                |
| Remove Dead Code     | Code that's never called                             |

## Rules

- Never add features during a refactor.
- Never fix bugs during a refactor (log them separately).
- If tests don't exist, write them first before refactoring.
- Keep commits atomic: one refactoring pattern per commit.

## Output Format

```
## Refactoring Plan
(What improvement is being made and why)

## Changes Made
(Summary of each change)

## Test Results
Before: (pass/fail count)
After:  (pass/fail count)
```
