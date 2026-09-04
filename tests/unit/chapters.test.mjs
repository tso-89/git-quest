/**
 * Walkthrough tests: for every chapter, play a plausible solution and assert
 * that all of its quest steps end up satisfied. If a check is impossible to
 * pass, or passes without the learner doing the work, these catch it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { GitEngine } = require('../../src/js/git-engine.js');
const Commands = require('../../src/js/commands.js');
const Chapters = require('../../src/js/chapters.js');
const { AGENT_EDITS } = require('../../src/js/widgets.js');

/** Stand up a chapter's sandbox plus the context its checks receive. */
function open(chapterId) {
  const chapter = Chapters.byId(chapterId);
  const eng = new GitEngine();
  chapter.setup(eng);
  const ctx = { eng, history: [], flags: {}, widget: {} };

  const results = () => chapter.quest.steps.map((s) => !!s.check(ctx));

  // The app re-runs every check after each command, which is how steps that
  // record a moment in time ("you broke it, then you fixed it") latch. The
  // harness has to do the same or those steps can never pass.
  const play = (line) => {
    const result = Commands.run(eng, line);
    ctx.history.push(line.trim());
    results();
    return result;
  };
  const done = () => results().every(Boolean);

  return { chapter, eng, ctx, play, results, done };
}

function assertSolved(session) {
  const results = session.results();
  const failed = session.chapter.quest.steps
    .map((s, i) => (results[i] ? null : `step ${i + 1}: ${s.label}`))
    .filter(Boolean);
  assert.deepEqual(failed, [], `unsolved steps in "${session.chapter.title}"`);
}

test('every chapter is numbered, named and has a quest', () => {
  assert.equal(Chapters.list.length, 11);
  Chapters.list.forEach((c, i) => {
    assert.equal(c.n, i);
    assert.ok(c.title && c.subtitle, `${c.id} needs a title and subtitle`);
    assert.ok(c.xp > 0, `${c.id} needs XP`);
    assert.ok(c.quest.steps.length >= 3, `${c.id} needs at least three steps`);
    c.quest.steps.forEach((s) => {
      assert.equal(typeof s.check, 'function');
      assert.ok(s.hint && s.label);
    });
    assert.ok(typeof c.setup === 'function');
    assert.ok(c.outro);
  });
});

test('no chapter starts already solved', () => {
  Chapters.list.forEach((c) => {
    const session = open(c.id);
    assert.equal(session.done(), false, `${c.id} is complete before the learner does anything`);
  });
});

test('total XP matches the sum of the chapters', () => {
  const sum = Chapters.list.reduce((n, c) => n + c.xp, 0);
  assert.equal(Chapters.totalXp, sum);
});

test('00 — break a file and restore it', () => {
  const s = open('why');
  s.play('cat story.md');
  s.play('echo "ruined" > story.md');
  s.play('git status');
  s.play('git restore story.md');
  assertSolved(s);
  assert.match(s.eng.worktree()['story.md'], /Tuesday Deploy/);
});

test('00 — deleting the file outright also counts, and restore brings it back', () => {
  const s = open('why');
  s.play('rm story.md');
  s.play('git status');
  assert.deepEqual(s.results(), [true, true, false]);
  s.play('git restore story.md');
  assertSolved(s);
});

test('00 — restoring without breaking anything does not count', () => {
  const s = open('why');
  s.play('git status');
  s.play('git restore story.md');
  assert.equal(s.results()[2], false, 'the third step needs real damage first');
});

test('01 — the sign-up checklist and username rules', () => {
  const s = open('account');
  assert.equal(s.done(), false);
  s.ctx.widget = { usernameValid: true, checks: { signup: true, twofa: true, email: true } };
  assertSolved(s);
});

test('02 — make a folder into a repository with one commit', () => {
  const s = open('repository');
  s.play('mkdir my-first-repo');
  s.play('cd my-first-repo');
  s.play('git init');
  s.play('ls -a');
  s.play('echo "# my-first-repo" > README.md');
  s.play('git add README.md');
  s.play('git commit -m "First commit"');
  assertSolved(s);
});

test('03 — sort the files, then write a gitignore that silences them', () => {
  const s = open('visibility');
  s.ctx.widget = { sorterSolved: true };
  s.play('git status');
  s.play('echo "secrets.env" > .gitignore');
  s.play('echo ".DS_Store" >> .gitignore');
  s.play('git status');
  assertSolved(s);

  const untracked = s.eng.status().untracked.map((f) => f.path);
  assert.ok(!untracked.includes('secrets.env'));
  assert.ok(!untracked.includes('.DS_Store'));
});

test('03 — a single chevron would clobber the first rule, and the quest notices', () => {
  const s = open('visibility');
  s.ctx.widget = { sorterSolved: true };
  s.play('echo "secrets.env" > .gitignore');
  s.play('echo ".DS_Store" > .gitignore');
  s.play('git status');
  assert.equal(s.results()[1], false, 'secrets.env was overwritten out of the file');
});

test('04 — create the remote and push to it', () => {
  const s = open('first-repo');
  s.play('gh repo create my-first-repo --public');
  s.play('git remote -v');
  s.play('git push');
  assertSolved(s);
});

test('04 — a private repo works just as well', () => {
  const s = open('first-repo');
  s.play('gh repo create my-first-repo --private');
  s.play('git remote -v');
  s.play('git push');
  assertSolved(s);
});

test('05 — two changes become two commits and one push', () => {
  const s = open('loop');
  s.play('echo "- Trunk-based development" >> notes.md');
  s.play('echo "# Ideas" > ideas.md');
  s.play('git add notes.md');
  s.play('git diff --staged');
  s.play('git commit -m "Add reading list for week two"');
  s.play('git add ideas.md');
  s.play('git commit -m "Start an ideas file"');
  s.play('git push');
  assertSolved(s);
  assert.equal(s.eng.status().ahead, 0);
});

test('05 — a lazy commit message does not pass', () => {
  const s = open('loop');
  s.play('echo "- Trunk-based development" >> notes.md');
  s.play('echo "# Ideas" > ideas.md');
  s.play('git add notes.md');
  s.play('git diff --staged');
  s.play('git commit -m "fix"');
  assert.equal(s.results()[2], false, '"fix" tells nobody anything');
});

test('06 — the desktop client loop and the VS Code hunt', () => {
  const s = open('gui');
  s.ctx.widget = { guiStaged: 1, guiCommitted: true, guiPushed: true, vscodeFound: 4 };
  assertSolved(s);

  s.ctx.widget.guiStaged = 2;
  assert.equal(s.results()[0], false, 'staging both files is not the exercise');
});

test('07 — branch, merge, revert, and find it again', () => {
  const s = open('branches');
  s.play('git switch -c fix/typo');
  s.play('echo "function greet(name) { return \'Hello, \' + name; }" > app.js');
  s.play('git commit -am "Fix the greeting typo"');
  s.play('git switch main');
  s.play('git merge fix/typo');
  s.play('git revert HEAD');
  s.play('git reflog');
  assertSolved(s);
  assert.match(s.eng.headCommit().message, /^Revert /);
});

test('07 — committing on main instead of a branch does not satisfy the branch step', () => {
  const s = open('branches');
  s.play('echo "changed" > app.js');
  s.play('git commit -am "Fix the greeting typo"');
  assert.equal(s.results()[0], false);
  assert.equal(s.results()[1], false);
});

test('08 — pull, hit the conflict, resolve it by hand, push', () => {
  const s = open('together');
  const pulled = s.play('git pull');
  assert.equal(pulled.ok, false, 'the pull is supposed to conflict');

  s.play('cat README.md');
  assert.deepEqual(s.results().slice(0, 3), [true, true, false]);

  s.play('echo "# my-first-repo" > README.md');
  s.play('echo "Shipped v1. Still learning, chapter eight of ten." >> README.md');
  s.play('git add README.md');
  s.play('git commit -m "Merge release note with my progress note"');
  s.play('git push');
  assertSolved(s);

  assert.ok(!/<{7}|={7}|>{7}/.test(s.eng.worktree()['README.md']));
  assert.equal(s.eng.headCommit().parents.length, 2, 'it is a real merge commit');
});

test('08 — committing with the markers still in the file is refused', () => {
  const s = open('together');
  s.play('git pull');
  s.play('git add README.md');
  const commit = s.play('git commit -m "Merge release note with my progress note"');
  assert.ok(commit.ok, 'staging the file is how you declare it resolved');
  assert.match(s.eng.worktree()['README.md'], /<{7}/, 'but the markers are still in there');
  assert.equal(s.results()[2], false, 'so the quest still marks it unresolved');
});

test('09 — commit first, run the agent, then catch what it hid', () => {
  const s = open('agents');
  s.play('git status');
  s.play('git commit -am "Note worktrees for later"');
  assert.equal(s.results()[0], true);

  // The agent panel writes its proposal into the working tree.
  Object.keys(AGENT_EDITS).forEach((path) => {
    s.eng.writeFile(`${s.eng.activeRepo().root}/${path}`, AGENT_EDITS[path]);
  });
  s.ctx.widget.agentRan = true;

  assert.equal(s.results()[3], false, 'secrets.env is no longer ignored');
  assert.equal(s.results()[4], false, 'app.js now logs the key');

  s.play('git diff');
  s.play('git restore .gitignore');
  s.play('git restore app.js');
  s.play('git add .');
  s.play('git commit -m "Take the notes and readme tidy-up only"');
  assertSolved(s);

  const staged = s.eng.status();
  const named = staged.untracked.concat(staged.staged).map((f) => f.path);
  assert.ok(!named.includes('secrets.env'), 'the key never became committable');
  assert.ok(!/console\.log/.test(s.eng.worktree()['app.js']));
});

test('09 — accepting the agent wholesale leaves the quest unfinished', () => {
  const s = open('agents');
  s.play('git commit -am "Note worktrees for later"');
  Object.keys(AGENT_EDITS).forEach((path) => {
    s.eng.writeFile(`${s.eng.activeRepo().root}/${path}`, AGENT_EDITS[path]);
  });
  s.ctx.widget.agentRan = true;
  s.play('git diff');
  s.play('git add .');
  s.play('git commit -m "Accept everything the agent did"');

  assert.equal(s.done(), false);
  assert.ok(
    Object.keys(s.eng.headTree()).includes('secrets.env'),
    'the live Stripe key is now committed, which is the disaster the chapter is about'
  );
  assert.match(s.eng.headTree()['app.js'], /console\.log/);
});

test('10 — generate the rules file and commit it', () => {
  const Agents = require('../../src/js/agents.js');
  const s = open('rules');
  s.ctx.widget = {
    selectedAgents: ['claude-code', 'codex'],
    answers: {
      projectName: 'atlas',
      stack: 'TypeScript',
      testCommand: 'pnpm test',
      commitStyle: 'conventional',
      askBeforeCommit: true,
      noNewDeps: true
    }
  };
  assert.deepEqual(s.results().slice(0, 2), [true, true]);

  // "Write into the repo" puts one file down per selected agent.
  s.ctx.widget.selectedAgents.forEach((id) => {
    s.eng.writeFile(
      `${s.eng.activeRepo().root}/${Agents.fileNameFor(id)}`,
      Agents.buildRulesFile(id, s.ctx.widget.answers)
    );
  });
  assert.equal(s.results()[2], true);

  s.play('git add .');
  s.play('git commit -m "Add agent rules"');
  assertSolved(s);
  assert.ok(Object.keys(s.eng.headTree()).includes('CLAUDE.md'));
  assert.ok(Object.keys(s.eng.headTree()).includes('AGENTS.md'));
});

test('isUsefulMessage rejects the messages people actually type', () => {
  ['fix', 'update', 'wip', 'stuff', 'changes', '', '   ', 'asdf'].forEach((m) => {
    assert.equal(Chapters.isUsefulMessage(m), false, `"${m}" should be rejected`);
  });
  ['Add reading list for week two', 'Stop the export crashing on empty dates']
    .forEach((m) => assert.equal(Chapters.isUsefulMessage(m), true, `"${m}" should pass`));
});
