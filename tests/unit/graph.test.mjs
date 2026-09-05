/**
 * graph.js and terminal.js were required by no test and checked by no linter.
 * These cover the pure parts: lane assignment, and the prompt's path shortening.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GitEngine, HOME } = require('../../src/js/git-engine.js');
const Graph = require('../../src/js/graph.js');
const Terminal = require('../../src/js/terminal.js');

function repoAt(path = `${HOME}/r`) {
  const eng = new GitEngine();
  eng.init(path);
  eng.cwd = path;
  return eng;
}

function commit(eng, name, body) {
  eng.writeFile(`${eng.cwd}/${name}`, body);
  eng.stage(name);
  return eng.commit(`add ${name}`);
}

test('layout returns nothing outside a repository', () => {
  const eng = new GitEngine();
  assert.deepEqual(Graph.layout(eng), { nodes: [], lanes: 0 });
});

test('linear history sits in a single lane, oldest first', () => {
  const eng = repoAt();
  commit(eng, 'a.md', 'one');
  commit(eng, 'b.md', 'two');
  commit(eng, 'c.md', 'three');

  const { nodes, lanes } = Graph.layout(eng);
  assert.equal(lanes, 1);
  assert.deepEqual(nodes.map((n) => n.lane), [0, 0, 0]);
  assert.deepEqual(nodes.map((n) => n.message), ['add a.md', 'add b.md', 'add c.md']);
  assert.ok(nodes[0].x < nodes[2].x, 'time runs left to right');
  assert.equal(nodes[2].isHead, true);
});

test('a diverged branch gets a lane of its own', () => {
  const eng = repoAt();
  const base = commit(eng, 'a.md', 'one');

  eng.repo.branches.feature = base.sha;
  eng.repo.HEAD = { ref: 'feature' };
  commit(eng, 'feature.md', 'theirs');

  eng.repo.HEAD = { ref: 'main' };
  eng.checkoutTree(eng.repo.objects[base.sha].tree);
  commit(eng, 'main.md', 'ours');

  const { nodes, lanes } = Graph.layout(eng);
  assert.equal(nodes.length, 3);
  assert.ok(lanes >= 2, 'two tips cannot share one lane');
  const tips = nodes.filter((n) => n.branches.length);
  assert.equal(new Set(tips.map((n) => n.lane)).size, 2);
});

test('a merge commit is marked and both parents are kept', () => {
  const eng = repoAt();
  const base = commit(eng, 'a.md', 'one');

  eng.repo.branches.feature = base.sha;
  eng.repo.HEAD = { ref: 'feature' };
  const theirs = commit(eng, 'feature.md', 'theirs');

  eng.repo.HEAD = { ref: 'main' };
  eng.checkoutTree(eng.repo.objects[base.sha].tree);
  commit(eng, 'main.md', 'ours');
  eng.repo.index = { ...eng.headTree(), 'feature.md': 'theirs' };
  const merge = eng.commit("Merge branch 'feature'", [theirs.sha]);

  const node = Graph.layout(eng).nodes.find((n) => n.sha === merge.sha);
  assert.ok(node, 'the merge commit is in the graph');
  assert.equal(node.merge, true);
  assert.equal(node.parents.length, 2);
});

test('branch labels are attached to the commit they point at', () => {
  const eng = repoAt();
  const first = commit(eng, 'a.md', 'one');
  eng.repo.branches.release = first.sha;

  const nodes = Graph.layout(eng).nodes;
  assert.deepEqual(nodes[0].branches.sort(), ['main', 'release']);
});

test('render escapes a commit message that looks like markup', () => {
  const eng = repoAt();
  eng.writeFile(`${eng.cwd}/a.md`, 'one');
  eng.stage('a.md');
  eng.commit('<img src=x onerror="boom">');

  const svg = Graph.render(eng);
  assert.ok(!svg.includes('<img'), 'the message must not become an element');
  assert.ok(svg.includes('&lt;img') || svg.includes('&lt;'), 'it is escaped instead');
});

test('prettyCwd shortens the home directory and leaves everything else alone', () => {
  assert.equal(Terminal.prettyCwd(HOME, HOME), '~');
  assert.equal(Terminal.prettyCwd(`${HOME}/my-first-repo`, HOME), '~/my-first-repo');
  assert.equal(Terminal.prettyCwd('/etc', HOME), '/etc');
  assert.equal(Terminal.prettyCwd('/home/youse', HOME), '/home/youse', 'prefix match must be a path boundary');
});

test('the completion list covers the verbs the lesson teaches', () => {
  ['git init', 'git status', 'git add', 'git commit -m', 'git push', 'git restore'].forEach((v) => {
    assert.ok(Terminal.VERBS.includes(v), `${v} should be completable`);
  });
});
