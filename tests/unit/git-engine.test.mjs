import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Engine = require('../../src/js/git-engine.js');
const { GitEngine, resolvePath, ignoreMatches, HOME } = Engine;

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
