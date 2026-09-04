/**
 * agents.js — what each coding agent reads, and the rules file we generate for it.
 *
 * Filenames and locations are the durable facts here; the surrounding tooling
 * moves fast, so the copy points people at their own docs for the rest.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.GQ = root.GQ || {}; root.GQ.Agents = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var AGENTS = [
    {
      id: 'claude-code',
      name: 'Claude Code',
      vendor: 'Anthropic',
      surface: 'Terminal, IDE extension, desktop app',
      file: 'CLAUDE.md',
      where: 'Repository root. Also read from ~/.claude/CLAUDE.md for every project.',
      extras: ['.claude/settings.json — permissions and hooks',
        '.claude/agents/ — specialised subagents',
        '.claude/commands/ — your own slash commands'],
      gitNote: 'Runs git itself. It can stage, commit and open pull requests, so the rules '
        + 'you write about commits are rules it will actually follow.',
      tip: 'Ask it to "commit this" and it writes the message from the diff. Ask it to '
        + '"show me the diff first" and you stay in charge.'
    },
    {
      id: 'claude-desktop',
      name: 'Claude Desktop',
      vendor: 'Anthropic',
      surface: 'Desktop app (Mac / Windows)',
      file: 'Project instructions',
      where: 'Paste the same rules into a Project\'s custom instructions. Connect a repo '
        + 'through an MCP filesystem or GitHub server.',
      extras: ['Projects — one per repo, with your rules pinned',
        'MCP servers — how the app reaches your files or GitHub'],
      gitNote: 'Does not run git in a terminal for you. It reads and writes files, so you '
        + 'commit afterwards — which makes committing before you start non-negotiable.',
      tip: 'Keep a CLAUDE.md in the repo anyway, and paste it into the Project. One source '
        + 'of truth, two places that read it.'
    },
    {
      id: 'antigravity',
      name: 'Google Antigravity',
      vendor: 'Google',
      surface: 'Agent-first IDE',
      file: 'GEMINI.md',
      where: 'Repository root. Many Google tools also pick up AGENTS.md if it is there.',
      extras: ['.agents/ — skills and workflows',
        'Workspace-level settings for what agents may run'],
      gitNote: 'Runs multiple agents over the same workspace, which is exactly when a branch '
        + 'per task stops being optional.',
      tip: 'If you also use Codex, keep the content in AGENTS.md and make GEMINI.md a '
        + 'one-line pointer at it.'
    },
    {
      id: 'codex',
      name: 'OpenAI Codex',
      vendor: 'OpenAI',
      surface: 'CLI, IDE extension, cloud',
      file: 'AGENTS.md',
      where: 'Repository root. Nested AGENTS.md files apply to their own subdirectory.',
      extras: ['~/.codex/config.toml — approval mode and sandbox',
        'Nested AGENTS.md — different rules per package'],
      gitNote: 'Works on a branch and hands you a diff. Reading that diff is the skill; '
        + 'the rules file is how you make the diff smaller.',
      tip: 'AGENTS.md is the closest thing to a cross-vendor standard. Write it once and '
        + 'let the others point at it.'
    }
  ];

  function byId(id) {
    var found = null;
    AGENTS.forEach(function (a) { if (a.id === id) found = a; });
    return found;
  }

  /** The git section every generated rules file gets — this is the point of the lesson. */
  function gitRules(answers) {
    var test = answers.testCommand || 'npm test';
    var lines = [
      '## Git rules',
      '',
      '- Before starting a new task, check the branch. If it is `main`, create one:',
      '  `feat/<slug>`, `fix/<slug>`, `docs/<slug>` or `chore/<slug>`.',
      '- Never commit directly to `main`.',
      '- Commit in small steps. One commit should undo cleanly on its own.'
    ];
    if (answers.commitStyle === 'conventional') {
      lines.push('- Commit messages use Conventional Commits: `type(scope): summary`,');
      lines.push('  where type is feat, fix, docs, refactor, test, chore, perf or ci.');
      lines.push('- Explain **why** in the body when the reason is not obvious from the diff.');
    } else {
      lines.push('- Commit messages: one short line saying what changed and why.');
      lines.push('  Present tense, no trailing period, under 72 characters.');
    }
    lines.push('- Never run `git push --force` on `main`.');
    lines.push('- Never commit `.env`, credentials, API keys or tokens. If you find one');
    lines.push('  already committed, stop and tell me — do not just delete it.');
    if (answers.askBeforeCommit) {
      lines.push('- Show me the diff and wait for my go-ahead before committing.');
    } else {
      lines.push('- You may commit without asking, but never push without asking.');
    }
    lines.push('- Run `' + test + '` before every commit. If it fails, say so — do not commit around it.');
    return lines.join('\n');
  }

  /** Build the whole rules file for one agent from the learner's answers. */
  function buildRulesFile(agentId, answers) {
    var agent = byId(agentId) || AGENTS[0];
    var name = answers.projectName || 'my-project';
    var stack = answers.stack || 'not specified yet';
    var test = answers.testCommand || 'npm test';
    var parts = [];

    parts.push('# ' + name);
    parts.push('');
    parts.push('> Rules for AI coding agents working in this repository.');
    parts.push('> Read this before changing anything.');
    parts.push('');
    parts.push('## The project');
    parts.push('');
    parts.push('- **Stack:** ' + stack);
    parts.push('- **Run the tests:** `' + test + '`');
    if (answers.projectDescription) {
      parts.push('- **What it does:** ' + answers.projectDescription);
    }
    parts.push('');
    parts.push('## How to work here');
    parts.push('');
    parts.push('- Match the style of the code around you, even if you would write it differently.');
    parts.push('- Change only what the task needs. Do not tidy adjacent code.');
    parts.push('- If something is ambiguous, ask instead of guessing.');
    if (answers.noNewDeps) {
      parts.push('- Do not add a new dependency without asking first.');
    }
    parts.push('');
    parts.push(gitRules(answers));

    if (agent.id === 'claude-code') {
      parts.push('');
      parts.push('## Claude Code specifics');
      parts.push('');
      parts.push('- Permissions and hooks live in `.claude/settings.json`.');
      parts.push('- Prefer small, reviewable edits over large rewrites.');
    }
    if (agent.id === 'antigravity' && answers.alsoAgentsMd) {
      parts.push('');
      parts.push('## Note');
      parts.push('');
      parts.push('The rules above are duplicated in `AGENTS.md` for other tools. Keep them in sync,');
      parts.push('or make one file a pointer at the other.');
    }
    if (agent.id === 'claude-desktop') {
      parts.push('');
      parts.push('## Using this in Claude Desktop');
      parts.push('');
      parts.push('Paste this file into the Project\'s custom instructions, and keep the original');
      parts.push('in the repo so every other tool reads the same rules.');
    }
    parts.push('');
    return parts.join('\n');
  }

  function fileNameFor(agentId) {
    var a = byId(agentId);
    if (!a) return 'AGENTS.md';
    return a.id === 'claude-desktop' ? 'CLAUDE.md' : a.file;
  }

  return {
    list: AGENTS,
    byId: byId,
    buildRulesFile: buildRulesFile,
    fileNameFor: fileNameFor
  };
}));
