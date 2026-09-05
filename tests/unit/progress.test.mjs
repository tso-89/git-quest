import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Progress = require('../../src/js/progress.js');

const DAY = 86400000;

/** Install a fake localStorage, optionally one that throws like a locked-down browser. */
function withStorage(behaviour = 'works') {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem(k) {
        if (behaviour === 'throws') throw new Error('access denied');
        return store.has(k) ? store.get(k) : null;
      },
      setItem(k, v) {
        if (behaviour === 'throws') throw new Error('quota exceeded');
        store.set(k, v);
      },
      removeItem(k) {
        if (behaviour === 'throws') throw new Error('access denied');
        store.delete(k);
      }
    }
  };
  return {
    store,
    restore() { delete globalThis.window; }
  };
}

test('defaults are a complete, playable state', () => {
  const d = Progress.defaults();
  assert.equal(d.chapter, 0);
  assert.equal(d.xp, 0);
  assert.deepEqual(d.completed, {});
  assert.deepEqual(d.agents, []);
  assert.equal(d.streak, 1);
  assert.equal(d.lastDay, null);
});

test('load falls back to defaults when there is no storage at all', () => {
  delete globalThis.window;
  assert.deepEqual(Progress.load(), Progress.defaults());
});

test('load and save round-trip through storage', () => {
  const s = withStorage();
  try {
    const saved = { ...Progress.defaults(), xp: 350, chapter: 4, completed: { why: true } };
    Progress.save(saved);
    const loaded = Progress.load();
    assert.equal(loaded.xp, 350);
    assert.equal(loaded.chapter, 4);
    assert.deepEqual(loaded.completed, { why: true });
  } finally {
    s.restore();
  }
});

test('a storage that throws never breaks the lesson', () => {
  const s = withStorage('throws');
  try {
    assert.deepEqual(Progress.load(), Progress.defaults());
    assert.doesNotThrow(() => Progress.save({ ...Progress.defaults(), xp: 10 }));
    assert.doesNotThrow(() => Progress.reset());
  } finally {
    s.restore();
  }
});

test('corrupt stored JSON is ignored rather than fatal', () => {
  const s = withStorage();
  try {
    s.store.set(Progress.KEY, '{not json at all');
    assert.deepEqual(Progress.load(), Progress.defaults());
  } finally {
    s.restore();
  }
});

test('unknown keys in storage do not leak into state', () => {
  const s = withStorage();
  try {
    s.store.set(Progress.KEY, JSON.stringify({ xp: 40, somethingElse: 'nope' }));
    const loaded = Progress.load();
    assert.equal(loaded.xp, 40);
    assert.equal(loaded.somethingElse, undefined);
  } finally {
    s.restore();
  }
});

test('the streak starts at one, grows the next day, and resets after a gap', () => {
  const day = (n) => n * DAY + 3600000;

  const first = Progress.touchStreak(Progress.defaults(), day(100));
  assert.equal(first.streak, 1);

  const sameDay = Progress.touchStreak({ ...first }, day(100));
  assert.equal(sameDay.streak, 1, 'coming back twice in one day is still one day');

  const nextDay = Progress.touchStreak({ ...first }, day(101));
  assert.equal(nextDay.streak, 2);

  const dayAfter = Progress.touchStreak({ ...nextDay }, day(102));
  assert.equal(dayAfter.streak, 3);

  const missed = Progress.touchStreak({ ...dayAfter }, day(105));
  assert.equal(missed.streak, 1, 'a missed day resets it');
});

test('levels advance every 400 XP', () => {
  assert.equal(Progress.levelFor(0), 1);
  assert.equal(Progress.levelFor(399), 1);
  assert.equal(Progress.levelFor(400), 2);
  assert.equal(Progress.levelFor(1590), 4);

  assert.deepEqual(Progress.levelProgress(0), { into: 0, need: 400, pct: 0 });
  assert.deepEqual(Progress.levelProgress(200), { into: 200, need: 400, pct: 50 });
  assert.deepEqual(Progress.levelProgress(600), { into: 200, need: 400, pct: 50 });
});

test('reset clears storage and hands back a fresh state', () => {
  const s = withStorage();
  try {
    Progress.save({ ...Progress.defaults(), xp: 900 });
    const fresh = Progress.reset();
    assert.deepEqual(fresh, Progress.defaults());
    assert.equal(s.store.has(Progress.KEY), false);
    assert.deepEqual(Progress.load(), Progress.defaults());
  } finally {
    s.restore();
  }
});

test('numbers that came back from storage as something else are coerced', () => {
  const s = withStorage();
  try {
    s.store.set(Progress.KEY, JSON.stringify({
      xp: '<img src=x onerror=alert(1)>',
      chapter: 'not-a-number',
      streak: null,
      completed: { why: true }
    }));
    const state = Progress.load();
    assert.equal(state.xp, 0, 'xp must be a number, not markup waiting for innerHTML');
    assert.equal(state.chapter, 0, 'Chapters.list[NaN] is a blank page');
    assert.equal(state.streak, 1, 'null is skipped, so the default stands');
    assert.deepEqual(state.completed, { why: true }, 'well-formed values still come through');
  } finally {
    s.restore();
  }
});

test('a stored value of the wrong shape falls back to the default', () => {
  const s = withStorage();
  try {
    s.store.set(Progress.KEY, JSON.stringify({ agents: 'claude-code', answers: 7, username: 42 }));
    const state = Progress.load();
    assert.deepEqual(state.agents, [], 'a string is not a list of agents');
    assert.deepEqual(state.answers, {}, 'a number is not an answers object');
    assert.equal(state.username, '42', 'but anything can be read as a username string');
  } finally {
    s.restore();
  }
});

test('the streak still survives a round-trip through storage', () => {
  const s = withStorage();
  try {
    const saved = Progress.touchStreak(Progress.defaults(), Date.now());
    Progress.save(saved);
    const loaded = Progress.load();
    assert.equal(loaded.lastDay, saved.lastDay, 'lastDay defaults to null but stores a number');
    assert.equal(Progress.touchStreak(loaded, Date.now() + DAY).streak, 2);
  } finally {
    s.restore();
  }
});
