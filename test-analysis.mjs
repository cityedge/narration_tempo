// Copyright (c) 2026 cityedge. MIT. Signal-level verification of display analysis.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("./", import.meta.url);
const messages = [];
const ctx = vm.createContext({
  Blob,
  setTimeout,
  self: {},
  postMessage: (m) => messages.push(m),
});
vm.runInContext(
  fs.readFileSync(new URL("src/analysis.js", root), "utf8") +
    "\n" +
    fs.readFileSync(new URL("src/formant.js", root), "utf8") +
    "\n" +
    fs.readFileSync(new URL("src/engine.js", root), "utf8") +
    "\nthis.api={spectrumFFT,compareAverage,envelopeCurve,logFrequencies,StretchAlignment,AudioSource,ToneSource,stretch,run,DEFAULT_WS};",
  ctx,
);
const api = ctx.api;
const signal = (sr, n, tones) =>
  Float32Array.from({ length: n }, (_, i) =>
    tones.reduce(
      (s, [f, a]) => s + a * Math.sin((i * 2 * Math.PI * f) / sr),
      0,
    ),
  );
const source = (pcm, sr) =>
  new api.AudioSource(
    { sampleRate: sr, channels: pcm.length, length: pcm[0].length },
    null,
    pcm,
  );
const maxDiff = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
const re = Float64Array.from({ length: 1024 }, (_, i) =>
    Math.sin((i * 2 * Math.PI * 17) / 1024),
  ),
  im = new Float64Array(1024),
  copy = re.slice();
api.spectrumFFT(re, im);
assert(Math.abs(im[17] + 512) < 1e-8);
api.spectrumFFT(re, im, true);
assert(maxDiff(re, copy) < 1e-12);
for (const sr of [8000, 48000, 192000]) {
  const a = signal(sr, sr / 10, [
      [600, 0.1],
      [2000, 0.04],
    ]),
    b = Float32Array.from(a, (x) => x * 5);
  const pair = await api.compareAverage(
    source([a, Float32Array.from(a, (x) => -x)], sr),
    source([b], sr),
  );
  assert(!pair.unavailable);
  assert(
    maxDiff(
      pair.before.map((x) => Math.max(-60, x)),
      pair.after.map((x) => Math.max(-60, x)),
    ) < 0.01,
    "gain/stereo-inversion invariance within display range",
  );
  assert(pair.frequencies.at(-1) <= sr / 2 + 1e-8);
  assert(pair.before.every(Number.isFinite));
}
const eqPcm = signal(48000, 48000, [
  [160, 0.1],
  [3500, 0.1],
]);
const eqSource = source([eqPcm], 48000);
const eqComparison = await api.compareAverage(
  eqSource,
  new api.ToneSource(eqSource, { clear: true }),
);
const nearest = (f) =>
  Array.from(eqComparison.frequencies).reduce(
    (best, x, i) =>
      Math.abs(x - f) < Math.abs(eqComparison.frequencies[best] - f) ? i : best,
    0,
  );
const low = nearest(160),
  high = nearest(3500);
const relativeBoost =
  eqComparison.after[high] -
  eqComparison.before[high] -
  (eqComparison.after[low] - eqComparison.before[low]);
assert(
  relativeBoost > 1.8 && relativeBoost < 2.1,
  "display normalization must preserve EQ band differences",
);
const silent = await api.compareAverage(
  source([new Float32Array(8000)], 8000),
  source([new Float32Array(8000)], 8000),
);
assert.equal(silent.unavailable, "analysisSilent");
function vowel(sr, seconds, shift = 1) {
  const tones = [];
  for (let f = 120; f < Math.min(5800, sr / 2); f += 120) {
    let a = 0.001;
    for (const [center, width, amp] of [
      [600, 120, 0.08],
      [1300, 160, 0.05],
      [2600, 200, 0.04],
    ])
      a += amp * Math.exp(-0.5 * ((f - center * shift) / width) ** 2);
    tones.push([f, a]);
  }
  return signal(sr, Math.round(seconds * sr), tones);
}
const sr = 16000,
  freqs = api.logFrequencies(6000),
  v = vowel(sr, 0.05);
const envelope = api.envelopeCurve([v], sr, freqs),
  scaled = api.envelopeCurve(
    [Float32Array.from(v, (x) => x * 0.17)],
    sr,
    freqs,
  );
assert(maxDiff(envelope.values, scaled.values) < 0.001);
const shifted = api.envelopeCurve([vowel(sr, 0.05, 1.2)], sr, freqs);
function peak(values, lo, hi) {
  let best = -Infinity,
    hz = 0;
  for (let i = 0; i < freqs.length; i++)
    if (freqs[i] >= lo && freqs[i] <= hi && values[i] > best) {
      best = values[i];
      hz = freqs[i];
    }
  return hz;
}
const p1 = peak(envelope.values, 400, 950),
  p2 = peak(shifted.values, 400, 950);
assert(Math.abs(p1 - 600) < 100);
assert(p2 - p1 > 70, "known spectral-envelope shift must remain visible");
console.log(
  "PASS: FFT round trip; gain / stereo invariance; Nyquist bounds; synthetic vowel peak shift",
  { p1, p2 },
);
for (const ratio of [0.7, 1, 1.15, 1.3]) {
  const pcm = vowel(sr, 2),
    src = source([pcm], sr),
    frames = Math.round(pcm.length / ratio),
    out = new Float32Array(frames),
    alignment = new api.StretchAlignment();
  await api.stretch(
    src,
    ratio,
    api.DEFAULT_WS,
    async (a, p, n) => out.set(a[0].subarray(0, n), p),
    null,
    alignment,
  );
  const without = new Float32Array(frames);
  await api.stretch(
    src,
    ratio,
    api.DEFAULT_WS,
    async (a, p, n) => without.set(a[0].subarray(0, n), p),
    null,
  );
  assert.deepEqual(out, without, "alignment recording must not affect audio");
  const output = alignment.outputFor(sr, 400, frames - 400, ratio),
    input = Math.round(alignment.sourceAt(output));
  assert(Math.abs(input - sr) < sr * 0.02, "actual source correspondence");
  const a = api.envelopeCurve([pcm.slice(input - 400, input + 400)], sr, freqs),
    b = api.envelopeCurve([out.slice(output - 400, output + 400)], sr, freqs);
  const useful = Array.from(freqs, (f, i) =>
    f >= 200 && f <= 4000 ? Math.abs(a.values[i] - b.values[i]) : 0,
  );
  const mean = useful.reduce((s, x) => s + x) / useful.length;
  assert(mean < 2, "stationary vowel envelope preservation");
  console.log("envelope ratio", ratio, "mean difference dB", mean.toFixed(4));
}
async function load(pcm, rate = sr) {
  messages.length = 0;
  await api.run({
    type: "load",
    meta: { sampleRate: rate, channels: 1, length: pcm.length },
    pcm: [pcm],
  });
  assert(!messages.find((m) => m.type === "error"));
}
const config = {
  ratio: 1,
  eq: { low: true, mud: true, clear: true },
  level: true,
  ws: api.DEFAULT_WS,
};
await load(vowel(sr, 3));
messages.length = 0;
await api.run({ type: "formant", config, start: 1 });
let result = messages.find((m) => m.type === "formantAnalyzed")?.data;
assert(result, JSON.stringify(messages.at(-1)));
assert.equal(result.reference, "formantLocal");
assert(maxDiff(result.before, result.after) < 0.001);
assert(vm.runInContext("rendered === null", ctx));
messages.length = 0;
await api.run({ type: "preview", config, start: 0 });
assert(
  messages.find((m) => m.type === "previewed")?.spectrum.frequencies.length ===
    256,
);
messages.length = 0;
await api.run({ type: "formant", config, start: 1 });
result = messages.find((m) => m.type === "formantAnalyzed")?.data;
assert.equal(result.reference, "formantPreview");
assert(maxDiff(result.before, result.after) < 0.001);
messages.length = 0;
await api.run({ type: "render", config });
assert(messages.find((m) => m.type === "rendered"));
for (const point of [0, 1, 2.5]) {
  messages.length = 0;
  await api.run({ type: "formant", config, start: point });
  result = messages.find((m) => m.type === "formantAnalyzed")?.data;
  assert(result && !result.unavailable, JSON.stringify(messages.at(-1)));
  assert.equal(result.reference, "formantFull");
  assert(maxDiff(result.before, result.after) < 0.001);
}
await load(new Float32Array(sr));
messages.length = 0;
await api.run({ type: "formant", config, start: 0.5 });
assert.equal(
  messages.find((m) => m.type === "formantAnalyzed")?.data.unavailable,
  "analysisSilent",
);
await load(new Float32Array(3));
messages.length = 0;
await api.run({ type: "formant", config, start: 0 });
assert.equal(
  messages.find((m) => m.type === "formantAnalyzed")?.data.unavailable,
  "analysisShort",
);
console.log(
  "PASS: local / preview / retained formant paths; exact unity with EQ and leveler; start/end windows; silence/short guards; no full render from analysis.",
);
// A standalone inspection near the end of an hour must never scan its prefix.
const deepRate = 8000,
  deepTime = 3000,
  deepStart = deepRate * deepTime;
let deepestReads = 0;
ctx.deepSource = {
  sampleRate: deepRate,
  channels: 1,
  length: deepRate * 3600,
  setGain() {},
  async read(start, n) {
    assert(
      start >= deepStart - 13 * deepRate &&
        start + n <= deepStart + 23 * deepRate,
      "formant inspection escaped the bounded region",
    );
    deepestReads += n;
    return [
      Float32Array.from(
        { length: n },
        (_, i) => 0.1 * Math.sin(((start + i) * 2 * Math.PI * 180) / deepRate),
      ),
    ];
  },
};
vm.runInContext(
  "source=deepSource;curve=new Float64Array(36000);cached=tone=working=rendered=previewAnalysis=null;",
  ctx,
);
messages.length = 0;
await api.run({
  type: "formant",
  config: { ...config, ratio: 1.15 },
  start: deepTime,
});
assert(
  messages.find((m) => m.type === "formantAnalyzed")?.data.frequencies
    .length === 256,
  JSON.stringify(messages.at(-1)),
);
assert(deepestReads < deepRate * 120);
console.log(
  "PASS: standalone formant inspection at minute 50 uses only the bounded local region.",
);
