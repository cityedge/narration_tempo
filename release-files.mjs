// Copyright (c) 2026 cityedge. MIT; see LICENSE.
// Explicit publication allowlist. Never recursively copy this workspace.
export const releaseFiles = [
  '.gitignore', '.gitattributes', '.nojekyll', 'LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md',
  'SOURCES.md', 'docs/VALIDATION.md', 'index.html', 'package.json', 'package-lock.json',
  'build.mjs', 'package.mjs', 'release-files.mjs', 'test-release.mjs',
  'test.mjs', 'test-dsp.mjs', 'tests/fixtures/wsola-v1.2.js',
  'src/index.html', 'src/style.css', 'src/app.js', 'src/engine.js',
  'vendor/NOTICE.txt', 'vendor/LICENSE-MIT.md', 'vendor/LAME-NOTICE.txt',
  'vendor/COPYING', 'vendor/COPYING.LESSER', 'vendor/browser-mp3.js',
  'vendor/mp3-async.ts', 'vendor/rebuild.mjs',
  'vendor/mp3-source/package.json', 'vendor/mp3-source/package-lock.json',
  'vendor/mp3-source/tsconfig.json', 'vendor/mp3-source/build.mjs',
  'vendor/mp3-source/src/errors.ts', 'vendor/mp3-source/src/mp3-worker-source.d.ts',
  'vendor/mp3-source/src/mp3/worker.ts', 'vendor/mp3-source/src/mp3/wav.ts',
  'vendor/mp3-source/src/mp3/xing.ts', 'vendor/mp3-source/src/mp3/encoder.d.ts',
  'vendor/mp3-source/scripts/prepare-lamejs.mjs',
  'vendor/mp3-source/third_party/lamejs/source.tar.gz',
  'vendor/mp3-source/third_party/lamejs/COPYING',
  'vendor/mp3-source/third_party/lamejs/COPYING.LESSER',
  'vendor/mp3-source/third_party/lamejs/README.md',
  'vendor/mp3-source/third_party/lamejs/extensions/README.md',
  'vendor/mp3-source/third_party/lamejs/extensions/VBROldIterationLoop.js',
  'vendor/mp3-source/third_party/lamejs/extensions/ABRIterationLoop.js',
  'release/README.md', 'release/SOURCES.md', 'release/rebuild-mp3.mjs',
  'release/RELEASE_NOTES.md',
];

// User-facing archive: no encoder source archive, test suite or installed tools.
// The small application-specific wrapper changes and relinking script remain.
export const runtimeFiles = [
  ['index.html', 'index.html'],
  ['release/README.md', 'README.md'],
  ['release/SOURCES.md', 'SOURCES.md'],
  ['LICENSE', 'LICENSE'],
  ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md'],
  ['vendor/LICENSE-MIT.md', 'vendor/LICENSE-MIT.md'],
  ['vendor/LAME-NOTICE.txt', 'vendor/LAME-NOTICE.txt'],
  ['vendor/COPYING', 'vendor/COPYING'],
  ['vendor/COPYING.LESSER', 'vendor/COPYING.LESSER'],
  ['vendor/mp3-async.ts', 'source-support/mp3-async.ts'],
  ['release/rebuild-mp3.mjs', 'source-support/rebuild-mp3.mjs'],
];
