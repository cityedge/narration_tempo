# 対応ソースと再ビルド / Corresponding source and rebuilding

利用時は `index.html` を開くだけです。以下は改変・再配布する開発者向けです。
Using the app only requires opening `index.html`. The following is for developers.

## アプリ / Application

必要環境: Node.js 22.12以降。以下のコマンドはこの文書のあるフォルダで実行します。
Requires Node.js 22.12 or later. Run commands in this application's root folder.

```sh
node build.mjs
```

`src/` と `vendor/browser-mp3.js` から単一HTMLを生成します。これだけならnpmのインストールも不要です。
This embeds `src/` and `vendor/browser-mp3.js` into a single HTML file; no npm install is needed.

## MP3ライブラリ / MP3 library

```sh
npm ci --prefix vendor/mp3-source
node vendor/rebuild.mjs
node build.mjs
```

依存ツールを初回インストールする際はネット接続が必要です。
以降のライブラリ・HTMLビルドは同梱ソースだけを使い、上流Gitへのアクセスは不要です。
Windowsでは標準の `tar`、その他の環境では `tar` コマンドが必要です。
Development-tool installation needs network access initially. Subsequent builds use the included sources;
no upstream Git checkout is required. A `tar` command is required (included with current Windows).

| ファイル / File | 役割 / Purpose |
| --- | --- |
| `vendor/mp3-async.ts` | MITラッパーの変更済みソース / modified MIT wrapper |
| `vendor/mp3-source/src/` | ラッパーの依存ソースとWorker / wrapper helpers and worker |
| `vendor/mp3-source/third_party/lamejs/source.tar.gz` | 未変更の固定リビジョンのソース / pinned unmodified upstream source |
| `vendor/mp3-source/third_party/lamejs/extensions/` | LGPLのVBR/ABR変更 / LGPL VBR and ABR modifications |
| `vendor/mp3-source/scripts/prepare-lamejs.mjs` | ソース展開と明示的パッチ / source extraction and explicit patches |
| `vendor/mp3-source/build.mjs` | MP3専用バンドルの生成 / MP3-only bundling |
| `vendor/mp3-source/package-lock.json` | ビルドツールの固定 / pinned build tools |

元ソースアーカイブのSHA-256:
`9db4f8798baf8f667a5aea687bad4b30cae0663e69064675ec7f9882074eb55d`

ライブラリを改変する場合はラッパー、拡張コード、またはパッチスクリプトを編集して上記を実行します。
元アーカイブを改変する場合は、変更履歴を記録し、`prepare-lamejs.mjs` のハッシュ検査も更新してください。
`vendor/mp3-source/src/mp3.ts` は `vendor/mp3-async.ts` から生成されるため、直接編集しません。
別の互換実装を使う場合は `vendor/browser-mp3.js` を置き換え、`node build.mjs` で再結合できます。

To modify the library, edit the wrapper, extensions or patch script and rebuild. If replacing the base
archive, record the changes and update its hash check in `prepare-lamejs.mjs`. The generated
`vendor/mp3-source/src/mp3.ts` is overwritten from `vendor/mp3-async.ts`.
A compatible replacement `vendor/browser-mp3.js` can also be embedded by running `node build.mjs`.

## テスト / Tests

```sh
npm ci
npx playwright install chromium
npm test
```

ブラウザ検証はネット遮断状態でHTMLをメモリへ読み込んで実行し、サーバーを起動しません。
合成テスト音源は `tests/tmp/` に生成します。`tests/fixtures/wsola-v1.2.js` は作者提供のMVPから
処理部分だけを取り出したMITの比較用固定コードです。引き継ぎ書や旧アプリの全文は不要です。
Browser tests use offline Chromium with in-memory HTML, without a server. Synthetic media is generated
under `tests/tmp/`. The frozen WSOLA reference is an MIT DSP excerpt of the author's earlier MVP.

## 配布 / Distribution

```sh
npm run package
```

Windows PowerShellで、`dist/` に次の配布物を作成します。

- `narration-tempo-<version>-user.zip`: HTML、利用者向け文書、ライセンス、`source-support/` の小さな補助ファイル。
- `narration-tempo-repository/`: GitHub公開用の開発ファイル。上流の対応ソースもローカルに保持しますが、利用者向けZIPには入れません。
- `RELEASE_NOTES.md`: GitHub Releaseへ貼る本文。アプリ取得先の隣に掲載する、上流対応ソースのリンクを含みます。
- `SHA256SUMS`: 利用者向けZIPのハッシュ。

利用者向けZIPの上流ソース取得先は [Browser Media I/O v0.5.0 Release](https://github.com/cityedge/browser-media-i-o/releases/tag/v0.5.0) の
[browser-media-io-sources-0.5.0.zip](https://github.com/cityedge/browser-media-i-o/releases/download/v0.5.0/browser-media-io-sources-0.5.0.zip) です。
アプリを配布する間、この資産を追加料金なしで取得できる状態に保ちます。Releaseページだけではなく、実際の対応ソースZIPを維持してください。
Narration Tempo固有の非同期PCM変更と再結合スクリプトは利用者向けZIPに残します。
利用者側の再ビルド手順の原稿は [release/SOURCES.md](release/SOURCES.md) です。

Only the user ZIP needs to be attached as the application's release asset. It contains the HTML, documents,
licenses and small application-specific rebuild support files. The exact upstream source is provided separately
by the existing v0.5.0 source asset linked above. Keep that asset available and put the source link next to the
app download; the generated `RELEASE_NOTES.md` supplies that text. The repository directory is for development,
not part of the user ZIP. No user recordings, installed tools, handover documents or old applications are packaged.

アプリのバージョンは `package.json` を単一の管理元として、HTMLの画面・タイトル・メタデータ、ZIP名、配布文書へ反映します。
The version in `package.json` is embedded into the UI, page title, HTML metadata, archive name and release documents.
