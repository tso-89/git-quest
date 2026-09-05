/**
 * commands.js — the shell the learner types into.
 *
 * Every command returns { lines: [{ text, cls }], ok } so the terminal never
 * has to know anything about git. Unsupported commands say so plainly rather
 * than failing silently — a beginner who mistypes should learn something.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./git-engine.js'));
  } else {
    root.GQ = root.GQ || {};
    root.GQ.Commands = factory(root.GQ.GitEngine);
  }
}(typeof self !== 'undefined' ? self : this, function (Engine) {
  'use strict';

  var resolvePath = Engine.resolvePath;
  var HOME = Engine.HOME;

  function out(text, cls) { return { text: text === undefined ? '' : text, cls: cls || 'out' }; }
  function ok(lines) { return { lines: lines || [], ok: true }; }
  function fail(lines) { return { lines: lines || [], ok: false }; }
  function err(text) { return fail([out(text, 'del')]); }

  /** Split a command line into tokens, honouring quotes. */
  function tokenize(line) {
    var tokens = [];
    var cur = '';
    var quote = null;
    var pushed = false;
    for (var i = 0; i < line.length; i += 1) {
      var ch = line.charAt(i);
      if (quote) {
        if (ch === quote) { quote = null; pushed = true; } else { cur += ch; }
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        pushed = true;
      } else if (/\s/.test(ch)) {
        if (cur || pushed) { tokens.push(cur); cur = ''; pushed = false; }
      } else {
        cur += ch;
      }
    }
    if (cur || pushed) tokens.push(cur);
    return tokens;
  }

  /** Pull a `> file` / `>> file` redirect off the end of the token list. */
  function extractRedirect(tokens) {
    for (var i = 0; i < tokens.length; i += 1) {
      if (tokens[i] === '>' || tokens[i] === '>>') {
        return {
          tokens: tokens.slice(0, i),
          redirect: { append: tokens[i] === '>>', target: tokens[i + 1] }
        };
      }
    }
    return { tokens: tokens, redirect: null };
  }

  function parse(line) {
    var r = extractRedirect(tokenize(line));
    var tokens = r.tokens;
    var flags = {};
    var args = [];
    tokens.slice(1).forEach(function (t, i) {
      if (t.charAt(0) === '-' && t.length > 1) {
        var eq = t.indexOf('=');
        if (eq !== -1) flags[t.slice(0, eq)] = t.slice(eq + 1);
        else flags[t] = true;
      } else {
        args.push(t);
      }
    });
    // keep the raw ordered tail so commands like `commit -m "msg"` can read values
    return { name: tokens[0], tokens: tokens, args: args, flags: flags, redirect: r.redirect };
  }

  /** Value following a flag, e.g. flagValue(tokens, '-m'). */
  function flagValue(tokens, flag) {
    var i = tokens.indexOf(flag);
    if (i === -1 || i === tokens.length - 1) return null;
    return tokens[i + 1];
  }

  // ---------------------------------------------------------------- diffing

  /** Longest-common-subsequence line diff. Small, but honest about what changed. */
  function diffLines(before, after) {
    var a = before === null || before === undefined ? [] : String(before).split('\n');
    var b = after === null || after === undefined ? [] : String(after).split('\n');
    var m = a.length;
    var n = b.length;
    var table = [];
    for (var i = 0; i <= m; i += 1) {
      var row = [];
      for (var k = 0; k <= n; k += 1) row.push(0);
      table.push(row);
    }
    for (i = m - 1; i >= 0; i -= 1) {
      for (var j = n - 1; j >= 0; j -= 1) {
        table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
    var result = [];
    i = 0; j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) { result.push({ op: ' ', text: a[i] }); i += 1; j += 1; }
      else if (table[i + 1][j] >= table[i][j + 1]) { result.push({ op: '-', text: a[i] }); i += 1; }
      else { result.push({ op: '+', text: b[j] }); j += 1; }
    }
    while (i < m) { result.push({ op: '-', text: a[i] }); i += 1; }
    while (j < n) { result.push({ op: '+', text: b[j] }); j += 1; }
    return result;
  }

  function renderDiff(path, before, after) {
    var lines = [];
    var changes = diffLines(before, after);
    if (!changes.some(function (c) { return c.op !== ' '; })) return lines;
    lines.push(out('diff --git a/' + path + ' b/' + path, 'bold'));
    if (before === null || before === undefined) lines.push(out('new file', 'dim'));
    if (after === null || after === undefined) lines.push(out('deleted file', 'dim'));
    lines.push(out('--- a/' + path, 'dim'));
    lines.push(out('+++ b/' + path, 'dim'));
    changes.forEach(function (c) {
      if (c.op === '+') lines.push(out('+' + c.text, 'add'));
      else if (c.op === '-') lines.push(out('-' + c.text, 'del'));
      else lines.push(out(' ' + c.text, 'dim'));
    });
    return lines;
  }

  function fmtDate(ms) {
    var d = new Date(ms);
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    return days[d.getUTCDay()] + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCDate()
      + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ' 2026 +0000';
  }

  // ----------------------------------------------------------- shell builtins

  var shell = {
    pwd: function (eng) { return ok([out(eng.cwd)]); },

    ls: function (eng, cmd) {
      var target = cmd.args[0] || '.';
      if (!eng.exists(target) && target !== '.') return err("ls: " + target + ": No such file or directory");
      var showAll = cmd.flags['-a'] || cmd.flags['-la'] || cmd.flags['-al'];
      var entries = eng.list(target);
      var repo = eng.activeRepo();
      if (showAll && repo && resolvePath(eng.cwd, target) === repo.root) {
        entries = [{ name: '.git', type: 'dir' }].concat(entries);
      }
      if (!entries.length) return ok([out('(empty)', 'dim')]);
      return ok([{
        text: entries.map(function (e) { return e.type === 'dir' ? e.name + '/' : e.name; }).join('   '),
        cls: 'out'
      }]);
    },

    cd: function (eng, cmd) {
      var target = cmd.args[0] || HOME;
      var abs = resolvePath(eng.cwd, target);
      if (!eng.isDir(abs)) return err('cd: ' + target + ': No such directory');
      eng.cwd = abs;
      return ok();
    },

    cat: function (eng, cmd) {
      if (!cmd.args.length) return err('cat: give it a filename');
      var content = eng.readFile(cmd.args[0]);
      if (content === null) return err('cat: ' + cmd.args[0] + ': No such file or directory');
      return ok(content.split('\n').map(function (l) { return out(l); }));
    },

    echo: function (eng, cmd) {
      var text = cmd.tokens.slice(1).join(' ');
      if (cmd.redirect) {
        var existing = cmd.redirect.append ? (eng.readFile(cmd.redirect.target) || '') : '';
        eng.writeFile(cmd.redirect.target, existing ? existing + '\n' + text : text);
        return ok();
      }
      return ok([out(text)]);
    },

    touch: function (eng, cmd) {
      if (!cmd.args.length) return err('touch: give it a filename');
      cmd.args.forEach(function (f) {
        if (eng.readFile(f) === null) eng.writeFile(f, '');
      });
      return ok();
    },

    mkdir: function (eng, cmd) {
      if (!cmd.args.length) return err('mkdir: give it a directory name');
      cmd.args.forEach(function (d) { eng.mkdirp(resolvePath(eng.cwd, d)); });
      return ok();
    },

    rm: function (eng, cmd) {
      if (!cmd.args.length) return err('rm: give it a filename');
      var missing = [];
      cmd.args.forEach(function (f) { if (!eng.removeFile(f)) missing.push(f); });
      if (missing.length) return err('rm: ' + missing.join(', ') + ': No such file');
      return ok();
    },

    clear: function () { return { lines: [], ok: true, clear: true }; },

    help: function () {
      return ok([
        out('This sandbox understands a useful slice of a real shell:', 'bold'),
        out(''),
        out('  files    ls  cat  echo "text" > file  touch  mkdir  rm  cd  pwd', 'accent'),
        out('  git      init  status  add  restore  commit  log  diff  show', 'accent'),
        out('           branch  switch  merge  reset  revert  reflog', 'accent'),
        out('           remote  push  pull  clone  config', 'accent'),
        out('  github   gh repo create  gh auth status', 'accent'),
        out(''),
        out('Nothing you type here touches your real computer.', 'dim'),
        out('Stuck? Press the Hint button on the quest card.', 'dim')
      ]);
    }
  };

  // -------------------------------------------------------------- git verbs

  function requireRepo(eng) {
    if (!eng.activeRepo()) {
      return err('fatal: not a git repository (or any of the parent directories): .git');
    }
    return null;
  }

  var git = {
    init: function (eng, cmd) {
      var target = cmd.args[0] ? resolvePath(eng.cwd, cmd.args[0]) : eng.cwd;
      if (Object.prototype.hasOwnProperty.call(eng.repos, target)) {
        return ok([out('Reinitialized existing Git repository in ' + target + '/.git/', 'dim')]);
      }
      eng.init(target);
      if (cmd.args[0]) eng.cwd = target;
      return ok([
        out('Initialized empty Git repository in ' + target + '/.git/', 'add'),
        out('A hidden .git folder now sits beside your files. That is the whole repository.', 'dim')
      ]);
    },

    status: function (eng) {
      var guard = requireRepo(eng); if (guard) return guard;
      var s = eng.status();
      var lines = [];
      lines.push(out('On branch ' + (s.branch || 'HEAD detached'), 'bold'));
      if (s.unmerged.length) {
        lines.push(out('You have unmerged paths.', 'warn'));
        lines.push(out('  (fix conflicts and then run "git commit")', 'dim'));
        lines.push(out('  (use "git add <file>..." to mark resolution)', 'dim'));
        lines.push(out(''));
        lines.push(out('Unmerged paths:'));
        s.unmerged.forEach(function (f) {
          lines.push(out('        ' + f.state + ':   ' + f.path, 'del'));
        });
      } else if (s.merging) {
        lines.push(out('All conflicts fixed but you are still merging.', 'warn'));
        lines.push(out('  (use "git commit" to conclude merge)', 'dim'));
      }
      if (s.ahead) lines.push(out("Your branch is ahead of 'origin/" + s.branch + "' by " + s.ahead + ' commit' + (s.ahead === 1 ? '' : 's') + '.', 'dim'));
      if (!eng.headSha() && !s.staged.length) lines.push(out('No commits yet', 'dim'));

      if (s.staged.length) {
        lines.push(out(''));
        lines.push(out('Changes to be committed:'));
        lines.push(out('  (use "git restore --staged <file>..." to unstage)', 'dim'));
        s.staged.forEach(function (f) { lines.push(out('        ' + f.state + ':   ' + f.path, 'add')); });
      }
      if (s.unstaged.length) {
        lines.push(out(''));
        lines.push(out('Changes not staged for commit:'));
        lines.push(out('  (use "git add <file>..." to include in what will be committed)', 'dim'));
        s.unstaged.forEach(function (f) { lines.push(out('        ' + f.state + ':   ' + f.path, 'del')); });
      }
      if (s.untracked.length) {
        lines.push(out(''));
        lines.push(out('Untracked files:'));
        lines.push(out('  (use "git add <file>..." to include in what will be committed)', 'dim'));
        s.untracked.forEach(function (f) { lines.push(out('        ' + f.path, 'del')); });
      }
      if (s.clean) {
        lines.push(out(''));
        lines.push(out('nothing to commit, working tree clean', 'add'));
      }
      return ok(lines);
    },

    add: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var all = !!(cmd.flags['-A'] || cmd.flags['--all']);
      if (!cmd.args.length && !all) return err('Nothing specified, nothing added.\nhint: Maybe you wanted to say "git add ."');
      var work = eng.worktree();
      var repo = eng.activeRepo();
      var staged = [];
      var refused = [];

      function stageEverything() {
        Object.keys(work).forEach(function (p) {
          if (eng.isIgnored(p)) return;
          eng.stage(p);
          staged.push(p);
        });
        Object.keys(repo.index).forEach(function (p) {
          if (!Object.prototype.hasOwnProperty.call(work, p)) { eng.stage(p); staged.push(p); }
        });
      }

      if (all) stageEverything();
      cmd.args.forEach(function (arg) {
        if (arg === '.' || arg === '*') {
          stageEverything();
          return;
        }
        var rel = arg.replace(/^\.\//, '');
        if (!Object.prototype.hasOwnProperty.call(work, rel)
          && !Object.prototype.hasOwnProperty.call(repo.index, rel)) {
          refused.push(rel);
          return;
        }
        eng.stage(rel);
        staged.push(rel);
      });
      if (refused.length) {
        return err("fatal: pathspec '" + refused[0] + "' did not match any files");
      }
      if (repo.merging) {
        repo.merging.conflicts = repo.merging.conflicts.filter(function (p) {
          return staged.indexOf(p) === -1;
        });
      }
      var lines = [];
      if (staged.length) {
        lines.push(out('Staged ' + staged.length + ' file' + (staged.length === 1 ? '' : 's') + '. Nothing is permanent yet.', 'dim'));
      }
      return ok(lines);
    },

    restore: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      var toStaged = !!cmd.flags['--staged'];
      if (!cmd.args.length) return err('fatal: you must specify path(s) to restore');
      var touched = [];
      cmd.args.forEach(function (arg) {
        var rel = arg.replace(/^\.\//, '');
        if (arg === '.') {
          Object.keys(repo.index).forEach(function (p) {
            if (toStaged) eng.unstage(p);
            else eng.fs[repo.root + '/' + p] = repo.index[p];
            touched.push(p);
          });
          return;
        }
        if (toStaged) { eng.unstage(rel); touched.push(rel); return; }
        if (!Object.prototype.hasOwnProperty.call(repo.index, rel)) {
          touched.push(null);
          return;
        }
        eng.fs[repo.root + '/' + rel] = repo.index[rel];
        touched.push(rel);
      });
      if (touched.indexOf(null) !== -1) {
        return err("error: pathspec did not match any file known to git");
      }
      return ok([out(toStaged
        ? 'Unstaged ' + touched.length + ' file(s). The edits are still on disk.'
        : 'Restored ' + touched.length + ' file(s) from the staging area.', 'add')]);
    },

    rm: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      if (cmd.flags['--cached']) {
        var cached = cmd.args.map(function (a) { return a.replace(/^\.\//, ''); });
        var unknown = cached.filter(function (a) {
          return !Object.prototype.hasOwnProperty.call(repo.index, a);
        });
        if (unknown.length) {
          return err("fatal: pathspec '" + unknown[0] + "' did not match any files");
        }
        cached.forEach(function (a) { delete repo.index[a]; });
        return ok([out("rm '" + cached.join("' '") + "'"),
          out('Removed from git, left on disk. This is how you un-commit a file you should not have added.', 'dim')]);
      }
      cmd.args.forEach(function (a) { eng.removeFile(a); delete repo.index[a]; });
      return ok([out("rm '" + cmd.args.join("' '") + "'")]);
    },

    commit: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      var message = flagValue(cmd.tokens, '-m') || flagValue(cmd.tokens, '--message');
      if (cmd.flags['-am'] || (cmd.flags['-a'] && cmd.tokens.indexOf('-m') !== -1)) {
        Object.keys(eng.worktree()).forEach(function (p) {
          if (Object.prototype.hasOwnProperty.call(repo.index, p)) eng.stage(p);
        });
        if (!message) message = flagValue(cmd.tokens, '-am');
      }
      if (!message) {
        return err('hint: no commit message given.\nUse:  git commit -m "what changed and why"');
      }
      var s = eng.status();
      if (s.unmerged.length) {
        return err('error: Committing is not possible because you have unmerged files.\n'
          + '  ' + s.unmerged.map(function (f) { return f.path; }).join('\n  ')
          + '\nhint: Fix them up in the work tree, then "git add" each one.');
      }
      if (!s.staged.length && !repo.merging) {
        var hint = s.unstaged.length || s.untracked.length
          ? 'nothing added to commit but untracked files present (use "git add")'
          : 'nothing to commit, working tree clean';
        return err('On branch ' + s.branch + '\n' + hint);
      }
      var extra = repo.merging ? [repo.merging.theirSha] : [];
      var commit = eng.commit(message, extra);
      var files = s.staged.length;
      var added = 0;
      var removed = 0;
      var head = commit.parents[0] ? repo.objects[commit.parents[0]].tree : {};
      s.staged.forEach(function (f) {
        diffLines(head[f.path], commit.tree[f.path]).forEach(function (c) {
          if (c.op === '+') added += 1;
          if (c.op === '-') removed += 1;
        });
      });
      return ok([
        out('[' + (s.branch || 'detached') + ' ' + commit.sha + '] ' + message, 'bold'),
        out(' ' + files + ' file' + (files === 1 ? '' : 's') + ' changed, '
          + added + ' insertion(+), ' + removed + ' deletion(-)', 'dim')
      ]);
    },

    log: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      var chain = eng.ancestry(eng.headSha());
      if (!chain.length) return err("fatal: your current branch 'main' does not have any commits yet");
      var oneline = cmd.flags['--oneline'];
      var limit = cmd.flags['-n'] ? Number(flagValue(cmd.tokens, '-n')) : chain.length;
      var lines = [];
      var branchesBySha = {};
      Object.keys(repo.branches).forEach(function (b) {
        branchesBySha[repo.branches[b]] = (branchesBySha[repo.branches[b]] || []).concat(b);
      });
      chain.slice(0, limit).forEach(function (sha, i) {
        var c = repo.objects[sha];
        var decoration = branchesBySha[sha] ? ' (' + branchesBySha[sha].join(', ') + (i === 0 ? ' -> HEAD' : '') + ')' : '';
        if (oneline) {
          lines.push({ text: sha + ' ' + c.message, cls: 'accent', decoration: decoration });
        } else {
          lines.push(out('commit ' + sha + decoration, 'accent'));
          if (c.parents.length > 1) lines.push(out('Merge: ' + c.parents.join(' '), 'dim'));
          lines.push(out('Author: ' + c.author + ' <' + c.email + '>', 'dim'));
          lines.push(out('Date:   ' + fmtDate(c.date), 'dim'));
          lines.push(out(''));
          lines.push(out('    ' + c.message));
          lines.push(out(''));
        }
      });
      return ok(lines);
    },

    show: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      var sha = eng.resolveRef(cmd.args[0] || 'HEAD');
      if (!sha) return err("fatal: bad revision '" + (cmd.args[0] || 'HEAD') + "'");
      var c = repo.objects[sha];
      var parentTree = c.parents[0] ? repo.objects[c.parents[0]].tree : {};
      var lines = [
        out('commit ' + sha, 'accent'),
        out('Author: ' + c.author + ' <' + c.email + '>', 'dim'),
        out('Date:   ' + fmtDate(c.date), 'dim'),
        out(''),
        out('    ' + c.message),
        out('')
      ];
      var paths = {};
      Object.keys(parentTree).concat(Object.keys(c.tree)).forEach(function (p) { paths[p] = true; });
      Object.keys(paths).sort().forEach(function (p) {
        renderDiff(p, parentTree[p], c.tree[p]).forEach(function (l) { lines.push(l); });
      });
      return ok(lines);
    },

    diff: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      var staged = cmd.flags['--staged'] || cmd.flags['--cached'];
      var from = staged ? eng.headTree() : repo.index;
      var to = staged ? repo.index : eng.worktree();
      var lines = [];
      var paths = {};
      Object.keys(from).concat(Object.keys(to)).forEach(function (p) { paths[p] = true; });
      Object.keys(paths).sort().forEach(function (p) {
        if (!staged && !Object.prototype.hasOwnProperty.call(repo.index, p)) return;
        renderDiff(p, from[p], to[p]).forEach(function (l) { lines.push(l); });
      });
      if (!lines.length) {
        return ok([out(staged
          ? 'Nothing staged. `git diff --staged` shows what a commit would contain.'
          : 'No unstaged changes. `git diff` shows edits you have not staged yet.', 'dim')]);
      }
      return ok(lines);
    },

    branch: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      if (cmd.flags['-d'] || cmd.flags['-D']) {
        var name = flagValue(cmd.tokens, cmd.flags['-d'] ? '-d' : '-D');
        if (name === eng.currentBranch()) return err("error: cannot delete branch '" + name + "' checked out");
        delete repo.branches[name];
        return ok([out('Deleted branch ' + name + '.')]);
      }
      if (!cmd.args.length) {
        var current = eng.currentBranch();
        return ok(Object.keys(repo.branches).sort().map(function (b) {
          return out((b === current ? '* ' : '  ') + b, b === current ? 'add' : 'out');
        }));
      }
      var newName = cmd.args[0];
      if (repo.branches[newName]) return err("fatal: a branch named '" + newName + "' already exists");
      var head = eng.headSha();
      if (!head) return err('fatal: not a valid object name: ' + (eng.currentBranch() || 'HEAD'));
      repo.branches[newName] = head;
      return ok([out("Created branch '" + newName + "'. It points at the same commit you are on.", 'dim')]);
    },

    switch: function (eng, cmd) { return checkoutBranch(eng, cmd, 'switch'); },
    checkout: function (eng, cmd) { return checkoutBranch(eng, cmd, 'checkout'); },

    merge: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      var theirName = cmd.args[0];
      if (!theirName) return err('fatal: no branch named for merge');
      var theirSha = cmd._sha || eng.resolveRef(theirName);
      if (!theirSha) return err("merge: " + theirName + " - not something we can merge");
      var ourSha = eng.headSha();
      if (ourSha === theirSha) return ok([out('Already up to date.', 'dim')]);

      var base = eng.mergeBase(ourSha, theirSha);
      if (base === ourSha) {
        repo.branches[eng.currentBranch()] = theirSha;
        eng.checkoutTree(repo.objects[theirSha].tree, { keepUntracked: true });
        eng.log('merge', theirSha, 'fast-forward to ' + theirName);
        return ok([
          out('Updating ' + ourSha + '..' + theirSha),
          out('Fast-forward', 'add'),
          out('No merge commit needed — your branch had not moved on.', 'dim')
        ]);
      }

      var merged = eng.mergeTrees(
        base ? repo.objects[base].tree : {},
        repo.objects[ourSha].tree,
        repo.objects[theirSha].tree,
        'HEAD',
        theirName
      );
      Object.keys(eng.worktree()).forEach(function (p) {
        if (!Object.prototype.hasOwnProperty.call(repo.index, p)) return;
        delete eng.fs[repo.root + '/' + p];
      });
      Object.keys(merged.tree).forEach(function (p) { eng.fs[repo.root + '/' + p] = merged.tree[p]; });

      if (merged.conflicts.length) {
        repo.merging = { theirSha: theirSha, theirName: theirName, conflicts: merged.conflicts };
        merged.conflicts.forEach(function (p) { delete repo.index[p]; });
        Object.keys(merged.tree).forEach(function (p) {
          if (merged.conflicts.indexOf(p) === -1) repo.index[p] = merged.tree[p];
        });
        var lines = [out('Auto-merging ' + merged.conflicts.join(', '), 'dim')];
        merged.conflicts.forEach(function (p) {
          lines.push(out('CONFLICT (content): Merge conflict in ' + p, 'del'));
        });
        lines.push(out('Automatic merge failed; fix conflicts and then commit the result.', 'warn'));
        lines.push(out('Open the file. Keep the lines you want, delete the <<<<<<< ======= >>>>>>> markers, then git add it.', 'dim'));
        return fail(lines);
      }

      repo.index = merged.tree;
      var mc = eng.commit("Merge branch '" + theirName + "'", [theirSha]);
      return ok([
        out('Merge made by the \'ort\' strategy.', 'add'),
        out('[' + eng.currentBranch() + ' ' + mc.sha + '] Merge branch \'' + theirName + "'", 'dim')
      ]);
    },

    reset: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      var mode = cmd.flags['--hard'] ? 'hard' : (cmd.flags['--soft'] ? 'soft' : 'mixed');
      var ref = cmd.args[0] || 'HEAD';
      var sha = eng.resolveRef(ref);
      if (!sha) return err("fatal: ambiguous argument '" + ref + "': unknown revision");
      var tree = repo.objects[sha].tree;
      if (repo.HEAD.ref) repo.branches[repo.HEAD.ref] = sha;
      else repo.HEAD.sha = sha;
      if (mode === 'mixed') repo.index = JSON.parse(JSON.stringify(tree));
      if (mode === 'hard') eng.checkoutTree(tree);
      eng.log('reset', sha, 'reset --' + mode + ' ' + ref);
      var note = {
        soft: 'HEAD moved. Your staging area and files are untouched.',
        mixed: 'HEAD moved and staging was reset. Your edits are still on disk.',
        hard: 'HEAD, staging and your files all moved. Anything uncommitted is gone — but see git reflog.'
      };
      return ok([
        out('HEAD is now at ' + sha + ' ' + repo.objects[sha].message),
        out(note[mode], mode === 'hard' ? 'warn' : 'dim')
      ]);
    },

    revert: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      var sha = eng.resolveRef(cmd.args[0] || 'HEAD');
      if (!sha) return err("fatal: bad revision '" + (cmd.args[0] || 'HEAD') + "'");
      var target = repo.objects[sha];
      var parentTree = target.parents[0] ? repo.objects[target.parents[0]].tree : {};
      var current = JSON.parse(JSON.stringify(repo.index));
      Object.keys(target.tree).forEach(function (p) {
        if (Object.prototype.hasOwnProperty.call(parentTree, p)) current[p] = parentTree[p];
        else delete current[p];
      });
      Object.keys(parentTree).forEach(function (p) { current[p] = parentTree[p]; });
      repo.index = current;
      eng.checkoutTree(current);
      var c = eng.commit('Revert "' + target.message + '"');
      return ok([
        out('[' + eng.currentBranch() + ' ' + c.sha + '] Revert "' + target.message + '"', 'add'),
        out('The old commit is still in your history. Revert undoes by adding, never by erasing.', 'dim')
      ]);
    },

    reflog: function (eng) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      if (!repo.reflog.length) return ok([out('No history yet.', 'dim')]);
      var lines = repo.reflog.map(function (e, i) {
        return out(e.sha + ' HEAD@{' + i + '}: ' + e.action + ': ' + e.message, i === 0 ? 'accent' : 'out');
      });
      lines.push(out(''));
      lines.push(out('Every one of these is still reachable. git reset --hard HEAD@{1} takes you back.', 'dim'));
      return ok(lines);
    },

    remote: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      if (cmd.args[0] === 'add') {
        var name = cmd.args[1];
        var url = cmd.args[2];
        if (!name || !url) return err('usage: git remote add <name> <url>');
        eng.remotes[name] = eng.remotes[name] || { url: url, branches: {}, objects: {} };
        eng.remotes[name].url = url;
        repo.remote = name;
        return ok([out("Remote '" + name + "' now points at " + url, 'dim')]);
      }
      if (!repo.remote) return ok([out('(no remotes yet — add one with git remote add origin <url>)', 'dim')]);
      return ok([out(repo.remote + '\t' + eng.remotes[repo.remote].url + ' (fetch)'),
        out(repo.remote + '\t' + eng.remotes[repo.remote].url + ' (push)')]);
    },

    push: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      if (!repo.remote) {
        return err("fatal: No configured push destination.\nhint: git remote add origin https://github.com/you/my-first-repo.git");
      }
      var branch = eng.currentBranch();
      if (!branch) return err('fatal: You are not currently on a branch.');
      var sha = repo.branches[branch];
      if (!sha) return err('error: src refspec ' + branch + ' does not match any');
      var remote = eng.remotes[repo.remote];
      var before = remote.branches[branch];
      var pushed = eng.aheadCount();
      remote.branches[branch] = sha;
      eng.ancestry(sha).forEach(function (s) { remote.objects[s] = repo.objects[s]; });
      return ok([
        out('Enumerating objects: ' + (pushed * 3 + 1) + ', done.', 'dim'),
        out('To ' + remote.url, 'dim'),
        out('   ' + (before ? before.slice(0, 7) + '..' + sha : '[new branch]      ' + branch + ' -> ' + branch), 'add'),
        out(pushed
          ? pushed + ' commit' + (pushed === 1 ? '' : 's') + ' are now on GitHub too. Your laptop is no longer the only copy.'
          : 'Everything up to date.', 'dim')
      ]);
    },

    pull: function (eng, cmd) {
      var guard = requireRepo(eng); if (guard) return guard;
      var repo = eng.activeRepo();
      if (!repo.remote) return err('fatal: no remote configured');
      var remote = eng.remotes[repo.remote];
      var branch = eng.currentBranch();
      var theirSha = remote.branches[branch];
      if (!theirSha) return ok([out('Already up to date.', 'dim')]);
      Object.keys(remote.objects).forEach(function (s) { repo.objects[s] = remote.objects[s]; });
      var ourSha = repo.branches[branch];
      if (ourSha === theirSha) return ok([out('Already up to date.', 'dim')]);
      return git.merge(eng, {
        args: [repo.remote + '/' + branch],
        flags: {},
        tokens: [],
        _sha: theirSha
      });
    },

    clone: function (eng, cmd) {
      var url = cmd.args[0];
      if (!url) return err('fatal: You must specify a repository to clone.');
      var name = cmd.args[1] || url.replace(/\.git$/, '').split('/').pop();
      var dest = resolvePath(eng.cwd, name);
      var source = eng.remotes.origin;
      if (!source) return err('fatal: repository \'' + url + '\' not found');
      eng.init(dest);
      var repo = eng.repo;
      repo.remote = 'origin';
      Object.keys(source.objects).forEach(function (s) { repo.objects[s] = source.objects[s]; });
      Object.keys(source.branches).forEach(function (b) { repo.branches[b] = source.branches[b]; });
      repo.HEAD = { ref: Object.keys(source.branches)[0] || 'main' };
      var prev = eng.cwd;
      eng.cwd = dest;
      eng.checkoutTree(eng.headTree());
      eng.cwd = prev;
      return ok([
        out("Cloning into '" + name + "'...", 'dim'),
        out('remote: Enumerating objects: ' + Object.keys(source.objects).length * 3 + ', done.', 'dim'),
        out('Receiving objects: 100%, done.', 'add'),
        out('You now have the full history — every commit, not just the latest files. cd ' + name, 'dim')
      ]);
    },

    config: function (eng, cmd) {
      var key = cmd.args[0];
      var value = cmd.args.slice(1).join(' ');
      if (!key) return ok(Object.keys(eng.config).map(function (k) { return out(k + '=' + eng.config[k]); }));
      if (!value) return ok([out(eng.config[key] === undefined ? '' : eng.config[key])]);
      eng.config[key] = value;
      return ok([out(key + ' set to ' + value, 'dim')]);
    }
  };

  function checkoutBranch(eng, cmd, verb) {
    var guard = requireRepo(eng); if (guard) return guard;
    var repo = eng.activeRepo();
    var create = cmd.flags['-c'] || cmd.flags['-b'];
    var name = cmd.args[0] || flagValue(cmd.tokens, '-c') || flagValue(cmd.tokens, '-b');
    if (!name) return err('fatal: missing branch name');

    if (create) {
      if (repo.branches[name]) return err("fatal: a branch named '" + name + "' already exists");
      var head = eng.headSha();
      if (!head) return err('fatal: you need at least one commit before branching');
      repo.branches[name] = head;
      repo.HEAD = { ref: name };
      eng.log('checkout', head, 'moving to ' + name);
      return ok([
        out("Switched to a new branch '" + name + "'", 'add'),
        out('Same files, different label. Nothing was copied — branches are cheap.', 'dim')
      ]);
    }

    var target = repo.branches[name];
    if (target === undefined) {
      var sha = eng.resolveRef(name);
      if (!sha) return err("error: pathspec '" + name + "' did not match any file(s) known to git");
      repo.HEAD = { sha: sha };
      eng.checkoutTree(repo.objects[sha].tree);
      eng.log('checkout', sha, 'detached at ' + sha);
      return ok([out("You are in 'detached HEAD' state at " + sha, 'warn'),
        out('Look around, then get back with: git switch ' + (Object.keys(repo.branches)[0] || 'main'), 'dim')]);
    }

    var s = eng.status();
    if (s.unstaged.length || s.staged.length) {
      return err('error: Your local changes would be overwritten by ' + verb + '.\nhint: commit them, or stash them, first.');
    }
    repo.HEAD = { ref: name };
    eng.checkoutTree(repo.objects[target].tree, { keepUntracked: true });
    eng.log('checkout', target, 'moving to ' + name);
    return ok([out("Switched to branch '" + name + "'", 'add')]);
  }

  // ----------------------------------------------------------- gh + dispatch

  var gh = {
    repo: function (eng, cmd) {
      if (cmd.args[1] !== 'create') return err('gh repo: try `gh repo create <name> --public`');
      var name = cmd.args[2] || 'my-first-repo';
      var visibility = cmd.flags['--private'] ? 'private' : (cmd.flags['--public'] ? 'public' : null);
      if (!visibility) {
        return err('gh repo create: choose one — add --public or --private.\nGitHub will not guess for you, and neither will this.');
      }
      var url = 'https://github.com/you/' + name + '.git';
      eng.remotes.origin = eng.remotes.origin || { url: url, branches: {}, objects: {} };
      eng.remotes.origin.url = url;
      if (eng.activeRepo()) eng.activeRepo().remote = 'origin';
      return ok([
        out('✓ Created ' + visibility + ' repository you/' + name + ' on GitHub', 'add'),
        out('✓ Added remote ' + url, 'add'),
        out(visibility === 'public'
          ? 'Public: anyone can read every file and every commit message, forever.'
          : 'Private: only you and people you invite can see it.', 'dim')
      ]);
    },
    auth: function () {
      return ok([
        out('github.com', 'bold'),
        out('  ✓ Logged in to github.com account you (keyring)', 'add'),
        out('  ✓ Token scopes: gist, read:org, repo', 'dim')
      ]);
    }
  };

  /** Run one line. Returns { lines, ok, clear }. */
  function run(eng, line) {
    var trimmed = String(line || '').trim();
    if (!trimmed) return ok();
    var cmd = parse(trimmed);

    if (cmd.name === 'git') {
      var verb = cmd.args[0];
      var sub = {
        name: 'git',
        tokens: cmd.tokens.slice(1),
        args: cmd.args.slice(1),
        flags: cmd.flags,
        redirect: cmd.redirect
      };
      if (!verb) return ok(shell.help(eng, cmd).lines);
      if (!Object.prototype.hasOwnProperty.call(git, verb)) {
        return err("git: '" + verb + "' is not supported in this sandbox.\nType `help` to see what is.");
      }
      return git[verb](eng, sub);
    }

    if (cmd.name === 'gh') {
      var ghVerb = cmd.args[0];
      if (!Object.prototype.hasOwnProperty.call(gh, ghVerb)) {
        return err("gh: '" + (ghVerb || '') + "' is not supported here. Try `gh repo create`.");
      }
      return gh[ghVerb](eng, cmd);
    }

    if (Object.prototype.hasOwnProperty.call(shell, cmd.name)) {
      return shell[cmd.name](eng, cmd);
    }

    return err(cmd.name + ': command not found. Type `help` for the list.');
  }

  return {
    run: run,
    parse: parse,
    tokenize: tokenize,
    diffLines: diffLines,
    renderDiff: renderDiff,
    fmtDate: fmtDate
  };
}));
