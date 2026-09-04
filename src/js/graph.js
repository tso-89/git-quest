/**
 * graph.js — draws the repository's history as an SVG.
 *
 * Oldest commit on the left, newest on the right, one row per lane. It redraws
 * after every command, because watching a node appear the instant you commit is
 * most of how the model lands.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.GQ = root.GQ || {}; root.GQ.Graph = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STEP_X = 86;
  var STEP_Y = 34;
  var PAD_X = 26;
  var PAD_Y = 24;
  var LABEL_ROOM = 26;

  /**
   * Order every reachable commit oldest-first and give each one a lane.
   * The first parent keeps its child's lane; other parents start a new one.
   */
  function layout(eng) {
    var repo = eng.activeRepo();
    if (!repo) return { nodes: [], lanes: 0 };

    var heads = {};
    Object.keys(repo.branches).forEach(function (b) { heads[repo.branches[b]] = true; });
    var headSha = eng.headSha();
    if (headSha) heads[headSha] = true;

    var reachable = {};
    Object.keys(heads).forEach(function (sha) {
      eng.ancestry(sha).forEach(function (s) { reachable[s] = true; });
    });

    var ordered = Object.keys(reachable)
      .map(function (sha) { return repo.objects[sha]; })
      .filter(Boolean)
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date - b.date;
        return a.sha < b.sha ? -1 : 1;
      });

    var branchesBySha = {};
    Object.keys(repo.branches).sort().forEach(function (b) {
      var sha = repo.branches[b];
      branchesBySha[sha] = (branchesBySha[sha] || []).concat(b);
    });

    // Assign lanes newest-first so a branch keeps one row along its length.
    var lane = {};
    var nextLane = 0;
    for (var i = ordered.length - 1; i >= 0; i -= 1) {
      var c = ordered[i];
      if (lane[c.sha] === undefined) {
        lane[c.sha] = nextLane;
        nextLane += 1;
      }
      c.parents.forEach(function (p, pi) {
        if (lane[p] === undefined) {
          lane[p] = pi === 0 ? lane[c.sha] : nextLane;
          if (pi !== 0) nextLane += 1;
        } else if (pi === 0) {
          lane[p] = Math.min(lane[p], lane[c.sha]);
        }
      });
    }

    var nodes = ordered.map(function (c, index) {
      return {
        sha: c.sha,
        message: c.message,
        parents: c.parents,
        merge: c.parents.length > 1,
        x: PAD_X + index * STEP_X,
        y: PAD_Y + (lane[c.sha] || 0) * STEP_Y,
        lane: lane[c.sha] || 0,
        branches: branchesBySha[c.sha] || [],
        isHead: c.sha === headSha
      };
    });

    var maxLane = 0;
    nodes.forEach(function (n) { if (n.lane > maxLane) maxLane = n.lane; });
    return { nodes: nodes, lanes: maxLane + 1 };
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function truncate(s, n) {
    var str = String(s);
    return str.length > n ? str.slice(0, n - 1) + '…' : str;
  }

  function render(eng) {
    var data = layout(eng);
    if (!data.nodes.length) {
      return '<p class="graph-empty">No commits yet. The graph fills in as you make them.</p>';
    }

    var byId = {};
    data.nodes.forEach(function (n) { byId[n.sha] = n; });

    var width = PAD_X * 2 + Math.max(0, data.nodes.length - 1) * STEP_X + 40;
    var height = PAD_Y * 2 + (data.lanes - 1) * STEP_Y + LABEL_ROOM;

    var edges = '';
    data.nodes.forEach(function (n) {
      n.parents.forEach(function (p) {
        var parent = byId[p];
        if (!parent) return;
        if (parent.y === n.y) {
          edges += '<line x1="' + parent.x + '" y1="' + parent.y + '" x2="' + n.x + '" y2="' + n.y
            + '" class="g-edge" />';
        } else {
          var mid = parent.x + (n.x - parent.x) / 2;
          edges += '<path d="M' + parent.x + ' ' + parent.y
            + ' C' + mid + ' ' + parent.y + ', ' + mid + ' ' + n.y + ', ' + n.x + ' ' + n.y
            + '" class="g-edge" fill="none" />';
        }
      });
    });

    var circles = '';
    var labels = '';
    data.nodes.forEach(function (n) {
      var cls = 'g-node' + (n.isHead ? ' is-head' : '') + (n.merge ? ' is-merge' : '');
      circles += '<circle cx="' + n.x + '" cy="' + n.y + '" r="' + (n.isHead ? 7 : 5.5) + '" class="' + cls + '">'
        + '<title>' + esc(n.sha + '  ' + n.message) + '</title></circle>';
      labels += '<text x="' + n.x + '" y="' + (PAD_Y + (data.lanes - 1) * STEP_Y + 20)
        + '" class="g-sha' + (n.isHead ? ' is-head' : '') + '" text-anchor="middle">' + esc(n.sha) + '</text>';
      if (n.branches.length) {
        labels += '<text x="' + n.x + '" y="' + (n.y - 12) + '" class="g-ref" text-anchor="middle">'
          + esc(truncate(n.branches.join(', '), 18)) + '</text>';
      }
    });

    return '<svg viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height
      + '" role="img" aria-label="Commit history: ' + data.nodes.length + ' commits">'
      + edges + circles + labels + '</svg>';
  }

  return { render: render, layout: layout };
}));
