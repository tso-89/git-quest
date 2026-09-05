# Security Guide

> The actual threat model for this project. The condensed agent-facing rules are in
> [`docs/rules/security.md`](../rules/security.md).
>
> Read this before starting a security review. Most of what a general web-app checklist
> asks about does not exist here, and a review that starts from one wastes its effort on
> categories that are structurally absent.

## What this project is

Git Quest is a static, single-page, zero-dependency browser lesson.

- No server. `npm run dev` runs `scripts/serve.mjs` on `127.0.0.1` for local editing only.
- No accounts, no sessions, no authentication, no authorisation, no database.
- No network I/O from the page: no `fetch`, no `XMLHttpRequest`, no WebSocket, no
  `postMessage`, no URL or query-string parsing.
- No runtime dependencies. `package.json` has no `dependencies` and no `devDependencies`.
- Published by GitHub Pages straight from the branch, serving the committed root
  `index.html` that `npm run build` generates from `src/`.

## Trust boundaries

There are exactly two, and both carry input the learner supplies to themselves:

1. **The simulated terminal and the widgets.** Free-form text — commands, file contents,
   commit messages, branch names, a GitHub username, rules-file answers — reaches the DOM.
2. **`localStorage`.** Progress is read back on every visit and must be treated as
   untrusted: it can be absent, corrupt, crafted, or of the wrong type.

There is no second user, no shared origin, and nothing an attacker can reach that they do
not already control. That makes injection here a **robustness** problem rather than a
cross-user one — but the sinks are real, the escaping still has to be right, and a page
this `innerHTML`-heavy will not stay safe by accident.

## Where the risk actually is

### 1. XSS and DOM injection — the only high-value category

The UI is built by string concatenation into `innerHTML` and `insertAdjacentHTML`. Every
learner-controlled value must pass through the module's `esc()` on the way in.

- `esc()` lives in `app.js`, `widgets.js`, `terminal.js` and `graph.js`. All four escape
  `&`, `<`, `>` and `"`. The `"` matters: several sinks interpolate into an attribute
  (`data-cmd="…"`, `title="…"`, `class="…"`, `value="…"`).
- Raw-HTML sinks (`blockHtml`, `questHtml` in `app.js`) accept only static author-written
  strings from `chapters.js`. **Never build a block field by concatenating runtime data.**
- Forbidden outright, and currently absent: `eval`, `new Function`, `document.write`,
  `outerHTML`, string-argument `setTimeout`/`setInterval`, and inline `on*` attributes.
  Interaction is delegated `addEventListener` against `data-*` attributes.

When reviewing, trace each learner input to each sink and check the escape is applied and
correct for its context. That is the review.

### 2. `localStorage` is untrusted input

`progress.js` reads it inside `try`/`catch`, iterates the **defaults** key list so unknown
keys are discarded, and coerces types — numeric fields to numbers, strings to strings.
Keep it that way: an uncoerced `xp` reaches `innerHTML` on the finish screen, and an
uncoerced `chapter` yields `Chapters.list[NaN]` and a blank page.

### 3. Secrets in lesson content

The lesson teaches `.gitignore` by showing what a leaked key looks like, so key-shaped
strings appear in `src/js/chapters.js` and `src/js/widgets.js` **by design**. They must be
unmistakably fake — `sk_live_EXAMPLE_do_not_use_1234`, not a truncated real-looking key.
A plausible-looking prefix will trip GitHub secret scanning, trufflehog and gitleaks on a
public repository, and will make a reader think they found something.

Never commit `.env`, `*.pem`, `*.key`, or `.mcp.json` — `.gitignore` already excludes them.

### 4. Identities in lesson content

Placeholders only: `jamie-doe`, `acme`, `you@example.com`, `github.com/you`. Never a real
person's name, handle or email, including the repository owner's.

### 5. The build and the published artefact

- `scripts/build.mjs` inlines every local stylesheet and script into the root
  `index.html`, escaping any literal `</script` so an inlined source cannot close its own
  block. It throws if a local asset fails to inline.
- The committed root `index.html` must be byte-identical to a fresh `npm run build`. A
  commit that changes `src/` without rebuilding publishes a stale lesson.
  `bash scripts/setup-hooks.sh` makes git enforce this.
- `src/index.html` carries a `<meta>` CSP. GitHub Pages serves no custom headers, so a
  meta tag is the only option, and because the build inlines all scripts it must allow
  `'unsafe-inline'`. Its value is `default-src 'none'` and `connect-src 'none'`: even a
  successful injection has nowhere to send anything and cannot pull in remote script.

### 6. Third-party requests

Google Fonts is the **only** external request the page makes. It is a real dependency:
every visitor's IP and User-Agent reaches `fonts.googleapis.com` / `fonts.gstatic.com`,
and a compromise of that CSS endpoint yields arbitrary CSS on the page. The
"no dependencies" claim in `AGENTS.md` is about JavaScript, not the page. Self-hosting the
two WOFF2 families would remove it and make the offline `file://` story true.

Adding any other external resource — a CDN script, an analytics tag, a remote image —
needs an explicit decision, not a drive-by commit.

### 7. The dev server and the Python helpers

- `scripts/serve.mjs` binds `127.0.0.1`, normalises the request path and re-checks
  `startsWith(root)`. Keep both checks; the `startsWith` is the one doing the work.
- The Python scripts in `scripts/` must stay free of `subprocess` with `shell=True`,
  `os.system`, `yaml.load`, `eval`/`exec` and `pickle`, and must confine writes to
  `ROOT`-relative paths.

## Categories that do not apply

SQL injection, command injection, SSTI, XXE, authentication, authorisation, IDOR, session
handling, CSRF, rate limiting, CORS, file-upload validation, and dependency CVEs. There is
no server, no database, no template engine, no API and no dependency tree. Do not pad a
review with them — say they are inapplicable and move on.

## Reporting

Use the format in [`docs/rules/security.md`](../rules/security.md):

```
⚠️ SECURITY: [brief title]
Severity: Critical | High | Medium | Low
Location: [file:line]
Issue: [description]
Recommended fix: [suggestion]
```

Rate against the model above. A self-inflicted, same-origin issue with no second user is
Low or a defence-in-depth note — say so plainly rather than inflating it.
