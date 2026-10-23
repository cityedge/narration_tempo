/* Copyright (c) 2026 cityedge. MIT. Bounded formant inspection and its A/B audition. */
async function formantContext(c, start, end) {
  const sr = source.sampleRate,
    key = processingKey(c);
  if (rendered?.key === key)
    return {
      before: working,
      after: rendered,
      alignment: rendered.alignment,
      inputOffset: 0,
      outputOffset: 0,
      availableStart: 0,
      availableEnd: source.length,
      reference: "formantFull",
    };
  let clip = previewAnalysis;
  const reuse =
    clip?.key === key && start >= clip.start && end <= clip.start + clip.length;
  if (!reuse) {
    const begin = Math.max(0, start - sr),
      limit = Math.min(source.length, end + sr);
    clip = await localClip(c, begin, limit - begin, (_, v) =>
      progress("formant", v * 0.45),
    );
    clip.after = new AudioSource(
      { sampleRate: sr, channels: source.channels, length: clip.frames },
      null,
      clip.pcm,
    );
  }
  return {
    before: clip.local,
    after: clip.after,
    alignment: clip.alignment,
    inputOffset: clip.begin,
    outputOffset: clip.clipBegin,
    availableStart: clip.start,
    availableEnd: clip.start + clip.length,
    reference: reuse ? "formantPreview" : "formantLocal",
  };
}
function formantMatch(context, inputFrame, ratio, width) {
  const { before, after, alignment, inputOffset, outputOffset } = context;
  const half = Math.floor(width / 2),
    localInput = inputFrame - inputOffset;
  const expected = localInput / ratio,
    margin = before.sampleRate * 0.3;
  const lo = Math.max(outputOffset + half, Math.floor(expected - margin));
  const hi = Math.min(
    outputOffset + after.length - (width - half),
    Math.ceil(expected + margin),
  );
  if (hi < lo) return null;
  const out = alignment.outputFor(localInput, lo, hi, ratio);
  const input = Math.round(alignment.sourceAt(out));
  if (input < half || input + width - half > before.length) return null;
  return {
    input,
    output: out - outputOffset,
    sourceFrame: input + inputOffset,
  };
}
async function inspectFormantCandidate(
  context,
  center,
  c,
  frequencies,
  threshold,
  range,
) {
  const sr = source.sampleRate,
    width = Math.round(sr * 0.05),
    half = Math.floor(width / 2),
    frames = [];
  for (const offset of [-0.04, 0, 0.04]) {
    const m = formantMatch(
      context,
      Math.round(center + offset * sr),
      c.ratio,
      width,
    );
    if (
      !m ||
      m.sourceFrame - half < range.start ||
      m.sourceFrame + width - half > range.end
    )
      return null;
    const original = await context.before.read(m.input - half, width),
      quality = voicedFrame(original, sr);
    if (quality.rms < threshold || quality.periodicity < 0.55) return null;
    const a = envelopeCurve(original, sr, frequencies);
    const b = envelopeCurve(
      await context.after.read(m.output - half, width),
      sr,
      frequencies,
    );
    if (b.rms < 1e-5) return null;
    frames.push({
      ...m,
      before: a.values,
      after: b.values,
      rms: quality.rms,
      score: envelopeDistance(a.values, b.values, frequencies),
    });
  }
  // Reject changing phonemes / energy bursts before looking at the output score.
  if (
    Math.max(...frames.map((f) => f.rms)) >
    Math.min(...frames.map((f) => f.rms)) * 2
  )
    return null;
  if (
    frames.some(
      (f) => envelopeDistance(frames[1].before, f.before, frequencies) > 3,
    )
  )
    return null;
  // The median avoids elevating a single bad window; display that actual window.
  return [...frames].sort((a, b) => a.score - b.score)[1];
}
async function formantAudition(state, candidate) {
  const { context, ratio } = state,
    sr = source.sampleRate,
    ch = source.channels;
  const left = Math.floor(
    Math.min(
      sr * 0.8,
      candidate.sourceFrame - context.availableStart,
      candidate.output * ratio,
    ),
  );
  const right = Math.floor(
    Math.min(
      sr * 0.8,
      context.availableEnd - candidate.sourceFrame,
      (context.after.length - candidate.output) * ratio,
    ),
  );
  const startA = candidate.input - left,
    startB = candidate.output - Math.round(left / ratio);
  const nA = left + right,
    nB = Math.min(context.after.length - startB, Math.round(nA / ratio));
  const pcmA = await context.before.read(startA, nA),
    pcmB = await context.after.read(startB, nB);
  const stats = (pcm) => {
    let sum = 0,
      peak = 0;
    for (const channel of pcm)
      for (const x of channel) {
        sum += x * x;
        peak = Math.max(peak, Math.abs(x));
      }
    return {
      rms: Math.sqrt(sum / Math.max(1, pcm.length * pcm[0].length)),
      peak,
    };
  };
  const a = stats(pcmA),
    b = stats(pcmB);
  let gainA = 0.1 / Math.max(1e-9, a.rms),
    gainB = 0.1 / Math.max(1e-9, b.rms);
  const headroom = Math.min(
    1,
    amp(-1) / Math.max(a.peak * gainA, b.peak * gainB, 1e-9),
  );
  gainA *= headroom;
  gainB *= headroom;
  const encode = async (pcm, gain) => {
    const writer = new Encoder(pcm[0].length, sr, ch, 32, gain);
    for (let p = 0; p < pcm[0].length; p += 16384) {
      writer.push(pcm, p, Math.min(16384, pcm[0].length - p));
      if (p % 131072 === 0) {
        await pause();
        check();
      }
    }
    return writer.finish();
  };
  return {
    a: await encode(pcmA, gainA),
    b: await encode(pcmB, gainB),
    durationA: nA / sr,
    durationB: nB / sr,
    centerA: left / sr,
    centerB: (candidate.output - startB) / sr,
    gainA,
    gainB,
    windowMs: 50,
  };
}
async function sendFormantCandidate(state, index) {
  const candidate = state.candidates[index],
    sr = source.sampleRate;
  const audio = await formantAudition(state, candidate);
  check();
  const data = displayPair(
    state.frequencies,
    candidate.before,
    candidate.after,
    {
      reference: state.context.reference,
      sourceTime: candidate.sourceFrame / sr,
      outputTime:
        (candidate.output +
          state.context.outputOffset +
          Math.round(state.context.inputOffset / state.ratio)) /
        sr,
      searchStart: state.start / sr,
      searchEnd: state.end / sr,
      requestedTime: state.start / sr,
      candidateIndex: index,
      candidateCount: state.candidates.length,
      evaluatedCount: state.evaluatedCount,
      nextStart: state.end < source.length ? state.end / sr : null,
      windowMs: 50,
      bypass: Math.abs(state.ratio - 1) < 1e-8,
    },
  );
  formantSearchState = state;
  state.index = index;
  postMessage({ type: "formantAnalyzed", data, audio });
}
async function formantAnalysis(c, seconds) {
  validate(c);
  formantSearchState = null;
  const sr = source.sampleRate,
    start = clamp(Math.round((Number(seconds) || 0) * sr), 0, source.length);
  const end = Math.min(source.length, start + sr * 10),
    width = Math.round(sr * 0.05);
  const unavailable = (reason) =>
    postMessage({
      type: "formantAnalyzed",
      data: {
        unavailable: reason,
        searchStart: start / sr,
        searchEnd: end / sr,
        candidateCount: 0,
        nextStart: end < source.length ? end / sr : null,
      },
    });
  if (end - start < sr * 0.18) {
    unavailable(start === source.length ? "analysisEnd" : "analysisShort");
    return;
  }
  const context = await formantContext(c, start, end);
  const seeds = [],
    half = Math.floor(width / 2),
    margin = Math.ceil(sr * 0.09);
  const hop = Math.round(sr * 0.1);
  // A cheap periodicity/energy pass finds speech-like candidates across the range.
  for (let center = start + margin; center <= end - margin; center += hop) {
    const q = voicedFrame(
      await context.before.read(center - context.inputOffset - half, width),
      sr,
    );
    seeds.push({ center, ...q });
    if (seeds.length % 8 === 0) {
      progress("formant", 0.45 + (0.15 * (center - start)) / (end - start));
      await pause();
      check();
    }
  }
  const peak = Math.max(0, ...seeds.map((s) => s.rms)),
    threshold = Math.max(1e-5, peak * 0.03);
  const voiced = seeds.filter(
    (s) => s.rms >= threshold && s.periodicity >= 0.55,
  );
  if (!voiced.length) {
    unavailable(peak < 1e-5 ? "analysisSilent" : "analysisNoVoiced");
    return;
  }
  // Spread the bounded expensive checks across the entire voiced subset.
  const count = Math.min(32, voiced.length),
    frequencies = logFrequencies(Math.min(6000, sr * 0.48)),
    candidates = [];
  for (let i = 0; i < count; i++) {
    const seed =
      voiced[
        count === 1 ? 0 : Math.round((i * (voiced.length - 1)) / (count - 1))
      ];
    const candidate = await inspectFormantCandidate(
      context,
      seed.center,
      c,
      frequencies,
      threshold,
      { start, end },
    );
    if (candidate) candidates.push(candidate);
    progress("formant", 0.6 + (0.35 * (i + 1)) / count);
    await pause();
    check();
  }
  const ranked = chooseFormantCandidates(candidates, sr);
  if (!ranked.length) {
    unavailable("analysisNoVoiced");
    return;
  }
  const state = {
    key: processingKey(c),
    context,
    ratio: c.ratio,
    frequencies,
    candidates: ranked,
    start,
    end,
    evaluatedCount: count,
  };
  await sendFormantCandidate(state, 0);
}
async function nextFormantCandidate(c) {
  if (!formantSearchState || formantSearchState.key !== processingKey(c))
    throw Error("formantExpired");
  const state = formantSearchState;
  await sendFormantCandidate(
    state,
    (state.index + 1) % state.candidates.length,
  );
}
