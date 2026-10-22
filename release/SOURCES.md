# 対応ソースの取得と再ビルド / Source access and rebuilding

対象: **Narration Tempo v__APP_VERSION__** / Browser Media I/O **v0.5.0**。
この手順は開発者向けです。アプリの通常利用にソースの取得やNode.jsは不要です。
For developers only. Running the app does not require source downloads or Node.js.

## 元ライブラリの対応ソース / Exact upstream source

- [v0.5.0 Releaseページ / Release page](https://github.com/cityedge/browser-media-i-o/releases/tag/v0.5.0)
- [browser-media-io-sources-0.5.0.zip（対応ソース）](https://github.com/cityedge/browser-media-i-o/releases/download/v0.5.0/browser-media-io-sources-0.5.0.zip)
- [上流のSHA256SUMS](https://github.com/cityedge/browser-media-i-o/releases/download/v0.5.0/SHA256SUMS)

ソースZIPのSHA-256 / Source ZIP SHA-256:
`ea4637dbbc8d44b7d46d8a04647867ce92f47775c8bca69f21a955b653e4db11`

固定リビジョン / Pinned revision: `b55de4966e9cfd1dc0141adbb708fcfeccc20017`。
このZIPにはLGPLのMP3エンコーダーの元ソース、VBR/ABR変更、ビルドスクリプト、固定依存関係が含まれます。
必要なのは **sources** ZIPです。MP3実行用ZIPやGitHub自動生成の「Source code」への置き換えは避けてください。
The **sources** asset contains the encoder source, VBR/ABR modifications, build scripts and lockfile.
Use that asset rather than the MP3 runtime ZIP or GitHub's automatically generated source download.

## Narration Tempo側の変更 / Application-specific changes

アプリ固有のHTML・CSS・JavaScriptは `Narration_Tempo.html` 内に非圧縮で含まれています。
元ライブラリに追加した非同期PCM読み込みAPIのソースは [source-support/mp3-async.ts](source-support/mp3-async.ts)、
再ビルドとHTMLへの再結合は [source-support/rebuild-mp3.mjs](source-support/rebuild-mp3.mjs) に含まれます。
これらの追加部分はMITです。エンコーダー自体はv0.5.0から変更していません。

The application's HTML/CSS/JavaScript is included unminified in `Narration_Tempo.html`.
The additional asynchronous PCM reader is supplied as `source-support/mp3-async.ts`, with a rebuild/relink script.
These application-specific additions are MIT; the LGPL encoder is unchanged from v0.5.0.

## 再ビルド / Rebuild

Node.js 22.12以降と `tar` を使用します。ダウンロードしたソースZIPを作業用フォルダへ展開します。
以下は、この利用者向けZIPとソースZIPを隣同士のフォルダに展開した例です。
ソース側の `package.json` があるフォルダを指定してください。

Requires Node.js 22.12+ and `tar`. Extract the upstream source ZIP into a working copy.
From the user ZIP directory, run the following (adjust the path to the upstream folder containing `package.json`):

```sh
npm ci --prefix ../browser-media-io-sources-0.5.0
node source-support/rebuild-mp3.mjs ../browser-media-io-sources-0.5.0
```

結果は `Narration_Tempo.rebuilt.html` に保存します。元のHTMLは上書きしません。
補助スクリプトは、上流作業コピーの `src/mp3.ts` を同梱のラッパーに置き換えてからビルドします。
ラッパーを変更する場合は `source-support/mp3-async.ts` を編集します。
エンコーダーを変更する場合は、上流の `third_party/lamejs/extensions/` や
`scripts/prepare-lamejs.mjs` を編集して同じコマンドを実行します。
元の `source.tar.gz` を変更する場合は、そのスクリプトのハッシュ検査も更新してください。

The script writes `Narration_Tempo.rebuilt.html` without overwriting the original HTML. It replaces the upstream
working copy's `src/mp3.ts` with the supplied wrapper before building. Edit the supplied wrapper for wrapper changes;
edit the upstream encoder extensions or preparation script for encoder changes. If modifying the base source archive,
also update its hash check. No signing key is required. The resulting app still works offline as one HTML file.

## 配布する方へ / For distributors

アプリをダウンロード配布する間、上記v0.5.0の **対応ソースZIPを追加料金なしで取得可能な状態** に保ってください。
Releaseページだけを残してソース資産を削除・差し替えないでください。
アプリのダウンロードページ（Release本文など）にも、この対応ソースへのリンクを明示してください。
このZIPのライセンス文書、変更ラッパー、再結合スクリプトを維持すれば、上流ソース一式の重複同梱は不要です。
将来ライブラリを更新・変更する場合は、その配布物に対応するソース案内も更新します。

Keep the exact source asset accessible at no additional charge while distributing the app. Retaining only an empty
Release page is insufficient. Put a clear link to the corresponding source next to the app download, such as in its
Release description. Preserve the notices, modified wrapper and relinking script in this ZIP. If the library changes,
update the source provision to match. LGPLv3 section 4(d)(0) and GPLv3 section 6(d) describe this distribution method.
