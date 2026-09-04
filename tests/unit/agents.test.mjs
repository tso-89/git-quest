import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Agents = require('../../src/js/agents.js');

const ANSWERS = {
  projectName: 'atlas',
  projectDescription: 'Tracks reading notes',
  stack: 'TypeScript + React',
  testCommand: 'pnpm test',
  commitStyle: 'conventional',
  askBeforeCommit: true,
  noNewDeps: true
};

test('every agent is fully described', () => {
  assert.equal(Agents.list.length, 4);
  Agents.list.forEach((a) => {
    ['id', 'name', 'vendor', 'surface', 'file', 'where', 'gitNote', 'tip'].forEach((key) => {
      assert.ok(a[key], `${a.id} is missing ${key}`);
    });
    assert.ok(Array.isArray(a.extras) && a.extras.length);
  });
});

test('each agent maps to the filename it actually reads', () => {
  assert.equal(Agents.fileNameFor('claude-code'), 'CLAUDE.md');
  assert.equal(Agents.fileNameFor('codex'), 'AGENTS.md');
  assert.equal(Agents.fileNameFor('antigravity'), 'GEMINI.md');
  assert.equal(Agents.fileNameFor('claude-desktop'), 'CLAUDE.md', 'desktop gets the repo file too');
  assert.equal(Agents.fileNameFor('nonsense'), 'AGENTS.md', 'unknown agents fall back safely');
});

test('the generated file carries the project answers', () => {
  const file = Agents.buildRulesFile('claude-code', ANSWERS);
  assert.match(file, /^# atlas\n/);
  assert.match(file, /TypeScript \+ React/);
  assert.match(file, /`pnpm test`/);
  assert.match(file, /Tracks reading notes/);
});

test('the git rules are always present, whichever agent', () => {
  Agents.list.forEach((a) => {
    const file = Agents.buildRulesFile(a.id, ANSWERS);
    assert.match(file, /## Git rules/, `${a.id} lost its git rules`);
    assert.match(file, /Never commit directly to `main`/);
    assert.match(file, /Never run `git push --force` on `main`/);
    assert.match(file, /Never commit `\.env`, credentials, API keys or tokens/);
    assert.match(file, /Run `pnpm test` before every commit/);
  });
});

test('commit style changes the rule that gets written', () => {
  const conventional = Agents.buildRulesFile('codex', ANSWERS);
  assert.match(conventional, /Conventional Commits/);
  assert.doesNotMatch(conventional, /one short line saying what changed/);

  const plain = Agents.buildRulesFile('codex', { ...ANSWERS, commitStyle: 'plain' });
  assert.match(plain, /one short line saying what changed/);
  assert.doesNotMatch(plain, /Conventional Commits/);
});

test('the ask-before-commit toggle flips the instruction, not just the wording', () => {
  const asks = Agents.buildRulesFile('codex', ANSWERS);
  assert.match(asks, /Show me the diff and wait for my go-ahead before committing/);

  const autonomous = Agents.buildRulesFile('codex', { ...ANSWERS, askBeforeCommit: false });
  assert.match(autonomous, /never push without asking/);
  assert.doesNotMatch(autonomous, /wait for my go-ahead/);
});

test('the dependency rule only appears when asked for', () => {
  assert.match(Agents.buildRulesFile('codex', ANSWERS), /Do not add a new dependency/);
  assert.doesNotMatch(
    Agents.buildRulesFile('codex', { ...ANSWERS, noNewDeps: false }),
    /Do not add a new dependency/
  );
});

test('agent-specific sections only appear for their own agent', () => {
  assert.match(Agents.buildRulesFile('claude-code', ANSWERS), /## Claude Code specifics/);
  assert.doesNotMatch(Agents.buildRulesFile('codex', ANSWERS), /## Claude Code specifics/);
  assert.match(Agents.buildRulesFile('claude-desktop', ANSWERS), /Project's custom instructions/);
});

test('empty answers still produce a usable file rather than blanks', () => {
  const file = Agents.buildRulesFile('codex', {});
  assert.match(file, /^# my-project\n/);
  assert.match(file, /not specified yet/);
  assert.match(file, /`npm test`/);
  assert.ok(!file.includes('undefined'), 'no undefined leaked into the output');
});
