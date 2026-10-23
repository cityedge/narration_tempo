// Copyright (c) 2026 cityedge. MIT; see LICENSE.
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const root = new URL("./", import.meta.url);
const sourceCode =
  (await readFile(new URL("src/analysis.js", root), "utf8")) +
  "\n" +
  ((await readFile(new URL("src/formant.js", root), "utf8")) +
    "\n" +
    (await readFile(new URL("src/engine.js", root), "utf8")));
let joins = [];
const context = vm.createContext({
  Float32Array,
  Float64Array,
  Uint8Array,
  DataView,
  ArrayBuffer,
  Blob,
  setTimeout,
  self: {},
  postMessage() {},
  observe(prev, segment, offset, done) {
    const ref = prev[0],
      candidate = segment[0];
    let dot = 0,
      a = 0,
      b = 0;
    for (let j = 0; j < ref.length; j++) {
      dot += ref[j] * candidate[offset + j];
      a += ref[j] ** 2;
      b += candidate[offset + j] ** 2;
    }
    if (a * b > 1e-20)
      joins.push({ done, correlation: dot / Math.sqrt(a * b) });
  },
});
vm.runInContext(
  sourceCode.replace(
    "      const b = best - min,",
    "      observe(prev, segment, best - min, done);\n      const b = best - min,",
  ) + "\nthis.api={AudioSource,stretch,DEFAULT_WS};",
  context,
);
const api = context.api;
async function render(channels, sr, ratio, ws = {}) {
  joins = [];
  const length = channels[0].length,
    size = Math.round(length / ratio);
  const result = channels.map(() => new Float32Array(size));
  const input = new api.AudioSource(
    { sampleRate: sr, channels: channels.length, length },
    null,
    channels,
  );
  const rawRead = input.read.bind(input);
  input.read = async (start, count) => {
    assert(
      start >= 0 && count >= 0 && start + count <= length,
      `read outside clip: ${start}+${count}/${length}`,
    );
    return rawRead(start, count);
  };
  let written = 0;
  await api.stretch(
    input,
    ratio,
    { ...api.DEFAULT_WS, ...ws },
    async (chunk, p, n) => {
      assert.equal(p, written);
      chunk.forEach((a, c) => result[c].set(a.subarray(0, n), p));
      written += n;
    },
  );
  assert.equal(written, size);
  assert(result.every((a) => a.every(Number.isFinite)));
  return { result, joins: [...joins] };
}
// A terminal burst must survive once, at the original amplitude, at every
// output hop phase. Exact frame counts alone did not catch the old truncation.
let terminalCases = 0;
for (const sr of [8000, 16000, 44100, 48000, 96000, 192000])
  for (const ratio of [0.7, 0.85, 0.999, 1, 1.001, 1.15, 1.3])
    for (const seconds of [0.1, 0.5, 0.51, 1, 1.01, 1.024, 1.05]) {
      const a = new Float32Array(Math.round(sr * seconds));
      const burst = Math.round(sr * 0.005);
      for (let j = 0; j < burst; j++)
        a[a.length - burst + j] =
          0.4 *
          Math.sin((2 * Math.PI * 1000 * j) / sr) *
          Math.sin((Math.PI * (j + 0.5)) / burst) ** 2;
      const {
        result: [out],
      } = await render([a], sr, ratio);
      assert.deepEqual(
        out.slice(-burst),
        a.slice(-burst),
        `terminal content ${sr}/${ratio}/${seconds}`,
      );
      assert(
        out.subarray(0, out.length - burst).every((v) => v === 0),
        `terminal burst duplicated ${sr}/${ratio}/${seconds}`,
      );
      terminalCases++;
    }
console.log(
  `PASS: ${terminalCases} terminal-burst cases; no loss, attenuation or duplicate; exact duration and bounded reads.`,
);
// Tiny clips and custom windows still finish on the actual last input sample.
for (const length of [1, 2, 3, 4, 5, 7, 31, 128, 511, 1535, 1536, 1920, 3840])
  for (const ratio of [0.7, 0.999, 1, 1.001, 1.3])
    for (const ws of [
      {},
      { analysisStep: 16, searchStride: 16 },
      { analysisStep: 1, searchStride: 1 },
      { sequenceMs: 16, overlapMs: 7, seekMs: 2 },
      { sequenceMs: 120, overlapMs: 30, seekMs: 50 },
    ]) {
      const a = Float32Array.from(
        { length },
        (_, i) => 0.2 * Math.sin(i * 0.09) + 0.1,
      );
      const {
        result: [out],
      } = await render([a], 48000, ratio, ws);
      assert.equal(out.at(-1), a.at(-1), `last sample ${length}/${ratio}`);
      if (ratio === 1) assert.deepEqual(out, a);
    }
console.log("PASS: short clips, non-default windows and unity bypass.");
for (const sr of [16000, 48000]) {
  const a = Float32Array.from(
    { length: Math.round(sr * 1.4) },
    (_, i) =>
      0.22 * Math.sin((2 * Math.PI * 440 * i) / sr) +
      0.22 * Math.sin((2 * Math.PI * (sr / 8 + 440) * i) / sr),
  );
  const {
    result: [out],
    joins: points,
  } = await render([a], sr, 1.15);
  const interior = points.filter((x) => x.done < out.length - sr * 0.08);
  assert(interior.length > 20);
  const mean =
    interior.reduce((s, x) => s + x.correlation, 0) / interior.length;
  assert(
    mean > (sr === 16000 ? 0.95 : 0.8),
    `alias-sensitive join quality ${sr}: ${mean}`,
  );
  assert(
    interior.every((x) => x.correlation > 0),
    "no destructive joins in diagnostic tones",
  );
  console.log(
    `PASS: full-resolution candidate selection ${sr} Hz: mean correlation ${mean.toFixed(6)}.`,
  );
}
const a = Float32Array.from(
  { length: 48000 },
  (_, i) => 0.3 * Math.sin((2 * Math.PI * 173 * i) / 48000),
);
for (const ratio of [0.7, 1, 1.15, 1.3]) {
  const {
    result: [left, right],
  } = await render([a, Float32Array.from(a, (v) => -v)], 48000, ratio);
  assert(
    left.every((v, i) => v === -right[i]),
    "stereo alignment",
  );
  const repeat = (await render([a], 48000, ratio)).result[0];
  assert.deepEqual(left, repeat, "deterministic mono/stereo timing");
}
console.log("PASS: shared stereo phase and deterministic output.");
