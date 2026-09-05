import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Engine = require('../../src/js/git-engine.js');
const { GitEngine, resolvePath, ignoreMatches, shortHash, HOME } = Engine;

function repoAt(path = `${HOME}/r`) {
  const eng = new GitEngine();
  eng.init(path);
  eng.cwd = path;
  return eng;
}

test('resolvePath handles absolute, relative, dot and tilde forms', () => {
  assert.equal(resolvePath('/a/b', 'c'), '/a/b/c');
  assert.equal(resolvePath('/a/b', '/x/y'), '/x/y');
  assert.equal(resolvePath('/a/b', '../c'), '/a/c');
  assert.equal(resolvePath('/a/b', './c/./d'), '/a/b/c/d');
  assert.equal(resolvePath('/a/b', '~'), HOME);
  assert.equal(resolvePath('/a/b', '~/p'), `${HOME}/p`);
});

test('resolvePath cannot escape above the root', () => {
  assert.equal(resolvePath('/', '../../../etc'), '/etc');
});

test('ignoreMatches supports the three shapes a beginner writes', () => {
  assert.ok(ignoreMatches('secrets.env', 'secrets.env'));
  assert.ok(ignoreMatches('node_modules/', 'node_modules/left-pad/index.js'));
  assert.ok(ignoreMatches('*.log', 'logs/debug.log'));
  assert.ok(!ignoreMatches('*.log', 'debug.logger'));
  assert.ok(!ignoreMatches('# a comment', 'anything'));
  assert.ok(!ignoreMatches('secrets.env', 'other.env'));
});

test('status separates staged, unstaged and untracked', () => {
  const eng = repoAt();
  eng.writeFile('a.md', 'one');
  eng.writeFile('b.md', 'two');
  eng.stage('a.md');

  const s = eng.status();
  assert.equal(s.branch, 'main');
  assert.deepEqual(s.staged.map((f) => f.path), ['a.md']);
  assert.deepEqual(s.staged.map((f) => f.state), ['new file']);
  assert.deepEqual(s.untracked.map((f) => f.path), ['b.md']);
  assert.equal(s.unstaged.length, 0);
  assert.equal(s.clean, false);
});

test('an edit after staging shows up in both columns', () => {
  const eng = repoAt();
  eng.writeFile('a.md', 'one');
  eng.stage('a.md');
  eng.commit('first');
  eng.writeFile('a.md', 'two');
  eng.stage('a.md');
  eng.writeFile('a.md', 'three');

  const s = eng.status();
  assert.deepEqual(s.staged.map((f) => f.path), ['a.md']);
  assert.deepEqual(s.unstaged.map((f) => f.path), ['a.md']);
});

test('ignored files never appear as untracked', () => {
  const eng = repoAt();
  eng.writeFile('.gitignore', 'secrets.env\nnode_modules/');
  eng.writeFile('secrets.env', 'KEY=1');
  eng.writeFile('node_modules/dep/index.js', 'x');
  eng.writeFile('app.js', 'x');

  const untracked = eng.status().untracked.map((f) => f.path);
  assert.ok(untracked.includes('app.js'));
  assert.ok(untracked.includes('.gitignore'));
  assert.ok(!untracked.includes('secrets.env'));
  assert.ok(!untracked.some((p) => p.startsWith('node_modules/')));
});

test('.gitignore can never ignore itself', () => {
  const eng = repoAt();
  eng.writeFile('.gitignore', '.gitignore');
  assert.equal(eng.isIgnored('.gitignore'), false);
});

test('commit snapshots the index, not the working tree', () => {
  const eng = repoAt();
  eng.writeFile('a.md', 'staged version');
  eng.stage('a.md');
  eng.writeFile('a.md', 'later edit');
  const commit = eng.commit('snapshot');

  assert.equal(commit.tree['a.md'], 'staged version');
  assert.equal(eng.worktree()['a.md'], 'later edit');
});

test('commits chain and the branch ref follows HEAD', () => {
  const eng = repoAt();
  eng.writeFile('a.md', '1');
  eng.stage('a.md');
  const first = eng.commit('one');
  eng.writeFile('a.md', '2');
  eng.stage('a.md');
  const second = eng.commit('two');

  assert.deepEqual(second.parents, [first.sha]);
  assert.equal(eng.repo.branches.main, second.sha);
  assert.deepEqual(eng.ancestry(second.sha), [second.sha, first.sha]);
});

test('unstage restores the index entry from HEAD', () => {
  const eng = repoAt();
  eng.writeFile('a.md', 'committed');
  eng.stage('a.md');
  eng.commit('one');
  eng.writeFile('a.md', 'edited');
  eng.stage('a.md');
  eng.unstage('a.md');

  assert.equal(eng.repo.index['a.md'], 'committed');
  assert.equal(eng.worktree()['a.md'], 'edited');
});

test('mergeBase finds the fork point', () => {
  const eng = repoAt();
  eng.writeFile('a.md', 'base');
  eng.stage('a.md');
  const base = eng.commit('base');

  eng.repo.branches.feature = base.sha;
  eng.repo.HEAD = { ref: 'feature' };
  eng.writeFile('a.md', 'feature');
  eng.stage('a.md');
  const feature = eng.commit('feature work');

  eng.repo.HEAD = { ref: 'main' };
  eng.checkoutTree(eng.repo.objects[base.sha].tree);
  eng.writeFile('a.md', 'main');
  eng.stage('a.md');
  const main = eng.commit('main work');

  assert.equal(eng.mergeBase(main.sha, feature.sha), base.sha);
});

test('mergeTrees takes the one-sided change without a conflict', () => {
  const eng = repoAt();
  const merged = eng.mergeTrees(
    { a: '1', b: '1' },
    { a: '2', b: '1' },
    { a: '1', b: '3' },
    'HEAD',
    'other'
  );
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.tree, { a: '2', b: '3' });
});

test('mergeTrees writes markers when both sides changed a file', () => {
  const eng = repoAt();
  const merged = eng.mergeTrees({ a: 'base' }, { a: 'mine' }, { a: 'theirs' }, 'HEAD', 'origin/main');
  assert.deepEqual(merged.conflicts, ['a']);
  assert.match(merged.tree.a, /^<{7} HEAD\nmine\n={7}\ntheirs\n>{7} origin\/main$/);
});

test('checkoutTree can leave untracked files alone', () => {
  const eng = repoAt();
  eng.writeFile('tracked.md', 'v1');
  eng.stage('tracked.md');
  const first = eng.commit('one');
  eng.writeFile('scratch.md', 'mine');

  eng.checkoutTree(eng.repo.objects[first.sha].tree, { keepUntracked: true });
  assert.equal(eng.worktree()['scratch.md'], 'mine');

  eng.checkoutTree(eng.repo.objects[first.sha].tree);
  assert.equal(eng.worktree()['scratch.md'], undefined);
});

test('resolveRef understands branches, HEAD, HEAD~n and short shas', () => {
  const eng = repoAt();
  eng.writeFile('a.md', '1');
  eng.stage('a.md');
  const first = eng.commit('one');
  eng.writeFile('a.md', '2');
  eng.stage('a.md');
  const second = eng.commit('two');

  assert.equal(eng.resolveRef('main'), second.sha);
  assert.equal(eng.resolveRef('HEAD'), second.sha);
  assert.equal(eng.resolveRef('HEAD~1'), first.sha);
  assert.equal(eng.resolveRef('HEAD^'), first.sha);
  assert.equal(eng.resolveRef(first.sha), first.sha);
  assert.equal(eng.resolveRef('nope'), null);
});

test('ls lists directories before files, without duplicates', () => {
  const eng = repoAt();
  eng.writeFile('z.md', '');
  eng.writeFile('src/app.js', '');
  eng.writeFile('a.md', '');

  const names = eng.list('.').map((e) => `${e.name}${e.type === 'dir' ? '/' : ''}`);
  assert.deepEqual(names, ['src/', 'a.md', 'z.md']);
});

test('a repo is only active from inside its own tree', () => {
  const eng = repoAt(`${HOME}/r`);
  assert.ok(eng.activeRepo());
  eng.cwd = `${HOME}/r/deep/nested`;
  assert.ok(eng.activeRepo());
  eng.cwd = HOME;
  assert.equal(eng.activeRepo(), null);
});

test('snapshot and restore round-trip the whole world', () => {
  const eng = repoAt();
  eng.writeFile('a.md', 'one');
  eng.stage('a.md');
  eng.commit('one');
  const snap = eng.snapshot();

  eng.writeFile('a.md', 'destroyed');
  eng.removeFile('a.md');
  eng.restore(snap);

  assert.equal(eng.worktree()['a.md'], 'one');
  assert.equal(eng.ancestry(eng.headSha()).length, 1);
});

test('a gitignore glob with a ? does not blow up the regex engine', () => {
  // `?` used to reach the regex engine as a quantifier: `?boom*` threw
  // "Nothing to repeat" out of status(), and every later command with it.
  assert.doesNotThrow(() => ignoreMatches('?boom*', 'anything.md'));
  assert.equal(ignoreMatches('?boom*', 'anything.md'), false);
  assert.equal(ignoreMatches('note?.md', 'note1.md'), false, '? is a literal here, not a wildcard');
  assert.equal(ignoreMatches('note?.md', 'note?.md'), true);

  const eng = repoAt();
  eng.writeFile('.gitignore', '?boom*');
  eng.writeFile('a.md', 'one');
  assert.doesNotThrow(() => eng.status());
  assert.deepEqual(eng.status().untracked.map((f) => f.path).sort(), ['.gitignore', 'a.md']);
});

test('a second git init leaves the first repository alone', () => {
  const eng = new GitEngine();
  const alpha = `${HOME}/alpha`;
  eng.init(alpha);
  eng.cwd = alpha;
  eng.writeFile('a.txt', 'hello');
  eng.stage('a.txt');
  const first = eng.commit('alpha first commit');

  const beta = `${HOME}/beta`;
  eng.init(beta);
  eng.cwd = beta;
  assert.ok(eng.activeRepo(), 'beta is a repository too');
  assert.equal(eng.headSha(), null, 'and it starts empty');

  eng.cwd = alpha;
  assert.ok(eng.activeRepo(), 'alpha still exists');
  assert.equal(eng.headSha(), first.sha, 'with its history intact');
  assert.equal(eng.worktree()['a.txt'], 'hello');
});

test('re-initialising the same root keeps the history that is already there', () => {
  const eng = repoAt();
  eng.writeFile('a.md', 'one');
  eng.stage('a.md');
  const first = eng.commit('one');
  eng.init(eng.cwd);
  assert.equal(eng.headSha(), first.sha);
});

test('the nearest enclosing repository wins', () => {
  const eng = new GitEngine();
  const outer = `${HOME}/outer`;
  const inner = `${HOME}/outer/inner`;
  eng.init(outer);
  eng.init(inner);
  eng.cwd = inner;
  assert.equal(eng.activeRepo().root, inner);
  eng.cwd = outer;
  assert.equal(eng.activeRepo().root, outer);
});

test('HEAD~n walks first parents, so a merge does not send it down the other branch', () => {
  const eng = repoAt();
  eng.writeFile('a.md', 'one');
  eng.stage('a.md');
  const one = eng.commit('one');

  eng.repo.branches.feat = one.sha;
  eng.repo.HEAD = { ref: 'feat' };
  eng.writeFile('f.md', 'feat');
  eng.stage('f.md');
  const onFeat = eng.commit('two on feat');

  eng.repo.HEAD = { ref: 'main' };
  eng.checkoutTree(eng.repo.objects[one.sha].tree);
  eng.writeFile('m.md', 'main');
  eng.stage('m.md');
  const onMain = eng.commit('three on main');

  eng.repo.index = { ...eng.headTree(), 'f.md': 'feat' };
  eng.commit("Merge branch 'feat'", [onFeat.sha]);

  assert.equal(eng.resolveRef('HEAD~1'), onMain.sha, 'one back is the last commit on main');
  assert.equal(eng.resolveRef('HEAD~2'), one.sha, 'two back is the fork point, not the other branch');
  assert.notEqual(eng.resolveRef('HEAD~2'), onFeat.sha);
  assert.equal(eng.resolveRef('HEAD~9'), null, 'walking off the end is null, not a wrong commit');
});

test('ahead counts only the commits the remote does not have', () => {
  const eng = repoAt();
  eng.writeFile('a.md', 'one');
  eng.stage('a.md');
  const base = eng.commit('base');

  eng.remotes.origin = { url: 'x', branches: {}, objects: {} };
  eng.repo.remote = 'origin';
  eng.repo.index = { 'a.md': 'theirs' };
  const theirs = eng.commit('theirs');
  eng.remotes.origin.branches.main = theirs.sha;
  eng.ancestry(theirs.sha).forEach((sha) => { eng.remotes.origin.objects[sha] = eng.repo.objects[sha]; });

  // Rewind to the fork and make one commit of our own: 1 ahead, 1 behind.
  eng.repo.branches.main = base.sha;
  eng.checkoutTree(eng.repo.objects[base.sha].tree);
  eng.writeFile('b.md', 'mine');
  eng.stage('b.md');
  eng.commit('mine');

  assert.equal(eng.aheadCount(), 1, 'not the whole chain just because the remote sha is not an ancestor');
});

test('shortHash keeps the low bits of its multiply', () => {
  const seen = {};
  let collisions = 0;
  for (let i = 0; i < 20000; i += 1) {
    const h = shortHash(`commit-${i}`);
    if (seen[h]) collisions += 1;
    seen[h] = true;
  }
  assert.equal(collisions, 0, 'sequential inputs must not collide');
  assert.match(shortHash('a'), /^[0-9a-f]{7}$/);
});
