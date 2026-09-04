# Coding Style Rules

> These rules are loaded by Claude for all files in this project.
> Update them to match your team's actual conventions.

## General Principles

- **Clarity over cleverness** — readable code is maintainable code.
- **Explicit over implicit** — avoid magic; name things for what they do.
- **Small functions** — a function should do one thing and have one exit path (ideally).
- **No dead code** — remove commented-out code; use git history instead.

## TypeScript Conventions

- Enable `strict` mode; no `any` without a `// eslint-disable` comment explaining why.
- Prefer `interface` for object shapes; `type` for unions, intersections, and aliases.
- Use `const` by default; `let` only when reassignment is needed; never `var`.
- Destructure function parameters when >2 properties.
- Exports: prefer named exports; default exports only for framework-required components.
- File names: `kebab-case.ts` for modules; `PascalCase.tsx` for components.

## Python Conventions

- Follow PEP 8; use `black` for formatting and `ruff` for linting.
- Type-annotate all function signatures and public class attributes.
- Use dataclasses or Pydantic models for structured data, not plain dicts.
- Docstrings: Google style for public functions.

## Naming

| Context             | Convention       | Example                     |
|---------------------|------------------|-----------------------------|
| Variables & funcs   | camelCase (TS)   | `getUserById`               |
| Variables & funcs   | snake_case (Py)  | `get_user_by_id`            |
| Classes             | PascalCase       | `UserRepository`            |
| Constants           | SCREAMING_SNAKE  | `MAX_RETRY_COUNT`           |
| Files (TS)          | kebab-case       | `user-repository.ts`        |
| Files (Py)          | snake_case       | `user_repository.py`        |
| Database tables     | snake_case plural| `user_sessions`             |
| Environment vars    | SCREAMING_SNAKE  | `DATABASE_URL`              |

## Comments

- Write comments for **why**, not **what** — the code already shows what.
- TODO format: `// TODO(username): description` — always include a name.
- No commented-out code blocks.

## Error Handling

- Never swallow errors silently.
- Log errors at the boundary where they are caught.
- Return structured error responses from APIs (never raw stack traces).
- Use typed error classes, not generic `Error`.

## Imports

- Group in order: stdlib → third-party → internal → relative.
- No circular imports.
- Absolute imports preferred over deeply nested relative imports.
