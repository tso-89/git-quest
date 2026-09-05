import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GitEngine, HOME } = require('../../src/js/git-engine.js');
const Commands = require('../../src/js/commands.js');

/** Run a line and return its output as one string. */
function run(eng, line) {
  const result = Commands.run(eng, line);
  return { ok: result.ok, text: result.lines.map((l) => l.text).join('\n'), lines: result.lines };
}

function fresh() {
  const eng = new GitEngine();
  run(eng, 'git init my-first-repo');
  eng.cwd = `${HOME}/my-first-repo`;
  return eng;
}

test('tokenize keeps quoted strings whole', () => {
  assert.deepEqual(Commands.tokenize('git commit -m "two words"'), ['git', 'commit', '-m', 'two words']);
  assert.deepEqual(Commands.tokenize("echo 'a b'  c"), ['echo', 'a b', 'c']);
  assert.deepEqual(Commands.tokenize('echo ""'), ['echo', '']);
});

test('parse pulls a redirect off the end', () => {
  const cmd = Commands.parse('echo "hi" > notes.md');
  assert.deepEqual(cmd.tokens, ['echo', 'hi']);
  assert.deepEqual(cmd.redirect, { append: false, target: 'notes.md' });

  const appended = Commands.parse('echo "hi" >> notes.md');
  assert.equal(appended.redirect.append, true);
});

test('diffLines reports insertions and deletions, not a full rewrite', () => {
  const changes = Commands.diffLines('a\nb\nc', 'a\nB\nc');
  assert.deepEqual(changes.map((c) => c.op), [' ', '-', '+', ' ']);
});

test('diffLines treats a missing side as all-added or all-removed', () => {
  assert.ok(Commands.diffLines(null, 'x\ny').every((c) => c.op === '+'));
  assert.ok(Commands.diffLines('x\ny', null).every((c) => c.op === '-'));
});

test('git commands refuse to run outside a repository', () => {
  const eng = new GitEngine();
  const result = run(eng, 'git status');
  assert.equal(result.ok, false);
  assert.match(result.text, /not a git repository/);
});

test('echo with > writes and with >> appends', () => {
  const eng = fresh();
  run(eng, 'echo "one" > notes.md');
  assert.equal(eng.readFile('notes.md'), 'one');
  run(eng, 'echo "two" >> notes.md');
  assert.equal(eng.readFile('notes.md'), 'one\ntwo');
  run(eng, 'echo "three" > notes.md');
  assert.equal(eng.readFile('notes.md'), 'three');
});

test('git add refuses a path that does not exist', () => {
  const eng = fresh();
  const result = run(eng, 'git add ghost.md');
  assert.equal(result.ok, false);
  assert.match(result.text, /did not match any files/);
});

test('git add . skips ignored files', () => {
  const eng = fresh();
  run(eng, 'echo "secrets.env" > .gitignore');
  run(eng, 'echo "KEY=1" > secrets.env');
  run(eng, 'echo "hello" > app.js');
  run(eng, 'git add .');

  assert.deepEqual(Object.keys(eng.repo.index).sort(), ['.gitignore', 'app.js']);
});

test('git commit needs a message and something staged', () => {
  const eng = fresh();
  run(eng, 'echo "hi" > a.md');

  const noMessage = run(eng, 'git commit');
  assert.equal(noMessage.ok, false);
  assert.match(noMessage.text, /no commit message/);

  const nothingStaged = run(eng, 'git commit -m "a real message"');
  assert.equal(nothingStaged.ok, false);
  assert.match(nothingStaged.text, /nothing added to commit/);
});

test('git commit reports the file and line counts', () => {
  const eng = fresh();
  run(eng, 'echo "one" > a.md');
  run(eng, 'git add a.md');
  const result = run(eng, 'git commit -m "Add the first file"');
  assert.ok(result.ok);
  assert.match(result.text, /1 file changed, 1 insertion/);
});

test('git restore brings a file back; --staged only unstages it', () => {
  const eng = fresh();
  run(eng, 'echo "good" > a.md');
  run(eng, 'git add a.md');
  run(eng, 'git commit -m "Add a good file"');

  run(eng, 'echo "ruined" > a.md');
  run(eng, 'git restore a.md');
  assert.equal(eng.readFile('a.md'), 'good');

  run(eng, 'echo "edited" > a.md');
  run(eng, 'git add a.md');
  run(eng, 'git restore --staged a.md');
  assert.equal(eng.repo.index['a.md'], 'good', 'index reset to HEAD');
  assert.equal(eng.readFile('a.md'), 'edited', 'working file untouched');
});

test('gh repo create insists on a visibility', () => {
  const eng = fresh();
  const vague = run(eng, 'gh repo create my-first-repo');
  assert.equal(vague.ok, false);
  assert.match(vague.text, /--public or --private/);

  const explicit = run(eng, 'gh repo create my-first-repo --public');
  assert.ok(explicit.ok);
  assert.ok(eng.remotes.origin);
  assert.equal(eng.repo.remote, 'origin');
});

test('git push refuses without a remote, then syncs the branch', () => {
  const eng = fresh();
  run(eng, 'echo "hi" > a.md');
  run(eng, 'git add .');
  run(eng, 'git commit -m "Add the first file"');

  const noRemote = run(eng, 'git push');
  assert.equal(noRemote.ok, false);
  assert.match(noRemote.text, /No configured push destination/);

  run(eng, 'gh repo create my-first-repo --public');
  assert.equal(eng.status().ahead, 1);
  run(eng, 'git push');
  assert.equal(eng.status().ahead, 0);
  assert.equal(eng.remotes.origin.branches.main, eng.repo.branches.main);
});

test('switch -c makes a branch; switching back with dirty files is refused', () => {
  const eng = fresh();
  run(eng, 'echo "one" > a.md');
  run(eng, 'git add .');
  run(eng, 'git commit -m "Add the first file"');

  run(eng, 'git switch -c feat/x');
  assert.equal(eng.currentBranch(), 'feat/x');

  run(eng, 'echo "dirty" > a.md');
  const blocked = run(eng, 'git switch main');
  assert.equal(blocked.ok, false);
  assert.match(blocked.text, /local changes would be overwritten/);
  assert.equal(eng.currentBranch(), 'feat/x');
});

test('a merge with no divergence fast-forwards', () => {
  const eng = fresh();
  run(eng, 'echo "one" > a.md');
  run(eng, 'git add .');
  run(eng, 'git commit -m "Add the first file"');
  run(eng, 'git switch -c feat/x');
  run(eng, 'echo "two" > a.md');
  run(eng, 'git commit -am "Change the first file"');
  run(eng, 'git switch main');

  const merged = run(eng, 'git merge feat/x');
  assert.ok(merged.ok);
  assert.match(merged.text, /Fast-forward/);
  assert.equal(eng.readFile('a.md'), 'two');
});

test('a merge with edits on both sides conflicts and blocks the commit', () => {
  const eng = fresh();
  run(eng, 'echo "base" > a.md');
  run(eng, 'git add .');
  run(eng, 'git commit -m "Add the base file"');
  run(eng, 'git switch -c feat/x');
  run(eng, 'echo "theirs" > a.md');
  run(eng, 'git commit -am "Their version of the file"');
  run(eng, 'git switch main');
  run(eng, 'echo "mine" > a.md');
  run(eng, 'git commit -am "My version of the file"');

  const merged = run(eng, 'git merge feat/x');
  assert.equal(merged.ok, false);
  assert.match(merged.text, /CONFLICT/);
  assert.match(eng.readFile('a.md'), /<{7}/);

  const blocked = run(eng, 'git commit -m "Finish the merge"');
  assert.equal(blocked.ok, false);
  assert.match(blocked.text, /unmerged files/);

  run(eng, 'echo "resolved by hand" > a.md');
  run(eng, 'git add a.md');
  const done = run(eng, 'git commit -m "Resolve the conflict by hand"');
  assert.ok(done.ok);
  assert.equal(eng.repo.merging, null);
  assert.equal(eng.headCommit().parents.length, 2);
});

test('revert adds an opposite commit and keeps the original', () => {
  const eng = fresh();
  run(eng, 'echo "one" > a.md');
  run(eng, 'git add .');
  run(eng, 'git commit -m "Add the first file"');
  run(eng, 'echo "two" > a.md');
  run(eng, 'git commit -am "Change the first file"');
  const before = eng.ancestry(eng.headSha()).length;

  run(eng, 'git revert HEAD');
  assert.equal(eng.readFile('a.md'), 'one');
  assert.equal(eng.ancestry(eng.headSha()).length, before + 1, 'history grew, nothing was erased');
  assert.match(eng.headCommit().message, /^Revert /);
});

test('reset --hard moves everything; the reflog still knows the way back', () => {
  const eng = fresh();
  run(eng, 'echo "one" > a.md');
  run(eng, 'git add .');
  run(eng, 'git commit -m "Add the first file"');
  const keep = eng.headSha();
  run(eng, 'echo "two" > a.md');
  run(eng, 'git commit -am "Change the first file"');

  run(eng, `git reset --hard ${keep}`);
  assert.equal(eng.readFile('a.md'), 'one');
  assert.equal(eng.headSha(), keep);

  const reflog = run(eng, 'git reflog');
  assert.match(reflog.text, /reset --hard/);
});

test('clone copies the full history and checks the files out', () => {
  const eng = fresh();
  run(eng, 'echo "one" > a.md');
  run(eng, 'git add .');
  run(eng, 'git commit -m "Add the first file"');
  run(eng, 'gh repo create my-first-repo --public');
  run(eng, 'git push');

  eng.cwd = HOME;
  const cloned = run(eng, 'git clone https://github.com/you/my-first-repo.git copy');
  assert.ok(cloned.ok);
  eng.cwd = `${HOME}/copy`;
  assert.equal(eng.readFile('a.md'), 'one');
  assert.equal(eng.ancestry(eng.headSha()).length, 1);
});

test('git pull fast-forwards work someone else pushed', () => {
  const eng = fresh();
  run(eng, 'echo "one" > a.md');
  run(eng, 'git add .');
  run(eng, 'git commit -m "Add the first file"');
  run(eng, 'gh repo create my-first-repo --public');
  run(eng, 'git push');

  // A teammate pushes a file we do not have.
  const mine = eng.repo.branches.main;
  eng.repo.index = { 'a.md': 'one', 'team.md': 'from a teammate' };
  const theirs = eng.commit('Teammate work');
  eng.remotes.origin.branches.main = theirs.sha;
  eng.ancestry(theirs.sha).forEach((s) => { eng.remotes.origin.objects[s] = eng.repo.objects[s]; });
  eng.repo.branches.main = mine;
  eng.checkoutTree(eng.repo.objects[mine].tree);

  const pulled = run(eng, 'git pull');
  assert.ok(pulled.ok);
  assert.equal(eng.readFile('team.md'), 'from a teammate');
});

test('unknown commands say so instead of failing silently', () => {
  const eng = fresh();
  assert.match(run(eng, 'sudo rm -rf /').text, /command not found/);
  assert.match(run(eng, 'git rebase main').text, /not supported in this sandbox/);
});

test('help lists what the sandbox understands', () => {
  const eng = fresh();
  const helped = run(eng, 'help');
  assert.match(helped.text, /git\s+init\s+status\s+add/);
  assert.match(helped.text, /Nothing you type here touches your real computer/);
});

test('git add -A and --all stage everything, like git add .', () => {
  // parse() routes every -flag into cmd.flags, so these used to fall through to
  // "Nothing specified, nothing added" with unreachable handling behind them.
  ['-A', '--all'].forEach((flag) => {
    const eng = fresh();
    eng.writeFile('a.md', 'one');
    eng.writeFile('b.md', 'two');
    const res = run(eng, `git add ${flag}`);
    assert.equal(res.ok, true, `git add ${flag} should work`);
    assert.deepEqual(Object.keys(eng.repo.index).sort(), ['a.md', 'b.md']);
  });
});

test('git add -A still honours .gitignore', () => {
  const eng = fresh();
  eng.writeFile('.gitignore', 'secret.env');
  eng.writeFile('secret.env', 'KEY=1');
  eng.writeFile('app.js', 'ok');
  run(eng, 'git add -A');
  assert.deepEqual(Object.keys(eng.repo.index).sort(), ['.gitignore', 'app.js']);
});

test('git add with no paths and no flag still explains itself', () => {
  const eng = fresh();
  eng.writeFile('a.md', 'one');
  const res = run(eng, 'git add');
  assert.equal(res.ok, false);
  assert.match(res.text, /Nothing specified/);
});

test('git rm --cached refuses a file git has never heard of', () => {
  const eng = fresh();
  eng.writeFile('a.md', 'one');
  run(eng, 'git add a.md');

  const ghost = run(eng, 'git rm --cached ghost.md');
  assert.equal(ghost.ok, false, 'a false success here is the wrong failure mode');
  assert.match(ghost.text, /did not match any files/);
  assert.deepEqual(Object.keys(eng.repo.index), ['a.md'], 'and nothing was removed');

  const real = run(eng, 'git rm --cached a.md');
  assert.equal(real.ok, true);
  assert.deepEqual(Object.keys(eng.repo.index), []);
});

test('a merge does not delete untracked files that were sitting there', () => {
  const eng = fresh();
  eng.writeFile('a.md', 'base');
  run(eng, 'git add .');
  run(eng, 'git commit -m "base"');

  run(eng, 'git switch -c feat');
  eng.writeFile('feat.md', 'theirs');
  run(eng, 'git add .');
  run(eng, 'git commit -m "on the branch"');

  run(eng, 'git switch main');
  eng.writeFile('a.md', 'ours');
  run(eng, 'git add .');
  run(eng, 'git commit -m "on main"');

  eng.writeFile('scratch.txt', 'my notes, not committed');
  run(eng, 'git merge feat');
  assert.equal(eng.worktree()['scratch.txt'], 'my notes, not committed');
});

test('a fast-forward merge leaves untracked files alone too', () => {
  const eng = fresh();
  eng.writeFile('a.md', 'base');
  run(eng, 'git add .');
  run(eng, 'git commit -m "base"');

  run(eng, 'git switch -c feat');
  eng.writeFile('feat.md', 'theirs');
  run(eng, 'git add .');
  run(eng, 'git commit -m "on the branch"');
  run(eng, 'git switch main');

  eng.writeFile('scratch.txt', 'my notes');
  run(eng, 'git merge feat');
  assert.equal(eng.worktree()['scratch.txt'], 'my notes');
  assert.equal(eng.worktree()['feat.md'], 'theirs');
});

test('git init twice does not erase the repository you were in', () => {
  const eng = fresh();
  eng.writeFile('a.md', 'one');
  run(eng, 'git add .');
  run(eng, 'git commit -m "first"');

  const again = run(eng, 'git init');
  assert.equal(again.ok, true);
  assert.match(again.text, /Reinitialized/);

  assert.equal(run(eng, 'git status').ok, true, 'the repo is still a repo');
  assert.match(run(eng, 'git log').text, /first/);
});

test('a repository made inside another does not swallow the first', () => {
  const eng = fresh();
  eng.writeFile('a.md', 'one');
  run(eng, 'git add .');
  run(eng, 'git commit -m "outer first commit"');

  run(eng, 'mkdir side');
  run(eng, 'cd side');
  run(eng, 'git init');
  run(eng, 'cd ..');

  assert.match(run(eng, 'git log').text, /outer first commit/);
});
