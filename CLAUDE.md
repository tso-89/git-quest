@AGENTS.md

---

# Claude Code Specifics

Everything above is imported from `AGENTS.md`, the shared source of truth for this project.
Edit that file, not this one, for anything that applies to all coding agents.

## Subagents

Specialised agents live in `.claude/agents/`. Claude auto-delegates based on each agent's
`description` field.

| Agent | Delegates When |
|-------|----------------|
| `coding-agent` | Writing new code or implementing features |
| `code-reviewer` | Reviewing or auditing code quality |
| `debugger` | Investigating bugs or errors |
| `test-writer` | Writing or improving tests |
| `refactor-agent` | Refactoring without changing behaviour |
| `security-agent` | Security reviews or vulnerability assessment |
| `docs-writer` | Writing or updating documentation |
| `ui-ux-agent` | UI/UX design, component design, accessibility audits |

See `.claude/agents/README.md` for the index and instructions for adding new agents.

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/review` | Code review of current file or selection |
| `/pr-describe` | Generate a PR description |
| `/grill-me` | Interactive design interview |
| `/test-triage` | Analyse and triage failing tests |

## Claude Code Layout

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | This file — imports `AGENTS.md`, adds Claude-specific config |
| `.claude/agents/` | Specialised subagents, auto-delegated by task type |
| `.claude/skills/` | Portable skills (mirrored from `skills/`) |
| `.claude/commands/` | Slash commands |
| `.claude/rules/` | Path-specific rules, auto-loaded every session |
| `.claude/settings.json` | Permissions, model, and safety config |
| `.mcp.json` | MCP server configuration |

> `.claude/rules/` and `.claude/skills/` are generated from `docs/rules/` and `skills/`.
> Edit the sources, not the copies.

## MCP

`.mcp.json` is checked in and read automatically by Claude Code. It ships empty; see
`docs/guides/mcp.md` for ready-to-paste server configurations.
