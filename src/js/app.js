/**
 * app.js — wires the lesson together.
 *
 * Owns the current chapter's sandbox, renders the two (sometimes three) panes,
 * and re-runs the quest checks after every command or widget interaction.
 */
(function () {
  'use strict';

  var GitEngine = window.GQ.GitEngine.GitEngine;
  var Commands = window.GQ.Commands;
  var Chapters = window.GQ.Chapters;
  var Terminal = window.GQ.Terminal;
  var Graph = window.GQ.Graph;
  var Widgets = window.GQ.Widgets;
  var Agents = window.GQ.Agents;
  var Progress = window.GQ.Progress;
  var HOME = window.GQ.GitEngine.HOME;

  var state = Progress.touchStreak(Progress.load(), Date.now());
  Progress.save(state);

  var runtime = null;

  var el = {
    map: document.getElementById('chapter-map'),
    level: document.getElementById('hud-level'),
    xpBar: document.getElementById('hud-xp-bar'),
    xpText: document.getElementById('hud-xp-text'),
    streak: document.getElementById('hud-streak'),
    stage: document.getElementById('stage'),
    lesson: document.getElementById('lesson'),
    work: document.getElementById('work'),
    agentPane: document.getElementById('agent-pane'),
    reset: document.getElementById('btn-reset')
  };

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --------------------------------------------------------------- lesson HTML

  function traysHtml() {
    return ''
      + '<figure class="trays">'
      + '  <div class="tray"><div class="tray-h">Working directory</div>'
      + '    <p class="tray-p">Everything on disk right now. Git watches it and promises nothing about it.</p>'
      + '    <code class="tray-c">your editor</code></div>'
      + '  <div class="tray-arrow"><span>git add</span></div>'
      + '  <div class="tray"><div class="tray-h">Staging area</div>'
      + '    <p class="tray-p">The shortlist. What the next commit will contain — and nothing else.</p>'
      + '    <code class="tray-c">git add &lt;file&gt;</code></div>'
      + '  <div class="tray-arrow"><span>git commit</span></div>'
      + '  <div class="tray is-sealed"><div class="tray-h">History</div>'
      + '    <p class="tray-p">Sealed snapshots with your name and reason on them. It only grows.</p>'
      + '    <code class="tray-c">git commit -m "…"</code></div>'
      + '</figure>';
  }

  function agentFilesHtml() {
    return '<div class="agentfiles">' + Agents.list.map(function (a) {
      return '<div class="af">'
        + '<div class="af-h"><span class="af-n">' + esc(a.name) + '</span>'
        + '<code class="af-f">' + esc(a.file) + '</code></div>'
        + '<p class="af-w">' + esc(a.where) + '</p>'
        + '<p class="af-g">' + esc(a.gitNote) + '</p>'
        + '</div>';
    }).join('') + '</div>';
  }

  function blockHtml(block) {
    if (block.p) return '<p>' + block.p + '</p>';
    if (block.h) return '<h3>' + esc(block.h) + '</h3>';
    if (block.note) {
      return '<aside class="note note-' + (block.kind || 'tip') + '">'
        + '<span class="note-tag">' + (block.kind === 'warn' ? 'Careful' : block.kind === 'key' ? 'The idea' : 'Tip')
        + '</span><p>' + block.note + '</p></aside>';
    }
    if (block.code) {
      return '<pre class="codeblock">' + esc(block.code) + '</pre>';
    }
    if (block.cmds) {
      return '<div class="cmds"><div class="cmds-h">Commands for this chapter — click one to load it</div>'
        + block.cmds.map(function (c) {
          return '<button class="cmd" data-cmd="' + esc(c.cmd) + '">'
            + '<code>' + esc(c.cmd) + '</code><span>' + esc(c.desc) + '</span></button>';
        }).join('') + '</div>';
    }
    if (block.compare) {
      return '<table class="compare"><thead><tr>'
        + block.compare.heads.map(function (h) { return '<th>' + h + '</th>'; }).join('')
        + '</tr></thead><tbody>'
        + block.compare.rows.map(function (row) {
          return '<tr>' + row.map(function (cell) { return '<td>' + cell + '</td>'; }).join('') + '</tr>';
        }).join('')
        + '</tbody></table>';
    }
    if (block.trays) return traysHtml();
    if (block.agentFiles) return agentFilesHtml();
    return '';
  }

  function questHtml(chapter, results) {
    var done = results.filter(Boolean).length;
    var total = results.length;
    var complete = done === total;

    var steps = chapter.quest.steps.map(function (step, i) {
      var isDone = results[i];
      var isCurrent = !isDone && results.slice(0, i).every(Boolean);
      return '<li class="qs ' + (isDone ? 'is-done' : '') + (isCurrent ? ' is-current' : '') + '">'
        + '<span class="qs-mark" aria-hidden="true">' + (isDone ? '✓' : isCurrent ? '▸' : '') + '</span>'
        + '<div class="qs-body">'
        + '<span class="qs-label">' + esc(step.label) + '</span>'
        + (isDone ? '' : '<button class="qs-hint" data-hint="' + i + '">Hint</button>')
        + '<p class="qs-hint-text" data-hint-text="' + i + '" hidden>' + step.hint + '</p>'
        + '</div></li>';
    }).join('');

    return '<div class="quest ' + (complete ? 'is-complete' : '') + '">'
      + '<div class="quest-h"><span class="quest-tag">Quest</span>'
      + '<span class="quest-count">' + done + ' / ' + total + '</span></div>'
      + '<h4 class="quest-t">' + esc(chapter.quest.title) + '</h4>'
      + '<p class="quest-b">' + chapter.quest.brief + '</p>'
      + '<ul class="qs-list">' + steps + '</ul>'
      + (complete
        ? '<div class="quest-done">'
          + '<p class="quest-outro">' + chapter.outro + '</p>'
          + '<div class="quest-done-row">'
          + '<span class="xp-won">+' + chapter.xp + ' XP</span>'
          + (chapter.n < Chapters.list.length - 1
            ? '<button class="btn btn-primary" data-next>Next: ' + esc(Chapters.list[chapter.n + 1].title) + ' →</button>'
            : '<button class="btn btn-primary" data-finish>Finish the lesson</button>')
          + '</div></div>'
        : '')
      + '</div>';
  }

  function renderLesson() {
    var chapter = runtime.chapter;
    var results = runtime.results;
    el.lesson.innerHTML = ''
      + '<div class="lesson-inner">'
      + '  <div class="ch-eyebrow">Chapter ' + (chapter.n < 10 ? '0' : '') + chapter.n
      + (chapter.personalised ? ' <span class="ch-tag">personalised</span>' : '') + '</div>'
      + '  <h2 class="ch-title">' + esc(chapter.title) + '</h2>'
      + '  <p class="ch-sub">' + esc(chapter.subtitle) + '</p>'
      // The quest sits above the prose on purpose: the objective is what the
      // learner should see first, and the completion card should never be
      // something they have to scroll to find.
      + questHtml(chapter, results)
      + '  <div class="prose">' + chapter.blocks.map(blockHtml).join('') + '</div>'
      + '</div>';
    el.lesson.scrollTop = runtime.lessonScroll || 0;
  }

  // ----------------------------------------------------------------- work pane

  function workTabsHtml(chapter) {
    var tabs = [];
    if (chapter.widget) {
      tabs.push({ id: 'widget', label: widgetLabel(chapter.widget) });
    }
    tabs.push({ id: 'terminal', label: 'Terminal' });
    if (tabs.length === 1) return '';
    return '<div class="work-tabs">' + tabs.map(function (t) {
      return '<button class="work-tab ' + (runtime.pane === t.id ? 'is-on' : '') + '" data-pane="' + t.id + '">'
        + esc(t.label) + '</button>';
    }).join('') + '</div>';
  }

  function widgetLabel(type) {
    return {
      username: 'Sign-up',
      sorter: 'Sort the files',
      gui: 'Desktop clients',
      rules: 'Rules builder'
    }[type] || 'Workbench';
  }

  function renderWork() {
    var chapter = runtime.chapter;
    el.work.innerHTML = workTabsHtml(chapter)
      + '<div class="work-body" data-work-body></div>';
    var body = el.work.querySelector('[data-work-body]');

    if (runtime.pane === 'widget' && chapter.widget) {
      body.innerHTML = '<div class="widget-scroll" data-widget-mount></div>';
      Widgets.create(chapter.widget, {
        mount: body.querySelector('[data-widget-mount]'),
        engine: runtime.eng,
        state: runtime.widget,
        onChange: evaluate
      });
      return;
    }

    body.innerHTML = ''
      + '<div class="term" data-term></div>'
      + '<div class="graph"><div class="graph-h">Your history</div>'
      + '<div class="graph-body" data-graph></div></div>';

    runtime.terminal = Terminal.create({
      mount: body.querySelector('[data-term]'),
      engine: runtime.eng,
      commands: Commands,
      home: HOME,
      onCommand: function (line) {
        runtime.history.push(line.trim());
        drawGraph();
        evaluate();
      }
    });
    if (runtime.termBuffer && runtime.termBuffer.length) {
      runtime.terminal.print(runtime.termBuffer);
    } else {
      runtime.terminal.print([
        { text: 'Sandbox ready. Nothing here touches your machine.', cls: 'dim' },
        { text: 'Type `help` for what this shell understands.', cls: 'dim' },
        { text: '' }
      ]);
    }
    drawGraph();
    runtime.terminal.focus();
  }

  function drawGraph() {
    var target = el.work.querySelector('[data-graph]');
    if (target) target.innerHTML = Graph.render(runtime.eng);
  }

  function renderAgentPane() {
    var chapter = runtime.chapter;
    if (!chapter.agentPane) {
      el.agentPane.hidden = true;
      el.stage.classList.remove('has-agent');
      return;
    }
    el.agentPane.hidden = false;
    el.stage.classList.add('has-agent');
    var picked = state.agents && state.agents.length ? state.agents : ['claude-code'];
    var agent = Agents.byId(picked[0]) || Agents.list[0];
    Widgets.create('agent', {
      mount: el.agentPane,
      engine: runtime.eng,
      state: runtime.widget,
      agentName: agent.name,
      onChange: function () {
        drawGraph();
        evaluate();
      }
    });
  }

  // ------------------------------------------------------------------- header

  function renderHud() {
    var level = Progress.levelFor(state.xp);
    var progress = Progress.levelProgress(state.xp);
    el.level.textContent = 'LVL ' + level;
    el.xpBar.style.width = progress.pct + '%';
    el.xpText.textContent = state.xp + ' / ' + Chapters.totalXp + ' XP';
    el.streak.textContent = state.streak + '-day streak';

    el.map.innerHTML = Chapters.list.map(function (c) {
      var done = !!state.completed[c.id];
      var here = runtime && runtime.chapter.id === c.id;
      return '<button class="node ' + (done ? 'is-done' : '') + (here ? ' is-here' : '') + '"'
        + ' data-goto="' + c.n + '" title="' + esc(c.title) + '"'
        + ' aria-label="Chapter ' + c.n + ': ' + esc(c.title) + (done ? ' (complete)' : '') + '"'
        + ' aria-current="' + (here ? 'step' : 'false') + '">'
        + (done ? '✓' : (c.n < 10 ? '0' + c.n : c.n)) + '</button>';
    }).join('');
  }

  // ------------------------------------------------------------------- checks

  function evaluate() {
    var chapter = runtime.chapter;
    var ctx = {
      eng: runtime.eng,
      history: runtime.history,
      flags: runtime.flags,
      widget: runtime.widget
    };
    var results = chapter.quest.steps.map(function (step) {
      try {
        return !!step.check(ctx);
      } catch (e) {
        return false;
      }
    });
    var wasComplete = runtime.results.every(Boolean) && runtime.results.length > 0;
    runtime.results = results;
    var isComplete = results.every(Boolean);

    if (isComplete && !state.completed[chapter.id]) {
      state.completed[chapter.id] = true;
      state.xp += chapter.xp;
      Progress.save(state);
      renderHud();
      celebrate();
    } else if (isComplete !== wasComplete) {
      renderHud();
    }

    runtime.lessonScroll = el.lesson.scrollTop;
    renderLesson();
    return results;
  }

  function celebrate() {
    document.body.classList.add('is-levelled');
    window.setTimeout(function () { document.body.classList.remove('is-levelled'); }, 1400);
  }

  // -------------------------------------------------------------- chapter life

  function startChapter(index, opts) {
    var chapter = Chapters.list[Math.max(0, Math.min(index, Chapters.list.length - 1))];
    var eng = new GitEngine();
    chapter.setup(eng);

    runtime = {
      chapter: chapter,
      eng: eng,
      history: [],
      flags: {},
      widget: {},
      results: [],
      pane: chapter.pane === 'widget' && chapter.widget ? 'widget' : 'terminal',
      lessonScroll: 0
    };

    // Carry the learner's own answers into the personalised chapters.
    if (chapter.widget === 'rules') {
      runtime.widget.selectedAgents = (state.agents || []).slice();
      if (state.answers && Object.keys(state.answers).length) {
        runtime.widget.answers = JSON.parse(JSON.stringify(state.answers));
      }
    }
    if (chapter.widget === 'username' && state.username) {
      runtime.widget.username = state.username;
    }

    state.chapter = chapter.n;
    Progress.save(state);

    renderHud();
    renderWork();
    renderAgentPane();
    evaluate();
    if (!opts || !opts.keepScroll) el.lesson.scrollTop = 0;
    document.title = 'Git Quest — ' + chapter.title;
  }

  function persistAnswers() {
    if (!runtime || runtime.chapter.widget !== 'rules') return;
    if (runtime.widget.selectedAgents) state.agents = runtime.widget.selectedAgents.slice();
    if (runtime.widget.answers) state.answers = JSON.parse(JSON.stringify(runtime.widget.answers));
    if (runtime.widget.username) state.username = runtime.widget.username;
    Progress.save(state);
  }

  // ------------------------------------------------------------------ events

  el.map.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-goto]');
    if (!btn) return;
    persistAnswers();
    startChapter(Number(btn.getAttribute('data-goto')));
  });

  el.work.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-pane]');
    if (!tab) return;
    persistAnswers();
    if (runtime.pane === 'terminal' && runtime.terminal) {
      runtime.termBuffer = null;
    }
    runtime.pane = tab.getAttribute('data-pane');
    renderWork();
    evaluate();
  });

  el.lesson.addEventListener('click', function (e) {
    var cmd = e.target.closest('[data-cmd]');
    if (cmd) {
      if (runtime.pane !== 'terminal') {
        runtime.pane = 'terminal';
        renderWork();
      }
      if (runtime.terminal) runtime.terminal.setValue(cmd.getAttribute('data-cmd'));
      return;
    }
    var hint = e.target.closest('[data-hint]');
    if (hint) {
      var i = hint.getAttribute('data-hint');
      var text = el.lesson.querySelector('[data-hint-text="' + i + '"]');
      if (text) {
        text.hidden = !text.hidden;
        hint.textContent = text.hidden ? 'Hint' : 'Hide hint';
      }
      return;
    }
    if (e.target.closest('[data-next]')) {
      persistAnswers();
      startChapter(runtime.chapter.n + 1);
      return;
    }
    if (e.target.closest('[data-finish]')) {
      persistAnswers();
      showFinish();
    }
  });

  el.reset.addEventListener('click', function () {
    startChapter(runtime.chapter.n);
  });

  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input, textarea')) return;
    if (e.key === '[' && runtime.chapter.n > 0) startChapter(runtime.chapter.n - 1);
    if (e.key === ']' && runtime.chapter.n < Chapters.list.length - 1) startChapter(runtime.chapter.n + 1);
  });

  function showFinish() {
    var picked = (state.agents || []).map(function (id) {
      var a = Agents.byId(id);
      return a ? a.name + ' (' + Agents.fileNameFor(id) + ')' : id;
    });
    el.lesson.innerHTML = ''
      + '<div class="lesson-inner finish">'
      + '  <div class="ch-eyebrow">Complete</div>'
      + '  <h2 class="ch-title">You can use git now</h2>'
      + '  <p class="ch-sub">' + state.xp + ' XP, ' + Object.keys(state.completed).length
      + ' of ' + Chapters.list.length + ' chapters.</p>'
      + '  <div class="prose">'
      + '    <p>Everything below is a thing you actually did, not a thing you read:</p>'
      + '    <ul class="finish-list">'
      + '      <li>Recovered a file you destroyed on purpose</li>'
      + '      <li>Turned a folder into a repository and made your first commit</li>'
      + '      <li>Kept a live API key out of history with <code>.gitignore</code></li>'
      + '      <li>Pushed to GitHub and understood what <code>origin</code> means</li>'
      + '      <li>Ran the loop twice and split two ideas into two commits</li>'
      + '      <li>Did the same thing with buttons, and knew what they were doing</li>'
      + '      <li>Branched, merged, reverted, and found the commit again in the reflog</li>'
      + '      <li>Resolved a merge conflict by hand</li>'
      + '      <li>Caught an agent doing something its summary did not mention</li>'
      + '      <li>Wrote a rules file' + (picked.length ? ' for ' + esc(picked.join(' and ')) : '') + '</li>'
      + '    </ul>'
      + '    <h3>Do this next, today</h3>'
      + '    <p>Open a real terminal. <code>cd</code> into a folder you care about, run <code>git init</code>, '
      + '    write a <code>.gitignore</code>, and make one commit. The whole lesson was practice for those four minutes.</p>'
      + '    <p>Then paste your rules file into the same folder. The next agent that opens it will read your rules '
      + '    before it touches a single line.</p>'
      + '  </div>'
      + '  <div class="quest-done-row" style="margin-top:20px">'
      + '    <button class="btn" data-goto-start>Back to chapter 00</button>'
      + '    <button class="btn" data-wipe>Reset all progress</button>'
      + '  </div>'
      + '</div>';

    el.lesson.querySelector('[data-goto-start]').addEventListener('click', function () {
      startChapter(0);
    });
    el.lesson.querySelector('[data-wipe]').addEventListener('click', function () {
      state = Progress.touchStreak(Progress.reset(), Date.now());
      Progress.save(state);
      startChapter(0);
    });
  }

  startChapter(state.chapter || 0);
}());
