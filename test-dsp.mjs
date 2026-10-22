import vm from "node:vm";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("./", import.meta.url),
  engine = await readFile(new URL("src/engine.js", root), "utf8"),
  original = await readFile(
    new URL("tests/fixtures/wsola-v1.2.js", root),
    "utf8",
  );
const workerMessages = [];
const ctx = vm.createContext({
  Float32Array,
  Float64Array,
  Uint8Array,
  DataView,
  ArrayBuffer,
  Blob,
  setTimeout,
  self: {},
  postMessage: (m) => workerMessages.push(m),
});
vm.runInContext(
  engine +
    "\nthis.api={AudioSource,ToneSource,toneCoefficients,mp3Source,analyze,levelCurve,stretch,Encoder,Meter,DEFAULT_WS,run};",
  ctx,
);
const api = ctx.api;
// Worker guards: the stated 72-minute limit must fit standard 48k stereo,
// including a 60-minute source slowed to 72 minutes. Higher rates still obey
// the independent memory bound; one extra output sample must be rejected.
vm.runInContext(
  `
  source = {sampleRate:48000, channels:2, length:72*60*48000};
  validate({ratio:1,ws:DEFAULT_WS});
  source.length = 60*60*48000;
  validate({ratio:60/72,ws:DEFAULT_WS});
`,
  ctx,
);
assert.throws(
  () =>
    vm.runInContext(
      `
  source.length = 72*60*48000+1;
  validate({ratio:1,ws:DEFAULT_WS});
`,
      ctx,
    ),
  /durationLimit/,
);
assert.throws(
  () =>
    vm.runInContext(
      `
  source = {sampleRate:96000,channels:2,length:72*60*96000};
  validate({ratio:1,ws:DEFAULT_WS});
`,
      ctx,
    ),
  /memoryLimit/,
);
console.log(
  "PASS: 72-minute worker boundary, 60→72 min, 48k stereo retained capacity, high-rate memory guard.",
);
const old = vm.createContext({
  Float32Array,
  Uint8Array,
  DataView,
  ArrayBuffer,
  setTimeout,
  tr: (x) => x,
});
vm.runInContext(
  original + "\nthis.api={transform};",
  old,
);
const sr = 16000,
  n = sr * 8,
  a = Float32Array.from(
    { length: n },
    (_, i) =>
      0.4 *
      Math.sin((i / sr) * 2 * Math.PI * (i < sr * 4 ? 173 : 220)) *
      (0.6 + 0.4 * Math.sin((i / sr) * 5) ** 2),
  );
for (const channels of [[a], [a, Float32Array.from(a, (v) => -0.7 * v)]])
  for (const ratio of [0.7, 1, 1.15, 1.3]) {
    const meta = { sampleRate: sr, length: n, channels: channels.length },
      source = new api.AudioSource(meta, null, channels),
      frames = Math.round(n / ratio),
      writer = new api.Encoder(frames, sr, channels.length, 24, 1),
      parts = [];
    await api.stretch(source, ratio, api.DEFAULT_WS, async (a, p, n) =>
      writer.push(a, 0, n),
    );
    await old.api.transform({
      buffer: {
        sampleRate: sr,
        numberOfChannels: channels.length,
        getChannelData: (c) => channels[c],
      },
      startFrame: 0,
      sourceFrames: n,
      ratio,
      bits: 24,
      wsolaConfig: api.DEFAULT_WS,
      write: async (b) => parts.push(b),
      progress: () => {},
      signal: { cancelled: false },
    });
    const actual = Buffer.from(await writer.finish().arrayBuffer()).subarray(
        44,
        44 + frames * channels.length * 3,
      ),
      expected = Buffer.concat(parts);
    assert.deepEqual(actual, expected, `WSOLA ${channels.length}ch ${ratio}`);
  }
const source = new api.AudioSource(
    { sampleRate: sr, length: n, channels: 1 },
    null,
    [a],
  ),
  { env } = await api.analyze(source);
for (let f = 0; f < env.length; f++) {
  let p = 0;
  for (
    let i = Math.max(0, f * 1600 - 4000);
    i < Math.min(n, f * 1600 + 4000);
    i++
  )
    p = Math.max(p, Math.abs(a[i]));
  assert(
    Math.abs(env[f] - 20 * Math.log10(Math.max(1e-9, p))) < 1e-5,
    "rolling envelope",
  );
}
const meter = new api.Meter(sr, 1, n);
for (let p = 0; p < n; p += 16384)
  meter.push([a.subarray(p, p + 16384)], p, Math.min(16384, n - p));
const measured = meter.result();
assert(Number.isFinite(measured.lufs));
const silence = new api.AudioSource(
  { sampleRate: sr, length: 32000, channels: 1 },
  null,
  [new Float32Array(32000)],
);
const silent = await api.analyze(silence);
assert(api.levelCurve(silent.env).every(Number.isFinite));
console.log(
  "PASS: WSOLA v1.2 byte-identical PCM24 at 0.7/1/1.15/1.3, mono/stereo; rolling peak windows; finite silent gain.",
);
// TPDF at the final 16-bit quantizer: silence must contain both +/-1 LSB,
// approximately 0.25 LSB^2 variance, and no DC offset.
const quantizer = new api.Encoder(160000, 16000, 1, 16, 1);
quantizer.push([new Float32Array(160000)], 0, 160000);
const dithered = new DataView(await quantizer.finish().arrayBuffer());
let sum = 0,
  squares = 0,
  min = 0,
  max = 0;
for (let i = 44; i < dithered.byteLength; i += 2) {
  const v = dithered.getInt16(i, true);
  sum += v;
  squares += v * v;
  min = Math.min(min, v);
  max = Math.max(max, v);
}
assert.equal(min, -1);
assert.equal(max, 1);
assert(Math.abs(sum / 160000) < 0.01);
assert(Math.abs(squares / 160000 - 0.25) < 0.01);
// Float master introduces no 16-bit quantization, dither or clipping below 0dBFS.
const floating = new api.Encoder(n, sr, 1, 32, 1);
floating.push([a], 0, n);
const floatBytes = await floating.finish().arrayBuffer();
assert.equal(new DataView(floatBytes).getUint16(20, true), 3);
assert.deepEqual(new Float32Array(floatBytes, 44), a);
// Compare the checkpoint reader (including backwards seeks) to an independent
// whole-array direct-form-I filter. This catches clicks at block boundaries.
const raw = new api.AudioSource(
  { sampleRate: sr, length: n, channels: 2 },
  null,
  [a, a],
);
const eq = { low: true, mud: true, clear: true };
const filtered = new api.ToneSource(raw, eq),
  expected = new Float32Array(a);
for (const b of api.toneCoefficients(sr, eq)) {
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < n; i++) {
    const x = expected[i],
      y = b[0] * x + b[1] * x1 + b[2] * x2 - b[3] * y1 - b[4] * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    expected[i] = y;
  }
}
for (const [p, count] of [
  [70000, 1000],
  [0, 40000],
  [65500, 2000],
  [120000, 8000],
  [1000, 70000],
]) {
  const actual = await filtered.read(p, count);
  for (let i = 0; i < count; i++) {
    assert(
      Math.abs(actual[0][i] - expected[p + i]) < 1e-6,
      "continuous EQ across seek/block",
    );
    assert.equal(actual[0][i], actual[1][i], "independent stereo filter state");
  }
}
for (const [eq, f, lo, hi] of [
  [{ low: true }, 20, -30, -20],
  [{ mud: true }, 320, -2.6, -2.4],
  [{ clear: true }, 3500, 1.9, 2.1],
]) {
  const wave = Float32Array.from(
      { length: 48000 },
      (_, i) => 0.1 * Math.sin((2 * Math.PI * f * i) / sr),
    ),
    src = new api.ToneSource(
      new api.AudioSource(
        { sampleRate: sr, length: 48000, channels: 1 },
        null,
        [wave],
      ),
      eq,
    ),
    actual = (await src.read(0, 48000))[0];
  let before = 0,
    after = 0;
  for (let i = 16000; i < 48000; i++) {
    before += wave[i] ** 2;
    after += actual[i] ** 2;
  }
  const gain = 10 * Math.log10(after / before);
  assert(gain > lo && gain < hi, JSON.stringify({ eq, gain }));
}
console.log(
  "PASS: TPDF distribution/DC, float master exact PCM, EQ continuity/random seek/stereo and response of all three switches.",
);

// Preview cost is bounded by the excerpt, even on a long file and after EQ
// changes. Any scan from the beginning or to the end makes this source fail.
for (const seconds of [30, 3000])
  for (const eq of [
    { low: false, mud: false, clear: false },
    { low: true, mud: true, clear: true },
  ]) {
    const rate = 48000,
      total = 3600 * rate,
      selected = seconds * rate,
      reads = [];
    ctx.testSource = {
      sampleRate: rate,
      channels: 2,
      length: total,
      setGain() {},
      async read(p, n) {
        assert(
          p >= selected - 12 * rate && p + n <= selected + 42 * rate,
          "preview read outside local context",
        );
        reads.push([p, n]);
        const a = Float32Array.from(
          { length: n },
          (_, i) => 0.15 * Math.sin(((p + i) * 2 * Math.PI * 173) / rate),
        );
        return [a, Float32Array.from(a, (x) => -0.7 * x)];
      },
    };
    vm.runInContext(
      "source=testSource;curve=new Float64Array(36000).fill(2);cached=null;tone=null;working=null;rendered=null;",
      ctx,
    );
    workerMessages.length = 0;
    const began = performance.now();
    await api.run({
      type: "preview",
      config: { ratio: 1.15, level: true, eq, ws: api.DEFAULT_WS },
      start: seconds,
    });
    assert(
      !workerMessages.some((m) => m.type === "error"),
      workerMessages.find((m) => m.type === "error")?.message,
    );
    assert(
      !workerMessages.some((m) => m.type === "stats" || m.type === "rendered"),
    );
    assert(
      workerMessages
        .filter((m) => m.type === "progress")
        .every((m) => m.phase === "preview"),
    );
    const result = workerMessages.find((m) => m.type === "previewed");
    assert.equal(result.reference, "estimate");
    assert.equal(
      new DataView(await result.b.slice(0, 44).arrayBuffer()).getUint32(
        40,
        true,
      ),
      Math.round((30 * rate) / 1.15) * 2 * 4,
    );
    assert.equal(
      vm.runInContext("cached===null && rendered===null && tone===null", ctx),
      true,
      "preview must not populate full-recording state",
    );
    const touched = reads.reduce((n, r) => n + r[1], 0) / rate;
    assert(touched < 240, "bounded repeated block reads");
    console.log(
      JSON.stringify({
        previewStartSeconds: seconds,
        eq: eq.low,
        readSeconds: Math.round(touched),
        elapsedMs: Math.round(performance.now() - began),
      }),
    );
  }
// After full conversion, preview B must be the exact retained PCM, with no
// normalization or stretch pass; preview A remains the unmodified original.
ctx.testSource = new api.AudioSource(
  { sampleRate: sr, length: n, channels: 1 },
  null,
  [a],
);
vm.runInContext(
  "source=testSource;curve=levelCurve(new Float32Array(80).fill(-10));cached=null;tone=null;working=null;rendered=null;",
  ctx,
);
const config = {
  ratio: 1.15,
  level: true,
  eq: { low: false, mud: false, clear: false },
  ws: api.DEFAULT_WS,
};
workerMessages.length = 0;
await api.run({ type: "render", config });
const fullResult = workerMessages.find((m) => m.type === "rendered");
assert(fullResult, workerMessages.find((m) => m.type === "error")?.message);
workerMessages.length = 0;
await api.run({ type: "preview", config, start: 4 });
const excerpt = workerMessages.find((m) => m.type === "previewed");
assert.equal(excerpt.reference, "rendered");
const fullBytes = Buffer.from(await fullResult.blob.arrayBuffer()),
  previewBytes = Buffer.from(await excerpt.b.arrayBuffer());
assert.deepEqual(
  previewBytes.subarray(44),
  fullBytes.subarray(44 + Math.round((4 * sr) / config.ratio) * 4),
);
const rawPreview = new Float32Array(await excerpt.a.arrayBuffer(), 44);
assert.deepEqual(rawPreview, a.subarray(4 * sr));
assert(
  !workerMessages.some((m) => m.type === "stats" || m.type === "rendered"),
);
console.log(
  "PASS: bounded early/late previews with EQ on/off; full-result excerpt is byte-identical; original preview unchanged.",
);
