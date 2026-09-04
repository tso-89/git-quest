# {{PROJECT_NAME}}

> {{PROJECT_DESCRIPTION}}

[![CI](https://github.com/org/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/org/repo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

{{PROJECT_DESCRIPTION}}

## Quick Start

```bash
# Clone
git clone https://github.com/org/repo.git
cd repo

# Install dependencies
{{CMD_INSTALL}}

# Copy environment template and fill in values
cp .env.example .env

# Run development server
{{CMD_DEV}}
```

Open [http://localhost:3000](http://localhost:3000).

## Documentation

| Document                              | Description                        |
|---------------------------------------|------------------------------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and component overview |
| [Coding Style](docs/guides/coding-style.md) | Code conventions and standards |
| [Testing Guide](docs/guides/testing.md) | How to write and run tests        |
| [Security Guide](docs/guides/security.md) | Security requirements            |
| [Git Workflow](docs/guides/git-workflow.md) | Branching, commits, and PR process |
| [ADRs](docs/ADR/)                    | Architecture Decision Records      |
| [Contributing](CONTRIBUTING.md)      | How to contribute to this project  |
| [Changelog](CHANGELOG.md)            | History of notable changes         |

## Development

```bash
{{CMD_DEV}}          # Start dev server with hot reload
{{CMD_TEST}}         # Run all tests
{{CMD_TEST}} --watch   # Tests in watch mode
{{CMD_LINT}}         # Lint code
{{CMD_FORMAT}}       # Auto-format code
{{CMD_BUILD}}        # Production build
```

## AI Agent Setup

Project rules live in **[AGENTS.md](AGENTS.md)** — one file, read by every agent.

| Agent | How it picks up the rules |
|-------|---------------------------|
| Claude Code | `CLAUDE.md` imports `AGENTS.md`; extras in `.claude/` |
| Codex | reads `AGENTS.md` directly |
| OpenCode | reads `AGENTS.md`; config in `opencode.json` |
| Antigravity | `GEMINI.md`; skills in `.agents/skills/` |
| Cursor / Windsurf | `.cursorrules` / `.windsurfrules` point at `AGENTS.md` |

Only the agents you selected at deploy time are present. Shared skills live in `skills/`.

```bash
# Fill in project placeholders (name, stack, commands)
python3 scripts/bootstrap-ai-project.py

# Check the agent configuration is valid
python3 scripts/validate-ai-config.py

# Optional: install git pre-commit hooks
bash scripts/setup-hooks.sh
```

## Project Structure

```
.
├── AGENTS.md           # Shared rules — read by every agent
├── skills/             # Portable agent skills
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ADR/            # Architecture decisions
│   ├── rules/          # Agent-facing rules (style, security, git)
│   ├── guides/         # Extended human guides
│   └── tests/          # Test registry
├── scripts/            # Bootstrap and validation
├── templates/          # Agent / skill / ADR templates
└── src/                # Application source
```

## Contributing

1. Fork and create a feature branch: `feat/<slug>`
2. Follow the [Coding Style Guide](docs/guides/coding-style.md)
3. Ensure all tests pass: `{{CMD_TEST}}`
4. Open a pull request with a clear description

## License

[MIT](LICENSE) — (c) {{YEAR}}
