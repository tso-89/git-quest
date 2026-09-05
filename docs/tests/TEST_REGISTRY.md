# Test Registry

> Integration and end-to-end tests are recorded here, along with anything they need to run.
> Unit tests are not listed — their names are the documentation.

Run everything with `npm run verify` before pushing — that lints, builds and runs both
suites. The end-to-end tests load the built `index.html` rather than the sources, so the
build always runs first.

## End-to-end

**File:** `tests/e2e/render.test.mjs`
**Runner:** `node --test` driving headless Chrome
**Under test:** `index.html` — the built single-file page that GitHub Pages serves

These are the only tests that exercise the DOM. Everything else runs the same modules in
Node with no browser.

### Requirements

| Requirement | Detail |
|-------------|--------|
| Browser | Chrome or Chromium. Looked up at `$CHROME_PATH`, then the standard macOS and Linux install paths. |
| Build | `index.html` must exist. `npm test`, `npm run test:e2e` and `npm run verify` build it first. |
| Network | None. The page is loaded over `file://`; the Google Fonts request fails harmlessly. |
| Fixtures | None. Each chapter seeds its own sandbox in code. |
| Environment variables | `CHROME_PATH` — optional; only needed when Chrome is somewhere non-standard. |

If no browser is found the whole file **skips** rather than fails, so a machine without
Chrome still gets a green unit run. There is no CI to catch that for you: if you are the
one pushing, make sure Chrome is installed, or set `CHROME_PATH`, so the skip does not
hide a regression from your readers.

### How they work

Each test appends a small script to a copy of the bundle, renders it with
`--headless --dump-dom`, and reads back whatever that script wrote into a `#HARNESS`
element. Anything the page throws during startup surfaces as a failed assertion, because
the harness element never appears.

### Cases

| Test | What it proves |
|------|----------------|
| the page boots and renders chapter 00 at rest | The app starts with no interaction: title, five quest steps, eleven map nodes, a live prompt, the seeded commit in the graph, and the quest card above the prose. |
| typing in the terminal drives the engine and ticks the quest | The full loop — keystroke, command, engine mutation, re-check, re-render — and that completing a chapter awards exactly its XP. |
| a commit redraws the history graph | The graph is derived from engine state after every command, and marks exactly one HEAD. |
| the agent chapter opens a third pane and the agent can be run | The layout grows to three columns for chapter 09, the agent applies its edits, and `git diff` exposes both things its summary omitted. |
| switching to a widget chapter renders its workbench | Widget chapters render their exercise, respond to clicks, and can switch to the terminal tab and back. |
| the rules builder generates a file and writes it into the sandbox | Form input regenerates the preview, the git rules are always present, and "Write into the repo" puts the correctly-named file into the working tree. |

### Known limitations

- Rendering is asserted structurally, not visually. There is no screenshot comparison, so a
  purely cosmetic regression would not be caught.
- Only one browser engine is covered. Safari and Firefox are not exercised.
- Each case spawns Chrome once, so the file takes roughly 12 seconds.

## Integration

None. The boundary between the model and the UI is thin enough that the unit tests and the
end-to-end tests meet in the middle with nothing left over.
