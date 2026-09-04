/**
 * git-engine.js — a small, honest simulation of git.
 *
 * It models the three places a change can live (working tree, index, history)
 * the same way real git does, because the whole lesson depends on that model
 * being true. Commands live in commands.js; this file only holds state and the
 * operations on it.
 *
 * Loadable as a classic script tag (attaches to window.GQ) or required in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GQ = root.GQ || {};
    root.GQ.GitEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HOME = '/home/you';
  var EPOCH = Date.UTC(2026, 2, 3, 9, 12, 0);

  /** Deterministic 7-char hex id. Not sha-1 — it only has to look and behave like one. */
  function shortHash(input) {
    var h1 = 0x811c9dc5;
    var h2 = 0x01000193;
    for (var i = 0; i < input.length; i += 1) {
      h1 ^= input.charCodeAt(i);
      h1 = (h1 * 0x01000193) >>> 0;
      h2 = (h2 ^ (input.charCodeAt(i) + i)) >>> 0;
      h2 = (h2 * 0x85ebca6b) >>> 0;
    }
    return (h1.toString(16) + h2.toString(16)).slice(0, 7);
  }

  function clone(obj) {
    var out = {};
    Object.keys(obj).forEach(function (k) { out[k] = obj[k]; });
    return out;
  }

  function dirname(path) {
    var i = path.lastIndexOf('/');
    return i <= 0 ? '/' : path.slice(0, i);
  }

  function basename(path) {
    return path.slice(path.lastIndexOf('/') + 1);
  }

  /** Resolve a possibly-relative path against cwd. No symlinks, no `..` beyond root. */
  function resolvePath(cwd, input) {
    var raw = input;
    if (raw === '~' || raw.indexOf('~/') === 0) raw = HOME + raw.slice(1);
    var parts = (raw.charAt(0) === '/' ? raw : cwd + '/' + raw).split('/');
    var stack = [];
    parts.forEach(function (p) {
      if (p === '' || p === '.') return;
      if (p === '..') { stack.pop(); return; }
      stack.push(p);
    });
    return '/' + stack.join('/');
  }

  /** Does `path` sit inside `dir` (strictly below it)? */
  function isInside(dir, path) {
    return path.indexOf(dir + '/') === 0;
  }

  /**
   * Match a .gitignore-style pattern. Supports the three shapes a beginner
   * actually writes: `name`, `dir/`, and `*.ext`.
   */
  function ignoreMatches(pattern, relPath) {
    var p = pattern.trim();
    if (!p || p.charAt(0) === '#') return false;
    var segments = relPath.split('/');
    if (p.slice(-1) === '/') {
      var dir = p.slice(0, -1);
      return segments.slice(0, -1).indexOf(dir) !== -1;
    }
    if (p.indexOf('*') !== -1) {
      var rx = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$');
      return segments.some(function (s) { return rx.test(s); });
    }
    return segments.indexOf(p) !== -1 || relPath === p;
  }

  // ---------------------------------------------------------------- Engine

  function GitEngine(options) {
    var opts = options || {};
    this.cwd = opts.cwd || HOME;
    this.fs = opts.fs ? clone(opts.fs) : {};
    this.dirs = { '/': true, '/home': true };
    this.dirs[HOME] = true;
    this.repo = null;
    this.remotes = {};
    this.config = { 'user.name': 'you', 'user.email': 'you@example.com' };
    this.seq = 0;
    this.clock = EPOCH;
    this.listeners = [];
  }

  GitEngine.HOME = HOME;
  GitEngine.resolvePath = resolvePath;
  GitEngine.ignoreMatches = ignoreMatches;
  GitEngine.shortHash = shortHash;

  GitEngine.prototype.onChange = function (fn) {
    this.listeners.push(fn);
  };

  GitEngine.prototype.emit = function () {
    var self = this;
    this.listeners.forEach(function (fn) { fn(self); });
  };

  GitEngine.prototype.tick = function () {
    this.seq += 1;
    this.clock += 1000 * 60 * (7 + (this.seq % 5));
    return this.clock;
  };

  // ------------------------------------------------------------ filesystem

  GitEngine.prototype.writeFile = function (path, content) {
    var abs = resolvePath(this.cwd, path);
    this.fs[abs] = content;
    this.mkdirp(dirname(abs));
    return abs;
  };

  GitEngine.prototype.readFile = function (path) {
    var abs = resolvePath(this.cwd, path);
    return Object.prototype.hasOwnProperty.call(this.fs, abs) ? this.fs[abs] : null;
  };

  GitEngine.prototype.removeFile = function (path) {
    var abs = resolvePath(this.cwd, path);
    if (!Object.prototype.hasOwnProperty.call(this.fs, abs)) return false;
    delete this.fs[abs];
    return true;
  };

  GitEngine.prototype.mkdirp = function (path) {
    var parts = path.split('/').filter(Boolean);
    var acc = '';
    var self = this;
    parts.forEach(function (p) { acc += '/' + p; self.dirs[acc] = true; });
    this.dirs['/'] = true;
  };

  GitEngine.prototype.exists = function (path) {
    var abs = resolvePath(this.cwd, path);
    return Object.prototype.hasOwnProperty.call(this.fs, abs) || this.dirs[abs] === true;
  };

  GitEngine.prototype.isDir = function (path) {
    return this.dirs[resolvePath(this.cwd, path)] === true;
  };

  /** Immediate children of a directory, directories first, each as {name, type}. */
  GitEngine.prototype.list = function (path) {
    var abs = resolvePath(this.cwd, path || '.');
    var seen = {};
    var out = [];
    var prefix = abs === '/' ? '/' : abs + '/';
    Object.keys(this.dirs).forEach(function (d) {
      if (d.indexOf(prefix) !== 0) return;
      var rest = d.slice(prefix.length);
      if (!rest || rest.indexOf('/') !== -1) return;
      if (seen[rest]) return;
      seen[rest] = true;
      out.push({ name: rest, type: 'dir' });
    });
    Object.keys(this.fs).forEach(function (f) {
      if (f.indexOf(prefix) !== 0) return;
      var rest = f.slice(prefix.length);
      if (!rest || rest.indexOf('/') !== -1) return;
      if (seen[rest]) return;
      seen[rest] = true;
      out.push({ name: rest, type: 'file' });
    });
    return out.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name < b.name ? -1 : 1;
    });
  };

  // ------------------------------------------------------------------ repo

  /** The repository containing cwd, or null. */
  GitEngine.prototype.activeRepo = function () {
    if (!this.repo) return null;
    if (this.cwd === this.repo.root || isInside(this.repo.root, this.cwd)) return this.repo;
    return null;
  };

  GitEngine.prototype.init = function (root) {
    this.mkdirp(root);
    this.repo = {
      root: root,
      objects: {},
      branches: {},
      HEAD: { ref: 'main' },
      index: {},
      reflog: [],
      merging: null,
      remote: null
    };
    return this.repo;
  };

  /** Working-tree files as { relPath: content }, excluding ignored paths. */
  GitEngine.prototype.worktree = function () {
    var repo = this.activeRepo();
    if (!repo) return {};
    var out = {};
    var prefix = repo.root + '/';
    Object.keys(this.fs).forEach(function (abs) {
      if (abs.indexOf(prefix) !== 0) return;
      out[abs.slice(prefix.length)] = this.fs[abs];
    }, this);
    return out;
  };

  GitEngine.prototype.ignorePatterns = function () {
    var repo = this.activeRepo();
    if (!repo) return [];
    var raw = this.fs[repo.root + '/.gitignore'];
    if (!raw) return [];
    return raw.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  };

  GitEngine.prototype.isIgnored = function (relPath) {
    if (relPath === '.gitignore') return false;
    return this.ignorePatterns().some(function (p) { return ignoreMatches(p, relPath); });
  };

  GitEngine.prototype.headSha = function () {
    var repo = this.activeRepo();
    if (!repo) return null;
    if (repo.HEAD.sha) return repo.HEAD.sha;
    return repo.branches[repo.HEAD.ref] || null;
  };

  GitEngine.prototype.headCommit = function () {
    var sha = this.headSha();
    var repo = this.activeRepo();
    return sha && repo ? repo.objects[sha] : null;
  };

  GitEngine.prototype.headTree = function () {
    var commit = this.headCommit();
    return commit ? clone(commit.tree) : {};
  };

  GitEngine.prototype.currentBranch = function () {
    var repo = this.activeRepo();
    if (!repo) return null;
    return repo.HEAD.ref || null;
  };

  /**
   * status() is the heart of the lesson: it names the difference between
   * HEAD → index (staged) and index → working tree (not staged).
   */
  GitEngine.prototype.status = function () {
    var repo = this.activeRepo();
    if (!repo) return null;
    var head = this.headTree();
    var index = repo.index;
    var work = this.worktree();
    var staged = [];
    var unstaged = [];
    var untracked = [];
    var self = this;

    Object.keys(index).forEach(function (p) {
      if (!Object.prototype.hasOwnProperty.call(head, p)) staged.push({ path: p, state: 'new file' });
      else if (head[p] !== index[p]) staged.push({ path: p, state: 'modified' });
    });
    Object.keys(head).forEach(function (p) {
      if (!Object.prototype.hasOwnProperty.call(index, p)) staged.push({ path: p, state: 'deleted' });
    });

    Object.keys(index).forEach(function (p) {
      if (!Object.prototype.hasOwnProperty.call(work, p)) unstaged.push({ path: p, state: 'deleted' });
      else if (work[p] !== index[p]) unstaged.push({ path: p, state: 'modified' });
    });

    Object.keys(work).forEach(function (p) {
      if (Object.prototype.hasOwnProperty.call(index, p)) return;
      if (self.isIgnored(p)) return;
      untracked.push({ path: p, state: 'untracked' });
    });

    // A path in conflict is neither staged nor untracked: git calls it unmerged,
    // and refuses to commit while any remain.
    var unmerged = repo.merging ? repo.merging.conflicts.slice() : [];
    var notUnmerged = function (f) { return unmerged.indexOf(f.path) === -1; };
    if (unmerged.length) {
      staged = staged.filter(notUnmerged);
      unstaged = unstaged.filter(notUnmerged);
      untracked = untracked.filter(notUnmerged);
    }

    var byPath = function (a, b) { return a.path < b.path ? -1 : 1; };
    return {
      branch: this.currentBranch(),
      detached: !!repo.HEAD.sha,
      merging: repo.merging,
      unmerged: unmerged.map(function (p) { return { path: p, state: 'both modified' }; }),
      staged: staged.sort(byPath),
      unstaged: unstaged.sort(byPath),
      untracked: untracked.sort(byPath),
      clean: !staged.length && !unstaged.length && !untracked.length && !unmerged.length,
      ahead: this.aheadCount()
    };
  };

  /** How many commits the local branch has that the remote does not. */
  GitEngine.prototype.aheadCount = function () {
    var repo = this.activeRepo();
    if (!repo || !repo.remote) return 0;
    var branch = this.currentBranch();
    if (!branch) return 0;
    var remoteSha = this.remotes[repo.remote] && this.remotes[repo.remote].branches[branch];
    var localSha = repo.branches[branch];
    if (!localSha) return 0;
    var chain = this.ancestry(localSha);
    var idx = chain.indexOf(remoteSha);
    return idx === -1 ? chain.length : idx;
  };

  /** Newest-first list of commit shas reachable from `sha` (first-parent then merges). */
  GitEngine.prototype.ancestry = function (sha) {
    var repo = this.activeRepo();
    if (!repo || !sha) return [];
    var seen = {};
    var order = [];
    var queue = [sha];
    while (queue.length) {
      var cur = queue.shift();
      if (!cur || seen[cur] || !repo.objects[cur]) continue;
      seen[cur] = true;
      order.push(cur);
      repo.objects[cur].parents.forEach(function (p) { queue.push(p); });
    }
    return order;
  };

  GitEngine.prototype.stage = function (relPath) {
    var repo = this.activeRepo();
    var work = this.worktree();
    if (Object.prototype.hasOwnProperty.call(work, relPath)) {
      repo.index[relPath] = work[relPath];
    } else {
      delete repo.index[relPath];
    }
  };

  GitEngine.prototype.unstage = function (relPath) {
    var repo = this.activeRepo();
    var head = this.headTree();
    if (Object.prototype.hasOwnProperty.call(head, relPath)) repo.index[relPath] = head[relPath];
    else delete repo.index[relPath];
  };

  GitEngine.prototype.commit = function (message, extraParents) {
    var repo = this.activeRepo();
    var parents = [];
    var headSha = this.headSha();
    if (headSha) parents.push(headSha);
    (extraParents || []).forEach(function (p) { if (p) parents.push(p); });

    var date = this.tick();
    var sha = shortHash(JSON.stringify({ p: parents, m: message, t: repo.index, s: this.seq }));
    repo.objects[sha] = {
      sha: sha,
      parents: parents,
      message: message,
      tree: clone(repo.index),
      author: this.config['user.name'],
      email: this.config['user.email'],
      date: date
    };
    if (repo.HEAD.ref) repo.branches[repo.HEAD.ref] = sha;
    else repo.HEAD.sha = sha;
    this.log('commit', sha, message);
    repo.merging = null;
    return repo.objects[sha];
  };

  GitEngine.prototype.log = function (action, sha, message) {
    var repo = this.activeRepo();
    if (!repo) return;
    repo.reflog.unshift({ sha: sha, action: action, message: message, n: repo.reflog.length });
  };

  /** Replace working tree + index with a commit's tree. Used by switch/reset --hard. */
  GitEngine.prototype.checkoutTree = function (tree, opts) {
    var repo = this.activeRepo();
    var options = opts || {};
    var work = this.worktree();
    var self = this;
    Object.keys(work).forEach(function (p) {
      if (options.keepUntracked && !Object.prototype.hasOwnProperty.call(repo.index, p)) return;
      delete self.fs[repo.root + '/' + p];
    });
    Object.keys(tree).forEach(function (p) {
      self.fs[repo.root + '/' + p] = tree[p];
      self.mkdirp(dirname(repo.root + '/' + p));
    });
    repo.index = clone(tree);
  };

  GitEngine.prototype.resolveRef = function (ref) {
    var repo = this.activeRepo();
    if (!repo) return null;
    if (ref === 'HEAD') return this.headSha();
    if (Object.prototype.hasOwnProperty.call(repo.branches, ref)) return repo.branches[ref];
    var m = /^HEAD~(\d+)$/.exec(ref);
    if (m) {
      var chain = this.ancestry(this.headSha());
      return chain[Number(m[1])] || null;
    }
    if (ref === 'HEAD^') {
      var head = this.headCommit();
      return head && head.parents[0] ? head.parents[0] : null;
    }
    if (repo.objects[ref]) return ref;
    var hit = Object.keys(repo.objects).filter(function (s) { return s.indexOf(ref) === 0; });
    return hit.length === 1 ? hit[0] : null;
  };

  /** Nearest commit reachable from both. */
  GitEngine.prototype.mergeBase = function (a, b) {
    var chainA = this.ancestry(a);
    var chainB = this.ancestry(b);
    for (var i = 0; i < chainA.length; i += 1) {
      if (chainB.indexOf(chainA[i]) !== -1) return chainA[i];
    }
    return null;
  };

  /**
   * Three-way merge of file trees. Returns { tree, conflicts }.
   * A file changed on one side only is taken from that side; changed on both,
   * differently, is a conflict written with the markers the learner will meet.
   */
  GitEngine.prototype.mergeTrees = function (base, ours, theirs, ourLabel, theirLabel) {
    var tree = {};
    var conflicts = [];
    var paths = {};
    [base, ours, theirs].forEach(function (t) {
      Object.keys(t).forEach(function (p) { paths[p] = true; });
    });
    Object.keys(paths).forEach(function (p) {
      var b = base[p];
      var o = ours[p];
      var t = theirs[p];
      if (o === t) { if (o !== undefined) tree[p] = o; return; }
      if (o === b) { if (t !== undefined) tree[p] = t; return; }
      if (t === b) { if (o !== undefined) tree[p] = o; return; }
      conflicts.push(p);
      tree[p] = '<<<<<<< ' + ourLabel + '\n'
        + (o === undefined ? '' : o + '\n')
        + '=======\n'
        + (t === undefined ? '' : t + '\n')
        + '>>>>>>> ' + theirLabel;
    });
    return { tree: tree, conflicts: conflicts };
  };

  GitEngine.prototype.snapshot = function () {
    return JSON.parse(JSON.stringify({
      cwd: this.cwd, fs: this.fs, dirs: this.dirs, repo: this.repo,
      remotes: this.remotes, config: this.config, seq: this.seq, clock: this.clock
    }));
  };

  GitEngine.prototype.restore = function (snap) {
    this.cwd = snap.cwd;
    this.fs = snap.fs;
    this.dirs = snap.dirs;
    this.repo = snap.repo;
    this.remotes = snap.remotes;
    this.config = snap.config;
    this.seq = snap.seq;
    this.clock = snap.clock;
  };

  return {
    GitEngine: GitEngine,
    resolvePath: resolvePath,
    ignoreMatches: ignoreMatches,
    shortHash: shortHash,
    basename: basename,
    dirname: dirname,
    HOME: HOME
  };
}));
