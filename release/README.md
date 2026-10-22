# Narration Tempo v__APP_VERSION__

長尺ナレーションの音量差を整え、声の高さを保って速度を変え、WAV／MP3として保存するローカルアプリです。

## 起動と使い方

ZIP全体を展開し、`index.html` をChromeで開きます。
アプリは単一HTMLで動作します。サーバー、インターネット、追加インストールは利用時に不要です。

1. WAV／MP3を選択・ドロップします。入力・仕上がりとも最大72分です。
2. 必要に応じて速度と音声補正を設定します。レベラーは初期ONです。
3. 「全体変換」で完成音声を保持し、「音声全体」の原音／処理後を切り替えて再生・シークします。
4. 24bit WAV、ディザ付き16bit WAV、MP3から選び「保存」します。保存先はブラウザ設定に従います。

「30秒プレビュー」は選択位置の区間だけを処理します。全体変換前のラウドネスは区間からの推定です。
目安は−14 LUFSで、厳密なTrue Peak保証はありません。ページを閉じると保持音声は失われます。
画面上部の `v__APP_VERSION__` がアプリのバージョンです。MP3ライブラリのv0.5.0とは別です。

## ライセンスとソース

アプリ本体は [MIT](LICENSE)、同梱MP3エンコーダーはLGPL-3.0です。
詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。
元ライブラリのソース一式はZIPに重複収録せず、[Browser Media I/O v0.5.0 Release](https://github.com/cityedge/browser-media-i-o/releases/tag/v0.5.0) から取得できます。
取得先・照合用ハッシュ・再ビルド方法は [SOURCES.md](SOURCES.md) に記載しています。
`source-support/` はNarration Tempo固有のラッパー変更と再結合用の開発者向け補助ファイルで、通常の利用時には操作不要です。
再配布時は、このZIPの添付文書と補助ファイルを保持してください。

## English

Extract the entire ZIP, then open `index.html` in Chrome. No server, network or installation is required.
Select English at the top. Load WAV/MP3, set tempo and optional voice corrections, convert the full recording,
compare Original/Processed with playback and seeking, then save as 24-bit WAV, dithered 16-bit WAV or MP3.
Input and output are limited to 72 minutes. The 30-second preview processes only the chosen excerpt;
before full conversion its loudness is an estimate. Closing the page discards the retained result.

Application version: **__APP_VERSION__**. The application is MIT licensed; the embedded MP3 encoder remains LGPL-3.0.
The complete upstream source is available from Browser Media I/O **v0.5.0** Releases. See `SOURCES.md` for the exact
download, checksum and rebuild steps. `source-support/` contains only application-specific wrapper changes and
the relinking script; it is not needed to run the app. Preserve the documents and support files when redistributing.
