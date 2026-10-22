// Copyright (c) 2026 cityedge. MIT; see ../LICENSE.
// For developers only. Run from the user ZIP root:
// node source-support/rebuild-mp3.mjs <extracted-v0.5.0-source-directory>
// First install the upstream build tools with npm ci in that directory.
// Copies the included wrapper over upstream src/mp3.ts; use a working copy.
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const support = new URL('./', import.meta.url);
const inputHtml = new URL('../index.html', support);
const outputHtml = new URL('../index.rebuilt.html', support);
if (!process.argv[2]) throw Error('Pass the extracted Browser Media I/O v0.5.0 source directory. See SOURCES.md.');
const upstream = resolve(process.argv[2]);
const pkg = JSON.parse(await readFile(join(upstream, 'package.json'), 'utf8'));
if (pkg.name !== 'browser-media-io' || pkg.version !== '0.5.0') throw Error('Expected Browser Media I/O 0.5.0 source.');
let html = await readFile(inputHtml, 'utf8');
const begin = '/* BrowserMp3 bundle:begin */', end = '/* BrowserMp3 bundle:end */';
const start = html.indexOf(begin), finish = html.indexOf(end);
if (start < 0 || finish < start || html.indexOf(begin, start + 1) !== -1 || html.indexOf(end, finish + 1) !== -1)
  throw Error('Expected exactly one replaceable MP3 bundle in index.html.');
await copyFile(new URL('mp3-async.ts', support), join(upstream, 'src/mp3.ts'));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'], {
  cwd: upstream, stdio: 'inherit',
});
execFileSync(process.execPath, ['scripts/build-mp3.mjs'], { cwd: upstream, stdio: 'inherit' });
const bundle = await readFile(join(upstream, 'dist/standalone/browser-mp3.js'), 'utf8');
if (/<\/script/i.test(bundle)) throw Error('Unsafe script delimiter in the rebuilt bundle.');
html = html.slice(0, start + begin.length) + '\n' + bundle + '\n' + html.slice(finish);
await writeFile(outputHtml, html, 'utf8');
console.log(`Rebuilt library and relinked application: ${fileURLToPath(outputHtml)}`);
