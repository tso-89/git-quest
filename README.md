# Git Quest

> An interactive git lesson for people who have never run `git init` — and who now work
> alongside AI coding agents that write code faster than they can read it.

[![CI](https://github.com/org/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/org/repo/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What it is

Eleven chapters, each ending in something the learner **does** rather than reads. The right
half of the screen is a working git sandbox — a real repository model with a working tree,
a staging area, commits, branches, merges, conflicts and a reflog — driven by a terminal
that understands a useful slice of `git`, `gh` and a shell.

Nothing is installed. Nothing touches the learner's machine. It is one HTML file.

| # | Chapter | What they do |
|---|---------|--------------|
| 00 | The twenty-second undo | Destroy a file, then get it back |
| 01 | A name you will still want in five years | Pick a username that passes GitHub's rules; open the account |
| 02 | A folder with a memory | `git init` a folder and make the first commit |
| 03 | Public, private, and the key you cannot unsee | Sort ten files into commit / keep-out, then write a `.gitignore` |
| 04 | Getting it onto GitHub | Create the remote, connect it, push |
| 05 | The loop you will run all day | Split two changes into two commits and push |
| 06 | The same loop, without typing | Do it again in a simulated GitHub Desktop and VS Code |
| 07 | Branches, and undoing anything | Branch, merge, revert, then find it in the reflog |
| 08 | When someone else has been editing | Resolve a real merge conflict by hand |
| 09 | Git when an agent is typing | Catch an agent doing something its summary omitted |
| 10 | Write the rules file | Generate `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` and commit it |

Chapters 09 and 10 personalise around the agents the learner picks: **Claude Code**,
**Claude Desktop**, **Google Antigravity** and **OpenAI Codex**.

## Quick Start

```bash
git clone https://github.com/org/repo.git
cd repo

# There are no dependencies to install.
npm run dev          # http://localhost:4173, serving src/ directly
```

Or build the single-file version and open it from disk:

```bash
npm run build        # writes dist/index.html
open dist/index.html
```

## Development

```bash
npm run dev          # dev server over src/, no build step
npm run build        # inline everything into dist/
npm test             # build, then unit + end-to-end tests
npm run test:unit    # logic only, no browser
npm run test:e2e     # headless Chrome against dist/index.html
npm run lint         # syntax check the files Node cannot import
```

Edit files in `src/` and reload. The browser sources are plain classic scripts, so there is
no bundler, no transpiler and no watch process.

`npm test` runs the end-to-end tests in headless Chrome. They skip automatically if no
Chrome binary is found; set `CHROME_PATH` to point at one.

## How it is put together

```
src/
├── index.html            # the app shell — header, lesson pane, work pane, agent pane
├── css/
│   ├── tokens.css        # palette, type scale, light and dark themes
│   └── app.css           # layout and components
└── js/
    ├── git-engine.js     # the repository model: working tree, index, commits, merges
    ├── commands.js       # the shell: parsing, git verbs, diffing, output
    ├── chapters.js       # all eleven chapters — prose, quests and their checks
    ├── agents.js         # agent facts and the rules-file generator
    ├── widgets.js        # the non-terminal exercises
    ├── terminal.js       # terminal UI: input, history, tab completion
    ├── graph.js          # the commit graph, redrawn after every command
    ├── progress.js       # XP, streak and completion in localStorage
    └── app.js            # wiring, rendering, quest evaluation
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how a keystroke becomes a quest tick,
and [docs/design/mockups.html](docs/design/mockups.html) for the three design directions
this was chosen from.

## Deploying

`dist/index.html` is a complete, self-contained page. Serve it from anywhere — GitHub
Pages, S3, a USB stick. The only external request is the Google Fonts stylesheet, and the
page falls back to system faces without it.

`dist/artifact.html` is the same page as a body fragment, for hosts that supply their own
document shell.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | How the sandbox, chapters and quest checks fit together |
| [Design mockups](docs/design/mockups.html) | The three directions, and why this one won |
| [Test registry](docs/tests/TEST_REGISTRY.md) | The end-to-end tests and what they need |
| [Coding Style](docs/guides/coding-style.md) | Code conventions |
| [Git Workflow](docs/guides/git-workflow.md) | Branching, commits, PRs |
| [ADRs](docs/ADR/) | Architecture Decision Records |
| [Changelog](CHANGELOG.md) | History of notable changes |

## Contributing

Adding a chapter means adding one object to `src/js/chapters.js`: a `setup` that seeds the
sandbox, some content blocks, and a quest whose steps are checked against engine state
rather than against the exact command the learner typed. The walkthrough tests in
`tests/unit/chapters.test.mjs` will hold you to it — every chapter must be provably
completable, and provably not complete before the learner does the work.

## License

[MIT](LICENSE) — (c) 2026
