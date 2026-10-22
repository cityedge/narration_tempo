// Copyright (c) 2026 cityedge. MIT; see LICENSE.
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { releaseFiles, runtimeFiles } from './release-files.mjs';
const root = new URL('./', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
assert.equal(new Set(releaseFiles).size, releaseFiles.length);
for (const name of releaseFiles) {
  assert(!name.split('/').some(p => ['..', 'node_modules', 'build', 'dist', 'tmp'].includes(p)), name);
  assert(!/handover|music_envelope|narration_speed|\.(wav|mp3|png)$/i.test(name), name);
  const stat = await lstat(new URL(name, root));
  assert(stat.isFile() && !stat.isSymbolicLink(), name);
}
assert.match(await read('LICENSE'), /^MIT License/);
assert.match(await read('vendor/COPYING.LESSER'), /GNU LESSER GENERAL PUBLIC LICENSE/);
assert.match(await read('vendor/COPYING'), /GNU GENERAL PUBLIC LICENSE/);
const html = await read('Narration_Tempo.html');
const { version } = JSON.parse(await read('package.json'));
assert(html.includes(`<title>Narration Tempo v${version}</title>`));
assert(html.includes(`<meta name="application-version" content="${version}" />`));
assert(html.includes(`id="appVersion">v${version}</span>`));
assert(!html.includes('__APP_VERSION__'));
assert(!/id="(?:licenses|licenseDialog)"|\/\*__[A-Z]+__\*\//.test(html));
assert(!/<(?:script[^>]+src|link[^>]+href)|fetch\(|XMLHttpRequest/i.test(html));
assert.match(html, /THIRD_PARTY_NOTICES\.md/);
assert.match(html, /modified lamejs 1\.2\.7 \(LGPL-3\.0\)/);
assert.equal(html.split('/* BrowserMp3 bundle:begin */').length, 2);
assert.equal(html.split('/* BrowserMp3 bundle:end */').length, 2);
const archive = await readFile(new URL('vendor/mp3-source/third_party/lamejs/source.tar.gz', root));
assert.equal(createHash('sha256').update(archive).digest('hex'), '9db4f8798baf8f667a5aea687bad4b30cae0663e69064675ec7f9882074eb55d');
// Every local document link in the main publication documents must ship in the ZIP.
for (const doc of ['README.md', 'SOURCES.md', 'THIRD_PARTY_NOTICES.md']) {
  for (const match of (await read(doc)).matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (target && !/^[a-z]+:/i.test(target)) assert(releaseFiles.includes(target), `${doc}: ${target}`);
  }
}
const runtimeNames = runtimeFiles.map(([, name]) => name);
assert.equal(new Set(runtimeNames).size, runtimeNames.length);
for (const [source, name] of runtimeFiles) {
  assert(releaseFiles.includes(source), source);
  assert(!/\.tar\.gz$|\.zip$|^src\/|^tests\/|node_modules|mp3-source\//.test(name), name);
  if (!name.endsWith('.md')) continue;
  for (const match of (await read(source)).matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (target && !/^[a-z]+:/i.test(target)) assert(runtimeNames.includes(target), `${source}: ${target}`);
  }
}
for (const file of ['release/SOURCES.md', 'release/RELEASE_NOTES.md']) {
  const text = await read(file);
  assert(text.includes('https://github.com/cityedge/browser-media-i-o/releases/download/v0.5.0/browser-media-io-sources-0.5.0.zip'));
  assert(text.includes('ea4637dbbc8d44b7d46d8a04647867ce92f47775c8bca69f21a955b653e4db11'));
}
console.log(`PASS: version ${version}; ${releaseFiles.length} repository files, ${runtimeFiles.length} user files; source access, licenses, links and offline HTML.`);
