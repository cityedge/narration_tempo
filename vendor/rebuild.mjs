// Copyright (c) 2026 cityedge. MIT; see ../LICENSE.
// First: npm ci --prefix Narration_Tempo/vendor/mp3-source
// Then: node Narration_Tempo/vendor/rebuild.mjs
// Rebuild from the included sources; no upstream Git checkout is required.
import { copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const source = new URL('mp3-source/', root);
await copyFile(new URL('mp3-async.ts', root), new URL('src/mp3.ts', source));
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], {
  cwd: fileURLToPath(source), stdio: 'inherit',
});
execFileSync(process.execPath, ['build.mjs'], {
  cwd: fileURLToPath(source), stdio: 'inherit',
});
await copyFile(new URL('dist/browser-mp3.js', source), new URL('browser-mp3.js', root));
console.log('Rebuilt vendor/browser-mp3.js. Run build.mjs to embed it in the app.');
