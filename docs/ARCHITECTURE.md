# Architecture Overview

> **Status:** Living document — update when significant structural changes occur.
> **Last Updated:** 2026-09-04

## System Purpose

Git Quest teaches version control to someone who has never run `git init`, and who is now
working alongside an AI agent that writes code faster than they can read it. It does this
by giving them a real repository model to play in, rather than screenshots of one.

Two constraints shaped everything below:

1. **It must open from a file.** No server, no install, no account, no network. A learner
   who cannot yet clone a repository should not have to clone a repository.
2. **The sandbox must be honest.** If the lesson teaches that a commit snapshots the index
   rather than the working tree, the engine has to actually behave that way — otherwise the
   first thing they do in a real terminal contradicts what they were taught.

## High-Level Architecture

```mermaid
flowchart TD
  subgraph ui[UI layer]
    terminal[terminal.js<br/>input, history, completion]
    widgets[widgets.js<br/>non-terminal exercises]
    graph[graph.js<br/>commit graph SVG]
    app[app.js<br/>render + orchestration]
  end

  subgraph model[Model layer]
    commands[commands.js<br/>shell + git verbs + diff]
    engine[git-engine.js<br/>repository state]
  end

  subgraph content[Content]
    chapters[chapters.js<br/>prose, quests, checks]
    agents[agents.js<br/>agent facts + rules generator]
  end

  store[(localStorage<br/>progress.js)]

  terminal -->|command line| commands
  commands -->|mutates| engine
  widgets -->|mutates| engine
  app -->|reads| engine
  app -->|renders| graph
  app -->|renders| terminal
  app -->|renders| widgets
  chapters -->|seeds| engine
  chapters -->|checks read| engine
  app -->|evaluates| chapters
  agents --> widgets
  agents --> chapters
  app <--> store
```

Dependencies point one way: **UI → model**, never the reverse. `git-engine.js` has no idea
a DOM exists, which is why the whole repository model is testable in Node with no browser.

## Component Breakdown

| Module | Owns | Knows about |
|--------|------|-------------|
| `git-engine.js` | The virtual filesystem, the repository (objects, refs, HEAD, index, reflog, remotes), status, merging, ancestry | Nothing else |
| `commands.js` | Tokenising a command line, every `git`/`gh`/shell verb, line diffing, output formatting | `git-engine.js` |
| `chapters.js` | The eleven chapters: sandbox seed, content blocks, quest steps and their checks | `git-engine.js` (through the ctx it is handed) |
| `agents.js` | What each agent reads, and the generated rules file | Nothing else |
| `widgets.js` | The five non-terminal exercises | `agents.js`, the engine it is handed |
| `terminal.js` | The terminal UI: prompt, echo, history, tab completion | The engine and command runner it is handed |
| `graph.js` | Laying out and drawing the commit graph | The engine it is handed |
| `progress.js` | XP, level, streak, completion, persistence | `localStorage`, defensively |
| `app.js` | Rendering the panes, chapter lifecycle, running the quest checks | All of the above |

## Data Flow

The interesting path is what happens between a keystroke and a quest step turning green.

1. The learner presses Enter. `terminal.js` echoes the line and calls `Commands.run`.
2. `commands.js` tokenises it, pulls off any `>` redirect, and dispatches to a verb.
3. The verb mutates `git-engine.js` state and returns classed output lines.
4. `terminal.js` prints them; `app.js` redraws the commit graph.
5. `app.js` calls `evaluate()`, which runs **every** quest step's `check(ctx)` against the
   current engine state.
6. The lesson pane re-renders with the new step states. If all steps pass and the chapter
   was not already complete, XP is awarded and progress is saved.

Widget interactions take the same path from step 5, with the widget writing into a shared
state object first.

### Why checks read state instead of matching commands

A step is satisfied by `check(ctx)` inspecting the engine, not by string-matching what was
typed. `rm story.md` and `echo "ruined" > story.md` both damage the file, and both should
count. Where a step genuinely is about running a particular command — `git status`, `ls -a`
— the check consults `ctx.history` instead.

Some steps describe a *sequence* rather than a state: "break it, then fix it" is not
visible in the final state, because the final state is identical to the starting one. Those
latch a flag on `ctx.flags` the first time they see the intermediate condition. This is why
`evaluate()` must run after every single command, and why the walkthrough tests do the same.

## Key Design Decisions

| Decision | Why |
|----------|-----|
| Simulated git rather than real git compiled to WASM | A real git would be megabytes, would need a filesystem shim anyway, and would give worse error messages than ones written for a beginner. The simulation is ~600 lines and every message can teach. |
| Classic `<script>` tags, not ES modules | ES modules are blocked by CORS on `file://`. Classic scripts let the same source run from disk, from a dev server, and inside the built bundle. |
| A UMD wrapper on every browser module | The same file loads in a browser and `require()`s in Node, so the engine, commands, chapters and agents are all unit-testable with no DOM and no dependencies. |
| Full snapshots per commit, not deltas | It is what git conceptually does, it makes checkout trivial, and the sizes involved are a few kilobytes of lesson text. |
| No runtime dependencies, no bundler | The deliverable is one HTML file that must still work in five years. |
| Progress in `localStorage`, guarded | Nothing here is worth an account. Every read and write is wrapped, because private windows and locked-down browsers throw rather than return null. |

See [`ADR/`](ADR/) for full records.

| ADR | Decision | Status |
|-----|----------|--------|
| [ADR-001](ADR/ADR-001-ai-tooling.md) | AI tooling configuration | Accepted |

## External Dependencies

None at runtime, with one soft exception: the Google Fonts stylesheet for IBM Plex Sans and
JetBrains Mono. Every font stack declares real system fallbacks, so the page is fully usable
offline or with the request blocked.

Development uses only what ships with Node 20+ (`node --test`, `node:http`, `node:fs`) and,
for the end-to-end tests, whatever Chrome or Chromium is already installed.

## Deployment

`npm run build` inlines every stylesheet and script into two outputs:

- `dist/index.html` — a complete standalone page. Host it anywhere static, or open it from
  disk.
- `dist/artifact.html` — the same page as a body fragment, for hosts that supply their own
  document shell.

There is no server component, so there is nothing to operate.

## Non-Functional Requirements

- **Works offline.** After first load, including the fonts, nothing is fetched.
- **Works from `file://`.** No CORS-dependent features.
- **Accessible.** Keyboard operable throughout, visible focus, `aria-live` terminal output,
  labelled controls, and `prefers-reduced-motion` respected.
- **Both themes.** Dark by default, with a complete light palette; every colour comes from a
  token defined in the base `:root` block.
- **Responsive.** Three panes collapse to two, then to one column under 900px.
- **Fast.** One file, no framework, no build at runtime.

## Glossary

| Term | Meaning here |
|------|--------------|
| **Chapter** | One lesson: a sandbox seed, content blocks, and a quest |
| **Quest** | The chapter's objective, as an ordered list of independently checked steps |
| **Check** | A function given `{ eng, history, flags, widget }` that returns whether a step is satisfied |
| **Sandbox** | A fresh `GitEngine` instance, seeded per chapter and reset by the Reset button |
| **Work pane** | The right-hand pane: terminal plus commit graph, or a widget |
| **Agent pane** | The third pane, present only in chapter 09 |
| **Widget** | A non-terminal exercise (username picker, sorter, GUI simulators, rules builder) |
