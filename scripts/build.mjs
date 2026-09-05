/**
 * build.mjs — inline every stylesheet and script into one file.
 *
 * Produces two artefacts from the same source:
 *   index.html         the site. Committed, because GitHub Pages serves this
 *                      repo straight from the branch — there is no CI step to
 *                      build it. Rebuild and stage it whenever src/ changes.
 *   dist/artifact.html the same page as a body fragment, for hosts that supply
 *                      their own document shell. Generated, not committed.
 *
 * No bundler, no dependencies. `node scripts/build.mjs`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

const read = (relative) => readFileSync(join(src, relative), 'utf8');

// A literal `</script` inside inlined JS ends the block, whatever the JS meant.
const closeSafe = (js) => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');

// Inline local stylesheets. The Google Fonts link stays remote by design.
html = html.replace(
  /^[ \t]*<link rel="stylesheet" href="(css\/[^"]+)">\r?\n/gm,
  (_, href) => `<style>\n/* ${href} */\n${read(href).trimEnd()}\n</style>\n`
);

// Inline local scripts, in the order they appear.
html = html.replace(
  /^[ \t]*<script src="(js\/[^"]+)"><\/script>\r?\n/gm,
  (_, srcPath) => `<script>\n/* ${srcPath} */\n${closeSafe(read(srcPath).trimEnd())}\n</script>\n`
);

if (/<(link|script)[^>]+(href|src)="(css|js)\//.test(html)) {
  throw new Error('build: a local asset was not inlined — check the tag formatting in src/index.html');
}

mkdirSync(dist, { recursive: true });
writeFileSync(join(root, 'index.html'), html);

// The Artifact host supplies <!doctype>, <head> and <body>, so hand it the
// fragment: everything the head needs plus the body's own content.
const headInner = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const bodyInner = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const fragment = headInner
  .replace(/^[ \t]*<meta charset="utf-8">\r?\n/m, '')
  .replace(/^[ \t]*<meta name="viewport"[^>]*>\r?\n/m, '')
  .trim() + '\n' + bodyInner.trim() + '\n';

writeFileSync(join(dist, 'artifact.html'), fragment);

const kb = (s) => `${(Buffer.byteLength(s, 'utf8') / 1024).toFixed(1)} kB`;
console.log(`index.html         ${kb(html)}   <- the published site, commit this`);
console.log(`dist/artifact.html ${kb(fragment)}`);
