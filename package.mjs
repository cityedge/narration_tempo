// Copyright (c) 2026 cityedge. MIT; see LICENSE.
import { mkdir, mkdtemp, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { releaseFiles, runtimeFiles } from './release-files.mjs';
const root = fileURLToPath(new URL('./', import.meta.url));
if (process.platform !== 'win32') throw Error('ZIP packaging requires Windows PowerShell; source builds are cross-platform.');
execFileSync(process.execPath, ['build.mjs'], { cwd: root, stdio: 'inherit' });
execFileSync(process.execPath, ['test-release.mjs'], { cwd: root, stdio: 'inherit' });
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Expected a numeric release version');
const dist = join(root, 'dist');
await mkdir(dist, { recursive: true });
// A fresh directory prevents stale or unrelated files entering a later release.
const release = await mkdtemp(join(dist, `narration-tempo-${version}-`));
const project = join(release, 'narration-tempo-repository');
for (const name of releaseFiles) {
  const target = join(project, name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, name), target);
}
const runtime = join(release, `narration-tempo-${version}`);
for (const [source, name] of runtimeFiles) {
  const target = join(runtime, name);
  await mkdir(dirname(target), { recursive: true });
  if (source.startsWith('release/') && source.endsWith('.md')) {
    const doc = (await readFile(join(root, source), 'utf8')).replaceAll('__APP_VERSION__', version);
    await writeFile(target, doc, 'utf8');
  } else await copyFile(join(root, source), target);
}
const releaseNotes = (await readFile(join(root, 'release/RELEASE_NOTES.md'), 'utf8')).replaceAll('__APP_VERSION__', version);
await writeFile(join(release, 'RELEASE_NOTES.md'), releaseNotes, 'utf8');
const archive = join(release, `narration-tempo-${version}-user.zip`);
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
  'Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:NT_ZIP_SOURCE, $env:NT_ZIP_DESTINATION, [System.IO.Compression.CompressionLevel]::Optimal, $true)'],
  { stdio: 'inherit', env: { ...process.env, NT_ZIP_SOURCE: runtime, NT_ZIP_DESTINATION: archive } });
const sha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(join(release, 'SHA256SUMS'), `${sha256}  narration-tempo-${version}-user.zip\n`);
console.log(JSON.stringify({ project, runtime, archive, sha256, files: runtimeFiles.length }, null, 2));
