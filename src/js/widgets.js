/**
 * widgets.js — the interactive pieces that are not a terminal.
 *
 * Each widget writes into a shared state object and calls onChange, which is
 * what re-runs the chapter's quest checks. Widgets never grade themselves.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./agents.js'));
  else { root.GQ = root.GQ || {}; root.GQ.Widgets = factory(root.GQ.Agents); }
}(typeof self !== 'undefined' ? self : this, function (Agents) {
  'use strict';

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ------------------------------------------------------------- 01 username

  var USERNAME_RULES = [
    { id: 'len', label: '1 to 39 characters', test: function (v) { return v.length >= 1 && v.length <= 39; } },
    { id: 'chars', label: 'Letters, numbers and hyphens only', test: function (v) { return /^[A-Za-z0-9-]+$/.test(v); } },
    { id: 'edges', label: 'Does not start or end with a hyphen', test: function (v) { return !/^-|-$/.test(v); } },
    { id: 'double', label: 'No two hyphens in a row', test: function (v) { return !/--/.test(v); } },
    { id: 'dated', label: 'Nothing you will outgrow (a year, a job, a course)', test: function (v) { return !/(19|20)\d\d|(^|-)(intern|student|learning|temp|test)(-|$)/i.test(v); } }
  ];

  var ACCOUNT_STEPS = [
    { id: 'signup', label: 'Created the account', detail: 'github.com/signup — email, password, username, done.', href: 'https://github.com/signup' },
    { id: 'twofa', label: 'Turned on two-factor authentication', detail: 'Settings, then Password and authentication.', href: 'https://github.com/settings/security' },
    { id: 'email', label: 'Made my email address private', detail: 'Settings, then Emails, then "Keep my email addresses private".', href: 'https://github.com/settings/emails' }
  ];

  function usernameWidget(ctx) {
    var state = ctx.state;
    state.checks = state.checks || {};
    state.username = state.username || '';

    ctx.mount.innerHTML = ''
      + '<div class="w w-username">'
      + '  <div class="w-head"><span class="w-title">Claim your name</span>'
      + '    <span class="w-sub">github.com/<span data-u-preview>' + esc(state.username || 'your-name') + '</span></span></div>'
      + '  <div class="w-body">'
      + '    <label class="w-label" for="u-input">Try a username</label>'
      + '    <input id="u-input" class="w-input" data-u-input placeholder="e.g. jamie-doe" '
      + '           value="' + esc(state.username) + '" autocomplete="off" spellcheck="false" />'
      + '    <ul class="rulelist" data-u-rules></ul>'
      + '    <div class="w-divider"></div>'
      + '    <div class="w-label">Then do these three, for real</div>'
      + '    <ul class="checklist" data-u-checks></ul>'
      + '  </div>'
      + '</div>';

    var input = ctx.mount.querySelector('[data-u-input]');
    var rulesEl = ctx.mount.querySelector('[data-u-rules]');
    var checksEl = ctx.mount.querySelector('[data-u-checks]');
    var preview = ctx.mount.querySelector('[data-u-preview]');

    function renderRules() {
      var value = input.value.trim();
      var allPass = value.length > 0;
      rulesEl.innerHTML = USERNAME_RULES.map(function (rule) {
        var pass = value.length > 0 && rule.test(value);
        if (!pass) allPass = false;
        return '<li class="rule ' + (pass ? 'is-pass' : 'is-fail') + '">'
          + '<span class="rule-mark" aria-hidden="true">' + (pass ? '✓' : '·') + '</span>'
          + esc(rule.label) + '</li>';
      }).join('');
      preview.textContent = value || 'your-name';
      state.username = value;
      state.usernameValid = allPass;
      ctx.onChange();
    }

    function renderChecks() {
      checksEl.innerHTML = ACCOUNT_STEPS.map(function (step) {
        var done = !!state.checks[step.id];
        return '<li class="chk ' + (done ? 'is-done' : '') + '">'
          + '<button class="chk-box" data-check="' + step.id + '" aria-pressed="' + done + '">'
          + (done ? '✓' : '') + '</button>'
          + '<div class="chk-text"><span class="chk-label">' + esc(step.label) + '</span>'
          + '<span class="chk-detail">' + esc(step.detail) + '</span></div>'
          + '<a class="chk-link" href="' + step.href + '" target="_blank" rel="noopener noreferrer">Open ↗</a>'
          + '</li>';
      }).join('');
    }

    input.addEventListener('input', renderRules);
    checksEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-check]');
      if (!btn) return;
      var id = btn.getAttribute('data-check');
      state.checks[id] = !state.checks[id];
      renderChecks();
      ctx.onChange();
    });

    renderRules();
    renderChecks();
  }

  // --------------------------------------------------------------- 03 sorter

  var SORT_FILES = [
    { name: 'README.md', keep: true, why: 'Explains the project. The first thing anyone reads.' },
    { name: '.env', keep: false, why: 'Real credentials. Never, in any repository, public or private.' },
    { name: '.env.example', keep: true, why: 'Same keys, no values. It tells people what they need to fill in.' },
    { name: 'src/app.js', keep: true, why: 'It is the project.' },
    { name: 'node_modules/', keep: false, why: 'Thousands of files your package manager rebuilds in seconds.' },
    { name: 'id_rsa', keep: false, why: 'Your private SSH key. Worse than an API key — it is your identity.' },
    { name: 'package-lock.json', keep: true, why: 'Pins exact versions so everyone builds the same thing.' },
    { name: '.DS_Store', keep: false, why: 'macOS folder noise. Pure clutter in every diff.' },
    { name: 'docs/setup.md', keep: true, why: 'Documentation belongs beside the code it documents.' },
    { name: 'aws-credentials.json', keep: false, why: 'This is the one that ends up on the news, and on your bill.' }
  ];

  function sorterWidget(ctx) {
    var state = ctx.state;
    state.answers = state.answers || {};

    function render() {
      var correct = 0;
      var rows = SORT_FILES.map(function (f, i) {
        var answer = state.answers[f.name];
        var judged = answer !== undefined;
        var right = judged && answer === f.keep;
        if (right) correct += 1;
        return '<li class="sort-row ' + (judged ? (right ? 'is-right' : 'is-wrong') : '') + '">'
          + '<code class="sort-name">' + esc(f.name) + '</code>'
          + '<div class="sort-btns">'
          + '<button class="sort-b ' + (answer === true ? 'is-on' : '') + '" data-file="' + i + '" data-keep="1">Commit it</button>'
          + '<button class="sort-b ' + (answer === false ? 'is-on' : '') + '" data-file="' + i + '" data-keep="0">Keep it out</button>'
          + '</div>'
          + (judged
            ? '<p class="sort-why">' + (right ? '' : '<strong>Not quite. </strong>') + esc(f.why) + '</p>'
            : '')
          + '</li>';
      }).join('');

      var solved = correct === SORT_FILES.length;
      state.sorterSolved = solved;

      ctx.mount.innerHTML = ''
        + '<div class="w w-sorter">'
        + '  <div class="w-head"><span class="w-title">Commit it, or keep it out?</span>'
        + '    <span class="w-sub"><span class="' + (solved ? 'ok' : '') + '">' + correct + ' of ' + SORT_FILES.length + ' right</span></span></div>'
        + '  <ul class="sort-list">' + rows + '</ul>'
        + (solved
          ? '<p class="w-done">All ten. The pattern: <strong>secrets and rebuildable junk stay out; everything that describes the project goes in.</strong></p>'
          : '')
        + '</div>';
    }

    ctx.mount.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-file]');
      if (!btn) return;
      var file = SORT_FILES[Number(btn.getAttribute('data-file'))];
      state.answers[file.name] = btn.getAttribute('data-keep') === '1';
      render();
      ctx.onChange();
    });

    render();
  }

  // ------------------------------------------------------------------ 06 gui

  var GUI_FILES = [
    { name: 'notes.md', add: ['- Trunk-based development'], del: [] },
    { name: 'ideas.md', add: ['# Ideas', '', '- A CLI that reads git history out loud'], del: [] }
  ];

  var VSCODE_SPOTS = [
    { id: 'changes', label: 'Changed files — this is git status' },
    { id: 'stage', label: 'The + button — this is git add' },
    { id: 'message', label: 'The message box — this is -m' },
    { id: 'sync', label: 'The sync arrows — this is push and pull' }
  ];

  function guiWidget(ctx) {
    var state = ctx.state;
    state.tab = state.tab || 'desktop';
    state.staged = state.staged || {};
    state.summary = state.summary === undefined ? '' : state.summary;
    state.found = state.found || {};

    function counts() {
      var n = 0;
      Object.keys(state.staged).forEach(function (k) { if (state.staged[k]) n += 1; });
      return n;
    }

    function syncState() {
      state.guiStaged = counts();
      state.guiCommitted = !!state.committed;
      state.guiPushed = !!state.pushed;
      state.vscodeFound = Object.keys(state.found).filter(function (k) { return state.found[k]; }).length;
      ctx.onChange();
    }

    function desktopHtml() {
      var files = GUI_FILES.map(function (f, i) {
        var on = !!state.staged[f.name];
        return '<li class="gd-file">'
          + '<button class="gd-check ' + (on ? 'is-on' : '') + '" data-gd-file="' + i + '" '
          + 'aria-pressed="' + on + '" aria-label="Stage ' + esc(f.name) + '">' + (on ? '✓' : '') + '</button>'
          + '<span class="gd-name">' + esc(f.name) + '</span>'
          + '<span class="gd-badge">' + (f.del.length ? 'M' : 'A') + '</span></li>';
      }).join('');

      var diff = GUI_FILES.map(function (f) {
        return '<div class="gd-diff-file"><div class="gd-diff-head">' + esc(f.name) + '</div>'
          + f.add.map(function (l) {
            return '<div class="gd-l add"><span class="mk">+</span>' + esc(l || ' ') + '</div>';
          }).join('') + '</div>';
      }).join('');

      var canCommit = counts() > 0 && state.summary.trim().length > 2 && !state.committed;

      return ''
        + '<div class="gd">'
        + '  <div class="gd-top">'
        + '    <span class="gd-repo">▾ my-first-repo</span>'
        + '    <span class="gd-branch">⑂ main</span>'
        + '    <button class="gd-push ' + (state.committed && !state.pushed ? 'is-ready' : '') + '" data-gd-push '
        + (state.committed && !state.pushed ? '' : 'disabled') + '>'
        + (state.pushed ? '✓ Pushed' : 'Push origin ' + (state.committed ? '↑ 1' : '')) + '</button>'
        + '  </div>'
        + '  <div class="gd-body">'
        + '    <div class="gd-side">'
        + '      <div class="gd-side-h">' + (state.committed ? '0' : GUI_FILES.length) + ' changed files</div>'
        + '      <ul class="gd-files">' + (state.committed ? '<li class="gd-empty">No local changes</li>' : files) + '</ul>'
        + '      <div class="gd-commit">'
        + '        <input class="gd-summary" data-gd-summary placeholder="Summary (required)" '
        + '               value="' + esc(state.summary) + '" aria-label="Commit summary" '
        + (state.committed ? 'disabled' : '') + ' />'
        + '        <button class="gd-btn" data-gd-commit ' + (canCommit ? '' : 'disabled') + '>'
        + (state.committed ? '✓ Committed to main' : 'Commit ' + counts() + ' file to main') + '</button>'
        + '      </div>'
        + '    </div>'
        + '    <div class="gd-main">' + (state.committed
          ? '<p class="gd-note">Committed. The changes moved from the left panel into history — exactly what <code>git commit</code> did in the terminal.</p>'
          : diff) + '</div>'
        + '  </div>'
        + '</div>';
    }

    function vscodeHtml() {
      var found = state.found;
      return ''
        + '<div class="vs">'
        + '  <div class="vs-top"><span class="vs-t">Explorer</span><span class="vs-t is-on">Source Control</span>'
        + '    <span class="vs-hint">' + Object.keys(found).filter(function (k) { return found[k]; }).length
        + ' of 4 found</span></div>'
        + '  <div class="vs-body">'
        + '    <div class="vs-panel">'
        + '      <button class="vs-spot ' + (found.message ? 'is-found' : '') + '" data-vs="message">'
        + '        <span class="vs-msgbox">Message (Ctrl+Enter to commit)</span></button>'
        + '      <div class="vs-section">'
        + '        <button class="vs-spot vs-inline ' + (found.changes ? 'is-found' : '') + '" data-vs="changes">Changes  2</button>'
        + '      </div>'
        + '      <div class="vs-row"><span class="vs-file">notes.md</span>'
        + '        <button class="vs-spot vs-plus ' + (found.stage ? 'is-found' : '') + '" data-vs="stage">+</button>'
        + '        <span class="vs-m">M</span></div>'
        + '      <div class="vs-row"><span class="vs-file">ideas.md</span><span class="vs-u">U</span></div>'
        + '    </div>'
        + '    <div class="vs-status">'
        + '      <span class="vs-br">⑂ main</span>'
        + '      <button class="vs-spot vs-sync ' + (found.sync ? 'is-found' : '') + '" data-vs="sync">↻ 1↑ 0↓</button>'
        + '    </div>'
        + '  </div>'
        + '  <ul class="vs-legend">' + VSCODE_SPOTS.map(function (s) {
          return '<li class="' + (found[s.id] ? 'is-found' : '') + '">' + esc(s.label) + '</li>';
        }).join('') + '</ul>'
        + '</div>';
    }

    function render() {
      ctx.mount.innerHTML = ''
        + '<div class="w w-gui">'
        + '  <div class="w-tabs">'
        + '    <button class="w-tab ' + (state.tab === 'desktop' ? 'is-on' : '') + '" data-gui-tab="desktop">GitHub Desktop</button>'
        + '    <button class="w-tab ' + (state.tab === 'vscode' ? 'is-on' : '') + '" data-gui-tab="vscode">VS Code</button>'
        + '  </div>'
        + (state.tab === 'desktop' ? desktopHtml() : vscodeHtml())
        + '</div>';
    }

    ctx.mount.addEventListener('click', function (e) {
      var tab = e.target.closest('[data-gui-tab]');
      if (tab) { state.tab = tab.getAttribute('data-gui-tab'); render(); return; }

      var file = e.target.closest('[data-gd-file]');
      if (file) {
        var f = GUI_FILES[Number(file.getAttribute('data-gd-file'))];
        state.staged[f.name] = !state.staged[f.name];
        render(); syncState(); return;
      }
      if (e.target.closest('[data-gd-commit]')) {
        state.committed = true;
        render(); syncState(); return;
      }
      if (e.target.closest('[data-gd-push]')) {
        state.pushed = true;
        render(); syncState(); return;
      }
      var spot = e.target.closest('[data-vs]');
      if (spot) {
        state.found[spot.getAttribute('data-vs')] = true;
        render(); syncState();
      }
    });

    ctx.mount.addEventListener('input', function (e) {
      if (e.target.matches('[data-gd-summary]')) {
        state.summary = e.target.value;
        var btn = ctx.mount.querySelector('[data-gd-commit]');
        if (btn) {
          btn.disabled = !(counts() > 0 && state.summary.trim().length > 2);
          btn.textContent = 'Commit ' + counts() + ' file to main';
        }
      }
    });

    render();
    syncState();
  }

  // ------------------------------------------------------------ 09 agent pane

  /** What the agent proposes. Two changes are good; two are not. */
  var AGENT_EDITS = {
    'notes.md': '# Notes\n\n- Read Pro Git chapters 1-3\n- Try worktrees\n- Review diffs before accepting them\n',
    'README.md': '# my-first-repo\n\nLearning git properly, finally.\n\n## Setup\n\n1. Copy secrets.env.example to secrets.env\n2. Run the app\n',
    '.gitignore': 'node_modules/\n.DS_Store\n',
    'app.js': 'const KEY = process.env.STRIPE_KEY;\n\nfunction charge(amount) {\n  console.log("charging", amount, "with", KEY);\n  return { amount: amount, key: KEY };\n}\n'
  };

  function agentWidget(ctx) {
    var state = ctx.state;
    var agentName = ctx.agentName || 'Claude Code';

    function render() {
      var ran = !!state.agentRan;
      ctx.mount.innerHTML = ''
        + '<div class="ap">'
        + '  <div class="ap-head"><span class="ap-t">Agent</span><span class="ap-pill">' + esc(agentName) + '</span></div>'
        + '  <div class="ap-thread">'
        + '    <div class="ap-msg"><div class="ap-who">You</div>'
        + '      Tidy up my notes, add setup steps to the readme, and clean up the gitignore.</div>'
        + (ran
          ? '<div class="ap-msg"><div class="ap-who is-agent">' + esc(agentName) + '</div>'
            + 'Done. I tidied <code>notes.md</code>, added a Setup section to <code>README.md</code>, '
            + 'and cleaned up <code>.gitignore</code>. Four files changed.</div>'
            + '<div class="ap-msg ap-summary"><div class="ap-who">Its summary says</div>'
            + '<ul class="ap-list"><li>notes.md &mdash; tidied</li><li>README.md &mdash; setup steps</li>'
            + '<li>.gitignore &mdash; cleaned up</li></ul>'
            + '<p class="ap-warn">Three bullets. Four files changed. Go and read the diff.</p></div>'
          : '<div class="ap-msg ap-idle">Waiting. Commit your own work first — then let it run.</div>')
        + '  </div>'
        + '  <div class="ap-act">'
        + (ran
          ? '<p class="ap-hint">Run <code>git diff</code> in the terminal. Everything it did is in there, '
            + 'including the parts it did not mention.</p>'
          : '<button class="ap-run" data-agent-run>Run the agent</button>'
            + '<p class="ap-hint">It will change four files in your working directory. Nothing is committed.</p>')
        + '  </div>'
        + '</div>';
    }

    ctx.mount.addEventListener('click', function (e) {
      if (!e.target.closest('[data-agent-run]')) return;
      var repo = ctx.engine.activeRepo();
      if (!repo) {
        var hint = ctx.mount.querySelector('.ap-hint');
        if (hint) hint.textContent = 'The agent works in a repository. cd back into my-first-repo in the Terminal tab first.';
        return;
      }
      Object.keys(AGENT_EDITS).forEach(function (path) {
        ctx.engine.writeFile(repo.root + '/' + path, AGENT_EDITS[path]);
      });
      state.agentRan = true;
      render();
      ctx.onChange();
    });

    render();
  }

  // ------------------------------------------------------------------ 10 rules

  function rulesWidget(ctx) {
    var state = ctx.state;
    state.selectedAgents = state.selectedAgents || [];
    state.answers = state.answers || {
      projectName: '', stack: '', testCommand: '', projectDescription: '',
      commitStyle: 'conventional', askBeforeCommit: true, noNewDeps: true
    };
    state.previewAgent = state.previewAgent || state.selectedAgents[0] || null;

    function generated(agentId) {
      return Agents.buildRulesFile(agentId, state.answers);
    }

    function render() {
      var picked = state.selectedAgents;
      if (picked.length && picked.indexOf(state.previewAgent) === -1) state.previewAgent = picked[0];
      var a = state.answers;

      var cards = Agents.list.map(function (agent) {
        var on = picked.indexOf(agent.id) !== -1;
        return '<button class="ag-card ' + (on ? 'is-on' : '') + '" data-agent="' + agent.id + '" aria-pressed="' + on + '">'
          + '<span class="ag-check">' + (on ? '✓' : '') + '</span>'
          + '<span class="ag-n">' + esc(agent.name) + '</span>'
          + '<code class="ag-f">' + esc(agent.file) + '</code></button>';
      }).join('');

      var preview = '';
      if (picked.length && state.previewAgent) {
        var tabs = picked.map(function (id) {
          return '<button class="w-tab ' + (id === state.previewAgent ? 'is-on' : '') + '" data-preview="' + id + '">'
            + esc(Agents.fileNameFor(id)) + '</button>';
        }).join('');
        preview = '<div class="w-divider"></div>'
          + '<div class="w-tabs w-tabs-sm">' + tabs + '</div>'
          + '<pre class="rules-out" data-rules-out>' + esc(generated(state.previewAgent)) + '</pre>'
          + '<div class="rules-actions">'
          + '  <button class="btn" data-rules-copy>Copy ' + esc(Agents.fileNameFor(state.previewAgent)) + '</button>'
          + '  <button class="btn btn-primary" data-rules-write>Write into the repo</button>'
          + '  <span class="rules-status" data-rules-status></span>'
          + '</div>';
      }

      ctx.mount.innerHTML = ''
        + '<div class="w w-rules">'
        + '  <div class="w-head"><span class="w-title">Your rules file</span>'
        + '    <span class="w-sub">' + (picked.length ? picked.length + ' agent' + (picked.length === 1 ? '' : 's') : 'pick at least one') + '</span></div>'
        + '  <div class="w-body">'
        + '    <div class="w-label">Which agents do you use?</div>'
        + '    <div class="ag-grid">' + cards + '</div>'
        + '    <div class="w-divider"></div>'
        + '    <div class="form-grid">'
        + '      <label class="w-label" for="r-name">Project name</label>'
        + '      <input id="r-name" class="w-input" data-r="projectName" value="' + esc(a.projectName) + '" placeholder="my-first-repo" />'
        + '      <label class="w-label" for="r-stack">Stack</label>'
        + '      <input id="r-stack" class="w-input" data-r="stack" value="' + esc(a.stack) + '" placeholder="TypeScript + React + Postgres" />'
        + '      <label class="w-label" for="r-test">How to run the tests</label>'
        + '      <input id="r-test" class="w-input" data-r="testCommand" value="' + esc(a.testCommand) + '" placeholder="npm test" />'
        + '      <label class="w-label" for="r-desc">One line: what it does</label>'
        + '      <input id="r-desc" class="w-input" data-r="projectDescription" value="' + esc(a.projectDescription) + '" placeholder="Tracks reading notes" />'
        + '    </div>'
        + '    <div class="w-label" style="margin-top:14px">Commit messages</div>'
        + '    <div class="seg">'
        + '      <button class="seg-b ' + (a.commitStyle === 'conventional' ? 'is-on' : '') + '" data-style="conventional">Conventional Commits</button>'
        + '      <button class="seg-b ' + (a.commitStyle === 'plain' ? 'is-on' : '') + '" data-style="plain">Plain sentences</button>'
        + '    </div>'
        + '    <ul class="toggles">'
        + '      <li><button class="tg ' + (a.askBeforeCommit ? 'is-on' : '') + '" data-toggle="askBeforeCommit" aria-pressed="' + !!a.askBeforeCommit + '"></button>'
        + '        <span>Show me the diff and wait before committing</span></li>'
        + '      <li><button class="tg ' + (a.noNewDeps ? 'is-on' : '') + '" data-toggle="noNewDeps" aria-pressed="' + !!a.noNewDeps + '"></button>'
        + '        <span>Ask before adding a new dependency</span></li>'
        + '    </ul>'
        + preview
        + '  </div>'
        + '</div>';
    }

    function status(message) {
      var el = ctx.mount.querySelector('[data-rules-status]');
      if (el) el.textContent = message;
    }

    ctx.mount.addEventListener('click', function (e) {
      var agent = e.target.closest('[data-agent]');
      if (agent) {
        var id = agent.getAttribute('data-agent');
        var i = state.selectedAgents.indexOf(id);
        if (i === -1) state.selectedAgents.push(id); else state.selectedAgents.splice(i, 1);
        render(); ctx.onChange(); return;
      }
      var pv = e.target.closest('[data-preview]');
      if (pv) { state.previewAgent = pv.getAttribute('data-preview'); render(); return; }
      var seg = e.target.closest('[data-style]');
      if (seg) { state.answers.commitStyle = seg.getAttribute('data-style'); render(); ctx.onChange(); return; }
      var tg = e.target.closest('[data-toggle]');
      if (tg) {
        var key = tg.getAttribute('data-toggle');
        state.answers[key] = !state.answers[key];
        render(); ctx.onChange(); return;
      }
      if (e.target.closest('[data-rules-copy]')) {
        var text = generated(state.previewAgent);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            status('Copied.');
          }, function () {
            status('Select the text above and copy it.');
          });
        } else {
          status('Select the text above and copy it.');
        }
        return;
      }
      if (e.target.closest('[data-rules-write]')) {
        var repo = ctx.engine.activeRepo();
        if (!repo) {
          status('No repository here — cd back into my-first-repo in the Terminal tab first.');
          return;
        }
        var root = repo.root;
        var written = [];
        state.selectedAgents.forEach(function (agentId) {
          var name = Agents.fileNameFor(agentId);
          if (written.indexOf(name) !== -1) return;
          ctx.engine.writeFile(root + '/' + name, generated(agentId));
          written.push(name);
        });
        status('Wrote ' + written.join(', ') + ' — now commit it in the Terminal tab.');
        ctx.onChange();
      }
    });

    ctx.mount.addEventListener('input', function (e) {
      var field = e.target.getAttribute && e.target.getAttribute('data-r');
      if (!field) return;
      state.answers[field] = e.target.value;
      var out = ctx.mount.querySelector('[data-rules-out]');
      if (out && state.previewAgent) out.textContent = generated(state.previewAgent);
      ctx.onChange();
    });

    render();
  }

  // ----------------------------------------------------------------- dispatch

  var registry = {
    username: usernameWidget,
    sorter: sorterWidget,
    gui: guiWidget,
    agent: agentWidget,
    rules: rulesWidget
  };

  function create(type, ctx) {
    var fn = registry[type];
    if (!fn) {
      ctx.mount.innerHTML = '<p class="graph-empty">Nothing to do here.</p>';
      return;
    }
    fn(ctx);
  }

  return {
    create: create,
    SORT_FILES: SORT_FILES,
    USERNAME_RULES: USERNAME_RULES,
    AGENT_EDITS: AGENT_EDITS
  };
}));
