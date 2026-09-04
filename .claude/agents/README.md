# Agents Index

> Specialized subagents for this project. Claude will automatically delegate to these agents
> based on their `description` field in each `.md` file.

## Available Agents

| Agent             | File                    | When Claude Delegates                                      |
|-------------------|-------------------------|------------------------------------------------------------|
| `coding-agent`    | `coding-agent.md`       | Writing new code, implementing features, building modules  |
| `code-reviewer`   | `code-reviewer.md`      | Reviewing, auditing, or analysing code quality             |
| `test-writer`     | `test-writer.md`        | Writing, generating, or improving tests                    |
| `debugger`        | `debugger.md`           | Debugging, tracing, or investigating bugs                  |
| `refactor-agent`  | `refactor-agent.md`     | Refactoring without changing behaviour                     |
| `docs-writer`     | `docs-writer.md`        | Writing or updating documentation, ADRs, READMEs           |
| `security-agent`  | `security-agent.md`     | Security reviews, vulnerability assessments, threat models |
| `ui-ux-agent`     | `ui-ux-agent.md`        | UI/UX design, component design, accessibility audits       |

## Adding a New Agent

1. Create a new file `<agent-name>.md` in this directory.
2. Add the required YAML frontmatter:

```yaml
---
name: agent-name
description: >
  Clear description of WHEN to use this agent.
  Claude uses this to decide when to delegate.
model: opus                      # optional — prefer aliases (opus/sonnet/haiku) over pinned IDs
tools: Read, Grep, Glob, Bash                      # optional — restrict to specific tools
---
```

3. Write the system prompt in Markdown below the frontmatter.
4. Restart your Claude Code session (or use `/agents` CLI command) to load the new agent.
5. Run `python scripts/validate-ai-config.py` to confirm the frontmatter is valid.

## Best Practices

- Give agents **non-overlapping** responsibilities.
- Write the `description` field as "use when…" — Claude reads this to decide when to delegate.
- Keep agent system prompts focused — they should know their domain deeply, not broadly.
- Test agents by explicitly invoking them: *"Use the code-reviewer agent to review `src/api/`"*.
