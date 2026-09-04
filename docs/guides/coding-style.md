# Coding Style Guide

> Extended human-facing reference. The condensed agent-facing rules live in
> [`docs/rules/coding-style.md`](../rules/coding-style.md) and are loaded by every agent.

## Language-Specific Conventions

See the rule files for the condensed agent-facing version:
- All platforms: [`docs/rules/coding-style.md`](../rules/coding-style.md)

## Principles

1. **Readable > Clever** — code is read 10× more than it's written.
2. **Explicit > Implicit** — no hidden magic; code should be self-documenting.
3. **Consistent > Personal** — follow team conventions even if you'd personally do it differently.
4. **Small > Large** — small functions, small PRs, small commits.

## Formatting

- Line length: 100 characters max.
- Indentation: 2 spaces (TypeScript / JavaScript); 4 spaces (Python).
- Trailing newline at end of every file.
- No trailing whitespace.

### Tooling

| Language   | Formatter | Linter  |
|------------|-----------|---------|
| TypeScript | Prettier  | ESLint  |
| Python     | Black     | Ruff    |

Auto-format on save is expected. CI will fail if format is wrong.

## TypeScript

### Types
```typescript
// ✅ Good — explicit interface
interface User {
  id: string
  email: string
  createdAt: Date
}

// ❌ Bad — opaque object
const user: Record<string, any> = { ... }
```

### Functions
```typescript
// ✅ Good — small, named, single purpose
function calculateTax(amount: number, rate: number): number {
  return amount * rate
}

// ❌ Bad — long, unnamed, multiple responsibilities
const process = (data: any) => { /* 100 lines */ }
```

### Async / Error Handling
```typescript
// ✅ Good — typed errors, no swallowing
async function fetchUser(id: string): Promise<User> {
  const user = await db.users.findById(id)
  if (!user) throw new NotFoundError(`User ${id} not found`)
  return user
}

// ❌ Bad — swallowed error, no type info
try {
  await fetchUser(id)
} catch (e) {
  // silently fails
}
```

## Python

### Type Hints
```python
# ✅ Good
def get_user(user_id: str) -> User | None:
    return db.query(User).filter_by(id=user_id).first()

# ❌ Bad — no types
def get_user(user_id):
    return db.query(User).filter_by(id=user_id).first()
```

### Docstrings (Google style)
```python
def calculate_tax(amount: float, rate: float) -> float:
    """Calculate tax on a given amount.

    Args:
        amount: The pre-tax amount.
        rate: The tax rate as a decimal (e.g. 0.15 for 15%).

    Returns:
        The calculated tax amount.

    Raises:
        ValueError: If rate is not between 0 and 1.
    """
    if not 0 <= rate <= 1:
        raise ValueError(f"Rate must be between 0 and 1, got {rate}")
    return amount * rate
```

## Testing Style

See [`testing.md`](testing.md) for the full testing guide.

Quick rules:
- Test names are sentences: `it returns 404 when user does not exist`.
- One logical assertion per test (group related with `expect.soft` or equivalent).
- Never `console.log` in tests.
