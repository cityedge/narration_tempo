/* Copyright (c) 2026 cityedge. MIT. Display-only audio analysis; no dependencies. */
"use strict";

// Compact, exact grain anchors. Crossfades mix two source positions; lookup uses
// the dominant contributor. This is an alignment aid, not a one-to-one time warp.
class StretchAlignment {
  constructor() {
    this.chunks = [];
    this.length = 0;
  }
  add(output, input, fade) {
    const slot = this.length % 4096;
    if (!slot) this.chunks.push(new Uint32Array(4096 * 3));
    this.chunks[this.chunks.length - 1].set([output, input, fade], slot * 3);
    this.length++;
  }
  at(i) {
    return this.chunks[Math.floor(i / 4096)].subarray(
      (i % 4096) * 3,
      (i % 4096) * 3 + 3,
    );
  }
  sourceAt(output) {
    let lo = 0,
      hi = this.length - 1;
    while (lo < hi) {
      const m = Math.ceil((lo + hi) / 2);
      if (this.at(m)[0] <= output) lo = m;
      else hi = m - 1;
    }
    let a = this.at(lo);
    if (lo && output - a[0] < a[2] / 2) a = this.at(lo - 1);
    return a[1] + output - a[0];
  }
  outputFor(input, lower, upper, ratio) {
    let best = lower,
      score = Infinity;
    let begin = 0,
      end = this.length - 1;
    while (begin < end) {
      const mid = Math.ceil((begin + end) / 2);
      if (this.at(mid)[0] <= lower) begin = mid;
      else end = mid - 1;
    }
    for (let i = begin; i < this.length && this.at(i)[0] <= upper; i++) {
      const a = this.at(i),
        left = Math.max(lower, a[0] + a[2]);
      const right = Math.min(
        upper,
        i + 1 < this.length ? this.at(i + 1)[0] - 1 : upper,
      );
      if (right < left) continue;
      const p = Math.max(left, Math.min(right, a[0] + input - a[1]));
      const d =
        Math.abs(a[1] + p - a[0] - input) + Math.abs(p - input / ratio) * 1e-4;
      if (d < score) {
        best = p;
        score = d;
      }
    }
    return Math.round(best);
  }
}

function spectrumFFT(real, imag, inverse = false) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size,
      wr = Math.cos(angle),
      wi = Math.sin(angle);
    for (let p = 0; p < n; p += size) {
      let r = 1,
        im = 0;
      for (let j = 0; j < size / 2; j++) {
        const a = p + j,
          b = a + size / 2;
        const tr = real[b] * r - imag[b] * im,
          ti = real[b] * im + imag[b] * r;
        real[b] = real[a] - tr;
        imag[b] = imag[a] - ti;
        real[a] += tr;
        imag[a] += ti;
        const next = r * wr - im * wi;
        im = r * wi + im * wr;
        r = next;
      }
    }
  }
  if (inverse)
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
}
function framePower(channels, size) {
  const power = new Float64Array(size / 2 + 1);
  let energy = 0;
  const length = channels[0].length;
  for (const a of channels) {
    const re = new Float64Array(size),
      im = new Float64Array(size);
    const mean = a.reduce((s, v) => s + v, 0) / Math.max(1, length);
    let norm = 0;
    for (let i = 0; i < length; i++) {
      const w =
        length < 2 ? 1 : 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
      re[i] = (a[i] - mean) * w;
      norm += w * w;
      energy += (a[i] - mean) ** 2;
    }
    spectrumFFT(re, im);
    for (let k = 0; k < power.length; k++)
      power[k] +=
        (re[k] ** 2 + im[k] ** 2) /
        (Math.max(1, norm) * size * channels.length);
  }
  return {
    power,
    rms: Math.sqrt(energy / Math.max(1, length * channels.length)),
  };
}
function logFrequencies(max, count = 256) {
  return Float64Array.from(
    { length: count },
    (_, i) => 40 * (max / 40) ** (i / (count - 1)),
  );
}
function spectrumCurve(power, sr, size, frequencies) {
  const total = power.reduce((s, x) => s + x, 0) || 1;
  return Float64Array.from(frequencies, (f) => {
    const bin = (f * size) / sr,
      width = Math.max(0.75, bin * 0.029);
    const left = Math.max(1, Math.floor(bin - width)),
      right = Math.min(power.length - 1, Math.ceil(bin + width));
    let sum = 0,
      norm = 0;
    for (let k = left; k <= right; k++) {
      const w = Math.max(0, 1 - Math.abs(k - bin) / (width + 1));
      sum += power[k] * w;
      norm += w;
    }
    return (
      10 * Math.log10(Math.max(1e-15, sum / Math.max(1e-12, norm) / total))
    );
  });
}
function displayPair(frequencies, before, after, extra = {}) {
  const top = Math.max(...before, ...after);
  return {
    frequencies,
    before: Float32Array.from(before, (x) => x - top),
    after: Float32Array.from(after, (x) => x - top),
    ...extra,
  };
}
async function averageSpectrum(src) {
  const length = Math.min(src.length, Math.round(src.sampleRate * 0.04));
  const size = 2 ** Math.ceil(Math.log2(Math.max(64, length)));
  const windows = Math.max(
    1,
    Math.min(160, Math.ceil(src.length / Math.max(1, length))),
  );
  const power = new Float64Array(size / 2 + 1);
  let energy = 0;
  for (let i = 0; i < windows; i++) {
    const start =
      windows === 1
        ? 0
        : Math.round((i * (src.length - length)) / (windows - 1));
    const result = framePower(await src.read(start, length), size);
    for (let k = 0; k < power.length; k++)
      power[k] += result.power[k] / windows;
    energy += result.rms ** 2 / windows;
    if (i % 16 === 0) {
      await pause();
      check();
    }
  }
  return { power, size, rms: Math.sqrt(energy), windows };
}
async function compareAverage(before, after) {
  const a = await averageSpectrum(before),
    b = await averageSpectrum(after);
  if (a.rms < 1e-5 || b.rms < 1e-5) return { unavailable: "analysisSilent" };
  const frequencies = logFrequencies(Math.min(20000, before.sampleRate / 2));
  return displayPair(
    frequencies,
    spectrumCurve(a.power, before.sampleRate, a.size, frequencies),
    spectrumCurve(b.power, after.sampleRate, b.size, frequencies),
    { windows: [a.windows, b.windows] },
  );
}

// Low-quefrency cepstral smoothing estimates the broad spectral envelope.
// No LPC pole tracking / F1-F3 detection or quality score is claimed.
function envelopeCurve(channels, sr, frequencies) {
  const size = 2 ** Math.ceil(Math.log2(Math.max(64, channels[0].length)));
  const { power, rms } = framePower(channels, size);
  const total = power.reduce((s, p) => s + p, 0) || 1;
  const re = new Float64Array(size),
    im = new Float64Array(size);
  for (let k = 0; k < size; k++)
    re[k] =
      0.5 * Math.log(Math.max(1e-12, power[Math.min(k, size - k)] / total));
  spectrumFFT(re, im, true);
  const cutoff = sr * 0.0025;
  for (let k = 0; k < size; k++) {
    const q = Math.min(k, size - k),
      w = q < cutoff ? 0.5 + 0.5 * Math.cos((Math.PI * q) / cutoff) : 0;
    re[k] *= w;
    im[k] *= w;
  }
  spectrumFFT(re, im);
  const values = Float64Array.from(frequencies, (f) => {
    const k = (f * size) / sr,
      lo = Math.floor(k),
      t = k - lo;
    return (
      (20 / Math.LN10) * (re[lo] * (1 - t) + re[Math.min(size / 2, lo + 1)] * t)
    );
  });
  return { values, rms };
}

// Copyright (c) 2026 cityedge. MIT. Heuristics for finding inspectable voiced regions.
// This is not speech recognition, formant tracking, or an audio-quality score.
function voicedFrame(channels, sr) {
  // Pick the strongest channel so inverse stereo cannot cancel the gate.
  let selected = channels[0],
    strongest = -1;
  for (const channel of channels) {
    let energy = 0;
    for (const v of channel) energy += v * v;
    if (energy > strongest) {
      strongest = energy;
      selected = channel;
    }
  }
  // Box-filtered decimation is sufficient for this coarse periodicity gate;
  // displayed spectra and audition audio always use the original sample rate.
  const stride = Math.max(1, Math.floor(sr / 8000));
  const a = new Float64Array(Math.floor(selected.length / stride));
  let mean = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < stride; j++) a[i] += selected[i * stride + j] / stride;
    mean += a[i];
  }
  mean /= Math.max(1, a.length);
  let energy = 0;
  for (let i = 0; i < a.length; i++) {
    a[i] -= mean;
    energy += a[i] * a[i];
  }
  let periodicity = 0;
  if (energy > 1e-12) {
    const rate = sr / stride;
    for (
      let lag = Math.ceil(rate / 500);
      lag <= Math.min(Math.floor(rate / 65), a.length / 2);
      lag++
    ) {
      let dot = 0,
        left = 0,
        right = 0;
      for (let i = lag; i < a.length; i++) {
        dot += a[i] * a[i - lag];
        left += a[i] ** 2;
        right += a[i - lag] ** 2;
      }
      periodicity = Math.max(
        periodicity,
        dot / Math.sqrt(Math.max(1e-30, left * right)),
      );
    }
  }
  return { rms: Math.sqrt(energy / Math.max(1, a.length)), periodicity };
}
function envelopeDistance(before, after, frequencies) {
  // Ignore uninformative low-energy tails and a global log-level offset.
  // A weighted RMS of spectral shape is only a ranking within this search.
  const top = Math.max(...before);
  let sum = 0,
    weight = 0;
  const points = [];
  for (let i = 0; i < before.length; i++) {
    if (frequencies[i] < 150 || frequencies[i] > 5000) continue;
    const w = Math.max(0, 1 + (before[i] - top) / 40);
    if (!w) continue;
    const d = after[i] - before[i];
    points.push([d, w]);
    sum += d * w;
    weight += w;
  }
  if (!weight) return 0;
  const offset = sum / weight;
  return Math.sqrt(
    points.reduce(
      (total, [d, w]) => total + w * Math.min(24, Math.abs(d - offset)) ** 2,
      0,
    ) / weight,
  );
}
function chooseFormantCandidates(candidates, sr) {
  const sorted = [...candidates].sort(
    (a, b) => b.score - a.score || a.sourceFrame - b.sourceFrame,
  );
  const selected = [];
  for (const candidate of sorted)
    if (
      selected.every(
        (other) =>
          Math.abs(other.sourceFrame - candidate.sourceFrame) >= sr * 0.25,
      )
    )
      selected.push(candidate);
  return selected;
}
