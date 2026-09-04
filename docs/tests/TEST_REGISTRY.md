# Test Registry

> All tests in this project must be documented here.
> **YOU MUST** add an entry whenever you create a new test file.

## Format

Each entry requires:
- **Test ID** — Sequential, unique identifier (e.g. `T-001`).
- **What it tests** — The module, function, or behaviour under test.
- **Acceptance Criteria** — What must be true for the test to pass.
- **Type** — `unit` | `integration` | `e2e` | `snapshot`.
- **File** — Path to the test file.

---

## Registry

| Test ID | Module / Behaviour | Acceptance Criteria | Type | File |
|---------|--------------------|---------------------|------|------|
| T-000   | _(example) `getUserById` returns user for valid ID_ | Returns a user object with correct `id` and `email`; throws `NotFoundError` for unknown ID | unit | `src/users/user-service.test.ts` |

> Delete the T-000 example row when adding your first real test.

---

## Best Practices

- **Test IDs are permanent** — never reuse an ID even if a test is deleted.
- **One entry per test file**, not per `it()` block.
- **Keep acceptance criteria behavioural** — describe observable outcomes, not implementation details.
- Integration and e2e tests must note any required environment variables or seed data.
