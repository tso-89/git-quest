# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-09-04

First release.

### Added

- Eleven chapters, each ending in a quest the learner completes by doing rather than reading.
- A simulated git engine with a working tree, staging area, commit graph, branches,
  three-way merges with real conflict markers, `revert`, `reset`, and a reflog.
- A terminal that understands a useful slice of `git`, `gh` and a POSIX shell, with command
  history, tab completion and clickable command references in the lesson text.
- A commit graph that redraws after every command, with lanes for branches and merges.
- Non-terminal exercises: a GitHub username validator, a commit-it-or-keep-it-out sorter,
  simulated GitHub Desktop and VS Code source-control panels, and a rules-file builder.
- An agent panel (chapter 09) that proposes a plausible change containing one thing its own
  summary does not mention, so the learner has to read the diff to find it.
- A rules-file generator for Claude Code, Claude Desktop, Google Antigravity and OpenAI
  Codex, emitting the correct filename for each and always including the git rules.
- Progress, XP, levels and a daily streak, stored in `localStorage` and safe when storage
  is unavailable.
- Light and dark themes, keyboard navigation, and a layout that collapses to one column.
- A dependency-free build that inlines everything into a single HTML file, plus a dev
  server that serves `src/` with no build step at all.
- 87 tests: unit coverage of the engine, commands, chapters, agents and progress, and
  end-to-end tests that drive the real UI in headless Chrome.

### Design

- Three directions were mocked up in `docs/design/mockups.html`. The shipped design is the
  quest structure from "Terminal Quest" with the slate-and-electric-blue palette from
  "The Workbench", which grows a third pane in chapter 09.
