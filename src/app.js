"use strict";
(() => {
  const $ = (id) => document.getElementById(id),
    wsDefaults = {
      sequenceMs: 40,
      seekMs: 15,
      overlapMs: 8,
    };
  const controlHints = {
    ja: ["日本語表示に切り替えます。", "Switch the interface to Japanese."],
    manual: [
      "詳しい操作・音声処理の説明を別タブで開きます。",
      "Open the detailed user guide in a new tab.",
    ],
    drop: [
      "WAV／MP3を選択、またはここにドロップ。入力・出力は最大72分です。",
      "Choose or drop WAV/MP3. Input and output: up to 72 minutes.",
    ],
    cancel: [
      "現在の処理を中止します。処理の区切りで反映されます。",
      "Cancel the current operation at the next processing boundary.",
    ],
    wave: [
      "クリック／ドラッグで移動。左右キーで5秒、Home/Endで先頭／末尾へ。",
      "Click or drag to seek. Arrow keys: 5 seconds; Home/End: start/end.",
    ],
    original: [
      "入力した原音を再生対象にします。",
      "Select the original recording for playback.",
    ],
    processed: [
      "全体変換した音を再生対象にします。全体変換の完了後に使えます。",
      "Play the retained result, available after full conversion.",
    ],
    play: [
      "選択中の音を再生／一時停止します。",
      "Play or pause the selected recording.",
    ],
    stop: [
      "停止して、再生を開始した位置へ戻ります。",
      "Stop and return to the playback start position.",
    ],
    seek: [
      "ドラッグして再生位置を変更します。",
      "Drag to change playback position.",
    ],
    level: [
      "時間方向の音量差を穏やかに整えます。OFFでも最終ラウドネス調整は行います。",
      "Even out volume over time. Final loudness adjustment still runs when this is off.",
    ],
    eqLow: [
      "75 Hz・12 dB/octのハイパスで不要な低音を抑えます。",
      "75 Hz, 12 dB/oct high-pass filter reduces unwanted lows.",
    ],
    eqMud: [
      "320 Hz周辺を広めに−2.5 dB（Q 0.8）。声のこもりを軽減します。",
      "Broad −2.5 dB cut at 320 Hz (Q 0.8) reduces muddiness.",
    ],
    eqClear: [
      "3.5 kHz周辺を＋2 dB（Q 0.8）。言葉の輪郭を補います。",
      "Broad +2 dB boost at 3.5 kHz (Q 0.8) adds presence.",
    ],
    speed: [
      "0.700〜1.300倍。1.000倍は速度変換をバイパスします。",
      "0.700–1.300×. At 1.000×, time stretching is bypassed.",
    ],
    slider: [
      "速度倍率を調整。大きい値ほど速く、仕上がりが短くなります。",
      "Adjust tempo: higher values play faster and produce a shorter result.",
    ],
    minutes: [
      "希望する仕上がり時間の分。入力後に「適用」を押します。",
      "Target duration in minutes; press Apply after editing.",
    ],
    seconds: [
      "希望する仕上がり時間の秒（0〜59）。",
      "Seconds component of the target duration (0–59).",
    ],
    apply: [
      "仕上がり時間から倍率を計算します。音声変換はまだ行いません。",
      "Calculate the tempo from the target duration; this does not convert audio.",
    ],
    sequenceMs: [
      "音をつなぐ単位の長さ。標準40 ms。通常は変更不要です。",
      "Length of each audio segment. Default: 40 ms. Usually leave unchanged.",
    ],
    seekMs: [
      "つなぎ目が似ている位置を探す範囲。標準は予定位置から前後15 ms。",
      "Search around each expected join. Default: ±15 ms.",
    ],
    overlapMs: [
      "重ねて滑らかにつなぐ長さ。標準8 ms、処理区間の長さの半分未満。",
      "Crossfade length. Default: 8 ms; must be less than half the segment length.",
    ],
    resetWs: [
      "WSOLAの3項目だけを標準値へ戻します。",
      "Reset only the three WSOLA parameters to defaults.",
    ],
    render: [
      "現在の設定で原音から全体を変換し、試聴・保存用に保持します。",
      "Convert the entire original with current settings and retain it for playback and saving.",
    ],
    start: [
      "原音上の開始位置（秒）。ここから原音30秒分を試聴します。",
      "Start time in the original, in seconds. Preview up to 30 seconds of source audio.",
    ],
    preview: [
      "選択区間だけを処理し、完成後にB（処理後）を自動再生します。",
      "Process the selected excerpt, then automatically play B (Processed).",
    ],
    a: [
      "プレビューの原音へ切り替えます。",
      "Switch the excerpt to A (Original).",
    ],
    b: [
      "プレビューの処理後へ切り替えます。",
      "Switch the excerpt to B (Processed).",
    ],
    player: [
      "30秒プレビューの再生・一時停止・シーク・音量を操作します。",
      "Play, pause, seek and adjust volume for the preview excerpt.",
    ],
    bits: [
      "24bit WAV／ディザ付き16bit WAV／MP3 VBR Q3。形式変更だけなら再変換不要です。",
      "24-bit WAV, dithered 16-bit WAV, or MP3 VBR Q3. Changing format needs no new full conversion.",
    ],
    export: [
      "保持した完成音声を選択形式で保存します。保存先はブラウザ設定に従います。",
      "Save the retained result in the selected format, using browser download settings.",
    ],
    download: [
      "直前に作成した保存用ファイルをもう一度ダウンロードします。",
      "Download the most recently encoded file again.",
    ],
    en: ["英語表示に切り替えます。", "Switch the interface to English."],
  };
  Object.assign(controlHints, {
    analyzeFormant: [
      "最後に操作した全体音声／プレビューの再生位置から10秒を探索します。開始位置の指定もできます。",
      "Search 10 seconds ahead of the last-used full recording or preview playhead, or use a specified start.",
    ],
    formantPosition: [
      "原音上の秒数を探索の起点として指定します。",
      "Set the search start in original seconds.",
    ],
    formantManual: [
      "ONで開始位置を手入力。OFFでは最後に操作した再生位置を使用します。",
      "Enable to enter a start time. Otherwise use the last-used playhead.",
    ],
    formantPlay: [
      "分析に使った実音の前後を、音量をそろえて試聴／一時停止します。",
      "Play/pause the actual analyzed audio with surrounding context and matched A/B levels.",
    ],
    formantA: [
      "EQ・レベラー適用後、速度変換前の音へ切り替えます。",
      "Switch to the audio after EQ/leveling, before time stretching.",
    ],
    formantB: [
      "速度変換後の音へ切り替えます。",
      "Switch to the actual time-stretched audio.",
    ],
    formantNext: [
      "同じ探索範囲の候補を差が大きい順に切り替えます。最後の候補の次は先頭へ戻ります。",
      "Cycle through candidates in the same range, ordered by difference.",
    ],
    formantNextRange: [
      "前回探索した範囲の直後から、次の10秒を探索します。",
      "Search the next 10 seconds immediately after the previous range.",
    ],
    formantSeek: [
      "短い分析用音声の再生位置を変更します。上の色付き部分が分析窓です。",
      "Seek within the analysis audition. The highlighted section above marks the analysis window.",
    ],
  });
  function applyHints() {
    for (const [id, pair] of Object.entries(controlHints)) {
      const el = $(id),
        hint = pair[lang === "en" ? 1 : 0];
      el.title = hint;
      el.setAttribute("aria-description", hint);
      const label = el.closest("label");
      if (label) label.title = hint;
    }
    document.querySelector('[data-t="advanced"]').title =
      lang === "ja"
        ? "速度変換の詳細設定。1倍では使われません。通常は標準値を使用します。"
        : "Time-stretch settings. Unused at 1×; defaults suit normal use.";
    document.querySelector('[data-t="shortPreview"]').title =
      lang === "ja"
        ? "部分試聴の操作を開閉します。全体変換前の音量は区間からの推定です。"
        : "Show or hide excerpt controls. Before full conversion, loudness is estimated locally.";
  }
  const text = {
    ja: {
      formantExpired: "設定が変わりました。もう一度分析してください。",
      analysisEnd: "音声の末尾です。少し手前へ再生位置を戻してください。",
      analysisNoVoiced:
        "この範囲に安定した発声の候補がありません。次の区間を探索してください。",
      formantLevelMatched: "試聴音量は前後で一致",
      formantWindow: "色付き部分＝分析した50 ms",
      formantLargest: "抽出候補内で最大差",
      formantCandidate: "候補（差が大きい順）",
      formantRange: "探索範囲",
      formantSeek: "分析試聴の再生位置",
      formantManual: "開始位置を指定",
      formantNextRange: "次の10秒を探索",
      formantNext: "次の候補",
      formantB: "変換後",
      formantA: "変換前",
      formantPlay: "▶ 試聴",
      analyzeFormantManual: "指定位置から分析",
      frequencyHz: "周波数 (Hz)",
      relativeDb: "相対 dB",
      analysisShort: "分析に必要な長さがありません。",
      analysisSilent: "無音または音が小さすぎるため比較できません。",
      formantBypass: "1倍：速度変換なし",
      formantTimes: "分析窓の中心（原音 → 変換後）",
      formantLocal: "選択付近を部分変換して比較",
      formantPreview: "30秒プレビューの実音を比較",
      formantFull: "全体変換の実音を比較",
      formantReady:
        "比較箇所を選びました。「試聴」で変換前／後を確認できます。",
      formantWorking: "安定した発声を探索し、WSOLA前後の差を比較中…",
      formantEmpty:
        "再生位置から先の10秒を探索し、安定した発声の候補から差が大きい箇所を選びます。",
      formantHelp:
        "前後3窓で差を確認し、代表の50 msを表示。試聴は周囲を含む原音約1.6秒分です。差の大きさは音質の良し悪しを示しません。",
      postWsola: "WSOLA直後",
      preWsola: "WSOLA直前",
      analyzeFormant: "再生位置から分析",
      formantPosition: "探索開始位置（原音の秒）",
      formantTitle: "フォルマント分析（声の響きの比較）",
      spectrumSampling: "区間全体から均等抽出した窓を平均",
      spectrumRange: "原音の対象区間",
      spectrumWorking: "試聴区間の平均スペクトルを計算中…",
      spectrumHelp:
        "試聴区間の原音／最終処理後。表示上の音量をそろえ、EQ・レベラー・速度変換による音色の差を比較します。",
      spectrumEmpty: "30秒プレビューを作成すると表示します。",
      spectrumTitle: "平均スペクトル",
      wsActive: "通常は標準値のまま使ってください。",
      wsBypass: "1.000倍では速度変換をバイパスします。",
      overlapLabel: "つなぎの長さ (ms)",
      seekLabel: "接続位置の探索範囲 (±ms)",
      sequenceLabel: "処理区間の長さ (ms)",
      previewAutoplayBlocked:
        "プレビューを作成しました。自動再生できない場合は下の再生ボタンを押してください。",
      manual: "マニュアル",
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
      reset: "標準に戻す",
      wsHelp:
        "つなぎの長さは処理区間の半分未満。探索の細かさは内部で管理します。",
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
        "速度・時間・WSOLAの入力値を確認してください。つなぎの長さは処理区間の半分未満です。",
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
      formantExpired: "Settings changed. Analyze again.",
      analysisEnd: "End of recording. Move the playhead back before analyzing.",
      analysisNoVoiced:
        "No stable voiced candidate in this range. Try the next range.",
      formantLevelMatched: "A/B playback levels matched",
      formantWindow: "Highlighted = analyzed 50 ms",
      formantLargest: "Largest among sampled candidates",
      formantCandidate: "Candidate (largest difference first)",
      formantRange: "Search range",
      formantSeek: "Analysis audition position",
      formantManual: "Set start position",
      formantNextRange: "Search next 10 sec",
      formantNext: "Next candidate",
      formantB: "After",
      formantA: "Before",
      formantPlay: "▶ Listen",
      analyzeFormantManual: "Analyze from position",
      frequencyHz: "Frequency (Hz)",
      relativeDb: "Relative dB",
      analysisShort: "The audio is too short for this analysis.",
      analysisSilent: "Silence or audio too quiet to compare.",
      formantBypass: "1×: time stretching bypassed",
      formantTimes: "Window centers (original → output)",
      formantLocal: "Locally converted excerpt",
      formantPreview: "Actual 30-second preview audio",
      formantFull: "Actual full-conversion audio",
      formantReady: "Comparison ready. Use Listen to compare Before and After.",
      formantWorking:
        "Finding stable voiced regions and comparing WSOLA envelopes…",
      formantEmpty:
        "Search 10 seconds ahead of the playhead and select a stable voiced candidate with a large difference.",
      formantHelp:
        "Differences are checked in three nearby windows; one representative 50 ms window is shown. Listen includes about 1.6 original seconds of context. Difference is not a quality score.",
      postWsola: "After WSOLA",
      preWsola: "Before WSOLA",
      analyzeFormant: "Analyze from playhead",
      formantPosition: "Search start (original seconds)",
      formantTitle: "Formant analysis (spectral envelope)",
      spectrumSampling: "Average of windows sampled evenly across the excerpt",
      spectrumRange: "Original excerpt",
      spectrumWorking: "Calculating the excerpt's average spectrum…",
      spectrumHelp:
        "Original vs final excerpt. Display levels are matched to compare tonal changes from EQ, leveling and tempo.",
      spectrumEmpty: "Create a 30-second preview to see the comparison.",
      spectrumTitle: "Average spectrum",
      wsActive: "Defaults are recommended for normal use.",
      wsBypass: "At 1.000×, time stretching is bypassed.",
      overlapLabel: "Crossfade length (ms)",
      seekLabel: "Join search range (±ms)",
      sequenceLabel: "Segment length (ms)",
      previewAutoplayBlocked:
        "Preview ready. If autoplay is blocked, press Play below.",
      manual: "Manual",
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
      reset: "Defaults",
      wsHelp:
        "Crossfade must be less than half the segment. Search granularity is managed internally.",
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
    ratio = 1,
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
    previewReference = null,
    spectrumData = null,
    formantData = null,
    formantAudio = null,
    formantMode = "b",
    formantToken = 0,
    formantWantPlay = false,
    formantAnimation = 0,
    activeMainPlayer = "full";
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
    applyHints();
    analysisUI();
    wsState();
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
    const ws = { searchStride: 8, analysisStep: 8 };
    for (const key of Object.keys(wsDefaults))
      ws[key] =
        Math.abs(ratio - 1) < 1e-8 ? wsDefaults[key] : Number($(key).value);
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
        Math.abs(ratio - 1) >= 1e-8 &&
        (!$(key).value ||
          !$(key).validity.valid ||
          !Number.isInteger(c.ws[key]))
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
    for (const key of Object.keys(wsDefaults))
      $(key).disabled = busy || Math.abs(ratio - 1) < 1e-8;
    $("resetWs").disabled = busy || Math.abs(ratio - 1) < 1e-8;
    $("formantPosition").disabled =
      busy || !meta || !$("formantManual").checked;
    $("formantManual").disabled = busy || !meta;
    for (const id of ["formantPlay", "formantA", "formantB", "formantSeek"])
      $(id).disabled = busy || !formantAudio;
    $("formantNext").disabled = busy || !(formantData?.candidateCount > 1);
    $("formantNextRange").disabled =
      busy || formantData?.nextStart == null || !!valid();
    $("analyzeFormant").disabled =
      busy ||
      !meta ||
      !!valid() ||
      ($("formantManual").checked &&
        (!$("formantPosition").value || !$("formantPosition").validity.valid));
    wsState();
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
    if (activeMainPlayer === "preview") activeMainPlayer = "full";
    spectrumData = null;
    analysisUI();
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
      clearFormant();
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
    activeMainPlayer = "full";
    stopFormant();
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
    activeMainPlayer = "full";
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
  $("original").onclick = () => {
    activeMainPlayer = "full";
    selectFull("original");
  };
  $("processed").onclick = () => {
    activeMainPlayer = "full";
    selectFull("processed");
  };
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
  $("player").onplay = () => {
    activeMainPlayer = "preview";
    stopFull();
    stopFormant();
  };
  $("player").onseeking = () => {
    if (urls.a && !busy) activeMainPlayer = "preview";
  };
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
        spectrum: "spectrumWorking",
        formant: "formantWorking",
      }[m.phase];
      status(phase);
      $("progress").value = m.value;
      $("percent").textContent = Math.round(m.value * 100) + "%";
      return;
    }
    if (m.type === "loaded") {
      rawWave = m.wave;
      $("formantPosition").max = Math.max(0, meta.length / meta.sampleRate);
      $("formantPosition").value = 0;
      $("formantManual").checked = false;
      activeMainPlayer = "full";
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
      spectrumData = { ...m.spectrum, start: m.start, duration: m.duration };
      analysisUI();
      previewInfo();
      selectAB("b", false, true);
      status("previewed");
    }
    if (m.type === "formantAnalyzed") {
      installFormantResult(m);
      status(m.data.unavailable || "formantReady");
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
      ? `_ws${c.ws.sequenceMs}-${c.ws.seekMs}-${c.ws.overlapMs}`
      : "";
    const eq = Object.values(c.eq).some(Boolean) ? "_voice" : "";
    return `${stem}_${c.level ? "leveled_" : ""}${speed}${ws}${eq}${c.bits === "mp3" ? "_VBR.mp3" : `_${c.bits}bit.wav`}`;
  }
  function process(type, startOverride) {
    if (busy || !meta || !worker) return;
    const error = valid();
    if (error) {
      status(error, true);
      return;
    }
    const analysis = type === "formant" || type === "formantCandidate";
    const analysisStart =
      startOverride ??
      ($("formantManual").checked
        ? Number($("formantPosition").value)
        : currentAnalysisPosition());
    if (type === "preview") clearPreview();
    else if (!analysis) {
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
    if (type === "formant") {
      $("formantPosition").value = analysisStart.toFixed(2);
      clearFormant();
    }
    stopFormant();
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
          : analysis
            ? "formantWorking"
            : "measure",
    );
    worker.postMessage({
      type,
      config: config(),
      start: analysis ? analysisStart : Number($("start").value) || 0,
    });
  }
  $("analyzeFormant").onclick = () => process("formant");
  $("formantNext").onclick = () => process("formantCandidate");
  $("formantNextRange").onclick = () => {
    if (formantData?.nextStart != null)
      process("formant", formantData.nextStart);
  };
  $("formantPosition").oninput = () => {
    clearFormant();
    locks();
  };
  $("formantManual").onchange = () => {
    if ($("formantManual").checked)
      $("formantPosition").value = currentAnalysisPosition().toFixed(2);
    clearFormant();
    locks();
  };
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
  function selectAB(next, keep = true, autoplay = false) {
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
      if (autoplay || (playing && keep))
        player.play().catch((error) => {
          if (request !== abToken || error.name === "AbortError") return;
          status("previewAutoplayBlocked");
        });
    };
    player.load();
    $("a").setAttribute("aria-pressed", String(next === "a"));
    $("b").setAttribute("aria-pressed", String(next === "b"));
  }
  $("a").onclick = () => {
    activeMainPlayer = "preview";
    selectAB("a");
  };
  $("b").onclick = () => {
    activeMainPlayer = "preview";
    selectAB("b");
  };
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

  function currentAnalysisPosition() {
    if (activeMainPlayer === "preview" && urls.a && spectrumData)
      return Math.min(
        meta.length / meta.sampleRate,
        spectrumData.start +
          $("player").currentTime * (mode === "b" ? ratio : 1),
      );
    const player = $("fullPlayer");
    return player.readyState && !player.seeking
      ? player.currentTime * playbackScale()
      : fullPosition;
  }
  function stopFormant() {
    formantWantPlay = false;
    $("formantPlayer").pause();
    cancelAnimationFrame(formantAnimation);
    formantPlaybackUI();
  }
  function clearFormant() {
    stopFormant();
    formantToken++;
    formantData = formantAudio = null;
    formantMode = "b";
    $("formantPlayer").removeAttribute("src");
    $("formantPlayer").load();
    revoke("formantA");
    revoke("formantB");
    analysisUI();
  }
  function installFormantResult(message) {
    stopFormant();
    formantToken++;
    revoke("formantA");
    revoke("formantB");
    formantData = message.data;
    formantAudio = message.audio
      ? { ...message.audio, a: undefined, b: undefined }
      : null;
    if (message.audio) {
      urls.formantA = URL.createObjectURL(message.audio.a);
      urls.formantB = URL.createObjectURL(message.audio.b);
      selectFormantMode(formantMode, false);
    } else {
      $("formantPlayer").removeAttribute("src");
      $("formantPlayer").load();
    }
    analysisUI();
  }
  function formantDescription() {
    if (!formantData) return t("formantEmpty");
    const range = `${t("formantRange")}: ${formantData.searchStart.toFixed(2)}–${formantData.searchEnd.toFixed(2)} s`;
    if (formantData.unavailable)
      return `${range} · ${t(formantData.unavailable)}`;
    return `${range} · ${t("formantCandidate")}: ${formantData.candidateIndex + 1}/${formantData.candidateCount}${formantData.candidateIndex === 0 ? " · " + t("formantLargest") : ""}\n${t(formantData.reference)} · ${t("formantTimes")}: ${formantData.sourceTime.toFixed(3)} → ${formantData.outputTime.toFixed(3)} s${formantData.bypass ? " · " + t("formantBypass") : ""}`;
  }
  function formantPlaybackUI() {
    $("formantPlay").textContent = t(formantWantPlay ? "pause" : "formantPlay");
    $("formantA").setAttribute("aria-pressed", String(formantMode === "a"));
    $("formantB").setAttribute("aria-pressed", String(formantMode === "b"));
    $("formantListen").hidden = !formantAudio;
    if (!formantAudio) return;
    const duration =
      formantMode === "a" ? formantAudio.durationA : formantAudio.durationB;
    const center =
      formantMode === "a" ? formantAudio.centerA : formantAudio.centerB;
    const half = formantAudio.windowMs / 2000,
      start = Math.max(0, center - half),
      end = Math.min(duration, center + half);
    const current = Math.min(duration, $("formantPlayer").currentTime || 0);
    $("formantSeek").max = duration;
    $("formantSeek").value = current;
    $("formantWindow").style.left = (100 * start) / duration + "%";
    $("formantWindow").style.width = (100 * (end - start)) / duration + "%";
    $("formantCursor").style.left = (100 * current) / duration + "%";
    $("formantListenInfo").textContent =
      `${current.toFixed(2)} / ${duration.toFixed(2)} s · ${t("formantWindow")}: ${start.toFixed(3)}–${end.toFixed(3)} s · ${t("formantLevelMatched")}`;
  }
  function tickFormant() {
    formantPlaybackUI();
    if (formantWantPlay) formantAnimation = requestAnimationFrame(tickFormant);
  }
  async function startFormantPlayback() {
    const request = formantToken;
    try {
      await $("formantPlayer").play();
      if (request !== formantToken || !formantWantPlay) return;
      cancelAnimationFrame(formantAnimation);
      tickFormant();
    } catch (e) {
      if (request === formantToken && e.name !== "AbortError") {
        stopFormant();
        status("playbackError", true);
      }
    }
  }
  function selectFormantMode(next, keep = true) {
    if (!formantAudio) return;
    const player = $("formantPlayer"),
      playing = formantWantPlay;
    const oldCenter =
      formantMode === "a" ? formantAudio.centerA : formantAudio.centerB;
    const delta =
      (player.currentTime - oldCenter) * (formantMode === "a" ? 1 : ratio);
    const newCenter =
      next === "a" ? formantAudio.centerA : formantAudio.centerB;
    const request = ++formantToken;
    player.pause();
    formantMode = next;
    player.src = urls[next === "a" ? "formantA" : "formantB"];
    player.onloadedmetadata = () => {
      if (request !== formantToken) return;
      player.currentTime = keep
        ? Math.max(
            0,
            Math.min(
              player.duration - 0.001,
              newCenter + delta / (next === "a" ? 1 : ratio),
            ),
          )
        : 0;
      if (formantWantPlay) startFormantPlayback();
      formantPlaybackUI();
    };
    player.load();
    formantWantPlay = playing;
    formantPlaybackUI();
  }
  $("formantPlay").onclick = () => {
    if (!formantAudio || busy) return;
    if (formantWantPlay) {
      stopFormant();
      return;
    }
    $("player").pause();
    stopFull();
    if ($("formantPlayer").ended) $("formantPlayer").currentTime = 0;
    formantWantPlay = true;
    formantPlaybackUI();
    startFormantPlayback();
  };
  $("formantA").onclick = () => selectFormantMode("a");
  $("formantB").onclick = () => selectFormantMode("b");
  $("formantSeek").oninput = () => {
    if ($("formantPlayer").readyState)
      $("formantPlayer").currentTime = Number($("formantSeek").value);
    formantPlaybackUI();
  };
  $("formantPlayer").onended = stopFormant;
  $("formantPlayer").onerror = () => {
    if (formantAudio) {
      stopFormant();
      status("playbackError", true);
    }
  };

  function wsState() {
    $("wsState").textContent = t(
      Math.abs(ratio - 1) < 1e-8 ? "wsBypass" : "wsActive",
    );
  }
  function analysisUI() {
    const spectrumText = !spectrumData
      ? t("spectrumEmpty")
      : spectrumData.unavailable
        ? t(spectrumData.unavailable)
        : `${t("spectrumRange")}: ${time(spectrumData.start)}–${time(spectrumData.start + spectrumData.duration)} · ${t("spectrumSampling")}`;
    $("spectrumInfo").textContent = spectrumText;
    $("formantInfo").textContent = formantDescription();
    $("formantInfo").dataset.searchStart = formantData?.searchStart ?? "";
    $("formantInfo").dataset.candidateIndex = formantData?.candidateIndex ?? "";
    $("analyzeFormant").textContent = t(
      $("formantManual").checked ? "analyzeFormantManual" : "analyzeFormant",
    );
    $("formantPosition").setAttribute("aria-label", t("formantPosition"));
    $("formantSeek").setAttribute("aria-label", t("formantSeek"));
    formantPlaybackUI();
    for (const [id, data, label] of [
      ["spectrumCanvas", spectrumData, "spectrumTitle"],
      ["formantCanvas", formantData, "formantTitle"],
    ]) {
      $(id).setAttribute("aria-label", t(label));
      $(id).dataset.state = data
        ? data.unavailable
          ? "unavailable"
          : "ready"
        : "empty";
      drawSpectrum($(id), data);
    }
  }
  function drawSpectrum(canvas, data) {
    const width = canvas.clientWidth;
    if (!width) return;
    const height = canvas.clientHeight,
      dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const left = 40,
      right = width - 14,
      top = 24,
      bottom = height - 32;
    const max =
      data?.frequencies?.at(-1) ||
      (canvas.id === "formantCanvas" ? 6000 : 20000);
    const x = (f) =>
      left + (Math.log(f / 40) / Math.log(max / 40)) * (right - left);
    const y = (v) =>
      top + (Math.min(60, Math.max(0, -v)) / 60) * (bottom - top);
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.fillStyle = "#9cacc0";
    ctx.strokeStyle = "#2a394b";
    ctx.lineWidth = 1;
    ctx.fillText(t("relativeDb"), 7, 13);
    for (const v of [0, -20, -40, -60]) {
      ctx.beginPath();
      ctx.moveTo(left, y(v));
      ctx.lineTo(right, y(v));
      ctx.stroke();
      ctx.fillText(String(v), 9, y(v) + 3);
    }
    let lastX = -100;
    for (const f of [100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
      if (f > max || x(f) - lastX < 32) continue;
      ctx.beginPath();
      ctx.moveTo(x(f), top);
      ctx.lineTo(x(f), bottom);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText(f >= 1000 ? f / 1000 + "k" : String(f), x(f), bottom + 14);
      lastX = x(f);
    }
    ctx.textAlign = "right";
    ctx.fillText(t("frequencyHz"), right, height - 3);
    ctx.textAlign = "left";
    if (!data || data.unavailable) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();
    for (const [values, color, line] of [
      [data.before, "#abb5c6", 2.5],
      [data.after, "#59d5d8", 1.5],
    ]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = line;
      ctx.beginPath();
      values.forEach((v, i) =>
        i
          ? ctx.lineTo(x(data.frequencies[i]), y(v))
          : ctx.moveTo(x(data.frequencies[i]), y(v)),
      );
      ctx.stroke();
    }
    ctx.restore();
  }
  const analysisObserver = new ResizeObserver(() => analysisUI());
  analysisObserver.observe($("spectrumCanvas"));
  analysisObserver.observe($("formantCanvas"));
  $("wsDetails").addEventListener("toggle", analysisUI);
  $("previewDetails").addEventListener("toggle", analysisUI);

  translate();
  locks();
  draw();
})();
