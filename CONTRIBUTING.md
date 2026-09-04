# Contributing Guide

> Thanks for contributing! This guide covers everything you need to get started.

---

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/org/repo.git
cd repo
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your local values

# 3. Install git hooks (runs AI config validator + tests on commit)
bash scripts/setup-hooks.sh

# 4. Start the dev server
pnpm dev
```

---

## Development Workflow

1. **Create a branch** from `main` following the naming convention: `feat/<slug>`, `fix/<slug>`, etc. See [Git Workflow](docs/guides/git-workflow.md).
2. **Make your changes**, following the [Coding Style Guide](docs/guides/coding-style.md).
3. **Write tests** for any new behaviour. See [Testing Guide](docs/guides/testing.md).
4. **Run the full suite** before pushing:
   ```bash
   pnpm lint
   pnpm test
   python scripts/validate-ai-config.py
   ```
5. **Open a PR** — fill out the PR template completely. Draft PRs are welcome early.
6. **Address review feedback** — respond to every comment.

---

## AI Agent Setup

This project is pre-configured for **Google Antigravity** and **Claude Code**.

| Platform | Setup |
|----------|-------|
| Antigravity | Install the `agy` CLI; open the project — rules load from `GEMINI.md` and `.agents/` |
| Claude Code | Run `claude` in the project root — rules load from `CLAUDE.md` (which imports `AGENTS.md`) |
| Codex | Run `codex` in the project root — rules load from `AGENTS.md` |
| OpenCode | Run `opencode` in the project root — rules load from `AGENTS.md` and `opencode.json` |
| Cursor | Open the project — `.cursorrules` loads automatically |
| Windsurf | Open the project — `.windsurfrules` loads automatically |

No additional AI setup is required. Specialised agents and skills are pre-configured.

### Adding a New Agent or Skill

**For Claude Code** — create a new `.md` file in `.claude/agents/` with proper YAML frontmatter. Use `templates/agent-template.md` as a starting point.

**For Antigravity** — create a new directory under `.agents/skills/<name>/` containing a `SKILL.md` file. Use `templates/skill-template.md` as a starting point.

After adding either, run `python scripts/validate-ai-config.py` to confirm the frontmatter is valid.

---

## Code Standards

| Topic | Guide |
|-------|-------|
| Coding style | [docs/guides/coding-style.md](docs/guides/coding-style.md) |
| Testing | [docs/guides/testing.md](docs/guides/testing.md) |
| Security | [docs/guides/security.md](docs/guides/security.md) |
| Git workflow | [docs/guides/git-workflow.md](docs/guides/git-workflow.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |

---

## Documenting Tests

All tests must be registered in [`docs/tests/TEST_REGISTRY.md`](docs/tests/TEST_REGISTRY.md).
Add an entry when you create a new test file. See the registry for the required fields.

---

## Reporting Issues

Use the GitHub issue templates:
- **Bug report** — for unexpected behaviour, crashes, or incorrect output.
- **Feature request** — for new capabilities or improvements.

---

## Architecture Decisions

Significant design choices should be documented as [ADRs](docs/ADR/).
Use `templates/adr-template.md` as your starting point. See [ADR-001](docs/ADR/ADR-001-ai-tooling.md) for an example.

---

## Questions?

Open a [GitHub Discussion](https://github.com/org/repo/discussions) or ping the team in Slack.
