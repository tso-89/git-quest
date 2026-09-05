/**
 * End-to-end: load the built bundle in headless Chrome, type into the real
 * terminal, and assert the quest reacts. This is the only test that proves the
 * DOM wiring works — everything else tests logic with no browser involved.
 *
 * Skips (rather than fails) when no Chrome binary is present.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bundle = join(root, 'index.html');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
const skip = !chrome ? 'no Chrome binary found (set CHROME_PATH to run this)' : false;

/**
 * Render `page` with the given in-page script appended, and return whatever the
 * script wrote into #HARNESS.
 */
function renderWithScript(script) {
  const dir = mkdtempSync(join(tmpdir(), 'git-quest-e2e-'));
  const file = join(dir, 'harness.html');
  const html = readFileSync(bundle, 'utf8').replace(
    '</body>',
    `<script>
(function () {
  var log = [];
  function record(k, v) { log.push(k + '=' + v); }
  try { ${script} } catch (e) { log.push('EXCEPTION=' + e.message); }
  var pre = document.createElement('pre');
  pre.id = 'HARNESS';
  pre.textContent = log.join('\\n');
  document.body.appendChild(pre);
}());
</script>
</body>`
  );
  writeFileSync(file, html);

  const dom = execFileSync(chrome, [
    '--headless', '--disable-gpu', '--no-sandbox',
    '--virtual-time-budget=5000', '--dump-dom',
    `file://${file}`
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });

  const match = dom.match(/<pre id="HARNESS">([\s\S]*?)<\/pre>/);
  assert.ok(match, 'the harness never ran — the page probably threw during startup');
  const text = match[1]
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  const out = {};
  text.split('\n').filter(Boolean).forEach((line) => {
    const i = line.indexOf('=');
    out[line.slice(0, i)] = line.slice(i + 1);
  });
  assert.equal(out.EXCEPTION, undefined, `page threw: ${out.EXCEPTION}`);
  return out;
}

const TYPE_HELPER = `
  function type(line) {
    var input = document.querySelector('.term-input');
    if (!input) throw new Error('no terminal input on the page');
    input.value = line;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }
  function stepStates() {
    return Array.prototype.map.call(
      document.querySelectorAll('.qs'),
      function (li) { return li.classList.contains('is-done') ? 'done' : 'todo'; }
    ).join(',');
  }
`;

test('the page boots and renders chapter 00 at rest', { skip }, () => {
  const out = renderWithScript(`
    record('title', document.querySelector('.ch-title').textContent);
    record('steps', document.querySelectorAll('.qs').length);
    record('nodes', document.querySelectorAll('.node').length);
    record('prompt', !!document.querySelector('.term-ps').textContent.trim());
    record('graph', document.querySelectorAll('.g-node').length);
    record('questAboveProse',
      document.querySelector('.quest').compareDocumentPosition(document.querySelector('.prose'))
      === Node.DOCUMENT_POSITION_FOLLOWING);
  `);

  assert.equal(out.title, 'Break it, then get it back');
  assert.equal(out.steps, '5');
  assert.equal(out.nodes, '11', 'one map node per chapter');
  assert.equal(out.prompt, 'true');
  assert.equal(out.graph, '1', 'the seeded commit is drawn');
  assert.equal(out.questAboveProse, 'true');
});

test('typing in the terminal drives the engine and ticks the quest', { skip }, () => {
  const out = renderWithScript(`
    ${TYPE_HELPER}
    record('before', stepStates());
    record('placeholder', document.querySelector('.term-input').placeholder);
    type('ls');
    type('cat story.md');
    record('looked', stepStates());
    type('echo "ruined" > story.md');
    type('git status');
    record('mid', stepStates());
    type('git restore story.md');
    record('after', stepStates());
    record('complete', !!document.querySelector('.quest.is-complete'));
    record('xp', document.getElementById('hud-xp-text').textContent);
    record('restored', /Restored 1 file/.test(document.querySelector('.term-out').textContent));
  `);

  assert.equal(out.before, 'todo,todo,todo,todo,todo');
  assert.match(out.placeholder, /Type a command/, 'the input says it is an input');
  assert.equal(out.looked, 'done,done,todo,todo,todo', 'looking around is safe and counts');
  assert.equal(out.mid, 'done,done,done,done,todo');
  assert.equal(out.after, 'done,done,done,done,done');
  assert.equal(out.complete, 'true');
  assert.equal(out.xp, '100 / 1590 XP', 'finishing the chapter awards its XP');
  assert.equal(out.restored, 'true');
});

test('a commit redraws the history graph', { skip }, () => {
  const out = renderWithScript(`
    ${TYPE_HELPER}
    record('before', document.querySelectorAll('.g-node').length);
    record('anatomy', document.querySelectorAll('.anatomy .an-part').length);
    record('anatomyKeys', document.querySelectorAll('.anatomy .an-keys li').length);
    var line = document.querySelector('.an-line');
    record('anatomyFits', line.scrollWidth <= line.clientWidth + 1);
    record('loadChips', document.querySelectorAll('.cmd .cmd-go').length > 0);
    // Baseline alignment gives boxes of different heights different offsetTops
    // even on one line, so ask whether they overlap vertically instead.
    var row = document.querySelector('.cmd');
    var codeRect = row.querySelector('code').getBoundingClientRect();
    var chipRect = row.querySelector('.cmd-go').getBoundingClientRect();
    record('chipOnSameRow', codeRect.bottom > chipRect.top && chipRect.bottom > codeRect.top);
    type('echo "new line" >> story.md');
    type('git add story.md');
    type('git commit -m "Add a line to the piece"');
    record('after', document.querySelectorAll('.g-node').length);
    record('head', document.querySelectorAll('.g-node.is-head').length);
  `);

  assert.equal(out.before, '1');
  assert.equal(out.anatomy, '4', 'the prompt breakdown renders its four parts');
  assert.equal(out.anatomyKeys, '4', 'each part gets a label');
  assert.equal(out.anatomyFits, 'true', 'the prompt line is not clipped');
  assert.equal(out.loadChips, 'true', 'commands advertise that clicking loads them');
  assert.equal(out.chipOnSameRow, 'true', 'the load chip sits beside the command, not under it');
  assert.equal(out.after, '2', 'the new commit appears in the graph');
  assert.equal(out.head, '1', 'exactly one node is marked HEAD');
});

test('the agent chapter opens a third pane and the agent can be run', { skip }, () => {
  const out = renderWithScript(`
    ${TYPE_HELPER}
    document.querySelectorAll('[data-goto]')[9].click();
    record('chapter', document.querySelector('.ch-title').textContent);
    record('agentPaneVisible', !document.getElementById('agent-pane').hidden);
    record('threeCols', document.getElementById('stage').classList.contains('has-agent'));
    type('git commit -am "Note worktrees for later"');
    document.querySelector('[data-agent-run]').click();
    record('summaryShown', /Four files changed/.test(document.querySelector('.ap-thread').textContent));
    type('git diff');
    record('diffShowsConsoleLog',
      /console\\.log/.test(document.querySelector('.term-out').textContent));
    record('diffShowsSecretsRemoval',
      /-secrets\\.env/.test(document.querySelector('.term-out').textContent));
  `);

  assert.equal(out.chapter, 'Git when an agent is typing');
  assert.equal(out.agentPaneVisible, 'true');
  assert.equal(out.threeCols, 'true');
  assert.equal(out.summaryShown, 'true', 'the agent reports four files but lists only three');
  assert.equal(out.diffShowsConsoleLog, 'true', 'the diff exposes the logging the summary omitted');
  assert.equal(out.diffShowsSecretsRemoval, 'true', 'and the removed gitignore line');
});

test('switching to a widget chapter renders its workbench', { skip }, () => {
  const out = renderWithScript(`
    document.querySelectorAll('[data-goto]')[3].click();
    record('chapter', document.querySelector('.ch-title').textContent);
    record('sortRows', document.querySelectorAll('.sort-row').length);
    record('tabs', document.querySelectorAll('.work-tab').length);
    document.querySelector('[data-file="0"][data-keep="1"]').click();
    record('firstJudged', !!document.querySelector('.sort-row.is-right'));
    document.querySelectorAll('.work-tab')[1].click();
    record('terminalAfterTab', !!document.querySelector('.term-input'));
  `);

  assert.equal(out.chapter, 'Public, private, and the key you cannot unsee');
  assert.equal(out.sortRows, '10');
  assert.equal(out.tabs, '2', 'a widget chapter offers both the workbench and the terminal');
  assert.equal(out.firstJudged, 'true');
  assert.equal(out.terminalAfterTab, 'true');
});

test('the rules builder generates a file and writes it into the sandbox', { skip }, () => {
  const out = renderWithScript(`
    document.querySelectorAll('[data-goto]')[10].click();
    document.querySelector('[data-agent="claude-code"]').click();
    var name = document.querySelector('[data-r="projectName"]');
    name.value = 'atlas';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    var testCmd = document.querySelector('[data-r="testCommand"]');
    testCmd.value = 'pnpm test';
    testCmd.dispatchEvent(new Event('input', { bubbles: true }));
    record('preview', document.querySelector('.rules-out').textContent.indexOf('# atlas') === 0);
    record('hasGitRules', /Never commit directly to/.test(document.querySelector('.rules-out').textContent));
    document.querySelector('[data-rules-write]').click();
    record('status', document.querySelector('.rules-status').textContent);
    record('stepsDone', document.querySelectorAll('.qs.is-done').length);
  `);

  assert.equal(out.preview, 'true');
  assert.equal(out.hasGitRules, 'true', 'the git rules are the point of the file');
  assert.match(out.status, /Wrote CLAUDE\.md/);
  assert.equal(out.stepsDone, '3', 'only the final commit step is left');
});
