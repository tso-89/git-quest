/**
 * chapters.js — the lesson itself.
 *
 * Each chapter seeds its own sandbox, renders some prose, and sets a quest.
 * Quest steps are checked against engine state rather than against the exact
 * string the learner typed, so there is always more than one right way through.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.GQ = root.GQ || {}; root.GQ.Chapters = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HOME = '/home/you';

  // ------------------------------------------------------------- seed content

  var STORY = [
    '# The Tuesday Deploy',
    '',
    'It went out at 4:47pm on a Tuesday, which is the first mistake.',
    'Nobody had written down what changed. There were eleven files open',
    'and three of them had been edited by something that was not a person.'
  ].join('\n');

  var README = [
    '# my-first-repo',
    '',
    'Learning git properly, finally.'
  ].join('\n');

  /** Has the learner typed a command matching this pattern? */
  function typed(ctx, re) {
    return (ctx.history || []).some(function (h) { return re.test(h); });
  }

  function commitCount(ctx) {
    return ctx.eng.ancestry(ctx.eng.headSha()).length;
  }

  function messageOf(ctx, index) {
    var chain = ctx.eng.ancestry(ctx.eng.headSha());
    var repo = ctx.eng.activeRepo();
    if (!repo || !chain[index || 0]) return '';
    return repo.objects[chain[index || 0]].message;
  }

  /** A commit message that would still mean something in six months. */
  function isUsefulMessage(msg) {
    var m = String(msg || '').trim();
    if (m.length < 12) return false;
    return !/^(fix|update|updates|changes|stuff|wip|asdf|test)$/i.test(m);
  }

  /** Does the file still contain conflict markers? */
  function hasConflictMarkers(text) {
    return /^(<{7}|={7}|>{7})/m.test(String(text || ''));
  }

  // ------------------------------------------------------------------ chapters

  var chapters = [

    // ------------------------------------------------------------------- 00
    {
      id: 'why',
      title: 'The twenty-second undo',
      subtitle: 'What git is, and what this lesson will teach you',
      xp: 100,
      pane: 'terminal',
      terminalHint: 'Type a command here and press Enter',
      setup: function (eng) {
        var root = HOME + '/story';
        eng.init(root);
        eng.cwd = root;
        eng.writeFile(root + '/story.md', STORY);
        eng.stage('story.md');
        eng.commit('Start the Tuesday piece');
      },
      blocks: [
        { p: 'Everyone arrives here the same way. A folder with <code>report.docx</code>, <code>report_v2.docx</code>, <code>report_v2_FINAL.docx</code>, and <code>report_v2_FINAL_actually.docx</code> — and no idea which one the good paragraph is in.' },
        { p: '<strong>Git</strong> is a program that remembers every version of a folder. You tell it when to take a snapshot; it keeps every snapshot you ever took, with your name, the date and a line about why. You can compare any two of them and go back to any one of them. That is what <em>version control</em> means, and it is all git does.' },
        { p: 'People have used it for that for twenty years. But there is a newer reason, and it is more urgent. An AI agent can rewrite nine files in ninety seconds. It will tell you what it did in three cheerful sentences. Those sentences are a <em>summary</em>, and summaries leave things out.' },
        { note: 'Git is the only thing standing between "the agent changed something" and "the agent changed <em>exactly these forty lines</em>, and here is the button that puts them back."', kind: 'key' },

        { h: 'How this lesson works' },
        { p: 'Eleven short chapters. Each one teaches one idea on this side of the screen, then hands you a <strong>quest</strong> — the box with the numbered steps above this text — that you finish by doing the thing on the other side. Steps tick themselves off as you go, you collect XP, and the next chapter is one click away. The map along the top shows where you are.' },
        { p: 'By the end you will have started a repository, put it on GitHub, run the daily save-and-share loop until it is boring, made and merged a branch, undone a mistake, resolved a conflict with a teammate, caught an agent slipping something past you, and written the rules file that stops it happening again. Every one of those is a thing you will have <em>done</em>, not read about.' },
        { note: 'Nothing to install and no account needed to start. Chapter 01 walks you through the GitHub account when you get there.', kind: 'tip' },

        { h: 'First: that black panel on the right' },
        { p: 'That is a <strong>terminal</strong>. You will also hear it called the command line, the shell, or the console — all the same thing. It is a box where you type the name of something you want done, press Enter, and the computer does it and prints an answer back.' },
        { p: 'It is not more dangerous than clicking. It is just fussier about spelling. And this particular one is a pretend computer that lives inside this web page: it has no connection to your real files, no internet, and no way to touch anything you care about. There is nothing here you can break.' },
        { note: 'Everything below can be run by clicking it in the grey boxes on this page — you never have to type anything from memory. Clicking loads the command into the terminal; then press Enter.', kind: 'tip' },

        { h: 'Reading the line before the cursor' },
        { p: 'Before the part you type, the terminal tells you who you are and where you are:' },
        { anatomy: true },
        { p: '<code>~</code> is shorthand for your home folder — the one your documents live in. So <code>~/story</code> means "a folder called <strong>story</strong>, inside my home folder". That folder is where you are standing right now, and it has exactly one file in it.' },
        { p: 'The <code>$</code> is the terminal saying <em>your turn</em>. You type after it, never before it.' },

        { h: 'Look around before you touch anything' },
        { p: 'Two commands to start, and neither one changes a single thing. <code>ls</code> <strong>lists</strong> what is in the folder you are standing in. <code>cat</code> prints a file to the screen so you can read it.' },
        { cmds: [
          { cmd: 'ls', desc: 'what is in this folder?' },
          { cmd: 'cat story.md', desc: 'show me what is in that file' }
        ] },
        { p: 'That file has already been saved into git\'s memory once. Git has a copy of exactly how it looks right now, whether you like the next thing you do to it or not.' },

        { h: 'Now wreck it, on purpose' },
        { p: 'The interesting character here is <code>&gt;</code>. On its own, <code>echo</code> just prints whatever you give it straight back at you. Put a <code>&gt;</code> and a filename after it and the text goes <strong>into that file instead</strong> — wiping out everything that was there before. It is the fastest way to ruin a file, which is exactly what we want.' },
        { p: 'Or skip the subtlety and delete the file outright with <code>rm</code>, short for remove. Either one is fine. Be as destructive as you like.' },
        { cmds: [
          { cmd: 'echo "ruined" > story.md', desc: 'replace everything in the file with the word ruined' },
          { cmd: 'rm story.md', desc: 'or delete the file completely' }
        ] },

        { h: 'Then get it back' },
        { p: '<code>git status</code> asks git what it has noticed since its last saved copy. <code>git restore</code> puts a file back the way git remembers it.' },
        { cmds: [
          { cmd: 'git status', desc: 'git, what changed?' },
          { cmd: 'cat story.md', desc: 'confirm the damage is real' },
          { cmd: 'git restore story.md', desc: 'put it back the way it was' }
        ] },
        { note: 'Nothing you do in this sandbox is permanent either. The <strong>Reset chapter</strong> button at the top right puts everything back to how it started, as many times as you want.', kind: 'tip' }
      ],
      quest: {
        title: 'Look, break, then undo',
        brief: 'Five commands. The first two only look at things. Then you destroy a file and get it back.',
        steps: [
          {
            label: 'See what is in the folder',
            hint: 'Click <code>ls</code> in the first grey box above — or type it into the terminal yourself — then press Enter.',
            check: function (ctx) { return typed(ctx, /^ls(\s|$)/); }
          },
          {
            label: 'Read the file',
            hint: 'Click or type <code>cat story.md</code>, then press Enter. It prints the file to the screen.',
            check: function (ctx) { return typed(ctx, /^cat\s+story\.md/); }
          },
          {
            label: 'Ruin story.md — overwrite it, or delete it',
            hint: '<code>echo "ruined" &gt; story.md</code> replaces the contents. <code>rm story.md</code> deletes it outright. Either counts.',
            check: function (ctx) {
              var work = ctx.eng.worktree();
              var head = ctx.eng.headTree();
              ctx.flags.damaged = ctx.flags.damaged || work['story.md'] !== head['story.md'];
              return !!ctx.flags.damaged;
            }
          },
          {
            label: 'Ask git what it noticed',
            hint: 'Type <code>git status</code>. It compares what is on disk right now against the copy it remembers.',
            check: function (ctx) { return typed(ctx, /^git\s+status/); }
          },
          {
            label: 'Put it back',
            hint: '<code>git restore story.md</code> copies the remembered version back over the broken one. Then <code>cat story.md</code> to see that it worked.',
            check: function (ctx) {
              var work = ctx.eng.worktree();
              var head = ctx.eng.headTree();
              return !!ctx.flags.damaged && work['story.md'] === head['story.md'];
            }
          }
        ]
      },
      outro: 'That is the whole promise, and you just used it. Everything from here is detail about how git remembers, and how to make it remember usefully.'
    },

    // ------------------------------------------------------------------- 01
    {
      id: 'account',
      title: 'A name you will still want in five years',
      subtitle: 'Getting a GitHub account, without regret',
      xp: 80,
      pane: 'widget',
      widget: 'username',
      setup: function (eng) { eng.cwd = HOME; eng.mkdirp(HOME); },
      blocks: [
        { p: 'Git and GitHub are not the same thing. <strong>Git</strong> is the program on your machine that remembers versions. <strong>GitHub</strong> is a website that holds a copy of that memory so it survives your laptop, and so other people — and other machines — can reach it.' },
        { p: 'You can use git with no account at all. You will not want to for long.' },
        { h: 'The username is the part people get wrong' },
        { p: 'It becomes your URL, appears on every commit you ever push, and is genuinely hard to change later. Employers look at it. So do the people reviewing your pull requests.' },
        { compare: {
          heads: ['Ages well', 'Regret it by March'],
          rows: [
            ['<code>jamie-doe</code> — your actual name', '<code>xX_devGod_Xx</code>'],
            ['<code>jdoe</code> — short, obviously you', '<code>jamie-at-acme</code> — you will change jobs'],
            ['<code>jamiebuilds</code> — name plus a verb', '<code>learning-git-2026</code> — dated on day one']
          ]
        } },
        { h: 'Two settings to change immediately' },
        { p: '<strong>Keep your email private.</strong> Every commit records an email address. GitHub can give you a no-reply address so your real one does not end up scraped out of a public repository. Settings, then Emails, then "Keep my email addresses private".' },
        { p: '<strong>Turn on two-factor authentication.</strong> Your account will eventually hold code that runs somewhere real, and tokens that can spend money. GitHub requires 2FA for contributors anyway. Do it while the account is empty and boring.' },
        { note: 'A free account gives you unlimited public <em>and</em> private repositories. You do not need to pay to keep your work to yourself.', kind: 'tip' }
      ],
      quest: {
        title: 'Open the account',
        brief: 'Pick a name that passes the checks, then do the three things on the list.',
        steps: [
          {
            label: 'Choose a username that passes every rule',
            hint: 'Letters, numbers and single hyphens. No leading or trailing hyphen, 39 characters maximum.',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.usernameValid); }
          },
          {
            label: 'Create the account at github.com',
            hint: 'The Sign up button opens the real site in a new tab. Come back and tick it off.',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.checks && ctx.widget.checks.signup); }
          },
          {
            label: 'Turn on two-factor authentication',
            hint: 'Settings, then Password and authentication, then Two-factor authentication.',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.checks && ctx.widget.checks.twofa); }
          },
          {
            label: 'Set your email to private',
            hint: 'Settings, then Emails, then "Keep my email addresses private".',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.checks && ctx.widget.checks.email); }
          }
        ]
      },
      outro: 'Account done. Nothing else in this lesson requires you to leave the page.'
    },

    // ------------------------------------------------------------------- 02
    {
      id: 'repository',
      title: 'A folder with a memory',
      subtitle: 'What a repository actually is',
      xp: 120,
      pane: 'terminal',
      setup: function (eng) { eng.cwd = HOME; eng.mkdirp(HOME); },
      blocks: [
        { p: 'A repository is a folder, plus one hidden subfolder called <code>.git</code> that holds every version of everything in it. That is the entire idea. There is no server involved, no account required, and nothing magic.' },
        { p: 'Delete <code>.git</code> and you have an ordinary folder again — with all your files, and no history. Keep it, and you can stand at any point in that folder\'s past.' },
        { h: 'Local first, remote second' },
        { p: 'Almost everything happens on your machine. <code>git commit</code> does not talk to the internet. You can work on a plane for six hours, commit forty times, and only then push it all to GitHub in one go.' },
        { p: 'The copy on GitHub is called a <strong>remote</strong>. It is a peer, not a boss — it just happens to be the copy everyone agrees to sync through.' },
        { note: 'Each commit is a full snapshot of the folder, not a list of edits. That is why going back to an old commit is instant, and why nothing is ever half-restored.', kind: 'key' },
        { h: 'Make one' },
        { p: 'Saving takes two commands. <code>git add</code> picks which files go into the next snapshot; <code>git commit</code> takes the snapshot and attaches your message to it. Why it is two steps and not one is Chapter 05\'s job. For now: add, then commit.' },
        { cmds: [
          { cmd: 'mkdir my-first-repo', desc: 'an ordinary folder' },
          { cmd: 'cd my-first-repo', desc: 'step into it' },
          { cmd: 'git init', desc: 'give it a memory' },
          { cmd: 'ls -a', desc: 'see the .git folder that appeared' },
          { cmd: 'echo "# my-first-repo" > README.md', desc: 'write something' },
          { cmd: 'git add README.md', desc: 'shortlist it' },
          { cmd: 'git commit -m "First commit"', desc: 'save the snapshot' }
        ] }
      ],
      quest: {
        title: 'Give a folder a memory',
        brief: 'Create a folder, turn it into a repository, and put one commit in it.',
        steps: [
          {
            label: 'Create and enter a new folder',
            hint: '<code>mkdir my-first-repo</code> then <code>cd my-first-repo</code>.',
            check: function (ctx) { return ctx.eng.cwd !== HOME && ctx.eng.cwd.indexOf(HOME + '/') === 0; }
          },
          {
            label: 'Run git init',
            hint: 'Just <code>git init</code>, inside the folder.',
            check: function (ctx) { return !!ctx.eng.activeRepo(); }
          },
          {
            label: 'Find the .git folder',
            hint: '<code>ls</code> hides it. <code>ls -a</code> shows everything.',
            check: function (ctx) { return typed(ctx, /^ls\s+-a/); }
          },
          {
            label: 'Make your first commit',
            hint: 'Write a file, <code>git add</code> it, then <code>git commit -m "First commit"</code>.',
            check: function (ctx) { return commitCount(ctx) >= 1; }
          }
        ]
      },
      outro: 'That folder now remembers. Everything from here is about what you choose to make it remember.'
    },

    // ------------------------------------------------------------------- 03
    {
      id: 'visibility',
      title: 'Public, private, and the key you cannot unsee',
      subtitle: 'What goes in, and what must never',
      xp: 120,
      pane: 'widget',
      widget: 'sorter',
      setup: function (eng) {
        var root = HOME + '/my-first-repo';
        eng.init(root);
        eng.cwd = root;
        eng.writeFile(root + '/README.md', README);
        eng.writeFile(root + '/app.js', 'console.log("hello");');
        eng.writeFile(root + '/secrets.env', 'STRIPE_KEY=sk_live_EXAMPLE_do_not_use_1234\nDB_PASSWORD=hunter2');
        eng.writeFile(root + '/.DS_Store', 'macOS junk');
        eng.stage('README.md');
        eng.stage('app.js');
        eng.commit('Add readme and entry point');
      },
      blocks: [
        { p: 'When you make a repository you pick <strong>public</strong> or <strong>private</strong>. Both are free. The difference is bigger than it looks.' },
        { compare: {
          heads: ['Public', 'Private'],
          rows: [
            ['Anyone can read every file', 'Only you and people you invite'],
            ['Anyone can read every commit message', 'Invited people see the full history'],
            ['Anyone can read every <em>past</em> version', 'Still fully version-controlled'],
            ['Search engines and scrapers index it in minutes', 'Not indexed'],
            ['Good for portfolios, libraries, learning in the open', 'Good for client work and anything with real data']
          ]
        } },
        { note: 'Private is not a safe place for secrets either. A private repo can be made public by one wrong click, and it is shared with every collaborator you add. The rule is simpler than "which visibility": <strong>secrets never go in a repository at all</strong>.', kind: 'warn' },
        { h: 'History is forever' },
        { p: 'This is the part that catches people. If you commit an API key and then delete it in the next commit, <em>the key is still in the history</em>. Anyone who clones the repository gets it. Bots scan public GitHub for exactly this, and they find keys within minutes — sometimes seconds.' },
        { p: 'The fix is to never let it in. That is what <code>.gitignore</code> is for: a plain text file listing things git should pretend it cannot see.' },
        { h: 'Two jobs' },
        { p: 'First, sort the files on the right into "commit it" and "keep it out". Then switch to the Terminal tab and write a <code>.gitignore</code> that makes git stop offering you <code>secrets.env</code>.' },
        { cmds: [
          { cmd: 'git status', desc: 'see what git is currently offering to commit' },
          { cmd: 'echo "secrets.env" > .gitignore', desc: 'start the ignore list' },
          { cmd: 'echo ".DS_Store" >> .gitignore', desc: 'two chevrons appends instead of overwriting' },
          { cmd: 'git status', desc: 'the ignored files are gone from the list' }
        ] }
      ],
      quest: {
        title: 'Sort it, then lock the door',
        brief: 'Get all ten files in the right bucket, then stop git from seeing the two that matter.',
        steps: [
          {
            label: 'Sort all ten files correctly',
            hint: 'Ask of each one: would I mind a stranger reading this, and can it be rebuilt?',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.sorterSolved); }
          },
          {
            label: 'Write a .gitignore listing secrets.env',
            hint: '<code>echo "secrets.env" &gt; .gitignore</code> — in the Terminal tab.',
            check: function (ctx) {
              return /secrets\.env/.test(ctx.eng.worktree()['.gitignore'] || '');
            }
          },
          {
            label: 'Ignore .DS_Store too',
            hint: '<code>echo ".DS_Store" &gt;&gt; .gitignore</code>. Two chevrons appends; one would wipe the file.',
            check: function (ctx) {
              return /\.DS_Store/.test(ctx.eng.worktree()['.gitignore'] || '');
            }
          },
          {
            label: 'Confirm git no longer offers them',
            hint: 'Run <code>git status</code> again. Neither file should appear as untracked.',
            check: function (ctx) {
              var s = ctx.eng.status();
              if (!s) return false;
              var names = s.untracked.map(function (f) { return f.path; });
              return typed(ctx, /^git\s+status/)
                && names.indexOf('secrets.env') === -1
                && names.indexOf('.DS_Store') === -1;
            }
          }
        ]
      },
      outro: 'The <code>.gitignore</code> itself gets committed — it is a rule about the project, and everyone working on it needs the same one.'
    },

    // ------------------------------------------------------------------- 04
    {
      id: 'first-repo',
      title: 'Getting it onto GitHub',
      subtitle: 'Your first remote, and what push actually does',
      xp: 130,
      pane: 'terminal',
      setup: function (eng) {
        var root = HOME + '/my-first-repo';
        eng.init(root);
        eng.cwd = root;
        eng.writeFile(root + '/README.md', README);
        eng.writeFile(root + '/.gitignore', 'secrets.env\n.DS_Store\nnode_modules/');
        eng.stage('README.md');
        eng.stage('.gitignore');
        eng.commit('Add readme and ignore rules');
      },
      blocks: [
        { p: 'Right now your repository exists in exactly one place: the folder on your machine. A spilled coffee is still a total loss. Time to make a second copy that lives somewhere else.' },
        { h: 'Two routes to the same place' },
        { p: '<strong>The website.</strong> Click New on github.com, name it, pick public or private, and it hands you three commands to paste. This is fine, and it is what most people do the first time.' },
        { p: '<strong>The command line.</strong> GitHub\'s own tool, <code>gh</code>, creates the repository and wires up the connection in one step. Once you have used it twice you will never open the website for this again.' },
        { note: '<code>origin</code> is not a keyword. It is just the conventional nickname for "the copy on the server". You could call it <code>github</code> or <code>backup</code>. Everyone calls it <code>origin</code>, so call it <code>origin</code>.', kind: 'key' },
        { h: 'What push means' },
        { p: '<code>git push</code> sends any commits your copy has that the remote does not. It never sends uncommitted work — if you have not committed it, pushing does nothing for it. That surprises everyone once.' },
        { cmds: [
          { cmd: 'gh repo create my-first-repo --public', desc: 'create it on GitHub and add the remote' },
          { cmd: 'gh repo create my-first-repo --private', desc: 'or keep it to yourself' },
          { cmd: 'git remote -v', desc: 'check where origin points' },
          { cmd: 'git push', desc: 'send your commits up' },
          { cmd: 'git status', desc: 'confirm nothing is left behind' }
        ] }
      ],
      quest: {
        title: 'Make the second copy',
        brief: 'Create the repository on GitHub, connect it, and push what you have.',
        steps: [
          {
            label: 'Create the repository on GitHub',
            hint: '<code>gh repo create my-first-repo --public</code>. It will refuse until you choose a visibility — on purpose.',
            check: function (ctx) { return !!ctx.eng.remotes.origin; }
          },
          {
            label: 'Check where origin points',
            hint: '<code>git remote -v</code> lists the remotes and their URLs.',
            check: function (ctx) { return typed(ctx, /^git\s+remote/); }
          },
          {
            label: 'Push your commits',
            hint: 'Just <code>git push</code>.',
            check: function (ctx) {
              var repo = ctx.eng.activeRepo();
              if (!repo || !repo.remote) return false;
              var remote = ctx.eng.remotes[repo.remote];
              return !!(remote && remote.branches.main && remote.branches.main === repo.branches.main);
            }
          }
        ]
      },
      outro: 'Two copies now, in two places, with identical history. This is the moment git stops being a chore and starts being insurance.'
    },

    // ------------------------------------------------------------------- 05
    {
      id: 'loop',
      title: 'The loop you will run all day',
      subtitle: 'status, add, commit, push — and the three trays',
      xp: 150,
      pane: 'terminal',
      setup: function (eng) {
        var root = HOME + '/my-first-repo';
        eng.init(root);
        eng.cwd = root;
        eng.writeFile(root + '/README.md', README);
        eng.writeFile(root + '/.gitignore', 'secrets.env\n.DS_Store\nnode_modules/');
        eng.writeFile(root + '/notes.md', '# Notes\n\n- Read Pro Git chapters 1-3');
        eng.stage('README.md');
        eng.stage('.gitignore');
        eng.stage('notes.md');
        eng.commit('Add readme, notes and ignore rules');
        eng.remotes.origin = {
          url: 'https://github.com/you/my-first-repo.git',
          branches: { main: eng.headSha() },
          objects: {}
        };
        eng.ancestry(eng.headSha()).forEach(function (s) {
          eng.remotes.origin.objects[s] = eng.repo.objects[s];
        });
        eng.repo.remote = 'origin';
      },
      blocks: [
        { p: 'Four commands, in the same order, for the rest of your career. Everything else in git is something you look up.' },
        { trays: true },
        { p: 'Every change lives in exactly one of those three places. <code>git status</code> is the command that tells you which — and it is the one you should run more than any other. Run it when you are lost. Run it before you commit. Run it after an agent finishes.' },
        { h: 'Why staging exists' },
        { p: 'It feels like an extra step until the first time you need it. You have edited four files and only two of them belong in the same commit. Staging lets you commit those two, then the other two separately, so each commit is one idea that can be undone on its own.' },
        { note: 'Working directory, then <code>git add</code>, then staging area, then <code>git commit</code>, then history, then <code>git push</code>, then GitHub. Three arrows, and <code>git status</code> to tell you where you are standing. That is the loop.', kind: 'key' },
        { h: 'The message is the point' },
        { p: 'In six months the diff will still be there but your memory will not. "fix" tells you nothing. "Stop the export crashing on empty date fields" tells you everything — and it tells an agent reading your history what this project cares about.' },
        { cmds: [
          { cmd: 'git status', desc: 'where is everything' },
          { cmd: 'git diff', desc: 'what did I actually change' },
          { cmd: 'echo "- Trunk-based development" >> notes.md', desc: 'append a line' },
          { cmd: 'git add notes.md', desc: 'shortlist one file' },
          { cmd: 'git diff --staged', desc: 'what would the commit contain' },
          { cmd: 'git commit -m "Add reading list for week two"', desc: 'seal it' },
          { cmd: 'git push', desc: 'send it up' }
        ] }
      ],
      quest: {
        title: 'Run the loop twice',
        brief: 'Two separate ideas, two separate commits, one push. Do not lump them together.',
        steps: [
          {
            label: 'Change notes.md and create one new file',
            hint: 'Try <code>echo "- Trunk-based development" &gt;&gt; notes.md</code> and <code>echo "# Ideas" &gt; ideas.md</code>.',
            check: function (ctx) {
              var work = ctx.eng.worktree();
              var head = ctx.eng.headTree();
              ctx.flags.twoChanges = ctx.flags.twoChanges
                || (work['notes.md'] !== head['notes.md']
                  && Object.keys(work).length > Object.keys(head).length);
              return !!ctx.flags.twoChanges;
            }
          },
          {
            label: 'Stage only notes.md, then check what the commit would contain',
            hint: '<code>git add notes.md</code>, then <code>git diff --staged</code>. The new file should not appear.',
            check: function (ctx) {
              return typed(ctx, /^git\s+diff\s+--staged/) && typed(ctx, /^git\s+add\s+notes\.md/);
            }
          },
          {
            label: 'Commit it with a message that will still make sense in six months',
            hint: 'At least a few words. <code>git commit -m "Add reading list for week two"</code>.',
            check: function (ctx) {
              return commitCount(ctx) >= 2 && isUsefulMessage(messageOf(ctx, 0));
            }
          },
          {
            label: 'Commit the second change separately',
            hint: 'Now <code>git add</code> the other file and commit it on its own.',
            check: function (ctx) {
              return commitCount(ctx) >= 3
                && isUsefulMessage(messageOf(ctx, 0))
                && isUsefulMessage(messageOf(ctx, 1));
            }
          },
          {
            label: 'Push both commits',
            hint: '<code>git push</code>. One push can carry any number of commits.',
            check: function (ctx) {
              var s = ctx.eng.status();
              return commitCount(ctx) >= 3 && !!s && s.ahead === 0;
            }
          }
        ]
      },
      outro: 'You now know enough git to work alone, safely, forever. Next: the same loop with buttons, then branches, other people, and agents.'
    },

    // ------------------------------------------------------------------- 06
    {
      id: 'gui',
      title: 'The same loop, without typing',
      subtitle: 'GitHub Desktop, VS Code, and when a button beats a command',
      xp: 110,
      pane: 'widget',
      widget: 'gui',
      setup: function (eng) { eng.cwd = HOME; eng.mkdirp(HOME); },
      blocks: [
        { p: 'Nothing you just learned requires a terminal. <strong>GitHub Desktop</strong> and the source control panel built into <strong>VS Code</strong> do the same four things with buttons — and both are showing you exactly the three trays from the last chapter, just with different labels.' },
        { compare: {
          heads: ['You already know this as', 'The button calls it'],
          rows: [
            ['<code>git status</code>', 'The list of changed files — always on screen'],
            ['<code>git add</code>', 'The checkbox, or "Stage changes" / the <strong>+</strong> icon'],
            ['<code>git commit -m "…"</code>', 'The Summary box, then "Commit to main"'],
            ['<code>git push</code>', '"Push origin", or the sync arrows in the status bar'],
            ['<code>git diff</code>', 'The red and green panel in the middle — always visible']
          ]
        } },
        { h: 'Where the GUI genuinely wins' },
        { p: 'Reading a diff. A graphical side-by-side is easier to scan than terminal output, and staging <em>part</em> of a file — a few lines rather than the whole thing — is far more pleasant with a mouse than with <code>git add -p</code>.' },
        { h: 'Where it does not' },
        { p: 'Anything an agent is going to do for you. Agents type commands; they do not click. If your only mental model is the button layout, you cannot read what the agent just ran, and you cannot tell it what to do differently. Learn both — but know the commands underneath.' },
        { note: 'Use whichever you like day to day. Just never be in the position of not knowing what the button did.', kind: 'tip' }
      ],
      quest: {
        title: 'Ship a change with the mouse',
        brief: 'Do one full loop in the simulated client on the right, then find the same controls in VS Code.',
        steps: [
          {
            label: 'Stage one file — and only one',
            hint: 'Click the checkbox next to it. Leave the other one alone.',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.guiStaged === 1); }
          },
          {
            label: 'Write a summary and commit',
            hint: 'The Summary box is the same thing as <code>-m</code>. A few real words.',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.guiCommitted); }
          },
          {
            label: 'Push it',
            hint: 'The "Push origin" button at the top.',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.guiPushed); }
          },
          {
            label: 'Find the same four controls in VS Code',
            hint: 'Switch to the VS Code tab and click each of the four highlighted spots.',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.vscodeFound >= 4); }
          }
        ]
      },
      outro: 'Same trays, same commits, same history. The buttons are a shortcut for things you now understand.'
    },

    // ------------------------------------------------------------------- 07
    {
      id: 'branches',
      title: 'Branch, merge, push — and undo anything',
      subtitle: 'Cheap parallel universes, and six ways to undo',
      xp: 180,
      pane: 'terminal',
      setup: function (eng) {
        var root = HOME + '/my-first-repo';
        eng.init(root);
        eng.cwd = root;
        eng.writeFile(root + '/README.md', README);
        eng.stage('README.md');
        eng.commit('Add readme');
        eng.writeFile(root + '/app.js', 'function greet(name) {\n  return "Helo, " + name;\n}\n');
        eng.stage('app.js');
        eng.commit('Add greet function');
        eng.remotes.origin = {
          url: 'https://github.com/you/my-first-repo.git',
          branches: { main: eng.headSha() },
          objects: {}
        };
        eng.ancestry(eng.headSha()).forEach(function (s) {
          eng.remotes.origin.objects[s] = eng.repo.objects[s];
        });
        eng.repo.remote = 'origin';
      },
      blocks: [
        { p: 'A branch is a sticky label pointing at one commit. That is all. Creating one copies nothing and takes no time, which is why the advice is always "just make a branch" — it costs you nothing to be wrong on one.' },
        { p: 'You are on <code>main</code> right now. Make <code>fix/typo</code>, and both labels point at the same commit. Commit once, and <code>fix/typo</code> moves forward while <code>main</code> stays put. That gap is the whole feature.' },
        { p: 'When the work on the branch turns out good, <code>git merge</code> brings it back into <code>main</code>. When it does not, delete the branch and <code>main</code> never knew.' },
        { p: 'Notice that none of this has touched GitHub. Branching, committing and merging are all local — the remote only learns about any of it when you <code>git push</code>. That is the whole rhythm of working in git: branch, commit, merge, push. The first three can happen a hundred times on a plane; the last one is what makes it real to anyone else.' },
        { note: 'This matters more with agents than without. "Let it try, and throw the branch away if it goes badly" is only a cheap sentence when the branch was cheap to make.', kind: 'key' },
        { h: 'The six panic buttons' },
        { p: 'Learn which one you need by what you are trying to undo. You used the first one in Chapter 00. This table is worth keeping.' },
        { compare: {
          heads: ['I want to…', 'Use'],
          rows: [
            ['Throw away edits I have not staged', '<code>git restore &lt;file&gt;</code>'],
            ['Unstage something, keep the edit', '<code>git restore --staged &lt;file&gt;</code>'],
            ['Undo a commit that is already pushed', '<code>git revert &lt;sha&gt;</code> — adds an opposite commit'],
            ['Undo a commit nobody has seen yet', '<code>git reset --soft HEAD~1</code> — keeps your work'],
            ['Undo everything back to a commit', '<code>git reset --hard &lt;sha&gt;</code> — <strong>destructive</strong>'],
            ['Find something I already destroyed', '<code>git reflog</code> — the undo history of the undo']
          ]
        } },
        { p: '<code>revert</code> versus <code>reset</code> is the one distinction worth memorising. <strong>Revert adds</strong> a new commit that undoes an old one, so shared history stays intact. <strong>Reset rewrites</strong>, which is fine alone and rude in public.' },
        { p: 'And <code>git reflog</code> is the safety net under the safety net: it records every position HEAD has been in, including ones you thought you deleted. Almost nothing in git is truly gone for about two weeks.' },
        { cmds: [
          { cmd: 'git switch -c fix/typo', desc: 'create a branch and move to it' },
          { cmd: 'git branch', desc: 'list branches, star marks where you are' },
          { cmd: 'echo "function greet(name) { return \'Hello, \' + name; }" > app.js', desc: 'fix the typo' },
          { cmd: 'git commit -am "Fix the greeting typo"', desc: '-am stages tracked files and commits' },
          { cmd: 'git switch main', desc: 'go back' },
          { cmd: 'git merge fix/typo', desc: 'bring the work across' },
          { cmd: 'git push', desc: 'now GitHub has the merge too' },
          { cmd: 'git revert HEAD', desc: 'undo the last commit, safely' },
          { cmd: 'git reflog', desc: 'everywhere HEAD has been' }
        ] }
      ],
      quest: {
        title: 'Branch, merge, push, undo, and find it again',
        brief: 'Do a piece of work on a branch, merge it, push it to GitHub, undo it safely, then prove nothing was lost.',
        steps: [
          {
            label: 'Create a branch and switch to it',
            hint: '<code>git switch -c fix/typo</code> does both at once.',
            check: function (ctx) {
              var b = ctx.eng.currentBranch();
              ctx.flags.branched = ctx.flags.branched || (!!b && b !== 'main');
              return !!ctx.flags.branched;
            }
          },
          {
            label: 'Change app.js and commit it on the branch',
            hint: 'Overwrite <code>app.js</code>, then <code>git commit -am "Fix the greeting typo"</code>.',
            check: function (ctx) {
              ctx.flags.branchCommit = ctx.flags.branchCommit
                || (!!ctx.flags.branched && ctx.eng.currentBranch() !== 'main' && commitCount(ctx) >= 3);
              return !!ctx.flags.branchCommit;
            }
          },
          {
            label: 'Switch back to main and merge the branch in',
            hint: '<code>git switch main</code>, then <code>git merge fix/typo</code>.',
            check: function (ctx) {
              return !!ctx.flags.branchCommit
                && ctx.eng.currentBranch() === 'main'
                && commitCount(ctx) >= 3;
            }
          },
          {
            label: 'Push main so GitHub has the merge too',
            hint: '<code>git push</code>. Everything so far was local; this is the step that makes it real.',
            check: function (ctx) {
              var repo = ctx.eng.activeRepo();
              var remote = repo && ctx.eng.remotes[repo.remote];
              ctx.flags.pushedMerge = ctx.flags.pushedMerge
                || (!!ctx.flags.branchCommit && !!remote
                  && ctx.eng.ancestry(repo.branches.main).length >= 3
                  && remote.branches.main === repo.branches.main);
              return !!ctx.flags.pushedMerge;
            }
          },
          {
            label: 'Undo that work with revert, not reset',
            hint: '<code>git revert HEAD</code>. It adds a new commit rather than erasing one.',
            check: function (ctx) { return /^Revert /.test(messageOf(ctx, 0)); }
          },
          {
            label: 'Prove the original commit is still there',
            hint: '<code>git reflog</code>, or <code>git log --oneline</code>. Revert never deletes.',
            check: function (ctx) { return typed(ctx, /^git\s+(reflog|log)/); }
          }
        ]
      },
      outro: 'Nothing you do in git is unrecoverable if you have committed once. That is the entire reason to commit often.'
    },

    // ------------------------------------------------------------------- 08
    {
      id: 'together',
      title: 'When someone else has been editing',
      subtitle: 'Pull, conflict, resolve',
      xp: 180,
      pane: 'terminal',
      setup: function (eng) {
        var root = HOME + '/my-first-repo';
        eng.init(root);
        eng.cwd = root;
        eng.writeFile(root + '/README.md', '# my-first-repo\n\nLearning git properly, finally.\n\n## Status\n\nJust getting started.');
        eng.stage('README.md');
        var base = eng.commit('Add readme');

        // Sam pushed a change to the same lines while you were offline.
        eng.remotes.origin = { url: 'https://github.com/you/my-first-repo.git', branches: {}, objects: {} };
        eng.repo.index = { 'README.md': '# my-first-repo\n\nLearning git properly, finally.\n\n## Status\n\nShipped the first version. Docs to follow.' };
        var theirs = eng.commit('Update status after release');
        eng.remotes.origin.branches.main = theirs.sha;
        eng.ancestry(theirs.sha).forEach(function (s) {
          eng.remotes.origin.objects[s] = eng.repo.objects[s];
        });

        // Rewind you to before Sam's commit, and give you your own conflicting edit.
        eng.repo.branches.main = base.sha;
        eng.repo.HEAD = { ref: 'main' };
        eng.checkoutTree(eng.repo.objects[base.sha].tree);
        eng.repo.index = { 'README.md': '# my-first-repo\n\nLearning git properly, finally.\n\n## Status\n\nStill learning. On chapter eight.' };
        eng.commit('Note progress through the lesson');
        eng.repo.remote = 'origin';
        eng.repo.reflog = [];
      },
      blocks: [
        { p: 'Sam, a teammate, has pushed a change to <code>README.md</code> while you were editing the same lines. <code>git pull</code> is the opposite of push: it fetches the commits the remote has that you do not, and combines them with yours. Usually that just works. Not this time — and neither of you did anything wrong. Git will not guess which version is right, and you would not want it to.' },
        { h: 'What a conflict actually looks like' },
        { p: 'When <code>git pull</code> cannot combine two edits automatically, it writes <em>both</em> versions into the file with markers between them, and stops. The file on disk becomes something like this:' },
        { code: '<<<<<<< HEAD\nStill learning. On chapter eight.\n=======\nShipped the first version. Docs to follow.\n>>>>>>> origin/main' },
        { p: 'Everything between the first marker and the row of equals signs is yours. Everything after the equals signs is theirs. Your job is to write the version that should exist — often a combination of both — and delete all three marker lines.' },
        { note: 'A conflict is not an error. It is git refusing to make an editorial decision on your behalf.', kind: 'key' },
        { cmds: [
          { cmd: 'git pull', desc: 'fetch their work and combine it with yours' },
          { cmd: 'cat README.md', desc: 'look at the markers' },
          { cmd: 'echo "# my-first-repo" > README.md', desc: 'start rewriting the file cleanly' },
          { cmd: 'echo "Shipped v1. Still learning, on chapter eight." >> README.md', desc: 'the version that should exist' },
          { cmd: 'git add README.md', desc: 'tell git this one is resolved' },
          { cmd: 'git commit -m "Merge release note with my progress note"', desc: 'finish the merge' },
          { cmd: 'git push', desc: 'send the resolution up' }
        ] }
      ],
      quest: {
        title: 'Survive your first conflict',
        brief: 'Pull Sam\'s change, resolve the collision by hand, and push the result.',
        steps: [
          {
            label: 'Pull, and hit the conflict',
            hint: '<code>git pull</code>. It is supposed to fail — that is the lesson.',
            check: function (ctx) {
              var repo = ctx.eng.activeRepo();
              ctx.flags.conflicted = ctx.flags.conflicted || !!(repo && repo.merging);
              return !!ctx.flags.conflicted;
            }
          },
          {
            label: 'Read the file and find the markers',
            hint: '<code>cat README.md</code>.',
            check: function (ctx) { return !!ctx.flags.conflicted && typed(ctx, /^cat\s+README\.md/); }
          },
          {
            label: 'Write the version that should exist, with no markers left',
            hint: 'Overwrite the file. Mention both things: the release and your progress.',
            check: function (ctx) {
              var content = ctx.eng.worktree()['README.md'] || '';
              return !!ctx.flags.conflicted && content.length > 0 && !hasConflictMarkers(content);
            }
          },
          {
            label: 'Stage the resolved file and commit the merge',
            hint: '<code>git add README.md</code> then <code>git commit -m "…"</code>.',
            check: function (ctx) {
              var repo = ctx.eng.activeRepo();
              return !!ctx.flags.conflicted && !!repo && !repo.merging && commitCount(ctx) >= 3;
            }
          },
          {
            label: 'Push the resolution',
            hint: '<code>git push</code>.',
            check: function (ctx) {
              var s = ctx.eng.status();
              return !!ctx.flags.conflicted && !!s && s.ahead === 0 && commitCount(ctx) >= 3;
            }
          }
        ]
      },
      outro: 'Conflicts stop being frightening at exactly this point: the second time you resolve one.'
    },

    // ------------------------------------------------------------------- 09
    {
      id: 'agents',
      title: 'Git when an agent is typing',
      subtitle: 'Read the diff, not the summary',
      xp: 220,
      pane: 'terminal',
      agentPane: true,
      personalised: true,
      setup: function (eng) {
        var root = HOME + '/my-first-repo';
        eng.init(root);
        eng.cwd = root;
        eng.writeFile(root + '/README.md', README);
        eng.writeFile(root + '/.gitignore', 'node_modules/\n.DS_Store\nsecrets.env');
        eng.writeFile(root + '/notes.md', '# Notes\n\n- Read Pro Git chapters 1-3');
        eng.writeFile(root + '/app.js', 'const KEY = process.env.STRIPE_KEY;\n\nfunction charge(amount) {\n  return { amount: amount, key: KEY };\n}\n');
        eng.writeFile(root + '/secrets.env', 'STRIPE_KEY=sk_live_EXAMPLE_do_not_use_1234');
        eng.stage('README.md');
        eng.stage('.gitignore');
        eng.stage('notes.md');
        eng.stage('app.js');
        eng.commit('Add app skeleton and ignore rules');
        eng.remotes.origin = {
          url: 'https://github.com/you/my-first-repo.git',
          branches: { main: eng.headSha() },
          objects: {}
        };
        eng.ancestry(eng.headSha()).forEach(function (s) {
          eng.remotes.origin.objects[s] = eng.repo.objects[s];
        });
        eng.repo.remote = 'origin';
        // The learner has an uncommitted edit, deliberately, so step one has teeth.
        eng.writeFile(root + '/notes.md', '# Notes\n\n- Read Pro Git chapters 1-3\n- Try worktrees');
      },
      blocks: [
        { p: 'This is the chapter the rest of the lesson was for. An agent writes faster than you can read, does not get tired, and is confidently wrong occasionally rather than never. Git is what makes that an acceptable trade.' },
        { h: 'Five habits, in order of how much they will save you' },
        { p: '<strong>1. Start in a repository with a remote.</strong> An agent will happily work for an hour in a folder with no <code>.git</code>, and nothing it does there can be undone. When you start a project with an agent, make the first instruction "initialise git, make the first commit, and create a GitHub repository for it" — then check its work yourself with <code>git remote -v</code> and <code>git log</code> before asking for anything else. Everything below assumes this happened.' },
        { p: '<strong>2. Commit before you prompt.</strong> A clean working tree before the agent starts means everything it changes shows up in <code>git status</code> as its work, not tangled with yours. It also means <code>git restore .</code> is a complete undo.' },
        { p: '<strong>3. Read the diff, not the summary.</strong> The summary is written by the thing that made the change. It is usually accurate and occasionally omits the interesting part. <code>git diff</code> cannot omit anything.' },
        { p: '<strong>4. One branch per task.</strong> So "this went badly, delete it" is one command instead of an afternoon.' },
        { p: '<strong>5. Keep secrets structurally impossible.</strong> An agent that can read your files can read <code>.env</code>, and an agent that can commit can commit it. <code>.gitignore</code> is the guardrail, and it belongs in the repository so every agent gets the same one.' },
        { note: 'Two agents at once on the same folder will fight. <code>git worktree add ../feature-b feat/b</code> gives each one its own directory sharing one history — the real answer to running things in parallel.', kind: 'tip' },
        { h: 'Now catch one' },
        { p: 'The panel on the right is an agent. Ask it to tidy your project. It will do roughly what you asked, report cheerfully, and slip in one change you would not have approved. Find it.' },
        { cmds: [
          { cmd: 'git remote -v', desc: 'is there a GitHub copy? there should be' },
          { cmd: 'git status', desc: 'start clean before you prompt' },
          { cmd: 'git commit -am "Note worktrees for later"', desc: 'commit your own work first' },
          { cmd: 'git diff', desc: 'the truth about what the agent did' },
          { cmd: 'git restore app.js', desc: 'reject one file\'s changes entirely' },
          { cmd: 'git add .', desc: 'accept what is left' }
        ] }
      ],
      quest: {
        title: 'Catch what the summary left out',
        brief: 'Check the repo has a remote, commit your own work, run the agent, read the diff, and stop the thing it got wrong from being committed.',
        steps: [
          {
            label: 'Confirm the repository has a remote',
            hint: '<code>git remote -v</code>. If this printed nothing, the first job would be creating the GitHub repo — see Chapter 04.',
            check: function (ctx) { return typed(ctx, /^git\s+remote/); }
          },
          {
            label: 'Commit your own changes before prompting',
            hint: 'You have an uncommitted edit to <code>notes.md</code>. <code>git commit -am "Note worktrees for later"</code> first.',
            check: function (ctx) {
              var s = ctx.eng.status();
              ctx.flags.cleanFirst = ctx.flags.cleanFirst || (!!s && s.clean && commitCount(ctx) >= 2);
              return !!ctx.flags.cleanFirst;
            }
          },
          {
            label: 'Run the agent',
            hint: 'Press "Run the agent" in the panel on the right.',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.agentRan); }
          },
          {
            label: 'Read the diff instead of the summary',
            hint: '<code>git diff</code>. Compare what you see against what the agent claimed.',
            check: function (ctx) { return !!(ctx.widget && ctx.widget.agentRan) && typed(ctx, /^git\s+diff/); }
          },
          {
            label: 'Put secrets.env back in .gitignore',
            hint: 'The agent quietly removed that line. Write it back, or <code>git restore .gitignore</code>.',
            check: function (ctx) {
              return /(^|\n)secrets\.env\s*(\n|$)/.test(ctx.eng.worktree()['.gitignore'] || '');
            }
          },
          {
            label: 'Remove the line that logs the key',
            hint: 'Look at <code>app.js</code>. <code>git restore app.js</code> throws away the whole change, which is fine here.',
            check: function (ctx) {
              return !/console\.log/.test(ctx.eng.worktree()['app.js'] || '');
            }
          },
          {
            label: 'Commit the parts that were actually good',
            hint: '<code>git add .</code> then commit. Check <code>git status</code> shows no <code>secrets.env</code>.',
            check: function (ctx) {
              var s = ctx.eng.status();
              if (!s || !ctx.widget || !ctx.widget.agentRan) return false;
              var names = s.untracked.concat(s.staged).map(function (f) { return f.path; });
              return commitCount(ctx) >= 3 && names.indexOf('secrets.env') === -1;
            }
          }
        ]
      },
      outro: 'You did not need to be smarter than the agent. You needed to look at the diff.'
    },

    // ------------------------------------------------------------------- 10
    {
      id: 'rules',
      title: 'Write the rules file',
      subtitle: 'One file that tells every agent how to behave here',
      xp: 200,
      pane: 'widget',
      widget: 'rules',
      personalised: true,
      setup: function (eng) {
        var root = HOME + '/my-first-repo';
        eng.init(root);
        eng.cwd = root;
        eng.writeFile(root + '/README.md', README);
        eng.writeFile(root + '/.gitignore', 'node_modules/\n.DS_Store\nsecrets.env');
        eng.stage('README.md');
        eng.stage('.gitignore');
        eng.commit('Add readme and ignore rules');
      },
      blocks: [
        { p: 'Every coding agent looks for a file in your repository that tells it how this project works. Same idea, four filenames — because the industry has not finished arguing.' },
        { agentFiles: true },
        { h: 'What actually belongs in it' },
        { p: 'Not a manual. A short list of the things you would otherwise have to say out loud every single session: how to run the tests, what style to match, what never to touch. If you find yourself typing the same correction twice, that correction belongs in this file.' },
        { p: 'And — the reason it is in a git lesson — <strong>your git rules go here</strong>. An agent that can commit will commit however it feels like unless you tell it otherwise. Branch naming, commit message format, never force-push, never commit <code>.env</code>, run the tests first. Written down once, followed every time.' },
        { note: 'Keep it short. A rules file nobody maintains is worse than none, because it confidently describes a project that no longer exists.', kind: 'warn' },
        { h: 'Build yours' },
        { p: 'Answer the questions on the right. You will get a real file, named correctly for whichever agents you picked, that you can paste straight into a project when you close this tab.' }
      ],
      quest: {
        title: 'Generate it, then commit it',
        brief: 'Pick your agents, answer the questions, and put the result in the repository — one last time round the loop.',
        steps: [
          {
            label: 'Pick at least one agent',
            hint: 'Multi-select. Plenty of people run two.',
            check: function (ctx) {
              return !!(ctx.widget && ctx.widget.selectedAgents && ctx.widget.selectedAgents.length);
            }
          },
          {
            label: 'Name the project and say how to run its tests',
            hint: 'The two things an agent asks about most.',
            check: function (ctx) {
              var a = ctx.widget && ctx.widget.answers;
              return !!(a && a.projectName && a.projectName.length > 1
                && a.testCommand && a.testCommand.length > 1);
            }
          },
          {
            label: 'Save the file into the sandbox repository',
            hint: 'Press "Write into the repo". It appears in the working directory like any other file.',
            check: function (ctx) {
              return Object.keys(ctx.eng.worktree()).some(function (p) {
                return /(CLAUDE|AGENTS|GEMINI)\.md$/.test(p);
              });
            }
          },
          {
            label: 'Commit it',
            hint: 'Switch to the Terminal tab: <code>git add .</code> then <code>git commit -m "Add agent rules"</code>.',
            check: function (ctx) {
              return Object.keys(ctx.eng.headTree()).some(function (p) {
                return /(CLAUDE|AGENTS|GEMINI)\.md$/.test(p);
              });
            }
          }
        ]
      },
      outro: 'That is the lesson. You can start a repository, work in it safely, recover from anything, work with other people, and hand an agent a set of rules it will actually follow.'
    }
  ];

  chapters.forEach(function (c, i) { c.n = i; });

  return {
    list: chapters,
    byId: function (id) {
      var found = null;
      chapters.forEach(function (c) { if (c.id === id) found = c; });
      return found;
    },
    totalXp: chapters.reduce(function (sum, c) { return sum + c.xp; }, 0),
    isUsefulMessage: isUsefulMessage
  };
}));
