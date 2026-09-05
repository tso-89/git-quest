/**
 * progress.js — what the learner keeps between visits.
 *
 * localStorage can throw or come back empty (private windows, cleared data,
 * thumbnail capture), so every read and write is guarded and the app must work
 * with the default state.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.GQ = root.GQ || {}; root.GQ.Progress = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'git-quest.progress.v1';

  function defaults() {
    return {
      chapter: 0,
      xp: 0,
      completed: {},
      agents: [],
      answers: {},
      username: '',
      streak: 1,
      lastDay: null
    };
  }

  function dayNumber(now) {
    return Math.floor((now || Date.now()) / 86400000);
  }

  var NUMBERS = { chapter: true, xp: true, streak: true };

  function load() {
    var state = defaults();
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        Object.keys(state).forEach(function (k) {
          if (parsed[k] === undefined || parsed[k] === null) return;
          // Whatever is in storage is not necessarily what we wrote there.
          if (NUMBERS[k]) state[k] = Number(parsed[k]) || 0;
          else if (k === 'lastDay') state[k] = isFinite(parsed[k]) ? Number(parsed[k]) : null;
          else if (typeof state[k] === 'string') state[k] = String(parsed[k]);
          else if (typeof parsed[k] === typeof state[k]) state[k] = parsed[k];
        });
      }
    } catch (e) {
      // No storage available. A fresh run is a perfectly good fallback.
    }
    return state;
  }

  function save(state) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      // Nothing to do — progress simply will not persist this session.
    }
    return state;
  }

  /** Bump the streak on a new calendar day; reset it if a day was missed. */
  function touchStreak(state, now) {
    var today = dayNumber(now);
    if (state.lastDay === null) {
      state.streak = 1;
    } else if (today === state.lastDay + 1) {
      state.streak += 1;
    } else if (today > state.lastDay + 1) {
      state.streak = 1;
    }
    state.lastDay = today;
    return state;
  }

  function levelFor(xp) {
    return Math.floor(xp / 400) + 1;
  }

  function levelProgress(xp) {
    var into = xp % 400;
    return { into: into, need: 400, pct: Math.round((into / 400) * 100) };
  }

  function reset() {
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    return defaults();
  }

  return {
    KEY: KEY,
    load: load,
    save: save,
    reset: reset,
    defaults: defaults,
    touchStreak: touchStreak,
    dayNumber: dayNumber,
    levelFor: levelFor,
    levelProgress: levelProgress
  };
}));
