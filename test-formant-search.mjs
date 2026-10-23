// Copyright (c) 2026 cityedge. MIT. Automatic inspection / audition regressions.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const root = new URL("./", import.meta.url),
  messages = [];
let cancelDuringSearch = false;
const ctx = vm.createContext({
  Blob,
  setTimeout,
  self: {},
  postMessage(m) {
    messages.push(m);
    if (
      cancelDuringSearch &&
      m.type === "progress" &&
      m.phase === "formant" &&
      m.value > 0.6
    )
      vm.runInContext("cancelled=true", ctx);
  },
});
vm.runInContext(
  ["analysis", "formant", "engine"]
    .map((f) => fs.readFileSync(new URL("src/" + f + ".js", root), "utf8"))
    .join("\n") +
    `
this.api={AudioSource,StretchAlignment,DEFAULT_WS,run,voicedFrame,envelopeDistance};
this.seed=(before,after,c)=>{source=working=before;curve=new Float64Array(120);rendered=after;rendered.key=processingKey(c);rendered.alignment=new StretchAlignment();rendered.alignment.add(0,0,0);previewAnalysis=formantSearchState=null;};
this.state=()=>formantSearchState;`,
  ctx,
);
const { api } = ctx,
  sr = 16000;
const source = (pcm) =>
  new api.AudioSource(
    { sampleRate: sr, channels: pcm.length, length: pcm[0].length },
    null,
    pcm,
  );
function vowel(seconds, shift = 1) {
  const pcm = new Float32Array(Math.round(seconds * sr));
  for (let f = 120; f < 5800; f += 120) {
    let a = 0.001;
    for (const [center, width, weight] of [
      [600, 120, 0.08],
      [1300, 160, 0.05],
      [2600, 200, 0.04],
    ])
      a += weight * Math.exp(-0.5 * ((f - center * shift) / width) ** 2);
    for (let i = 0; i < pcm.length; i++)
      pcm[i] += a * Math.sin((i * 2 * Math.PI * f) / sr);
  }
  return pcm;
}
let random = 123;
const noise = (n) =>
  Float32Array.from({ length: n }, () => {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    return (random / 2 ** 32 - 0.5) * 0.4;
  });
const before = vowel(12),
  after = before.slice(),
  copy = before.slice();
before.fill(0, 0, sr * 0.7);
before.set(noise(sr * 0.8), sr * 0.7);
after.set(before);
// A persistent envelope change must outrank a much stronger, one-window anomaly.
after.set(vowel(1, 1.2), 5 * sr);
after.set(vowel(0.008, 1.8), Math.round(2.986 * sr));
const c = {
  ratio: 1,
  eq: { low: false, mud: false, clear: false },
  level: false,
  ws: api.DEFAULT_WS,
};
async function command(type, start = 0, config = c) {
  messages.length = 0;
  await api.run({ type, config, start });
  assert(
    !messages.find((m) => m.type === "error"),
    JSON.stringify(messages.at(-1)),
  );
  return messages.find((m) => m.type === "formantAnalyzed");
}
ctx.seed(source([before]), source([after]), c);
const result = await command("formant");
assert(
  result.data.sourceTime > 5.05 && result.data.sourceTime < 5.95,
  JSON.stringify(result.data),
);
assert.equal(result.data.candidateIndex, 0);
assert.equal(result.data.searchStart, 0);
assert.equal(result.data.searchEnd, 10);
assert.equal(result.data.nextStart, 10);
assert(result.data.evaluatedCount <= 32 && result.data.candidateCount > 3);
assert(
  ctx.state().candidates.every((x) => x.sourceFrame / sr > 1.5),
  "silence/noise candidates must be excluded",
);
for (let i = 1; i < ctx.state().candidates.length; i++)
  assert(
    ctx.state().candidates[i - 1].score >= ctx.state().candidates[i].score,
  );
const selected = ctx.state().candidates[0],
  audio = result.audio;
assert(audio.durationA >= 1 && audio.durationA <= 1.6);
for (const side of ["A", "B"]) {
  const pcm = side === "A" ? before : after;
  const blob = audio[side.toLowerCase()],
    header = Buffer.from(await blob.arrayBuffer());
  assert.equal(header.readUInt16LE(20), 3);
  assert.equal(header.readUInt16LE(34), 32);
  const data = new Float32Array(
    header.buffer,
    header.byteOffset + 44,
    (header.length - 44) / 4,
  );
  const start = Math.round(
    selected[side === "A" ? "input" : "output"] - audio["center" + side] * sr,
  );
  let energy = 0,
    peak = 0;
  for (let i = 0; i < data.length; i++) {
    assert(
      Math.abs(data[i] - pcm[start + i] * audio["gain" + side]) < 1e-7,
      "listen to the exact analyzed source with a scalar gain only",
    );
    energy += data[i] ** 2;
    peak = Math.max(peak, Math.abs(data[i]));
  }
  assert(Math.abs(Math.sqrt(energy / data.length) - 0.1) < 1e-6);
  assert(peak <= 10 ** (-1 / 20) + 1e-6);
  assert(
    audio["center" + side] > 0.025 &&
      audio["center" + side] + 0.025 < audio["duration" + side],
  );
}
assert.deepEqual(
  before.slice(1.5 * sr),
  copy.slice(1.5 * sr),
  "analysis/audition must not mutate input PCM",
);
const oldState = ctx.state();
for (let i = 1; i <= oldState.candidates.length; i++) {
  const next = await command("formantCandidate");
  assert.equal(ctx.state(), oldState, "next candidate must reuse the search");
  assert.equal(next.data.candidateIndex, i % oldState.candidates.length);
}
const finalRange = await command("formant", 10);
assert.equal(finalRange.data.searchEnd, 12);
assert.equal(finalRange.data.nextStart, null);
const eof = await command("formant", 12);
assert.equal(eof.data.unavailable, "analysisEnd");
assert.equal(
  (await command("formant", 11.84)).data.unavailable,
  "analysisShort",
);
console.log(
  "PASS: voiced candidates, persistent vs isolated shift ranking, exact audition PCM, RMS match, clip markers, candidate cycle, last-range/EOF.",
);
const q = api.voicedFrame(
  [vowel(0.05), Float32Array.from(vowel(0.05), (x) => -x)],
  sr,
);
assert(
  q.periodicity > 0.9 && q.rms > 0.01,
  "opposite stereo does not cancel voiced detection",
);
ctx.seed(source([noise(sr * 2)]), source([noise(sr * 2)]), c);
assert.equal((await command("formant")).data.unavailable, "analysisNoVoiced");
ctx.seed(source([new Float32Array(sr)]), source([new Float32Array(sr)]), c);
assert.equal((await command("formant")).data.unavailable, "analysisSilent");
ctx.seed(source([before]), source([after]), c);
cancelDuringSearch = true;
messages.length = 0;
await api.run({ type: "formant", config: c, start: 0 });
assert.equal(messages.at(-1).message, "cancelled");
assert.equal(ctx.state(), null);
cancelDuringSearch = false;
assert((await command("formant")).audio);
messages.length = 0;
await api.run({ type: "formantCandidate", config: { ...c, ratio: 1.15 } });
assert.equal(messages.at(-1).message, "formantExpired");
await api.run({ type: "release" });
assert.equal(ctx.state(), null);
console.log(
  "PASS: inverse stereo, noise/silence rejection, cancel/retry, config mismatch and release.",
);
// Real local WSOLA for both faster and slower speech, with edge-safe listening.
for (const ratio of [0.7, 1.3]) {
  const pcm = vowel(3);
  await api.run({
    type: "load",
    meta: { sampleRate: sr, channels: 1, length: pcm.length },
    pcm: [pcm],
  });
  const r = await command("formant", 0, { ...c, ratio });
  assert.equal(r.data.reference, "formantLocal");
  assert(r.audio);
  assert(Math.abs(r.audio.durationA / ratio - r.audio.durationB) <= 1 / sr);
  assert(r.audio.centerA >= 0.025 && r.audio.centerB >= 0.025);
  assert(
    r.audio.durationA - r.audio.centerA >= 0.025 &&
      r.audio.durationB - r.audio.centerB >= 0.025,
  );
  assert(vm.runInContext("rendered===null", ctx));
}
console.log(
  "PASS: local slow/fast WSOLA audio, clip lengths and markers; no retained full conversion.",
);
