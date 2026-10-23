# Narration Tempo

長尺ナレーションの音量差を整え、声の高さを保って速度を変え、WAV／MP3として保存するローカルアプリです。
`index.html` をChromeで開いて使用します。動作するアプリは単一HTMLです。サーバー、インターネット、Python、Node.js、追加インストールは利用時に不要です。

**アプリ本体はMIT、同梱MP3エンコーダーはLGPL-3.0です。** 詳細は [LICENSE](LICENSE) と [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。利用者向けZIPには文書・ライセンスとアプリ固有の小さな補助ファイルを添付し、元ライブラリのソースはv0.5.0 Releaseから別途取得する方式です。ライセンス本文をアプリ画面に表示する機能はありません。

Offline narration leveling and pitch-preserving tempo adjustment, with WAV and MP3 export. Open `index.html` in Chrome; no server, internet connection or installation is required. Switch the UI to English in the upper-right corner. The application is MIT licensed; the bundled MP3 encoder remains LGPL-3.0. The user ZIP contains notices, licenses and application-specific rebuild support; upstream source is available separately from the v0.5.0 Release. See [SOURCES.md](SOURCES.md) for building and redistribution.

アプリのバージョンは `package.json` の `version` で管理し、ビルド時に画面、ページタイトル、HTMLのメタデータへ自動で埋め込みます。現在は **v0.1.5** です。

## GitHub Pagesで公開する場合

`narration-tempo-repository/` の中身をリポジトリのルートに配置します。ビルド済みの `index.html` と `.nojekyll` を含むので、GitHub上でNode.jsのビルドは不要です。

GitHubの **Settings → Pages → Build and deployment** で、**Deploy from a branch** を選び、公開するブランチ（例: `main`）と **/ (root)** を指定して保存します。公開URLはPages画面に表示されます。

`src/index.html` はビルド前のテンプレートです。配置するのは公開用フォルダ直下の `index.html` です。利用者向けZIPも `index.html` をローカルで開く仕様です。旧ローカル名 `Narration_Tempo.html` はビルド時に同じ内容を生成しますが、配布物には含めません。

For GitHub Pages, upload the contents of `narration-tempo-repository/` to the repository root, including the built `index.html` and `.nojekyll`. In Settings → Pages, select Deploy from a branch, your publishing branch (for example `main`), and / (root). No build on GitHub is needed. Use the published URL shown there.

詳しい操作・各設定・EQ・制限・トラブル対処は [ユーザーマニュアル](USER_GUIDE.html) を参照してください（[Markdown版](USER_GUIDE.md)）。

## 使い方

1. 上部左のエリアでWAVまたはMP3を選択・ドロップします。音量変化を全体解析し、右のステータス欄に進捗を表示します。横幅は約30%／70%で、狭い画面では縦に並びます。
2. 「音声全体」の再生ボタンで原音を聴けます。波形のクリック／ドラッグ、下のシークバー、波形にフォーカスして左右キー（5秒）、Home/Endで移動できます。停止は再生を開始した位置に戻ります。
3. 速度倍率、または仕上がりの分・秒を指定します。レベラーは初期ONです。音声補正3種類は初期OFFで、組み合わせて使えます。
4. 「全体変換」を押します。この時点ではダウンロードしません。完成した音声をアプリ内に保持します。
5. 「音声全体」の原音／処理後を切り替えて、好きな位置から比較します。切り替え時は倍率に応じて発話位置を合わせます。設定を変えると処理後の音は無効になり、再度全体変換が必要です。
6. 出力形式を選んで「保存」します。24bit WAV、TPDFディザ付き16bit WAV、MP3 VBR Q3に対応。出力形式だけの変更では全体変換をやり直しません。保存先はブラウザの設定に従います。

差分波形は、原音と処理後の振幅包絡を発話位置に合わせて比較します。両方に共通する領域はグレー、原音より増えた外側は緑、減った領域は赤です。音声信号同士の差分ではありません。

補助機能として「30秒プレビュー」を展開できます。選択位置から原音30秒分を対象にし、作成後はプレビュー欄の「B 処理後」が選ばれ、自動再生します。速度変更後のBの長さは倍率に応じて変わります。A/B切り替えは倍率に応じて再生位置を対応させます。全体再生との同時再生は行いません。

全体変換前は、選択区間と前後最大12秒の補正用余白だけを処理します。ファイル冒頭から試聴位置までの速度変換や、全体ラウドネス計測は行いません。EQなしのレベラーは読み込み時の解析カーブを利用し、EQありの場合は周辺区間で補正カーブを求めます。ラウドネスは試聴区間から推定するため、全体変換後の音量・境界の処理と完全には一致しません。

同じ設定で全体変換済みなら、保持した完成音声の対応区間をそのまま切り出します。この場合は再度のEQ・レベラー・速度調整・音量調整を行いません。プレビューは全体波形の色、全体ラウドネス値、全体の処理後再生・保存の可否を更新しません。全体波形の着色と処理後再生は「全体変換」の完了後に有効になります。

速度の初期値は1.000倍（速度変換をバイパス）、範囲は0.700～1.300倍です。時間指定では表示倍率が丸まっても計算精度を維持します。WSOLA詳細設定は同じ画面内で展開できます。前回設定の永続保存、バッチ、無音削除はありません。

30秒プレビューには、音量差を除いた原音／処理後の平均スペクトルを表示します。WSOLA詳細設定は「処理区間の長さ」「接続位置の探索範囲」「つなぎの長さ」の3項目です。その下のフォルマント分析では、再生位置から先の10秒を探索し、安定した候補の中で差が大きい発声のWSOLA直前／直後のスペクトル包絡を重ねます。「試聴」でその周囲を音量をそろえてA/B比較でき、「次の候補」「次の10秒」で確認を進められます。F1〜F3の自動検出や音質判定ではありません。詳細・比較対象・計算方法はマニュアルの9〜10節を参照してください。

The preview includes a level-matched average spectrum. Advanced WSOLA exposes three timing controls and a separate spectral-envelope comparison before/after WSOLA. It searches up to 10 seconds ahead of the last-used playhead for stable voiced candidates, shows the largest sampled difference, and provides level-matched A/B listening and candidate navigation. It is an approximate view of vocal resonance, not automatic F1–F3 detection or a quality score.

## 処理

`入力 → 音声補正（任意） → レベラー → WSOLA速度調整 → 全体ゲイン調整 → Float32音声を保持 → 試聴／WAV・MP3保存`

音声補正は固定パラメーターの穏やかなEQです。「低音を整理」は75 Hz・12 dB/octのハイパス、「こもりを低減」は320 Hz・Q 0.8・−2.5 dB、「明瞭さを追加」は3.5 kHz・Q 0.8・＋2 dBです。低サンプルレートでは中心周波数を調整します。フィルターの状態を区間境界に記録し、WSOLAの読み戻しでも連続性を維持します。ノイズ除去やディエッサーではありません。

レベラーは初期EMSの基本アルゴリズムを参考にした独立実装です。旧UIや状態管理は移植していません。0.5秒のピーク解析窓を0.1秒間隔で評価し、−6 dBFSを基準に補正カーブを作成します。増幅＋6 dB／減衰−24 dBを上限に、4秒のトゲ除去、4秒のメディアン、12秒の平滑化、毎秒1 dBの変化制限を行い、残った飛び出しを追加で抑えます。左右には共通のカーブを適用します。

非常に小さな区間や大きなレベル差は、増幅上限により完全には均一になりません。無音検出・ノイズ除去は行いません。原音の抑揚、ノイズ、息の聴感を実音源で確認してください。

WSOLAはMVPを基に、v0.1.3で末尾保護と候補評価を改善しました。粗探索から最大6か所の候補領域と基準位置を選び、それぞれの周辺を1サンプル刻み・全サンプル相関で精密評価します。最後の区間は原音の終端へ合わせ、末尾の欠落・減衰・二重再生を防ぎます。左右共通の位置選択と線形クロスフェードは維持しています。速度変更時の出力は旧MVPとバイト一致しません。中間音声と保持する完成音声はFloat32 PCMです。16bit WAVは保存時に一度だけTPDFディザ（±1 LSB、2 LSB peak-to-peak）を加えて量子化します。24bit WAVにはディザを加えません。MP3は保持音声から直接エンコードし、16bit WAVを中間ファイルにしません。短い入力では窓を縮め、4サンプル未満の入力／出力では端点を補間します。1倍は常にバイパスし、非有限サンプルは除外します。

ラウドネスはK-weightingとゲーティングを用いた参考Integrated LUFSです。速度調整後に、−14 LUFSへ近づけるゲインとサンプルピーク−1 dBFSを守るゲインの小さい方を適用します。厳密な−14 LUFS保証、True Peak制御、追加リミッターはありません。無音は増幅せず、測定不能として表示します。

## 長尺とメモリ

- 入力・出力とも最大72分。超える指定は開始前に案内し、切り捨てません。
- モノラル／ステレオ、8～192 kHz。保持する完成音声はFloat32換算で1.75 GiBまでです。72分・48 kHz・ステレオは収まります。高サンプルレートでは容量上限により最長時間が短くなります。
- WAVはファイルを小分けに読み、各処理段の全体コピーは作りません。標準RIFFのPCM 8/16/24/32bit、float 32/64bit、および対応サブ形式のWAVE_FORMAT_EXTENSIBLEを扱います。原音再生はブラウザ標準のデコーダーを使うため、特殊なWAVの再生対応はブラウザにも依存します。
- MP3はブラウザが全体デコードします。圧縮ファイル128 MiBまで、デコード済みPCM512 MiBまでに制限します。PCM容量の判定はデコード後のため、デコード自体のメモリ確保は必要です。大きいMP3は事前にWAVへ変換して入力してください。
- MP3のサンプルレートは先頭フレームから推定します。判定できない場合は48 kHzでデコードするため、特殊なファイルではリサンプリングが起こり得ます。
- 全体変換は小分けの処理で完成音声のBlobを作って保持します。保存時はこのBlobを窓読みし、再度レベラー・EQ・速度調整を行いません。再生・保存に必要なメモリや一時領域はブラウザが管理します。保存中には保持音声と保存用Blobの両方が存在します。ページを閉じると保持音声は失われます。
- 音声処理はHTML内蔵のWeb Workerで行います。キャンセルは処理の区切りで反映します。MP3エンコードは中止可能です。MP3のブラウザデコード自体は中断できませんが、中止後の結果は破棄します。

## MP3ライブラリ

[Browser Media I/O 0.5.0](https://github.com/cityedge/browser-media-i-o/tree/b55de4966e9cfd1dc0141adbb708fcfeccc20017) の専用MP3モジュールを埋め込んでいます。エンコーダーは変更せず、非同期PCM読み込み関数を受け取る `encodePcmSource` を追加しました。通常の `wavToMp3` に巨大WAVを渡す方法とは異なり、全体のArrayBuffer展開を行いません。エンコード側に渡すのは一度に36,864サンプルです。

標準はVBR Q3です。MP3の対応レート（8 / 11.025 / 12 / 16 / 22.05 / 24 / 32 / 44.1 / 48 kHz）以外は、書き出し時だけ窓付きsincで48 kHzへ変換します。WAVと保持音声のレートは変えません。Xing情報を付加しますが、エンコーダー遅延・パディングがあるためMP3の時間はWAVと厳密には一致しません。

MITラッパーと、LGPL-3.0のmodified lamejsを含みます。告知とライセンス本文は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) と `vendor/` にあります。MP3の対応ソースも同梱し、上流Gitを別途取得せず再ビルドできます。手順は [SOURCES.md](SOURCES.md) を参照してください。

## 開発

- `src/engine.js`：音源の窓読み込み、EQ、レベラー、WSOLA、ラウドネス計測、完成音声の保持、WAV／MP3エンコード、Worker制御
- `src/analysis.js`：表示用FFT・平均スペクトル・包絡推定、WSOLA接続位置の対応付け
- `src/formant.js`：候補の自動探索、比較順位、分析窓と周囲のA/B試聴
- `test-formant-search.mjs`：候補の選別・順位、試聴音の実データ一致、取消・末尾の検証
- `test-analysis.mjs`：分析の音量不変性、既知の山の移動、比較経路、局所処理の検証
- `src/app.js`：ファイル検証、UI状態、言語、試聴とダウンロード
- `src/index.html` / `src/style.css`：1画面構成とダークテーマ
- `build.mjs`：上記を単一HTMLへ埋め込み
- `vendor/`：MP3ライブラリ、変更ラッパー、再ビルド手順、ライセンス
- `test-wsola.mjs`：末尾の保持、短尺・各レート・候補選択品質、左右同期の検証
- `test-dsp.mjs`：1倍の旧MVP互換性、ピーク解析、ディザ、EQ連続性と周波数応答の検証
- `test.mjs`：ネットワーク遮断下のChromiumによる操作・入出力検証

このREADMEのあるフォルダから実行します。利用者がアプリを開くために開発ツールを導入する必要はありません。

```text
npm ci
npx playwright install chromium
npm test
node test.mjs --mp3 --long
node test.mjs --long --long-mp3
node test.mjs --limits
node test.mjs --preview-long
npm run package
```

テストはPlaywrightを使用します。通常のテストにはffmpegは不要です。`--mp3`はテスト音源生成にffmpeg、`--long-mp3`は結果検証にffprobeを使用します（アプリの依存ではありません）。PATHから探すか、`FFMPEG_PATH` / `FFPROBE_PATH` 環境変数で指定します。`--long`は `tests/tmp/` へ約691 MBの合成入力を作成します。

`npm run package` はWindows PowerShellで利用者向けZIPと、開発用リポジトリのフォルダを `dist/` に作成します。ZIPにはアプリ本体、添付文書、MIT／LGPL／GPL本文、Narration Tempo固有のラッパーと再結合スクリプトだけを収録します。上流ソース・開発ツール・テスト一式はZIPに含めません。生成する `RELEASE_NOTES.md` には対応ソースへのリンクがあるので、GitHub Release本文に使用してください。GitHubへの作成・アップロードはこのコマンドでは行いません。

## 検証記録

音声処理・長尺入力・区間プレビューの過去の検証結果は [docs/VALIDATION.md](docs/VALIDATION.md) にあります。
