import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, open, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import vm from "node:vm";
const root = new URL("./", import.meta.url),
  out = new URL("tests/tmp/", root);
await mkdir(out, { recursive: true });
const html = await readFile(new URL("index.html", root), "utf8");
const { version } = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const engine = await readFile(new URL("src/engine.js", root), "utf8");
new vm.Script(engine);
new vm.Script(await readFile(new URL("src/app.js", root), "utf8"));
assert(!/<(?:script[^>]+src|link[^>]+href)|fetch\(|XMLHttpRequest/i.test(html));
function fixture(seconds = 45, sr = 16000, ch = 1, bits = 16) {
  const frames = Math.round(seconds * sr),
    b = Buffer.alloc(44 + (frames * ch * bits) / 8);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE((sr * ch * bits) / 8, 28);
  b.writeUInt16LE((ch * bits) / 8, 32);
  b.writeUInt16LE(bits, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  for (let i = 0; i < frames; i++) {
    const t = i / sr,
      a = t < seconds / 2 ? 0.5 : 0.2,
      phrase = 0.65 + 0.35 * Math.sin(t * 4) ** 2,
      v =
        a *
        phrase *
        (Math.sin(t * 2 * Math.PI * 180) +
          0.22 * Math.sin(t * 2 * Math.PI * 360));
    for (let c = 0; c < ch; c++) {
      const x = v * (c ? -0.8 : 1),
        p = 44 + ((i * ch + c) * bits) / 8;
      if (bits === 16) b.writeInt16LE(Math.round(x * 32767), p);
      else b.writeIntLE(Math.round(x * 8388607), p, 3);
    }
  }
  return b;
}
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  offline: true,
  acceptDownloads: true,
});
await context.route(/^https?:/, (route) => route.abort());
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) errors.push(m.text());
});
await page.setContent(html, { waitUntil: "load" });
assert.equal(await page.title(), `Narration Tempo v${version}`);
assert.equal(await page.locator("#appVersion").textContent(), `v${version}`);
assert.equal(await page.locator("#licenses, #licenseDialog").count(), 0);
const input = fixture();
await writeFile(new URL("fixture.wav", out), input);
await page.locator("#file").setInputFiles({
  name: "日本語ナレーション.wav",
  mimeType: "audio/wav",
  buffer: input,
});
await page.waitForFunction(() => !document.querySelector("#preview").disabled, {
  timeout: 60000,
});
assert(await page.locator("#export").isDisabled());
assert(await page.locator("#processed").isDisabled());
await page.locator("#play").click();
await page.waitForFunction(
  () => document.querySelector("#fullPlayer").currentTime > 0.2,
);
assert.match(await page.locator("#play").textContent(), /一時停止/);
assert(Number(await page.locator("#wave").getAttribute("aria-valuenow")) > 0);
await page.locator("#stop").click();
assert(
  await page
    .locator("#fullPlayer")
    .evaluate((p) => p.paused && p.currentTime < 0.05),
);
await page.locator("#seek").evaluate((el) => {
  el.value = 20;
  el.dispatchEvent(new Event("input"));
});
assert(
  await page
    .locator("#fullPlayer")
    .evaluate((p) => Math.abs(p.currentTime - 20) < 0.05),
);
await page.locator("#seek").evaluate((el) => {
  el.value = 0;
  el.dispatchEvent(new Event("input"));
});
await page.locator("#previewDetails summary").click();
const rawCanvas = await page.locator("#wave").evaluate((c) => c.toDataURL()),
  originalMetrics = await page.locator("#metrics").textContent();
await page.evaluate(() => {
  document.querySelector("#preview").click();
  document.querySelector("#cancel").click();
});
await page.waitForFunction(() => document.querySelector("#cancel").hidden);
assert.match(await page.locator("#status").textContent(), /中止/);
assert(await page.locator("#b").isDisabled());
assert.equal(
  await page.locator("#wave").evaluate((c) => c.toDataURL()),
  rawCanvas,
);
await page.locator("#preview").click();
await page.waitForFunction(() => !document.querySelector("#a").disabled, {
  timeout: 120000,
});
assert.match(await page.locator("#metrics").textContent(), /LUFS/);
assert.equal(
  await page.locator("#metrics").textContent(),
  originalMetrics,
  "preview must not publish full-recording measurements",
);
assert.equal(
  await page.locator("#wave").evaluate((c) => c.toDataURL()),
  rawCanvas,
  "preview must leave the whole waveform gray",
);
assert(await page.locator("#processed").isDisabled());
assert(await page.locator("#export").isDisabled());
assert.equal(await page.locator("#b").getAttribute("aria-pressed"), "true");
assert.match(
  await page.locator("#previewInfo").textContent(),
  /区間からの推定/,
);
await page.screenshot({
  path: fileURLToPath(new URL("preview-only.png", out)),
  fullPage: true,
});
await page.locator("#b").click();
assert.equal(await page.locator("#b").getAttribute("aria-pressed"), "true");
await page.locator("#player").evaluate((p) => p.play());
await page.waitForFunction(
  () => document.querySelector("#player").currentTime > 0.1,
);
await page.locator("#a").click();
await page.waitForFunction(
  () => document.querySelector("#player").currentTime > 0,
);
await page.locator("#player").evaluate((p) => p.pause());
async function exportWav() {
  if (await page.locator("#export").isDisabled()) await renderFull();
  const promise = page.waitForEvent("download", { timeout: 120000 });
  await page.locator("#export").click();
  const download = await promise;
  const path = await download.path();
  return readFile(path);
}
let downloads = 0;
page.on("download", () => downloads++);
async function renderFull() {
  const before = downloads;
  await page.locator("#render").click();
  await page.waitForFunction(
    () => !document.querySelector("#export").disabled,
    null,
    { timeout: 180000 },
  );
  assert.equal(downloads, before, "conversion must not download");
  await page.waitForFunction(
    () => document.querySelector("#fullPlayer").readyState >= 1,
  );
}
await renderFull();
assert.equal(
  await page.locator("#processed").getAttribute("aria-pressed"),
  "true",
);
await page.locator("#seek").evaluate((el) => {
  el.value = 12;
  el.dispatchEvent(new Event("input"));
});
await page.locator("#play").click();
await page.waitForFunction(
  () => document.querySelector("#fullPlayer").currentTime > 12.1,
);
await page.locator("#original").click();
await page.waitForFunction(
  () =>
    !document.querySelector("#fullPlayer").paused &&
    document.querySelector("#fullPlayer").currentTime > 13.8,
);
await page.locator("#processed").click();
await page.waitForFunction(
  () =>
    !document.querySelector("#fullPlayer").paused &&
    document.querySelector("#fullPlayer").currentTime > 12,
);
await page.locator("#stop").click();
// Each envelope bin retains its shared gray interior and paints only its delta.
await page.evaluate(() => {
  document.querySelector("#original").click();
  document.querySelector("#processed").click();
  document.querySelector("#original").click();
  document.querySelector("#stop").click();
});
await page.waitForFunction(() => {
  const p = document.querySelector("#fullPlayer");
  return p.readyState >= 1 && p.paused;
});
assert.equal(
  await page.locator("#original").getAttribute("aria-pressed"),
  "true",
);
const colors = await page.locator("#wave").evaluate((canvas) => {
  const d = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height).data;
  const found = { gray: 0, green: 0, red: 0 };
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] === 136 && d[i + 1] === 150 && d[i + 2] === 170) found.gray++;
    if (d[i] === 84 && d[i + 1] === 206 && d[i + 2] === 139) found.green++;
    if (d[i] === 239 && d[i + 1] === 119 && d[i + 2] === 125) found.red++;
  }
  return found;
});
assert(
  colors.gray > 100 && colors.green > 100 && colors.red > 100,
  JSON.stringify(colors),
);
const wav = await exportWav();
assert.equal(wav.readUInt32LE(40) / 3, Math.round((45 * 16000) / 1.15));
assert.equal(wav.readUInt16LE(34), 24);
let peak = 0;
for (let i = 44; i + 2 < wav.length; i += 3)
  peak = Math.max(peak, Math.abs(wav.readIntLE(i, 3) / 8388608));
assert(peak <= 10 ** (-1 / 20) + 1e-6);
function rms(start, end) {
  let s = 0,
    n = 0;
  for (let i = Math.round(start * 16000); i < Math.round(end * 16000); i++) {
    const v = wav.readIntLE(44 + i * 3, 3) / 8388608;
    s += v * v;
    n++;
  }
  return Math.sqrt(s / n);
}
assert(
  Math.abs(20 * Math.log10(rms(3, 8) / rms(29, 34))) < 3,
  "level drift should be substantially reduced",
);
const convertedCanvas = await page
    .locator("#wave")
    .evaluate((c) => c.toDataURL()),
  fullMetrics = await page.locator("#metrics").textContent(),
  fullPlaybackUrl = await page.locator("#fullPlayer").getAttribute("src");
await page.locator("#previewDetails summary").click();
await page.locator("#start").fill("10");
await page.locator("#start").blur();
await page.locator("#preview").click();
await page.waitForFunction(() => !document.querySelector("#b").disabled);
assert.match(
  await page.locator("#previewInfo").textContent(),
  /全体変換済みの音声/,
);
assert.equal(
  await page.locator("#wave").evaluate((c) => c.toDataURL()),
  convertedCanvas,
);
assert.equal(await page.locator("#metrics").textContent(), fullMetrics);
assert.equal(
  await page.locator("#fullPlayer").getAttribute("src"),
  fullPlaybackUrl,
);
assert(!(await page.locator("#processed").isDisabled()));
assert(!(await page.locator("#export").isDisabled()));
await page.locator("#previewDetails summary").click();
await page.screenshot({
  path: new URL("desktop.png", out).pathname.replace(/^\/([A-Z]:)/, "$1"),
  fullPage: true,
});
await page.setViewportSize({ width: 1366, height: 768 });
await page.screenshot({
  path: fileURLToPath(new URL("laptop.png", out)),
  fullPage: true,
});
console.log(
  "laptop",
  await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    sections: [
      ...document.querySelectorAll("header,.intake-row,.wave-panel,.columns"),
    ].map((e) => ({
      name: e.className || e.tagName,
      top: e.getBoundingClientRect().top,
      height: e.getBoundingClientRect().height,
    })),
  })),
);
assert(
  await page.evaluate(
    () => document.documentElement.scrollHeight <= innerHeight,
  ),
  "one-screen laptop",
);
const intake = await page.evaluate(() => {
  const drop = document.querySelector("#drop").getBoundingClientRect();
  const status = document
    .querySelector(".status-panel")
    .getBoundingClientRect();
  const wave = document.querySelector(".wave-panel").getBoundingClientRect();
  return {
    fraction: drop.width / (drop.width + status.width),
    aligned: Math.abs(drop.top - status.top) < 1,
    above: status.bottom < wave.top,
  };
});
assert(
  Math.abs(intake.fraction - 0.3) < 0.01 && intake.aligned && intake.above,
  "30/70 intake and status above waveform",
);
await page.setViewportSize({ width: 1584, height: 992 });
await page.screenshot({
  path: fileURLToPath(new URL("concept-size.png", out)),
  fullPage: true,
});
await page.locator("#en").click();
assert.equal(await page.locator("#export").textContent(), "Save");
await page.locator("#minutes").fill("0");
await page.locator("#seconds").fill("40");
await page.locator("#apply").click();
assert.equal(await page.locator("#speed").inputValue(), "1.125");
assert(await page.locator("#download").isHidden());
await page.locator("#bits").selectOption("16");
const exact = await exportWav();
assert.equal(exact.readUInt32LE(40) / 2, 40 * 16000);
await page.locator(".settings summary").click();
await page.locator("#overlapMs").fill("25");
assert(await page.locator("#export").isDisabled());
await page.locator("#resetWs").click();
assert(!(await page.locator("#render").isDisabled()));
assert(await page.locator("#export").isDisabled());
await page.locator("#speed").fill("0.700");
await page.locator("#speed").blur();
await page.evaluate(() => {
  document.querySelector("#render").click();
  document.querySelector("#cancel").click();
});
await page.waitForFunction(() => document.querySelector("#cancel").hidden);
assert.match(await page.locator("#status").textContent(), /cancelled/);
await page.locator("#previewDetails summary").click();
await page.locator("#preview").click();
await page.waitForFunction(() => !document.querySelector("#a").disabled, {
  timeout: 120000,
});
await page.locator(".settings summary").click();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: new URL("mobile.png", out).pathname.replace(/^\/([A-Z]:)/, "$1"),
  fullPage: true,
});
assert(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
// End preview, stereo 24-bit input, faster output and mono/stereo metadata.
await page.locator("#file").setInputFiles({
  name: "stereo.wav",
  mimeType: "audio/wav",
  buffer: fixture(5, 48000, 2, 24),
});
await page.waitForFunction(() => !document.querySelector("#preview").disabled);
await page.locator("#speed").fill("1.300");
await page.locator("#speed").blur();
await page.locator("#bits").selectOption("24");
const stereo = await exportWav();
assert.equal(stereo.readUInt16LE(22), 2);
assert.equal(stereo.readUInt32LE(24), 48000);
assert.equal(stereo.readUInt32LE(40) / 6, Math.round(240000 / 1.3));
await page.locator("#previewDetails summary").click();
await page.locator("#start").fill("4.8");
await page.locator("#start").blur();
await page.locator("#preview").click();
await page.waitForFunction(() => !document.querySelector("#a").disabled);
await page.locator("#b").click();
await page.waitForFunction(() =>
  Number.isFinite(document.querySelector("#player").duration),
);
assert(await page.locator("#player").evaluate((p) => p.duration < 0.3));
// Save format changes must preserve the retained audio and never rerun DSP.
await page.locator("#bits").selectOption("mp3");
const retainedURL = await page.locator("#fullPlayer").getAttribute("src");
const downloadsBeforeCancel = downloads;
await page.evaluate(() => {
  document.querySelector("#export").click();
  document.querySelector("#cancel").click();
});
await page.waitForFunction(() => document.querySelector("#cancel").hidden);
assert.match(await page.locator("#status").textContent(), /cancelled/);
assert.equal(downloads, downloadsBeforeCancel);
assert(!(await page.locator("#export").isDisabled()));
assert.equal(
  await page.locator("#fullPlayer").getAttribute("src"),
  retainedURL,
);
const encoded = await exportWav();
assert.equal(
  await page.locator("#fullPlayer").getAttribute("src"),
  retainedURL,
);
assert(!encoded.subarray(0, 4).equals(Buffer.from("RIFF")));
await writeFile(new URL("export.mp3", out), encoded);
const decodedMP3 = await page.evaluate(async (bytes) => {
  const buffer = await new OfflineAudioContext(2, 1, 48000).decodeAudioData(
    Uint8Array.from(bytes).buffer,
  );
  let energy = 0;
  for (const x of buffer.getChannelData(0)) energy += x * x;
  return {
    duration: buffer.duration,
    channels: buffer.numberOfChannels,
    rms: Math.sqrt(energy / buffer.length),
  };
}, Array.from(encoded));
assert.equal(decodedMP3.channels, 2);
assert(Math.abs(decodedMP3.duration - 5 / 1.3) < 0.15);
assert(decodedMP3.rms > 0.01);
await page.locator("#bits").selectOption("24");
assert.deepEqual(
  await exportWav(),
  stereo,
  "MP3 save leaves the retained master unchanged",
);
// EQ changes invalidate output, and all three remain enabled after conversion.
for (const id of ["eqLow", "eqMud", "eqClear"])
  await page.locator("#" + id).check();
assert(await page.locator("#export").isDisabled());
assert(await page.locator("#processed").isDisabled());
await page.locator("#bits").selectOption("24");
await page.evaluate(() => {
  document.querySelector("#render").click();
  document.querySelector("#cancel").click();
});
await page.waitForFunction(() => document.querySelector("#cancel").hidden);
assert.match(await page.locator("#status").textContent(), /cancelled/);
const corrected = await exportWav();
assert(!corrected.equals(stereo));
assert.equal(corrected.length, stereo.length);
for (const id of ["eqLow", "eqMud", "eqClear"])
  await page.locator("#" + id).uncheck();
// 96kHz WAV retains its rate; MP3's streaming resampler yields 48kHz audio.
await page.locator("#file").setInputFiles({
  name: "96k.wav",
  mimeType: "audio/wav",
  buffer: fixture(2, 96000, 2),
});
await page.waitForFunction(() => !document.querySelector("#render").disabled);
await page.locator("#bits").selectOption("mp3");
const resampled = await exportWav();
const resampledDuration = await page.evaluate(
  async (bytes) =>
    (
      await new OfflineAudioContext(2, 1, 48000).decodeAudioData(
        Uint8Array.from(bytes).buffer,
      )
    ).duration,
  Array.from(resampled),
);
assert(Math.abs(resampledDuration - 2 / 1.3) < 0.15);
await page.locator("#bits").selectOption("24");
const highWav = await exportWav();
assert.equal(highWav.readUInt32LE(24), 96000);
assert.deepEqual(errors, []);
console.log(
  JSON.stringify(
    {
      passed: true,
      checks: [
        "offline in-memory HTML",
        "Japanese/English",
        "45s level drift <3dB",
        "sample peak <=-1dBFS",
        "16/24bit WAV and library MP3 output",
        "separate conversion/save; original & processed playback/seek",
        "green/red/gray difference waveform",
        "three EQ switches and stale result invalidation",
        "96kHz streaming MP3 resampling",
        "exact target duration",
        "A/B playing seek",
        "invalid WSOLA",
        "cancel/retry",
        "390px layout",
        "stereo 48kHz",
        "end preview",
      ],
      metrics: await page.locator("#metrics").textContent(),
    },
    null,
    2,
  ),
);
if (process.argv.includes("--limits")) {
  const sampleRate = 8000,
    frames = 72 * 60 * sampleRate;
  async function loadSilent(length) {
    const data = Buffer.alloc(44 + length * 2);
    fixture(0.01, sampleRate, 1).copy(data, 0, 0, 44);
    data.writeUInt32LE(data.length - 8, 4);
    data.writeUInt32LE(length * 2, 40);
    const path = new URL(`duration-boundary-${length}.wav`, out);
    await writeFile(path, data);
    await page.locator("#file").setInputFiles(fileURLToPath(path));
  }
  // Input boundary: exactly 72 minutes allowed, one extra sample rejected.
  await loadSilent(frames + 1);
  await page.waitForFunction(() =>
    document
      .querySelector("#status")
      .textContent.includes("Input supports up to 72 minutes"),
  );
  assert(await page.locator("#render").isDisabled());
  await loadSilent(frames);
  await page.waitForFunction(
    () => !document.querySelector("#render").disabled,
    null,
    { timeout: 60000 },
  );
  await page.locator("#minutes").fill("72");
  await page.locator("#seconds").fill("1");
  await page.locator("#apply").click();
  assert(await page.locator("#render").isDisabled());
  assert.match(
    await page.locator("#status").textContent(),
    /exceeds 72 minutes/,
  );
  await page.locator("#seconds").fill("0");
  await page.locator("#apply").click();
  assert(!(await page.locator("#render").isDisabled()));
  await page.locator("#bits").selectOption("16");
  const boundary = await exportWav();
  assert.equal(boundary.readUInt32LE(40) / 2, frames);
  assert.equal(await page.locator("#after").textContent(), "72:00");
  console.log(
    "PASS: input 72min +1 frame rejected; input exactly 72min and 72min WAV output accepted; 72min 1s output rejected.",
  );
}
if (process.argv.includes("--preview-long")) {
  const path = new URL("preview-45min-48k-mono.wav", out),
    chunk = fixture(1, 48000, 1),
    header = Buffer.from(chunk.subarray(0, 44)),
    seconds = 45 * 60,
    size = seconds * 48000 * 2;
  header.writeUInt32LE(size + 36, 4);
  header.writeUInt32LE(size, 40);
  const f = await open(path, "w");
  await f.write(header);
  for (let s = 0; s < seconds; s++) await f.write(chunk.subarray(44));
  await f.close();
  await page.locator("#file").setInputFiles(fileURLToPath(path));
  await page.waitForFunction(
    () => !document.querySelector("#preview").disabled,
    null,
    { timeout: 120000 },
  );
  await page.locator("#speed").fill("1.150");
  await page.locator("#speed").blur();
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.locator("#ja").click();
  if (!(await page.locator("#previewDetails").evaluate((d) => d.open)))
    await page.locator("#previewDetails summary").click();
  for (const [start, eq] of [
    [1008, false],
    [2400, true],
  ]) {
    for (const id of ["eqLow", "eqMud", "eqClear"])
      await page.locator("#" + id).setChecked(eq);
    await page.locator("#seek").evaluate((el, t) => {
      el.value = t;
      el.dispatchEvent(new Event("input"));
    }, start);
    const wave = await page.locator("#wave").evaluate((c) => c.toDataURL()),
      began = Date.now();
    await page.locator("#preview").click();
    await page.waitForFunction(
      () => !document.querySelector("#b").disabled,
      null,
      { timeout: 30000 },
    );
    console.log(
      JSON.stringify({
        longPreviewPassed: true,
        startSeconds: start,
        eq,
        elapsedMs: Date.now() - began,
      }),
    );
    assert.equal(
      await page.locator("#wave").evaluate((c) => c.toDataURL()),
      wave,
    );
    assert(await page.locator("#processed").isDisabled());
    assert(await page.locator("#export").isDisabled());
    await page.locator("#player").evaluate((p) => p.play());
    await page.waitForFunction(
      () => document.querySelector("#player").currentTime > 0.1,
    );
    await page.locator("#player").evaluate((p) => p.pause());
  }
  await page.screenshot({
    path: fileURLToPath(new URL("preview-long.png", out)),
    fullPage: true,
  });
}
if (process.argv.includes("--mp3")) {
  execFileSync(process.env.FFMPEG_PATH || "ffmpeg", [
    "-y",
    "-v",
    "error",
    "-i",
    fileURLToPath(new URL("fixture.wav", out)),
    "-c:a",
    "libmp3lame",
    "-q:a",
    "3",
    fileURLToPath(new URL("fixture.mp3", out)),
  ]);
  await page
    .locator("#file")
    .setInputFiles(fileURLToPath(new URL("fixture.mp3", out)));
  await page.waitForFunction(
    () => !document.querySelector("#preview").disabled,
    { timeout: 60000 },
  );
  const mp3 = await exportWav();
  assert.equal(mp3.readUInt16LE(34), 24);
  console.log("PASS: VBR MP3 → WAV");
}
if (process.argv.includes("--long")) {
  await page.setViewportSize({ width: 1366, height: 768 });
  const path = new URL("60min-48k-stereo.wav", out),
    chunk = fixture(1, 48000, 2),
    header = Buffer.from(chunk.subarray(0, 44)),
    size = 3600 * 48000 * 4;
  header.writeUInt32LE(size + 36, 4);
  header.writeUInt32LE(size, 40);
  const f = await open(path, "w");
  await f.write(header);
  for (let s = 0; s < 3600; s++) await f.write(chunk.subarray(44));
  await f.close();
  const began = Date.now();
  await page.locator("#file").setInputFiles(fileURLToPath(path));
  await page.waitForFunction(
    () => !document.querySelector("#preview").disabled,
    { timeout: 300000 },
  );
  console.log(
    "60min input analyzed in",
    ((Date.now() - began) / 1000).toFixed(1),
    "s",
  );
  await page.locator("#speed").fill("0.700");
  await page.locator("#speed").blur();
  assert(await page.locator("#export").isDisabled());
  assert.match(await page.locator("#status").textContent(), /72/);
  await page.locator("#speed").fill("1.300");
  await page.locator("#speed").blur();
  await page.locator("#bits").selectOption("24");
  await renderFull();
  await page.locator("#seek").evaluate((el) => {
    el.value = 2500;
    el.dispatchEvent(new Event("input"));
  });
  await page.locator("#play").click();
  await page.waitForFunction(
    () => document.querySelector("#fullPlayer").currentTime > 2500.1,
  );
  await page.locator("#stop").click();
  const downloadPromise = page.waitForEvent("download", { timeout: 600000 });
  await page.locator("#export").click();
  const download = await downloadPromise;
  const saved = await download.path(),
    info = await stat(saved),
    handle = await open(saved, "r"),
    h = Buffer.alloc(44);
  await handle.read(h, 0, 44, 0);
  await handle.close();
  assert.equal(h.readUInt32LE(40) / 6, Math.round((3600 * 48000) / 1.3));
  assert.equal(info.size, 44 + h.readUInt32LE(40));
  console.log(
    JSON.stringify({
      longPassed: true,
      seconds: (Date.now() - began) / 1000,
      outputBytes: info.size,
      durationSeconds: h.readUInt32LE(40) / 6 / 48000,
      metrics: await page.locator("#metrics").textContent(),
    }),
  );
  if (process.argv.includes("--long-mp3")) {
    await page.locator("#bits").selectOption("mp3");
    const mp3Start = Date.now(),
      downloadMP3 = page.waitForEvent("download", { timeout: 600000 });
    await page.locator("#export").click();
    const resultMP3 = await downloadMP3,
      savedMP3 = await resultMP3.path();
    const probe = JSON.parse(
      execFileSync(
        process.env.FFPROBE_PATH || "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration,size",
          "-show_entries",
          "stream=codec_name,sample_rate,channels",
          "-of",
          "json",
          savedMP3,
        ],
        { encoding: "utf8" },
      ),
    );
    assert.equal(probe.streams[0].codec_name, "mp3");
    assert.equal(probe.streams[0].channels, 2);
    assert(Math.abs(Number(probe.format.duration) - 3600 / 1.3) < 0.15);
    console.log(
      JSON.stringify({
        longMP3Passed: true,
        seconds: (Date.now() - mp3Start) / 1000,
        probe,
      }),
    );
  }
}
assert.deepEqual(errors, []);
await browser.close();
