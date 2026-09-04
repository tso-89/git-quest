# {{PROJECT_NAME}}

> {{PROJECT_DESCRIPTION}}

# Prime Directive

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity, but not at the cost of Functionality

**Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

## 5. We Are a Team

If you see a clearly better approach, say so before implementing. Explain the tradeoff in 2-4 bullets. If the current request is still reasonable, proceed unless the alternative avoids serious risk, far greater compute resources, or wasted work.

If what we are trying to do is similar to settled science or industry practice, let me know. We don't have to reinvent the wheel.

List a quick summary of what you did not decide to do, no more than a short paragraph explaining reasoning.

## Architecture

Use [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a full architectural overview.

## Tech Stack

| Layer       | Technology          |
|-------------|---------------------|
| Language    | {{LANGUAGE}}        |
| Framework   | {{FRAMEWORK}}       |
| Database    | {{DATABASE}}        |
| Package Mgr | {{PACKAGE_MANAGER}} |

## Common Commands

```bash
# Install dependencies
{{CMD_INSTALL}}

# Run dev server
{{CMD_DEV}}

# Run tests
{{CMD_TEST}}

# Lint & format
{{CMD_LINT}}
{{CMD_FORMAT}}

# Build
{{CMD_BUILD}}
```

## Critical Conventions

- **YOU MUST** run tests before committing any changes.
- **YOU MUST** follow the coding style defined in `docs/rules/coding-style.md`.
- Use `{{PACKAGE_MANAGER}}` for package management.
- **Testing & Test Documentation**:
  - All new features require a corresponding test file.
  - **YOU MUST** document integration and e2e tests in [`docs/tests/TEST_REGISTRY.md`](docs/tests/TEST_REGISTRY.md), including any fixtures, seed data, or environment variables they require.
  - Unit tests do not need a registry entry — the test name is the documentation.
- Never leave commented out or dead code without an explicit TODO and issue link.
- Always update documentation when changing features.
- Never commit secrets, `.env` files, or API keys.

## Rules

Path-specific rules live in `docs/rules/` and apply to all code in this project:

| Rule file | Covers |
|-----------|--------|
| [`docs/rules/coding-style.md`](docs/rules/coding-style.md) | Naming, imports, error handling, language conventions |
| [`docs/rules/security.md`](docs/rules/security.md) | Secrets, input validation, auth, dependencies |
| [`docs/rules/git-workflow.md`](docs/rules/git-workflow.md) | Branching, commit format, PR checklist |

## Directory Structure

```
.
├── AGENTS.md             # Shared project rules — read by every coding agent
├── docs/                 # Human-readable documentation
│   ├── ARCHITECTURE.md
│   ├── ADR/              # Architecture Decision Records
│   ├── rules/            # Agent-facing rules (style, security, git)
│   ├── guides/           # Extended human-facing guides
│   └── tests/            # Test registry
├── skills/               # Portable agent skills (shared across platforms)
├── templates/            # Component templates (agents, skills, ADRs)
├── scripts/              # Bootstrapping and validation scripts
└── src/                  # Application source code
```

## Skills

Portable skills live in `skills/<name>/SKILL.md`. They are **auto-triggered** when a request
matches the skill's `description` frontmatter field.

| Skill | Triggered When |
|-------|----------------|
| `coding` | Writing new code, implementing features |
| `code-review` | Reviewing, auditing, or analysing code |
| `debug-issue` | Investigating bugs, errors, unexpected behaviour |
| `write-tests` | Writing or improving tests |
| `refactor` | Refactoring without changing behaviour |
| `security` | Security reviews or vulnerability assessment |
| `documentation` | Writing or updating docs, READMEs |
| `create-adr` | Recording an Architecture Decision |
| `grill-me` | Interactive design interviews to align on a plan |

To add a skill: create `skills/<name>/SKILL.md` from `templates/skill-template.md`.

## Links

- [Architecture](docs/ARCHITECTURE.md)
- [ADRs](docs/ADR/)
- [Coding Style](docs/rules/coding-style.md)
- [Security](docs/rules/security.md)
- [Git Workflow](docs/rules/git-workflow.md)
- [Contributing](CONTRIBUTING.md)
