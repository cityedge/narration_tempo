"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    wsDefaults = {
      sequenceMs: 40,
      seekMs: 15,
      overlapMs: 8,
      searchStride: 8,
      analysisStep: 8,
    };
  const text = {
    ja: {
      tagline: "音量を整え、話す速さを調整",
      choose: "音声ファイルを選択",
      fileHelp: "WAV / MP3 · 入出力は最大72分 · ドロップにも対応",
      whole: "音声全体",
      source: "原音",
      result: "処理後",
      waveHelp: "クリック／ドラッグでシーク · 左右キーで5秒移動",
      common: "共通",
      increase: "増加",
      decrease: "減少",
      play: "▶ 再生",
      pause: "Ⅱ 一時停止",
      stop: "■ 停止",
      seek: "再生位置",
      eqLow: "低音を整理",
      eqMud: "こもりを低減",
      eqClear: "明瞭さを追加",
      render: "全体変換",
      renderHelp: "変換後は上のパネルで自由に試聴できます。",
      rendered: "全体変換が完了しました。処理後の音を試聴して保存できます。",
      rendering: "全体変換の結果を保持しています…",
      mp3: "MP3にエンコード中…",
      notRendered: "全体変換を行ってください。",
      wav16Help: "16bitへの量子化時にTPDFディザを適用します。",
      wav24Help: "24bit PCM · 入力のサンプルレートを維持します。",
      mp3Help:
        "VBR Q3 · 必要時48 kHzに変換。先頭・末尾に短い余白が加わる場合があります。",
      playbackError: "この形式をブラウザで再生できません。",
      settings: "速度と音量",
      level: "レベラー（音量を自動で整える）",
      speed: "速度（話す速さ）",
      slow: "0.700（遅く）",
      fast: "1.300（速く）",
      target: "仕上がり時間",
      min: "分",
      sec: "秒",
      apply: "適用",
      before: "元の長さ",
      after: "仕上がり",
      advanced: "WSOLA詳細設定",
      stride: "探索間隔",
      step: "比較の間引き",
      reset: "標準に戻す",
      wsHelp:
        "OverlapはSequenceの半分未満。細かい探索は処理時間が長くなります。",
      listenSave: "試聴と保存",
      start: "試聴開始位置",
      preview: "30秒プレビュー",
      shortPreview: "30秒プレビュー（部分試聴）",
      previewHelp:
        "選択位置から原音30秒分を試聴します。作成後はこの欄のBで再生できます。",
      previewEstimate:
        "区間だけを変換しました。音量は区間からの推定です。全体の処理後再生には「全体変換」が必要です。",
      previewExact:
        "全体変換済みの音声から切り出しました。この欄のA/Bで比較できます。",
      a: "A 原音",
      b: "B 処理後",
      format: "出力形式",
      export: "保存",
      loudHelp: "−14 LUFSを目安に調整 · ピーク上限 −1 dBFS",
      download: "再ダウンロード",
      cancel: "中止",
      footer:
        "ローカル処理 · 音声は送信されません。差分波形は発話位置を合わせた振幅比較です。保存先はブラウザの設定に従います。",
      idle: "音声ファイルを選択してください。",
      loading: "音声を読み込み中…",
      analyze: "音量の変化を解析中…",
      measure: "速度変換後の全体ラウドネスを解析中…",
      exporting: "WAVを書き出し中…",
      previewing: "選択した試聴区間を作成中…",
      ready: "原音を再生できます。設定を調整して全体変換してください。",
      previewed:
        "30秒プレビューを作成しました。プレビュー欄のBで処理後を聴けます。",
      exported: "保存用ファイルを作成し、ダウンロードを開始しました。",
      cancelled: "処理を中止しました。",
      invalid:
        "速度・時間・WSOLAの入力値を確認してください。OverlapはSequenceの半分未満です。",
      durationLimit:
        "仕上がり時間が72分を超えます。速度を上げるか、短い音源を選んでください。",
      inputLimit:
        "入力は72分まで、8〜192 kHzのモノラル／ステレオに対応しています。",
      formatError:
        "このWAV形式は未対応です。PCM（8/16/24/32bit）またはfloat（32/64bit）のWAVを使用してください。",
      truncated: "WAVのデータが不足しています。",
      tooLarge: "出力サイズがWAVの上限を超えています。",
      memoryLimit:
        "保持する音声は1.75 GiBまでです。仕上がり時間を短くするか、低いサンプルレートの音源を選んでください。",
      notLoaded: "音声を読み込んでください。",
      mp3Memory:
        "MP3のPCM展開が512 MiBを超えます。長尺はWAV形式で入力してください。",
      unsupported: "WAVまたはMP3を選択してください。",
      error: "処理できませんでした。",
      limited: "ピーク上限により調整",
      silent: "測定対象の音声がありません",
      stale: "設定を変更しました。保存するには全体変換をやり直してください。",
      durationApplied:
        "仕上がり時間を適用しました。表示倍率より細かい精度で処理します。",
    },
    en: {
      tagline: "Even out the level. Set the pace.",
      choose: "Choose an audio file",
      fileHelp: "WAV / MP3 · Up to 72 min in / out · Or drop a file",
      whole: "Full recording",
      source: "Original",
      result: "Processed",
      waveHelp: "Click / drag to seek · Arrow keys: ±5 seconds",
      common: "Common",
      increase: "Increase",
      decrease: "Decrease",
      play: "▶ Play",
      pause: "Ⅱ Pause",
      stop: "■ Stop",
      seek: "Playback position",
      eqLow: "Tidy lows",
      eqMud: "Reduce muddiness",
      eqClear: "Add clarity",
      render: "Convert full recording",
      renderHelp: "Listen freely in the panel above after conversion.",
      rendered:
        "Conversion complete. Listen to the processed recording, then save.",
      rendering: "Retaining the converted recording…",
      mp3: "Encoding MP3…",
      notRendered: "Convert the full recording first.",
      wav16Help: "TPDF dither is applied once at 16-bit quantization.",
      wav24Help: "24-bit PCM · Original sample rate preserved.",
      mp3Help:
        "VBR Q3 · Resampled to 48 kHz if needed. Brief encoder padding may be added.",
      playbackError: "The browser cannot play this audio format.",
      settings: "Tempo & level",
      level: "Leveler (automatically even out volume)",
      speed: "Speaking speed",
      slow: "0.700 (slower)",
      fast: "1.300 (faster)",
      target: "Final duration",
      min: "min",
      sec: "sec",
      apply: "Apply",
      before: "Original",
      after: "Final",
      advanced: "Advanced WSOLA settings",
      stride: "Search stride",
      step: "Analysis step",
      reset: "Defaults",
      wsHelp:
        "Overlap must be less than half of Sequence. Finer searches take longer.",
      listenSave: "Listen & save",
      start: "Preview start",
      preview: "30-second preview",
      shortPreview: "30-second preview (excerpt)",
      previewHelp:
        "Preview 30 original seconds from the selected position. Use B in this section to listen after processing.",
      previewEstimate:
        "Only the excerpt was converted; loudness is estimated from it. Use full conversion for processed playback above.",
      previewExact:
        "Excerpt from the completed conversion. Compare A/B in this section.",
      a: "A Original",
      b: "B Processed",
      format: "Output format",
      export: "Save",
      loudHelp: "Target −14 LUFS · Sample peak ceiling −1 dBFS",
      download: "Download again",
      cancel: "Cancel",
      footer:
        "Local processing · No audio uploads. Waveform differences compare amplitude at corresponding speech positions. Your browser controls the download location.",
      idle: "Choose an audio file to begin.",
      loading: "Loading audio…",
      analyze: "Analyzing level changes…",
      measure: "Measuring the full recording after tempo adjustment…",
      exporting: "Writing WAV…",
      previewing: "Preparing the selected excerpt…",
      ready:
        "Original ready to play. Adjust settings, then convert the full recording.",
      previewed: "30-second preview ready. Listen to B in the preview section.",
      exported: "File ready. Download started.",
      cancelled: "Processing cancelled.",
      invalid:
        "Check speed, duration and WSOLA settings. Overlap must be less than half of Sequence.",
      durationLimit:
        "The output exceeds 72 minutes. Increase the speed or choose a shorter recording.",
      inputLimit: "Input supports up to 72 minutes, 8–192 kHz, mono or stereo.",
      formatError:
        "Unsupported WAV. Use PCM (8/16/24/32-bit) or float (32/64-bit) WAV.",
      truncated: "The WAV data is incomplete.",
      tooLarge: "Output exceeds the WAV size limit.",
      memoryLimit:
        "Retained audio is limited to 1.75 GiB. Choose a shorter duration or a lower input sample rate.",
      notLoaded: "Load an audio file first.",
      mp3Memory: "Decoded MP3 exceeds 512 MiB. Use WAV for long recordings.",
      unsupported: "Choose a WAV or MP3 file.",
      error: "Unable to process the audio.",
      limited: "Peak constrained",
      silent: "No measurable audio",
      stale:
        "Settings changed. Convert the full recording again before saving.",
      durationApplied:
        "Final duration applied. Processing uses the full ratio, beyond the rounded display.",
    },
  };
  let lang = "ja",
    worker = null,
    busy = false,
    meta = null,
    file = null,
    ratio = 1.15,
    fromDuration = false,
    rawWave = null,
    resultWave = null,
    stats = null,
    urls = {},
    mode = "a",
    token = 0,
    abToken = 0,
    statusKey = "idle",
    statusDetail = "",
    statusError = false;
  let resultMeta = null,
    fullMode = "original",
    fullPosition = 0,
    renderRatio = 1,
    playOrigin = 0,
    fullToken = 0,
    animation = 0,
    wantPlay = false,
    previewReference = null;
  const t = (k) => text[lang][k] || k;
  const time = (s) => {
    const n = Math.round(s);
    return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
  };
  function status(key, error = false, detail = "") {
    statusKey = key;
    statusError = error;
    statusDetail = detail;
    $("status").textContent = t(key) + (detail ? " " + detail : "");
    $("status").className = error ? "error" : "";
  }
  function translate() {
    document.documentElement.lang = lang;
    document
      .querySelectorAll("[data-t]")
      .forEach((el) => (el.textContent = t(el.dataset.t)));
    $("ja").setAttribute("aria-pressed", String(lang === "ja"));
    $("en").setAttribute("aria-pressed", String(lang === "en"));
    $("wave").setAttribute("aria-label", t("seek"));
    $("seek").setAttribute("aria-label", t("seek"));
    $("slider").setAttribute("aria-label", t("speed"));
    status(statusKey, statusError, statusDetail);
    fileLabel();
    metrics();
    formatHelp();
    playbackUI();
    previewInfo();
  }
  $("ja").onclick = () => {
    lang = "ja";
    translate();
  };
  $("en").onclick = () => {
    lang = "en";
    translate();
  };
  function fileLabel() {
    if (!meta) return;
    $("fileName").textContent = file.name;
    $("fileName").title = file.name;
    $("fileInfo").textContent =
      `${time(meta.length / meta.sampleRate)} · ${meta.sampleRate / 1000} kHz · ${meta.channels === 1 ? "Mono" : "Stereo"} · ${(file.size / 1048576).toFixed(1)} MiB`;
  }
  function metrics() {
    if (!stats) {
      $("metrics").textContent = t("loudHelp");
      return;
    }
    $("metrics").textContent =
      stats.finalLufs === null
        ? t("silent")
        : `${stats.finalLufs.toFixed(1)} LUFS · ${stats.finalPeak > 0 ? (20 * Math.log10(stats.finalPeak)).toFixed(1) : "−∞"} dBFS${stats.limited ? " · " + t("limited") : ""}`;
  }
  function config() {
    const ws = {};
    for (const key of Object.keys(wsDefaults)) ws[key] = Number($(key).value);
    return {
      ratio,
      level: $("level").checked,
      bits: $("bits").value === "mp3" ? "mp3" : Number($("bits").value),
      eq: {
        low: $("eqLow").checked,
        mud: $("eqMud").checked,
        clear: $("eqClear").checked,
      },
      ws,
    };
  }
  function valid() {
    const c = config();
    if (
      !$("speed").value ||
      !$("speed").validity.valid ||
      !Number.isFinite(ratio) ||
      ratio < 0.7 - 1e-10 ||
      ratio > 1.3 + 1e-10
    )
      return "invalid";
    for (const key of Object.keys(wsDefaults))
      if (
        !$(key).value ||
        !$(key).validity.valid ||
        !Number.isInteger(c.ws[key])
      )
        return "invalid";
    if (c.ws.overlapMs * 2 >= c.ws.sequenceMs) return "invalid";
    if (meta && Math.round(meta.length / ratio) > meta.sampleRate * 72 * 60)
      return "durationLimit";
    if (
      meta &&
      Math.round(meta.length / ratio) * meta.channels * 4 > 1.75 * 1024 ** 3
    )
      return "memoryLimit";
    return "";
  }
  function locks() {
    document
      .querySelectorAll("input,select,#apply,#resetWs,#drop")
      .forEach((el) => (el.disabled = busy));
    for (const id of ["minutes", "seconds", "apply", "start"])
      $(id).disabled = busy || !meta;
    for (const id of ["preview", "render"])
      $(id).disabled = busy || !meta || !!valid();
    $("export").disabled = busy || !resultMeta || !!valid();
    $("original").disabled = !urls.original;
    $("processed").disabled = !resultMeta;
    $("play").disabled =
      $("stop").disabled =
      $("seek").disabled =
        !urls[fullMode];
    $("a").disabled = $("b").disabled = busy || !urls.a;
    $("cancel").hidden = !busy;
  }
  function setBusy(value) {
    busy = value;
    locks();
  }
  function revoke(key) {
    if (urls[key]) URL.revokeObjectURL(urls[key]);
    delete urls[key];
  }
  function clearPreview() {
    previewReference = null;
    previewInfo();
    abToken++;
    $("player").pause();
    $("player").removeAttribute("src");
    $("player").load();
    revoke("a");
    revoke("b");
  }
  function previewInfo() {
    $("previewInfo").textContent = t(
      previewReference === "rendered"
        ? "previewExact"
        : previewReference === "estimate"
          ? "previewEstimate"
          : "previewHelp",
    );
  }
  function invalidate(full = true) {
    clearPreview();
    if (full) {
      if (fullMode === "processed") selectFull("original");
      resultMeta = null;
      revoke("processed");
      worker?.postMessage({ type: "release" });
      revoke("export");
      $("download").hidden = true;
      stats = null;
      resultWave = null;
      metrics();
    }
    locks();
    draw();
  }
  function updated() {
    invalidate();
    syncTimes();
    const error = valid();
    status(error || "stale", !!error);
  }
  function syncTimes(syncTarget = false) {
    if (!meta) return;
    const duration = Math.round(meta.length / ratio) / meta.sampleRate;
    $("before").textContent = time(meta.length / meta.sampleRate);
    $("after").textContent = time(duration);
    $("waveEnd").textContent = time(meta.length / meta.sampleRate);
    if (syncTarget) {
      const sec = Math.round(duration);
      $("minutes").value = Math.floor(sec / 60);
      $("seconds").value = sec % 60;
    }
  }
  function speedChanged(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || !String(value).trim()) {
      locks();
      status("invalid", true);
      return;
    }
    ratio = Math.round(n * 1000) / 1000;
    fromDuration = false;
    $("speed").value = ratio.toFixed(3);
    $("slider").value = ratio;
    updated();
    syncTimes(true);
  }
  $("speed").oninput = () => {
    locks();
  };
  $("speed").onchange = () => speedChanged($("speed").value);
  $("slider").oninput = () => speedChanged($("slider").value);
  $("apply").onclick = () => {
    if (!meta || busy) return;
    const m = Number($("minutes").value),
      s = Number($("seconds").value);
    if (
      !$("minutes").value ||
      !$("seconds").value ||
      !Number.isInteger(m) ||
      !Number.isInteger(s) ||
      m < 0 ||
      s < 0 ||
      s > 59 ||
      m * 60 + s <= 0
    ) {
      status("invalid", true);
      return;
    }
    const next = meta.length / Math.round((m * 60 + s) * meta.sampleRate);
    if (next < 0.7 - 1e-10 || next > 1.3 + 1e-10) {
      status("invalid", true);
      return;
    }
    ratio = next;
    fromDuration = true;
    $("speed").value = ratio.toFixed(3);
    $("slider").value = ratio;
    updated();
    if (!valid()) status("durationApplied");
  };
  for (const id of ["minutes", "seconds"])
    $(id).onkeydown = (e) => {
      if (e.key === "Enter") $("apply").click();
    };
  for (const id of [
    "level",
    "eqLow",
    "eqMud",
    "eqClear",
    ...Object.keys(wsDefaults),
  ])
    $(id).addEventListener("input", updated);
  function formatHelp() {
    $("formatHelp").textContent = t(
      $("bits").value === "mp3"
        ? "mp3Help"
        : $("bits").value === "16"
          ? "wav16Help"
          : "wav24Help",
    );
  }
  $("bits").onchange = () => {
    revoke("export");
    $("download").hidden = true;
    formatHelp();
    locks();
  };
  $("resetWs").onclick = () => {
    for (const [k, v] of Object.entries(wsDefaults)) $(k).value = v;
    updated();
  };
  function setStart(v) {
    if (!meta || busy) return;
    $("start").value = Math.max(
      0,
      Math.min(
        Math.max(0, meta.length / meta.sampleRate - 0.1),
        Number(v) || 0,
      ),
    ).toFixed(1);
    clearPreview();
    locks();
    draw();
  }
  $("start").onchange = () => setStart($("start").value);
  // fullPosition is always in original seconds. Switching sources keeps the
  // corresponding speech position even though the processed duration differs.
  const playbackScale = () => (fullMode === "processed" ? renderRatio : 1);
  function playbackUI() {
    const scale = playbackScale(),
      duration = meta ? meta.length / meta.sampleRate / scale : 0;
    $("play").textContent = t(wantPlay ? "pause" : "play");
    $("playTime").textContent =
      `${time(fullPosition / scale)} / ${meta ? time(duration) : "—"}`;
    $("seek").max = duration || 1;
    $("seek").value = fullPosition / scale;
    $("waveEnd").textContent = meta ? time(duration) : "—";
    $("original").setAttribute("aria-pressed", String(fullMode === "original"));
    $("processed").setAttribute(
      "aria-pressed",
      String(fullMode === "processed"),
    );
  }
  function stopFull(reset = false) {
    wantPlay = false;
    $("fullPlayer").pause();
    cancelAnimationFrame(animation);
    if (reset) seekFull(playOrigin);
    playbackUI();
  }
  function tick() {
    if (!wantPlay) return;
    const player = $("fullPlayer");
    if (player.readyState && !player.seeking)
      fullPosition = player.currentTime * playbackScale();
    playbackUI();
    draw();
    animation = requestAnimationFrame(tick);
  }
  async function startFull() {
    const request = fullToken;
    $("player").pause();
    wantPlay = true;
    try {
      await $("fullPlayer").play();
      if (request !== fullToken || !wantPlay) return;
      cancelAnimationFrame(animation);
      tick();
    } catch (e) {
      if (request === fullToken && wantPlay && e.name !== "AbortError") {
        stopFull();
        status("playbackError", true);
      }
    }
    playbackUI();
  }
  function selectFull(next) {
    if (!urls[next]) return;
    const playing = wantPlay,
      player = $("fullPlayer"),
      request = ++fullToken;
    stopFull();
    fullMode = next;
    player.src = urls[next];
    player.onloadedmetadata = () => {
      if (request !== fullToken) return;
      player.currentTime = Math.min(
        fullPosition / playbackScale(),
        Math.max(0, player.duration - 0.001),
      );
      if (wantPlay) startFull();
      playbackUI();
      draw();
    };
    player.load();
    wantPlay = playing;
    playbackUI();
    draw();
    locks();
  }
  function seekFull(originalSeconds) {
    if (!meta) return;
    fullPosition = Math.max(
      0,
      Math.min(meta.length / meta.sampleRate, Number(originalSeconds) || 0),
    );
    if ($("fullPlayer").readyState)
      $("fullPlayer").currentTime = fullPosition / playbackScale();
    if (!busy) {
      $("start").value = Math.min(
        fullPosition,
        Math.max(0, meta.length / meta.sampleRate - 0.1),
      ).toFixed(1);
      clearPreview();
    }
    locks();
    playbackUI();
    draw();
  }
  $("original").onclick = () => selectFull("original");
  $("processed").onclick = () => selectFull("processed");
  $("play").onclick = () => {
    if (wantPlay) {
      fullPosition = $("fullPlayer").currentTime * playbackScale();
      stopFull();
      draw();
    } else {
      if (
        $("fullPlayer").ended ||
        fullPosition >= meta.length / meta.sampleRate
      )
        seekFull(0);
      playOrigin = fullPosition;
      startFull();
    }
  };
  $("stop").onclick = () => stopFull(true);
  $("seek").oninput = () => seekFull(Number($("seek").value) * playbackScale());
  $("fullPlayer").onended = () => {
    if (!meta) return;
    fullPosition = meta.length / meta.sampleRate;
    stopFull();
    draw();
  };
  $("fullPlayer").onerror = () => {
    if (urls[fullMode]) {
      stopFull();
      status("playbackError", true);
    }
  };
  $("player").onplay = () => stopFull();
  const waveSeek = (e) => {
    if (!meta) return;
    const rect = $("wave").getBoundingClientRect();
    seekFull(
      (((e.clientX - rect.left) / rect.width) * meta.length) / meta.sampleRate,
    );
  };
  $("wave").onpointerdown = (e) => {
    $("wave").setPointerCapture(e.pointerId);
    waveSeek(e);
  };
  $("wave").onpointermove = (e) => {
    if ($("wave").hasPointerCapture(e.pointerId)) waveSeek(e);
  };
  $("wave").onpointerup = (e) => $("wave").releasePointerCapture(e.pointerId);
  $("wave").onkeydown = (e) => {
    if (!meta) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      seekFull(
        fullPosition + (e.key === "ArrowLeft" ? -5 : 5) * playbackScale(),
      );
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      seekFull(e.key === "Home" ? 0 : meta.length / meta.sampleRate);
    }
  };
  function draw() {
    const canvas = $("wave"),
      ctx = canvas.getContext("2d"),
      w = canvas.width,
      h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#27364a";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 10, 0);
      ctx.lineTo((i * w) / 10, h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    if (rawWave)
      for (let i = 0; i < rawWave.length; i++) {
        const raw = Math.min(1, rawWave[i]) * h * 0.46,
          result = resultWave ? Math.min(1, resultWave[i]) * h * 0.46 : raw,
          common = Math.min(raw, result),
          outer = Math.max(raw, result),
          x = (i * w) / rawWave.length,
          width = w / rawWave.length;
        ctx.fillStyle = "#8896aa";
        ctx.fillRect(x, h / 2 - common, width, common * 2);
        ctx.fillStyle = result > raw ? "#54ce8b" : "#ef777d";
        ctx.fillRect(x, h / 2 - outer, width, outer - common);
        ctx.fillRect(x, h / 2 + common, width, outer - common);
      }
    if (meta) {
      const start = fullPosition,
        x = (start / (meta.length / meta.sampleRate)) * w;
      ctx.fillStyle = "#7de9e8";
      ctx.fillRect(x, 0, 2, h);
      canvas.setAttribute(
        "aria-valuemax",
        String(meta.length / meta.sampleRate / playbackScale()),
      );
      canvas.setAttribute("aria-valuenow", String(start / playbackScale()));
      canvas.setAttribute("aria-valuetext", time(start / playbackScale()));
    }
  }
  async function parseWav(f) {
    const first = new DataView(await f.slice(0, 12).arrayBuffer());
    const four = (v, p) =>
      String.fromCharCode(...new Uint8Array(v.buffer, v.byteOffset + p, 4));
    if (
      first.byteLength < 12 ||
      four(first, 0) !== "RIFF" ||
      four(first, 8) !== "WAVE"
    )
      throw Error("formatError");
    let format = null,
      data = null,
      p = 12;
    const end = Math.min(f.size, first.getUint32(4, true) + 8);
    while (p + 8 <= end) {
      const v = new DataView(await f.slice(p, p + 48).arrayBuffer()),
        id = four(v, 0),
        n = v.getUint32(4, true);
      if (p + 8 + n > end) throw Error("truncated");
      if (id === "fmt ") {
        if (n < 16) throw Error("formatError");
        let code = v.getUint16(8, true);
        if (code === 65534) {
          if (n < 40 || v.getUint16(24, true) < 22) throw Error("formatError");
          const guid = Array.from(new Uint8Array(v.buffer, 32, 16));
          if (
            guid.slice(2).join(",") !== "0,0,0,0,16,0,128,0,0,170,0,56,155,113"
          )
            throw Error("formatError");
          code = v.getUint16(32, true);
        }
        format = {
          format: code,
          channels: v.getUint16(10, true),
          sampleRate: v.getUint32(12, true),
          align: v.getUint16(20, true),
          bits: v.getUint16(22, true),
        };
      }
      if (id === "data" && !data) data = { offset: p + 8, size: n };
      if (format && data) break;
      p += 8 + n + (n % 2);
    }
    if (!format || !data) throw Error("formatError");
    const m = { ...format, ...data };
    if (
      ![1, 3].includes(m.format) ||
      !(m.format === 1 ? [8, 16, 24, 32] : [32, 64]).includes(m.bits) ||
      m.align !== (m.channels * m.bits) / 8 ||
      data.size % m.align
    )
      throw Error("formatError");
    m.length = data.size / m.align;
    return m;
  }
  function checkMeta(m) {
    if (
      ![1, 2].includes(m.channels) ||
      m.sampleRate < 8000 ||
      m.sampleRate > 192000 ||
      m.length < 256 ||
      m.length > m.sampleRate * 72 * 60
    )
      throw Error("inputLimit");
  }
  async function decodeMp3(f, id) {
    const head = new Uint8Array(await f.slice(0, 256 * 1024).arrayBuffer());
    let start = 0,
      sr = 48000;
    if (head[0] === 73 && head[1] === 68 && head[2] === 51)
      start =
        10 +
        ((head[6] & 127) << 21) +
        ((head[7] & 127) << 14) +
        ((head[8] & 127) << 7) +
        (head[9] & 127);
    for (let p = start; p + 4 < head.length; p++) {
      if (head[p] !== 255 || (head[p + 1] & 224) !== 224) continue;
      const ver = (head[p + 1] >> 3) & 3,
        layer = (head[p + 1] >> 1) & 3,
        rate = (head[p + 2] >> 2) & 3,
        br = head[p + 2] >> 4;
      if (ver !== 1 && layer === 1 && rate !== 3 && br > 0 && br < 15) {
        sr = [44100, 48000, 32000][rate] / (ver === 3 ? 1 : ver === 2 ? 2 : 4);
        break;
      }
    }
    // Browser decoding is necessarily whole-file. Compressed input is also capped
    // before decode; decoded PCM has a separate cap. WAV is the long-file route.
    if (f.size > 128 * 1048576) throw Error("mp3Memory");
    const ctx = new OfflineAudioContext(2, 1, sr),
      buffer = await ctx.decodeAudioData(await f.arrayBuffer());
    if (id !== token) throw Error("cancelled");
    const m = {
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      length: buffer.length,
    };
    checkMeta(m);
    if (m.length * m.channels * 4 > 512 * 1048576) throw Error("mp3Memory");
    return {
      meta: m,
      pcm: Array.from({ length: m.channels }, (_, c) =>
        buffer.getChannelData(c),
      ),
    };
  }
  function newWorker() {
    const url = URL.createObjectURL(
      new Blob([$("worker-source").textContent], { type: "text/javascript" }),
    );
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    return w;
  }
  async function load(f) {
    if (busy || !f) return;
    const id = ++token;
    stopFull();
    fullToken++;
    $("fullPlayer").removeAttribute("src");
    $("fullPlayer").load();
    revoke("original");
    fullMode = "original";
    fullPosition = playOrigin = 0;
    worker?.terminate();
    worker = null;
    invalidate();
    meta = null;
    file = f;
    rawWave = null;
    draw();
    $("before").textContent =
      $("after").textContent =
      $("waveEnd").textContent =
        "—";
    $("fileName").textContent = f.name;
    $("fileName").title = f.name;
    $("fileInfo").textContent = t("loading");
    setBusy(true);
    status("loading");
    $("progress").value = 0;
    $("percent").textContent = "0%";
    try {
      let decoded;
      if (/\.wav(e)?$/i.test(f.name)) {
        decoded = { meta: await parseWav(f) };
        checkMeta(decoded.meta);
      } else if (/\.mp3$/i.test(f.name)) decoded = await decodeMp3(f, id);
      else throw Error("unsupported");
      if (id !== token) return;
      const w = newWorker();
      worker = w;
      w.onmessage = (e) => {
        if (worker === w) receive(e.data);
      };
      w.onerror = (e) => {
        if (worker !== w) return;
        e.preventDefault();
        status("error", true, e.message);
        setBusy(false);
      };
      meta = decoded.meta;
      urls.original = URL.createObjectURL(f);
      selectFull("original");
      fileLabel();
      $("start").value = "0";
      $("start").max = Math.max(0, meta.length / meta.sampleRate - 0.1);
      syncTimes(true);
      w.postMessage(
        { type: "load", meta, file: decoded.pcm ? null : f, pcm: decoded.pcm },
        decoded.pcm?.map((a) => a.buffer) || [],
      );
    } catch (e) {
      if (id !== token) return;
      meta = null;
      status(
        text[lang][e.message] ? e.message : "error",
        true,
        text[lang][e.message] ? "" : e.message,
      );
      setBusy(false);
    }
  }
  function receive(m) {
    if (m.type === "progress") {
      const phase = {
        analyze: "analyze",
        measure: "measure",
        preview: "previewing",
        export: "exporting",
        render: "rendering",
        mp3: "mp3",
      }[m.phase];
      status(phase);
      $("progress").value = m.value;
      $("percent").textContent = Math.round(m.value * 100) + "%";
      return;
    }
    if (m.type === "loaded") {
      rawWave = m.wave;
      setBusy(false);
      const error = valid();
      status(error || "ready", !!error);
      draw();
      return;
    }
    if (m.type === "error") {
      if (!resultMeta) {
        resultWave = null;
        stats = null;
        metrics();
        draw();
      }
      if (!rawWave) {
        stopFull();
        fullToken++;
        revoke("original");
        $("fullPlayer").removeAttribute("src");
        $("fullPlayer").load();
        meta = null;
        worker?.terminate();
        worker = null;
      }
      status(
        text[lang][m.message] ? m.message : "error",
        m.message !== "cancelled",
        text[lang][m.message] ? "" : m.message,
      );
      setBusy(false);
      return;
    }
    if (m.type === "previewed") {
      urls.a = URL.createObjectURL(m.a);
      urls.b = URL.createObjectURL(m.b);
      previewReference = m.reference;
      previewInfo();
      selectAB("b", false);
      status("previewed");
    }
    if (m.type === "rendered") {
      stats = m.stats;
      resultWave = Float32Array.from(
        stats.wave,
        (v) => v * 10 ** (stats.gainDb / 20),
      );
      metrics();
      revoke("processed");
      urls.processed = URL.createObjectURL(m.blob);
      resultMeta = m.meta;
      renderRatio = ratio;
      selectFull("processed");
      status("rendered");
    }
    if (m.type === "exported") {
      revoke("export");
      urls.export = URL.createObjectURL(m.blob);
      const link = $("download");
      link.href = urls.export;
      link.download = outputName();
      link.hidden = false;
      link.click();
      status("exported");
    }
    $("progress").value = 1;
    $("percent").textContent = "100%";
    setBusy(false);
  }
  function outputName() {
    const stem = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[\\/:*?"<>|]/g, "_"),
      c = config();
    const speed = fromDuration
      ? "to" +
        time(Math.round(meta.length / ratio) / meta.sampleRate).replace(
          ":",
          "m",
        ) +
        "s"
      : "x" + ratio.toFixed(3);
    const ws = Object.keys(wsDefaults).some((k) => c.ws[k] !== wsDefaults[k])
      ? `_ws${c.ws.sequenceMs}-${c.ws.seekMs}-${c.ws.overlapMs}_s${c.ws.searchStride}d${c.ws.analysisStep}`
      : "";
    const eq = Object.values(c.eq).some(Boolean) ? "_voice" : "";
    return `${stem}_${c.level ? "leveled_" : ""}${speed}${ws}${eq}${c.bits === "mp3" ? "_VBR.mp3" : `_${c.bits}bit.wav`}`;
  }
  function process(type) {
    if (busy || !meta || !worker) return;
    const error = valid();
    if (error) {
      status(error, true);
      return;
    }
    if (type === "preview") clearPreview();
    else {
      revoke("export");
      $("download").hidden = true;
    }
    if (type === "export" && !resultMeta) {
      status("notRendered", true);
      return;
    }
    if (type === "render") {
      invalidate();
      $("previewDetails").open = false;
    }
    setBusy(true);
    $("player").pause();
    stopFull();
    $("progress").value = 0;
    $("percent").textContent = "0%";
    status(
      type === "export"
        ? config().bits === "mp3"
          ? "mp3"
          : "exporting"
        : type === "preview"
          ? "previewing"
          : "measure",
    );
    worker.postMessage({
      type,
      config: config(),
      start: Number($("start").value) || 0,
    });
  }
  $("preview").onclick = () => process("preview");
  $("render").onclick = () => process("render");
  $("export").onclick = () => process("export");
  $("cancel").onclick = () => {
    if (worker) worker.postMessage({ type: "cancel" });
    else {
      token++;
      meta = null;
      status("cancelled");
      setBusy(false);
    }
  };
  function selectAB(next, keep = true) {
    if (!urls[next]) return;
    const player = $("player"),
      playing = !player.paused,
      point = (player.currentTime || 0) * (mode === "b" ? ratio : 1),
      target = next === "b" ? point / ratio : point;
    const request = ++abToken;
    mode = next;
    player.pause();
    player.src = urls[next];
    player.onloadedmetadata = () => {
      if (request !== abToken) return;
      player.currentTime = keep
        ? Math.max(0, Math.min(target, player.duration - 0.01))
        : 0;
      if (playing && keep) player.play().catch(() => {});
    };
    player.load();
    $("a").setAttribute("aria-pressed", String(next === "a"));
    $("b").setAttribute("aria-pressed", String(next === "b"));
  }
  $("a").onclick = () => selectAB("a");
  $("b").onclick = () => selectAB("b");
  $("drop").onclick = () => $("file").click();
  $("file").onchange = () => {
    load($("file").files[0]);
    $("file").value = "";
  };
  $("drop").ondragover = (e) => {
    e.preventDefault();
    if (!busy) $("drop").classList.add("drag");
  };
  $("drop").ondragleave = () => $("drop").classList.remove("drag");
  $("drop").ondrop = (e) => {
    e.preventDefault();
    $("drop").classList.remove("drag");
    load(e.dataTransfer.files[0]);
  };
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());
  window.addEventListener("beforeunload", () => {
    worker?.terminate();
    for (const k of Object.keys(urls)) revoke(k);
  });
  translate();
  locks();
  draw();
})();
