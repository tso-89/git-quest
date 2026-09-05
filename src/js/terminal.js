/**
 * terminal.js — the thing the learner actually types into.
 *
 * A real <input> rather than a contenteditable, so keyboard, screen readers and
 * mobile keyboards all behave. Output is a list of classed lines; the terminal
 * knows nothing about git beyond calling Commands.run.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.GQ = root.GQ || {}; root.GQ.Terminal = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERBS = [
    'git status', 'git add', 'git add .', 'git commit -m', 'git commit -am', 'git push',
    'git pull', 'git log', 'git log --oneline', 'git diff', 'git diff --staged',
    'git restore', 'git restore --staged', 'git switch', 'git switch -c', 'git branch',
    'git merge', 'git revert', 'git reset', 'git reset --hard', 'git reflog', 'git init',
    'git remote -v', 'git remote add', 'git show', 'git clone', 'git config',
    'gh repo create', 'gh auth status',
    'ls', 'ls -a', 'cat', 'cd', 'pwd', 'echo', 'touch', 'mkdir', 'rm', 'clear', 'help'
  ];

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function prettyCwd(cwd, home) {
    if (cwd === home) return '~';
    if (cwd.indexOf(home + '/') === 0) return '~' + cwd.slice(home.length);
    return cwd;
  }

  function create(options) {
    var mount = options.mount;
    var engine = options.engine;
    var commands = options.commands;
    var home = options.home || '/home/you';
    var placeholder = options.placeholder || '';
    var onCommand = options.onCommand || function () {};

    var history = [];
    var historyIndex = -1;

    mount.innerHTML = ''
      + '<div class="term-scroll" data-term-scroll>'
      + '  <div class="term-out" data-term-out aria-live="polite" aria-atomic="false"></div>'
      + '  <div class="term-line term-input-line">'
      + '    <span class="term-ps" data-term-ps></span>'
      + '    <input class="term-input" data-term-input autocomplete="off" autocorrect="off"'
      + '           autocapitalize="off" spellcheck="false"'
      + '           aria-label="Terminal command input" />'
      + '  </div>'
      + '</div>';

    var scroll = mount.querySelector('[data-term-scroll]');
    var outEl = mount.querySelector('[data-term-out]');
    var psEl = mount.querySelector('[data-term-ps]');
    var input = mount.querySelector('[data-term-input]');
    // Chapter 00 uses this to say "you can type in here" to someone who has
    // never seen a terminal and may not realise the line is an input at all.
    if (placeholder) input.placeholder = placeholder;

    function promptText() {
      return 'you@quest ' + prettyCwd(engine.cwd, home) + ' $';
    }

    function refreshPrompt() {
      psEl.textContent = promptText();
    }

    function scrollToEnd() {
      scroll.scrollTop = scroll.scrollHeight;
    }

    function print(lines) {
      var html = '';
      lines.forEach(function (line) {
        var text = line.text === '' ? '&nbsp;' : esc(line.text);
        var deco = line.decoration ? '<span class="t-ref">' + esc(line.decoration) + '</span>' : '';
        html += '<div class="term-line t-' + (line.cls || 'out') + '">' + text + deco + '</div>';
      });
      outEl.insertAdjacentHTML('beforeend', html);
      scrollToEnd();
    }

    function echoCommand(text) {
      outEl.insertAdjacentHTML('beforeend',
        '<div class="term-line t-echo"><span class="term-ps">' + esc(promptText()) + '</span> '
        + esc(text) + '</div>');
    }

    function run(text, opts) {
      var line = String(text || '');
      var silent = opts && opts.silent;
      if (!silent) echoCommand(line);
      if (!line.trim()) { refreshPrompt(); scrollToEnd(); return { ok: true, lines: [] }; }

      var result = commands.run(engine, line);
      if (result.clear) outEl.innerHTML = '';
      else print(result.lines);

      history.push(line);
      historyIndex = history.length;
      refreshPrompt();
      onCommand(line, result);
      return result;
    }

    /** Tab completion: commands first, then filenames in the current directory. */
    function complete() {
      var value = input.value;
      if (!value) return;
      var matches = VERBS.filter(function (v) { return v.indexOf(value) === 0 && v !== value; });
      if (!matches.length) {
        var parts = value.split(/\s+/);
        var stub = parts[parts.length - 1];
        var names = engine.list('.').map(function (e) { return e.name; });
        var hits = names.filter(function (n) { return stub && n.indexOf(stub) === 0 && n !== stub; });
        if (hits.length === 1) {
          parts[parts.length - 1] = hits[0];
          input.value = parts.join(' ');
        } else if (hits.length > 1) {
          print([{ text: hits.join('   '), cls: 'dim' }]);
        }
        return;
      }
      if (matches.length === 1) {
        input.value = matches[0] + ' ';
      } else {
        print([{ text: matches.join('   '), cls: 'dim' }]);
      }
    }

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        var value = input.value;
        input.value = '';
        run(value);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        complete();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!history.length) return;
        historyIndex = Math.max(0, historyIndex - 1);
        input.value = history[historyIndex] || '';
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!history.length) return;
        historyIndex = Math.min(history.length, historyIndex + 1);
        input.value = historyIndex === history.length ? '' : history[historyIndex];
      }
    });

    mount.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('a')) return;
      if (window.getSelection && String(window.getSelection()).length) return;
      input.focus();
    });

    refreshPrompt();

    return {
      run: run,
      print: print,
      focus: function () { input.focus(); },
      setValue: function (v) { input.value = v; input.focus(); },
      clear: function () { outEl.innerHTML = ''; refreshPrompt(); },
      history: function () { return history.slice(); },
      refreshPrompt: refreshPrompt
    };
  }

  return { create: create, VERBS: VERBS, prettyCwd: prettyCwd };
}));
