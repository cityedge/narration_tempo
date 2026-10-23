/* Narration Tempo — independent worker DSP. No DOM, imports, or network. */
"use strict";
const DEFAULT_WS = Object.freeze({
  sequenceMs: 40,
  seekMs: 15,
  overlapMs: 8,
  searchStride: 8,
  analysisStep: 8,
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const db = (v) => 20 * Math.log10(Math.max(1e-9, v));
const amp = (v) => 10 ** (v / 20);
const pause = () => new Promise((r) => setTimeout(r, 0));
let cancelled = false,
  source = null,
  curve = null,
  cached = null,
  tone = null,
  toneKey = "",
  working = null,
  rendered = null,
  mp3Abort = null,
  previewAnalysis = null,
  formantSearchState = null;
const processingKey = (c) => JSON.stringify([c.ratio, c.level, c.ws, c.eq]);
function check() {
  if (cancelled) throw Error("cancelled");
}
function progress(phase, value) {
  if (!phase) return;
  postMessage({ type: "progress", phase, value });
}

// WAV remains on disk; only a small rolling PCM window is decoded. MP3 PCM is
// decoded once by the browser and transferred here without copying its buffers.
class AudioSource {
  constructor(meta, file, channels) {
    Object.assign(this, meta);
    this.file = file;
    this.pcm = channels;
    this.cache = null;
    this.gain = null;
  }
  setGain(gain) {
    this.gain = gain;
    this.cache = null;
  }
  async read(start, count) {
    check();
    if (
      !this.cache ||
      start < this.cache.start ||
      start + count > this.cache.end
    ) {
      const n = Math.min(this.length - start, Math.max(count, 131072));
      const arrays = Array.from(
        { length: this.channels },
        () => new Float32Array(Math.max(n, count)),
      );
      if (this.pcm) {
        for (let c = 0; c < this.channels; c++)
          arrays[c].set(this.pcm[c].subarray(start, start + n));
      } else {
        const bytes = await this.file
          .slice(
            this.offset + start * this.align,
            this.offset + (start + n) * this.align,
          )
          .arrayBuffer();
        check();
        if (bytes.byteLength !== n * this.align) throw Error("truncated");
        const view = new DataView(bytes),
          unit = this.bits / 8;
        for (let i = 0; i < n; i++)
          for (let c = 0; c < this.channels; c++) {
            const p = i * this.align + c * unit;
            let v;
            if (this.format === 3)
              v =
                this.bits === 32
                  ? view.getFloat32(p, true)
                  : view.getFloat64(p, true);
            else if (this.bits === 8) v = (view.getUint8(p) - 128) / 128;
            else if (this.bits === 16) v = view.getInt16(p, true) / 32768;
            else if (this.bits === 24)
              v =
                (((view.getUint8(p) |
                  (view.getUint8(p + 1) << 8) |
                  (view.getUint8(p + 2) << 16)) <<
                  8) >>
                  8) /
                8388608;
            else v = view.getInt32(p, true) / 2147483648;
            arrays[c][i] = Number.isFinite(v) && Math.abs(v) <= 3.4e38 ? v : 0;
          }
      }
      if (this.gain) {
        const hop = Math.round(this.sampleRate * 0.1);
        for (let i = 0; i < n; i++) {
          const x = (start + i) / hop,
            j = Math.floor(x),
            t = x - j;
          const g = amp(
            this.gain[Math.min(j, this.gain.length - 1)] * (1 - t) +
              this.gain[Math.min(j + 1, this.gain.length - 1)] * t,
          );
          for (let c = 0; c < this.channels; c++) arrays[c][i] *= g;
        }
      }
      this.cache = { start, end: start + arrays[0].length, arrays };
    }
    const p = start - this.cache.start;
    return this.cache.arrays.map((a) => a.subarray(p, p + count));
  }
}

// EQ keeps a tiny filter-state checkpoint per block. WSOLA can seek backwards
// without restarting a filter at the seek point or keeping full-length PCM.
function toneCoefficients(sr, eq = {}) {
  const list = [];
  if (eq.low) list.push(biquad(sr, 75, Math.SQRT1_2));
  const peak = (f, q, gain) => {
    const w = (2 * Math.PI * Math.min(f, sr * 0.4)) / sr,
      a = Math.sin(w) / (2 * q),
      A = 10 ** (gain / 40),
      d = 1 + a / A;
    return [
      (1 + a * A) / d,
      (-2 * Math.cos(w)) / d,
      (1 - a * A) / d,
      (-2 * Math.cos(w)) / d,
      (1 - a / A) / d,
    ];
  };
  if (eq.mud) list.push(peak(320, 0.8, -2.5));
  if (eq.clear) list.push(peak(3500, 0.8, 2));
  return list;
}
class ToneSource {
  constructor(raw, eq) {
    this.raw = raw;
    this.length = raw.length;
    this.sampleRate = raw.sampleRate;
    this.channels = raw.channels;
    this.coefficients = toneCoefficients(this.sampleRate, eq);
    this.states = [
      new Float64Array(this.channels * this.coefficients.length * 2),
    ];
    this.cache = null;
    this.gain = null;
  }
  setGain(gain) {
    this.gain = gain;
    this.readCache = null;
  }
  async block(index) {
    if (this.cache?.index === index) return this.cache.arrays;
    const size = 65536;
    // Analysis normally visits every block first. This also handles a direct
    // seek into a newly-created source, without an unbounded recursion.
    for (let k = this.states.length - 1; k <= index; k++) {
      if (k < index && this.states[k + 1]) continue;
      const start = k * size,
        n = Math.min(size, this.length - start),
        input = await this.raw.read(start, n),
        state = new Float64Array(this.states[k]),
        arrays = input.map((a) => new Float32Array(a));
      for (let c = 0; c < this.channels; c++) {
        for (let f = 0; f < this.coefficients.length; f++) {
          const b = this.coefficients[f],
            at = (c * this.coefficients.length + f) * 2;
          let z1 = state[at],
            z2 = state[at + 1];
          for (let i = 0; i < n; i++) {
            const x = arrays[c][i],
              y = b[0] * x + z1;
            z1 = b[1] * x - b[3] * y + z2;
            z2 = b[2] * x - b[4] * y;
            arrays[c][i] = y;
          }
          state[at] = z1;
          state[at + 1] = z2;
        }
      }
      this.states[k + 1] = state;
      this.cache = { index: k, arrays };
    }
    // A backwards seek uses the exact saved state at this block's start.
    if (this.cache?.index !== index) {
      const tail = this.states.splice(index + 1);
      const a = await this.block(index);
      this.states.splice(index + 1, 1, ...tail);
      return a;
    }
    return this.cache.arrays;
  }
  async read(start, count) {
    check();
    if (
      this.readCache &&
      start >= this.readCache.start &&
      start + count <= this.readCache.end
    ) {
      const p = start - this.readCache.start;
      return this.readCache.arrays.map((a) => a.subarray(p, p + count));
    }
    const requested = count;
    count = Math.max(count, Math.min(131072, this.length - start));
    const out = Array.from(
      { length: this.channels },
      () => new Float32Array(count),
    );
    const end = Math.min(this.length, start + count),
      hop = Math.round(this.sampleRate * 0.1);
    for (let p = start; p < end; ) {
      const index = Math.floor(p / 65536),
        off = p % 65536,
        a = await this.block(index),
        n = Math.min(end - p, a[0].length - off);
      for (let c = 0; c < this.channels; c++)
        out[c].set(a[c].subarray(off, off + n), p - start);
      p += n;
    }
    if (this.gain)
      for (let i = 0; i < count; i++) {
        const x = (start + i + (this.gainOffset || 0)) / hop,
          j = Math.floor(x),
          t = x - j,
          g = amp(
            this.gain[Math.min(j, this.gain.length - 1)] * (1 - t) +
              this.gain[Math.min(j + 1, this.gain.length - 1)] * t,
          );
        for (const a of out) a[i] *= g;
      }
    this.readCache = { start, end: start + count, arrays: out };
    return out.map((a) => a.subarray(0, requested));
  }
}

// A monotonic queue measures exactly the centred 0.5 s peak windows, in O(n).
async function analyze(src, report = (v) => progress("analyze", v)) {
  src.setGain(null);
  const win = Math.round(src.sampleRate * 0.5),
    hop = Math.round(src.sampleRate * 0.1),
    half = Math.floor(win / 2);
  const count = Math.ceil(src.length / hop),
    env = new Float32Array(count),
    wave = new Float32Array(1000);
  const indices = new Float64Array(win + 2),
    values = new Float32Array(win + 2),
    cap = indices.length;
  let head = 0,
    tail = 0,
    f = 0;
  for (let base = 0; base < src.length; base += 65536) {
    const n = Math.min(65536, src.length - base),
      a = await src.read(base, n);
    for (let j = 0; j < n; j++) {
      const i = base + j;
      let v = 0;
      for (let c = 0; c < src.channels; c++) v = Math.max(v, Math.abs(a[c][j]));
      const w = Math.min(999, Math.floor((i / src.length) * 1000));
      wave[w] = Math.max(wave[w], v);
      while (head !== tail && indices[head] < Math.max(0, f * hop - half))
        head = (head + 1) % cap;
      while (head !== tail && values[(tail - 1 + cap) % cap] <= v)
        tail = (tail - 1 + cap) % cap;
      indices[tail] = i;
      values[tail] = v;
      tail = (tail + 1) % cap;
      if (i + 1 === Math.min(src.length, f * hop + Math.ceil(win / 2))) {
        env[f++] = db(values[head]);
      }
    }
    report((base + n) / src.length);
    await pause();
    check();
  }
  while (f < count) {
    while (head !== tail && indices[head] < Math.max(0, f * hop - half))
      head = (head + 1) % cap;
    env[f++] = db(head !== tail ? values[head] : 0);
  }
  return { env, wave };
}
function median(a, size) {
  const half = Math.floor(size / 2);
  return a.map((_, i) => {
    const v = Array.from(
      a.slice(Math.max(0, i - half), Math.min(a.length, i + half + 1)),
    ).sort((x, y) => x - y);
    return v[Math.floor(v.length / 2)];
  });
}
function smooth(a, size) {
  const p = new Float64Array(a.length + 1),
    h = Math.floor(size / 2);
  for (let i = 0; i < a.length; i++) p[i + 1] = p[i] + a[i];
  return a.map((_, i) => {
    const s = Math.max(0, i - h),
      e = Math.min(a.length, i + h + 1);
    return (p[e] - p[s]) / (e - s);
  });
}
function levelCurve(env) {
  let g = Float64Array.from(env, (x) => clamp(-6 - x, -24, 6));
  const med = median(g, 41);
  g = g.map((v, i) => med[i] + clamp(v - med[i], -1, 1));
  g = smooth(median(g, 41), 120);
  for (let i = 1; i < g.length; i++)
    g[i] = clamp(g[i], g[i - 1] - 0.1, g[i - 1] + 0.1);
  for (let i = g.length - 2; i >= 0; i--)
    g[i] = clamp(g[i], g[i + 1] - 0.1, g[i + 1] + 0.1);
  return g.map((v, i) => {
    const excess = env[i] + v + 6;
    return (
      v - (excess > 0 ? Math.min(24, Math.max(excess * 0.5, excess - 1)) : 0)
    );
  });
}

// WSOLA with shared stereo alignment, a multi-candidate full-resolution search,
// and an end-anchored final segment. Output length is exact; reads stay bounded.
async function stretch(
  src,
  ratio,
  ws,
  write,
  phase = "measure",
  alignment = null,
) {
  alignment?.add(0, 0, 0);
  const target = Math.round(src.length / ratio),
    sr = src.sampleRate,
    ch = src.channels;
  let output = Array.from({ length: ch }, () => new Float32Array(16384)),
    used = 0,
    written = 0;
  async function emit(a, start, n) {
    let off = 0;
    while (off < n) {
      const take = Math.min(n - off, 16384 - used);
      for (let c = 0; c < ch; c++)
        output[c].set(a[c].subarray(start + off, start + off + take), used);
      used += take;
      off += take;
      if (used === 16384) {
        await write(output, written, used);
        written += used;
        used = 0;
      }
    }
  }
  if (Math.abs(ratio - 1) < 1e-8) {
    for (let p = 0; p < target; p += 16384) {
      const n = Math.min(16384, target - p);
      await emit(await src.read(p, n), 0, n);
      if (p % 262144 === 0) {
        progress(phase, p / target);
        await pause();
        check();
      }
    }
  } else if (Math.min(src.length, target) < 4) {
    // Sub-four-sample clips have no usable overlap. Interpolate their endpoints
    // rather than reading outside the clip or losing its final sample.
    const input = await src.read(0, src.length);
    const tiny = input.map(() => new Float32Array(target));
    for (let i = 0; i < target; i++) {
      const at =
        target === 1 ? src.length - 1 : (i * (src.length - 1)) / (target - 1);
      const left = Math.floor(at),
        right = Math.min(src.length - 1, left + 1);
      for (let c = 0; c < ch; c++)
        tiny[c][i] =
          input[c][left] * (1 - (at - left)) + input[c][right] * (at - left);
    }
    await emit(tiny, 0, target);
  } else {
    // Leave room for both the initial segment and a complete final crossfade,
    // even when a clip is shorter than the configured sequence length.
    const sequence = Math.min(
        Math.max(128, Math.round((sr * ws.sequenceMs) / 1000)),
        Math.floor(Math.min(src.length, target) / 2),
      ),
      overlap = Math.min(
        Math.max(32, Math.round((sr * ws.overlapMs) / 1000)),
        Math.floor((sequence - 1) / 2) || 1,
      ),
      hop = sequence - overlap,
      seek = Math.max(24, Math.round((sr * ws.seekMs) / 1000));
    let first = await src.read(0, sequence),
      done = Math.min(target, hop);
    await emit(first, 0, done);
    const finalReserve = sequence + overlap,
      finalStart = Math.max(
        hop,
        Math.ceil((target - finalReserve) / hop) * hop,
      ),
      finalLength = target - finalStart;
    const prev = first.map((a) => a.slice(hop, hop + overlap)),
      // Do not let preceding joins consume the terminal tail and repeat it in
      // the final crossfade. Reserve at least one untouched overlap at the end.
      maxBase = Math.max(
        0,
        Math.min(src.length - sequence, src.length - finalLength - hop),
      ),
      fade = Array.from({ length: ch }, () => new Float32Array(overlap));
    for (let k = 1; done < target; k++) {
      check();
      const remaining = target - done;
      if (remaining <= finalReserve) {
        // Anchor the last segment to the actual input end. Earlier regular hops
        // leave more than two overlaps here, so the tail after the crossfade is
        // copied at unity gain, with no extra output frames and no repeated tail.
        alignment?.add(done, src.length - remaining, overlap);
        const tail = await src.read(src.length - remaining, remaining);
        for (let c = 0; c < ch; c++)
          for (let j = 0; j < overlap; j++) {
            const t = (j + 0.5) / overlap;
            fade[c][j] = prev[c][j] * (1 - t) + tail[c][j] * t;
          }
        await emit(fade, 0, overlap);
        await emit(tail, overlap, remaining - overlap);
        done = target;
        break;
      }
      const nominal = clamp(Math.round(k * hop * ratio), 0, maxBase),
        min = Math.max(0, nominal - seek),
        max = Math.min(maxBase, nominal + seek);
      const segment = await src.read(min, max - min + sequence);
      let best = nominal;
      if (src.length > sequence + seek * 2) {
        let refCh = 0,
          energy = 0;
        for (let c = 0; c < ch; c++) {
          let e = 0;
          for (let j = 0; j < overlap; j++) e += prev[c][j] * prev[c][j];
          if (e > energy) {
            energy = e;
            refCh = c;
          }
        }
        // Keep the default silence gate independent of coarse comparison spacing.
        if (energy > 8e-6) {
          const ref = prev[refCh],
            a = segment[refCh];
          let coarseEnergy = 0;
          for (let j = 0; j < overlap; j += ws.analysisStep)
            coarseEnergy += ref[j] * ref[j];
          // A sparse reference can miss every nonzero sample. Fall back to the
          // full reference in that case instead of treating real audio as silence.
          const coarseStep = coarseEnergy > 1e-10 ? ws.analysisStep : 1;
          if (coarseStep === 1) coarseEnergy = energy;
          const score = (base, step, referenceEnergy) => {
            let dot = 0,
              den = 0;
            for (let j = 0; j < overlap; j += step) {
              const value = a[base - min + j];
              dot += ref[j] * value;
              den += value * value;
            }
            return den < 1e-10
              ? -2
              : dot / Math.sqrt(den * referenceEnergy) -
                  0.025 * ((base - nominal) / seek) ** 2;
          };
          const candidates = [];
          for (let pos = min; pos <= max; pos += ws.searchStride)
            candidates.push({
              pos,
              score: score(pos, coarseStep, coarseEnergy),
            });
          if ((max - min) % ws.searchStride)
            candidates.push({
              pos: max,
              score: score(max, coarseStep, coarseEnergy),
            });
          candidates.sort(
            (a, b) =>
              b.score - a.score ||
              Math.abs(a.pos - nominal) - Math.abs(b.pos - nominal) ||
              a.pos - b.pos,
          );
          // Keep separate neighbourhoods, not several adjacent points belonging
          // to a single peak. Include the nominal position as a safe baseline.
          const seeds = [];
          for (const candidate of candidates) {
            if (
              seeds.every(
                (pos) => Math.abs(pos - candidate.pos) > ws.searchStride * 2,
              )
            )
              seeds.push(candidate.pos);
            if (seeds.length === 6) break;
          }
          seeds.push(nominal);
          let fine = score(nominal, 1, energy),
            fineBest = nominal;
          const seen = new Set([nominal]);
          for (const seed of seeds)
            for (
              let pos = Math.max(min, seed - ws.searchStride);
              pos <= Math.min(max, seed + ws.searchStride);
              pos++
            ) {
              if (seen.has(pos)) continue;
              seen.add(pos);
              const q = score(pos, 1, energy);
              if (
                q > fine ||
                (q === fine &&
                  Math.abs(pos - nominal) < Math.abs(fineBest - nominal))
              ) {
                fine = q;
                fineBest = pos;
              }
            }
          best = fine > 0.05 ? fineBest : nominal;
        }
      }
      alignment?.add(done, best, overlap);
      const b = best - min,
        fadeN = Math.min(overlap, target - done);
      for (let c = 0; c < ch; c++)
        for (let j = 0; j < fadeN; j++) {
          const t = (j + 0.5) / overlap;
          fade[c][j] = prev[c][j] * (1 - t) + segment[c][b + j] * t;
        }
      await emit(fade, 0, fadeN);
      done += fadeN;
      const n = Math.min(hop - overlap, target - done);
      if (n > 0) {
        await emit(segment, b + overlap, n);
        done += n;
      }
      for (let c = 0; c < ch; c++) {
        prev[c].fill(0);
        const n = Math.max(0, Math.min(overlap, src.length - best - hop));
        prev[c].set(segment[c].subarray(b + hop, b + hop + n));
      }
      if ((k & 63) === 0) {
        progress(phase, done / target);
        await pause();
        check();
      }
    }
  }
  if (used) await write(output, written, used);
  progress(phase, 1);
  return target;
}

function biquad(sr, f, q, gain) {
  const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr,
    c = Math.cos(w),
    s = Math.sin(w),
    alpha = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (gain !== undefined) {
    const A = 10 ** (gain / 40),
      v = 2 * Math.sqrt(A) * alpha;
    b0 = A * (A + 1 + (A - 1) * c + v);
    b1 = -2 * A * (A - 1 + (A + 1) * c);
    b2 = A * (A + 1 + (A - 1) * c - v);
    a0 = A + 1 - (A - 1) * c + v;
    a1 = 2 * (A - 1 - (A + 1) * c);
    a2 = A + 1 - (A - 1) * c - v;
  } else {
    b0 = (1 + c) / 2;
    b1 = -(1 + c);
    b2 = b0;
    a0 = 1 + alpha;
    a1 = -2 * c;
    a2 = 1 - alpha;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
class Meter {
  constructor(sr, ch, length) {
    this.block = Math.min(length, Math.round(sr * 0.4));
    this.hop = Math.round(sr * 0.1);
    this.ring = new Float64Array(this.block);
    this.sum = 0;
    this.n = 0;
    this.energies = [];
    this.peak = 0;
    this.wave = new Float32Array(1000);
    this.length = length;
    this.filters = Array.from({ length: ch }, () =>
      [
        biquad(sr, 1681.974450955533, 1 / Math.sqrt(2), 4),
        biquad(sr, 38.13547087602444, 0.5003270373238773),
      ].map((c) => ({ c, x1: 0, x2: 0, y1: 0, y2: 0 })),
    );
  }
  push(a, offset, count) {
    for (let i = 0; i < count; i++) {
      let energy = 0,
        peak = 0;
      for (let c = 0; c < a.length; c++) {
        let v = a[c][i];
        peak = Math.max(peak, Math.abs(v));
        for (const f of this.filters[c]) {
          const b = f.c,
            y =
              b[0] * v + b[1] * f.x1 + b[2] * f.x2 - b[3] * f.y1 - b[4] * f.y2;
          f.x2 = f.x1;
          f.x1 = v;
          f.y2 = f.y1;
          f.y1 = y;
          v = y;
        }
        energy += v * v;
      }
      this.peak = Math.max(this.peak, peak);
      const w = Math.min(999, Math.floor(((offset + i) / this.length) * 1000));
      this.wave[w] = Math.max(this.wave[w], peak);
      const pos = this.n % this.block;
      this.sum += energy - this.ring[pos];
      this.ring[pos] = energy;
      this.n++;
      if (this.n >= this.block && (this.n - this.block) % this.hop === 0)
        this.energies.push(Math.max(0, this.sum / this.block));
    }
  }
  result() {
    const loud = (e) => -0.691 + 10 * Math.log10(e),
      absolute = this.energies.filter((e) => loud(e) > -70);
    if (!absolute.length)
      return { lufs: null, peak: this.peak, wave: this.wave };
    const gate =
        loud(absolute.reduce((a, b) => a + b, 0) / absolute.length) - 10,
      relative = absolute.filter((e) => loud(e) > gate);
    return {
      lufs: loud(relative.reduce((a, b) => a + b, 0) / relative.length),
      peak: this.peak,
      wave: this.wave,
    };
  }
}
function wavHeader(n, sr, ch, bits, format = 1) {
  const size = (n * ch * bits) / 8;
  if (size + 37 > 0xffffffff) throw Error("tooLarge");
  const v = new DataView(new ArrayBuffer(44)),
    str = (p, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i));
    };
  str(0, "RIFF");
  v.setUint32(4, 36 + size + (size % 2), true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, format, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, (sr * ch * bits) / 8, true);
  v.setUint16(32, (ch * bits) / 8, true);
  v.setUint16(34, bits, true);
  str(36, "data");
  v.setUint32(40, size, true);
  return v.buffer;
}
class Encoder {
  constructor(n, sr, ch, bits, gain) {
    this.parts = [wavHeader(n, sr, ch, bits, bits === 32 ? 3 : 1)];
    this.bits = bits;
    this.gain = gain;
    this.ch = ch;
    this.n = n;
    this.seed = 9135787;
  }
  push(a, offset, count) {
    const bytes = new Uint8Array((count * this.ch * this.bits) / 8);
    const view = new DataView(bytes.buffer);
    let at = 0;
    for (let i = 0; i < count; i++)
      for (let c = 0; c < this.ch; c++) {
        const v = clamp(a[c][offset + i] * this.gain, -1, 1);
        if (this.bits === 32) {
          view.setFloat32(at, v, true);
          at += 4;
          continue;
        }
        let q;
        if (this.bits === 24) q = Math.round(v < 0 ? v * 8388608 : v * 8388607);
        else {
          this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
          const r = this.seed / 4294967296;
          this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
          q = clamp(
            // TPDF: two independent uniforms, ±1 LSB (2 LSB peak-to-peak).
            Math.round(v * 32768 + r - this.seed / 4294967296),
            -32768,
            32767,
          );
        }
        bytes[at++] = q & 255;
        bytes[at++] = (q >> 8) & 255;
        if (this.bits === 24) bytes[at++] = (q >> 16) & 255;
      }
    this.parts.push(bytes);
  }
  finish() {
    if (((this.n * this.ch * this.bits) / 8) % 2)
      this.parts.push(new Uint8Array(1));
    const blob = new Blob(this.parts, { type: "audio/wav" });
    this.parts = [];
    return blob;
  }
}
function validate(c) {
  if (
    !Number.isFinite(c.ratio) ||
    c.ratio < 0.7 - 1e-10 ||
    c.ratio > 1.3 + 1e-10
  )
    throw Error("invalid");
  const w = c.ws;
  for (const [k, a, b] of [
    ["sequenceMs", 16, 120],
    ["seekMs", 2, 50],
    ["overlapMs", 2, 30],
  ])
    if (!Number.isInteger(w[k]) || w[k] < a || w[k] > b) throw Error("invalid");
  if (
    w.overlapMs * 2 >= w.sequenceMs ||
    ![1, 2, 4, 8, 16].includes(w.searchStride) ||
    ![1, 2, 4, 8, 16].includes(w.analysisStep)
  )
    throw Error("invalid");
  if (Math.round(source.length / c.ratio) > source.sampleRate * 72 * 60)
    throw Error("durationLimit");
  if (
    Math.round(source.length / c.ratio) * source.channels * 4 >
    1.75 * 1024 ** 3
  )
    throw Error("memoryLimit");
}
async function prepare(c) {
  validate(c);
  const key = processingKey(c);
  if (cached?.key === key) return cached;
  const nextTone = JSON.stringify(c.eq || {});
  if (!tone || toneKey !== nextTone) {
    const candidate = new ToneSource(source, c.eq);
    const analysis = await analyze(candidate);
    candidate.curve = levelCurve(analysis.env);
    tone = candidate;
    toneKey = nextTone;
  }
  working = tone;
  working.setGain(c.level ? tone.curve : null);
  const meter = new Meter(
    source.sampleRate,
    source.channels,
    Math.round(source.length / c.ratio),
  );
  await stretch(working, c.ratio, c.ws, async (a, p, n) => meter.push(a, p, n));
  check();
  cached = { key, ...masteringStats(meter.result()) };
  return cached;
}
function masteringStats(result) {
  const wanted = result.lufs === null ? 0 : -14 - result.lufs,
    peakGain = result.peak > 0 ? -1 - db(result.peak) : 0,
    gainDb =
      result.lufs === null ? Math.min(0, peakGain) : Math.min(wanted, peakGain);
  return {
    ...result,
    gainDb,
    finalLufs: result.lufs === null ? null : result.lufs + gainDb,
    finalPeak: result.peak * amp(gainDb),
    limited: gainDb < wanted - 0.01,
  };
}

// A hard-bounded view prevents a late preview from walking through the file's
// earlier audio, including when EQ needs fresh filter-state checkpoints.
class AudioWindow {
  constructor(raw, start, length) {
    Object.assign(this, {
      raw,
      start,
      length,
      sampleRate: raw.sampleRate,
      channels: raw.channels,
    });
  }
  async read(start, count) {
    const n = Math.max(0, Math.min(count, this.length - start));
    const input = n ? await this.raw.read(this.start + start, n) : [];
    if (n === count) return input;
    return Array.from({ length: this.channels }, (_, c) => {
      const a = new Float32Array(count);
      if (n) a.set(input[c]);
      return a;
    });
  }
}
async function encodeExcerpt(src, start, length, report) {
  const writer = new Encoder(length, src.sampleRate, src.channels, 32, 1);
  for (let p = 0; p < length; p += 16384) {
    const n = Math.min(16384, length - p);
    writer.push(await src.read(start + p, n), 0, n);
    if (p % 131072 === 0) {
      report(p / length);
      await pause();
      check();
    }
  }
  return writer.finish();
}
function blobSource(blob, sr, ch) {
  return new AudioSource(
    {
      sampleRate: sr,
      channels: ch,
      length: (blob.size - 44) / (ch * 4),
      bits: 32,
      format: 3,
      offset: 44,
      align: ch * 4,
    },
    blob,
    null,
  );
}
async function localClip(c, start, length, report = progress) {
  const sr = source.sampleRate,
    ch = source.channels;
  const begin = Math.max(0, start - sr * 12),
    end = Math.min(source.length, start + length + sr * 12);
  const local = new ToneSource(
    new AudioWindow(source, begin, end - begin),
    c.eq,
  );
  if (c.level) {
    if (local.coefficients.length) {
      const analysis = await analyze(local, (v) =>
        report("preview", 0.15 + v * 0.3),
      );
      local.setGain(levelCurve(analysis.env));
    } else {
      local.gainOffset = begin;
      local.setGain(curve);
    }
  }
  const clipBegin = Math.round((start - begin) / c.ratio),
    frames = Math.round(length / c.ratio),
    clipEnd = clipBegin + frames;
  const pcm = Array.from({ length: ch }, () => new Float32Array(frames)),
    meter = new Meter(sr, ch, frames);
  const alignment = new StretchAlignment(),
    stop = {};
  try {
    await stretch(
      local,
      c.ratio,
      c.ws,
      async (a, p, n) => {
        const s = Math.max(p, clipBegin),
          e = Math.min(p + n, clipEnd);
        if (e > s) {
          const part = a.map((channel, index) => {
            const slice = channel.subarray(s - p, e - p);
            pcm[index].set(slice, s - clipBegin);
            return slice;
          });
          meter.push(part, s - clipBegin, e - s);
        }
        report("preview", 0.45 + 0.45 * Math.min(1, (p + n) / clipEnd));
        if (p + n >= clipEnd) throw stop;
      },
      null,
      alignment,
    );
  } catch (e) {
    if (e !== stop) throw e;
  }
  check();
  return {
    local,
    pcm,
    stats: masteringStats(meter.result()),
    alignment,
    begin,
    clipBegin,
    frames,
    start,
    length,
    key: processingKey(c),
  };
}
async function preview(c, seconds) {
  validate(c);
  const sr = source.sampleRate,
    ch = source.channels;
  const start = clamp(
      Math.round((Number(seconds) || 0) * sr),
      0,
      source.length - 1,
    ),
    length = Math.min(source.length - start, sr * 30);
  source.setGain(null);
  previewAnalysis = null;
  const original = await encodeExcerpt(source, start, length, (v) =>
    progress("preview", v * 0.15),
  );
  let processed, reference;
  if (rendered?.key === processingKey(c)) {
    const begin = Math.round(start / c.ratio),
      end = Math.min(rendered.length, Math.round((start + length) / c.ratio));
    processed = await encodeExcerpt(rendered, begin, end - begin, (v) =>
      progress("preview", 0.15 + v * 0.75),
    );
    reference = "rendered";
  } else {
    const clip = await localClip(c, start, length);
    const writer = new Encoder(clip.frames, sr, ch, 32, amp(clip.stats.gainDb));
    for (let p = 0; p < clip.frames; p += 16384) {
      writer.push(clip.pcm, p, Math.min(16384, clip.frames - p));
      if (p % 131072 === 0) {
        await pause();
        check();
      }
    }
    processed = writer.finish();
    // Keep only the bounded excerpt and its pre-WSOLA source/checkpoints.
    previewAnalysis = {
      ...clip,
      pcm: null,
      after: blobSource(processed, sr, ch),
    };
    reference = "estimate";
  }
  progress("spectrum", 0);
  const spectrum = await compareAverage(
    blobSource(original, sr, ch),
    blobSource(processed, sr, ch),
  );
  check();
  postMessage({
    type: "previewed",
    a: original,
    b: processed,
    reference,
    spectrum,
    start: start / sr,
    duration: length / sr,
  });
}
// MP3 supports rates through 48 kHz. Other rates use a bounded, windowed-sinc
// reader; the retained WAV/master remains at the original sample rate.
function mp3Source(src) {
  const supported = [
    8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000,
  ];
  if (supported.includes(src.sampleRate))
    return {
      sampleRate: src.sampleRate,
      channels: src.channels,
      length: src.length,
      read: async (p, n) =>
        (await src.read(p, n)).map((a) => new Float32Array(a)),
    };
  const sampleRate = 48000,
    scale = src.sampleRate / sampleRate,
    cutoff = Math.min(1, 1 / scale) * 0.94,
    radius = Math.ceil(32 / cutoff);
  return {
    sampleRate,
    channels: src.channels,
    length: Math.round(src.length / scale),
    read: async (p, n) => {
      const start = Math.max(0, Math.floor(p * scale) - radius),
        end = Math.min(src.length, Math.ceil((p + n) * scale) + radius),
        a = await src.read(start, end - start),
        out = Array.from({ length: src.channels }, () => new Float32Array(n));
      for (let i = 0; i < n; i++) {
        const x = (p + i) * scale,
          center = Math.floor(x);
        let norm = 0;
        for (let k = center - radius + 1; k <= center + radius; k++) {
          const d = k - x,
            z = Math.PI * d * cutoff,
            weight =
              (Math.abs(z) < 1e-12 ? 1 : Math.sin(z) / z) *
              (0.5 + 0.5 * Math.cos((Math.PI * d) / radius));
          norm += weight;
          if (k >= 0 && k < src.length)
            for (let c = 0; c < src.channels; c++)
              out[c][i] += a[c][k - start] * weight;
        }
        for (const channel of out) channel[i] /= norm;
      }
      check();
      return out;
    },
  };
}
async function run(message) {
  const { type, config: c } = message;
  cancelled = false;
  try {
    if (type === "load") {
      source = new AudioSource(message.meta, message.file, message.pcm);
      cached = null;
      curve = null;
      tone = working = rendered = previewAnalysis = formantSearchState = null;
      const result = await analyze(source);
      check();
      curve = levelCurve(result.env);
      postMessage({ type: "loaded", wave: result.wave });
      return;
    }
    if (!source || !curve) throw Error("notLoaded");
    if (type === "release") {
      rendered = previewAnalysis = formantSearchState = null;
      return;
    }
    if (type === "export") {
      if (!rendered) throw Error("notRendered");
      if (c.bits === "mp3") {
        mp3Abort = new AbortController();
        try {
          const blob = await BrowserMp3.encodePcmSource(mp3Source(rendered), {
            mode: "vbr",
            vbrQuality: 3,
            signal: mp3Abort.signal,
            onProgress: (v) => progress("mp3", v),
          });
          check();
          postMessage({ type: "exported", blob });
        } catch (e) {
          if (cancelled || e.code === "ABORTED") throw Error("cancelled");
          throw e;
        } finally {
          mp3Abort = null;
        }
        return;
      }
      if (![16, 24].includes(c.bits)) throw Error("invalid");
      const r = rendered,
        encoder = new Encoder(r.length, r.sampleRate, r.channels, c.bits, 1);
      for (let p = 0; p < r.length; p += 65536) {
        const n = Math.min(65536, r.length - p);
        encoder.push(await r.read(p, n), 0, n);
        if (p % 262144 === 0) {
          progress("export", p / r.length);
          await pause();
          check();
        }
      }
      check();
      postMessage({ type: "exported", blob: encoder.finish() });
      return;
    }
    if (type === "preview") {
      await preview(c, message.start);
      return;
    }
    if (type === "formantCandidate") {
      await nextFormantCandidate(c);
      return;
    }
    if (type === "formant") {
      await formantAnalysis(c, message.start);
      return;
    }
    const stats = await prepare(c);
    const frames = Math.round(source.length / c.ratio),
      gain = amp(stats.gainDb);
    if (type === "render") {
      rendered = null;
      const alignment = new StretchAlignment();
      const encoder = new Encoder(
        frames,
        source.sampleRate,
        source.channels,
        32,
        gain,
      );
      await stretch(
        working,
        c.ratio,
        c.ws,
        async (a, p, n) => {
          check();
          encoder.push(a, 0, n);
        },
        "render",
        alignment,
      );
      check();
      const blob = encoder.finish(),
        meta = {
          length: frames,
          sampleRate: source.sampleRate,
          channels: source.channels,
          bits: 32,
          format: 3,
          offset: 44,
          align: source.channels * 4,
        };
      rendered = new AudioSource(meta, blob, null);
      rendered.key = processingKey(c);
      rendered.alignment = alignment;
      postMessage({ type: "rendered", blob, meta, stats });
    }
  } catch (e) {
    postMessage({ type: "error", message: e.message || String(e) });
  }
}
let running = false;
self.onmessage = async ({ data }) => {
  if (data.type === "cancel") {
    cancelled = true;
    mp3Abort?.abort();
    return;
  }
  if (running) return;
  running = true;
  try {
    await run(data);
  } finally {
    running = false;
  }
};
