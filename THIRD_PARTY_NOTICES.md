# ライセンスと同梱コンポーネント / Licenses and bundled components

**Narration Tempoのアプリ本体はMITライセンスです。同梱MP3エンコーダーはLGPL-3.0です。**
MITの適用対象はアプリ固有のソース、UI、文書、ビルド・テストコードです。
第三者の著作物をMITへ変更するものではありません。生成された単一HTMLには両方が含まれます。

**The Narration Tempo application is MIT licensed. Its bundled MP3 encoder remains LGPL-3.0.**
The application license does not relicense third-party code. The generated HTML is a combined distribution.

| コンポーネント / Component | ライセンス / License | 著作権者・出典 / Authors and source |
| --- | --- | --- |
| Narration Tempo application | MIT | Copyright (c) 2026 cityedge; [LICENSE](LICENSE) |
| Browser Media I/O 0.5.0 MP3 wrapper | MIT | Copyright (c) 2026 cityedge; [license](vendor/LICENSE-MIT.md) |
| Modified @breezystack/lamejs 1.2.7 encoder | LGPL-3.0 | Alex Zhukov, the LAME project and fork contributors; individual notices are retained in the source archive |

## MP3エンコーダー / MP3 encoder

Browser Media I/O revision: [`b55de4966e9cfd1dc0141adbb708fcfeccc20017`](https://github.com/cityedge/browser-media-i-o/tree/b55de4966e9cfd1dc0141adbb708fcfeccc20017).
Base lamejs revision: [`1fb0ef5fa177413107e2e107d054a9b994e3f79c`](https://github.com/shijinyu/lamejs/tree/1fb0ef5fa177413107e2e107d054a9b994e3f79c).
LAME project: <https://lame.sourceforge.io/>.

- [LGPLv3全文 / full LGPLv3](vendor/COPYING.LESSER)
- [GPLv3全文 / full GPLv3](vendor/COPYING)
- [元パッケージの告知 / original package notice](vendor/LAME-NOTICE.txt)
- [元ラッパーのMIT本文 / wrapper MIT license](vendor/LICENSE-MIT.md)
- [ソースと再ビルド手順 / source and rebuild instructions](SOURCES.md)

LGPLv3はGPLv3に追加の許可を加える構成なので、第4条(b)に従って両方の全文を添付しています。
GPL本文の添付は、アプリ固有のコードをGPLへ変更する意味ではありません。
このアプリは実行画面に著作権告知を表示せず、ライセンス関連の情報はこの文書にまとめています。
将来、実行時の著作権表示を追加する場合はLGPLv3第4条(c)も確認してください。

LGPLv3 incorporates GPLv3 with additional permissions. Both texts accompany the distribution under
LGPLv3 section 4(b); their inclusion does not change the application's MIT license.
Copyright notices are supplied in these documents and source files, not in the running UI.
If runtime copyright notices are added later, also observe LGPLv3 section 4(c).

## 変更とソース / Modifications and source

Browser Media I/Oの2026-10-18の変更は、JavaScript VBR/ABRループ、休眠経路の修正、
オプションとエラー処理です。LAME/lamejs由来の変更部分はLGPLのままです。
Narration Tempoでは2026-10-22にMITラッパーへ非同期PCMブロック読み込みを追加しました。
エンコーダーの処理は追加変更していません。

Upstream encoder modifications dated 2026-10-18 add JavaScript VBR/ABR loops and fix dormant paths,
options and error handling. LAME-derived changes retain LGPL terms.
Narration Tempo's 2026-10-22 modification adds asynchronous PCM reads to the MIT wrapper.
The encoder algorithm is unchanged from that upstream revision.

上流の対応ソースは [v0.5.0のソースZIP](https://github.com/cityedge/browser-media-i-o/releases/download/v0.5.0/browser-media-io-sources-0.5.0.zip) から取得できます。
利用者向けZIPの `source-support/` には、Narration Tempo固有の変更ラッパーと再結合スクリプトを添付しています。
開発用リポジトリでは `vendor/mp3-async.ts` と `vendor/mp3-source/` にもビルド入力を保持しています。
利用者向けZIPは上流ソース一式を重複収録しません。取得方法・対応バージョン・再ビルド手順は `SOURCES.md` を参照してください。
改変したライブラリでHTMLを再生成でき、署名鍵や実行時のネット接続は必要ありません。
再配布では文書、ライセンス本文、対応ソース、再結合に必要なアプリのコードを維持してください。

Upstream corresponding source is available from the exact v0.5.0 source ZIP linked above.
The user ZIP includes the application-specific modified wrapper and relinking script in `source-support/`.
The development repository also retains build inputs in `vendor/mp3-source/` and `vendor/mp3-async.ts`.
See `SOURCES.md` for exact source access and rebuild instructions. Modified libraries
can be rebuilt and recombined with the application; no signing key or runtime network access is required.
Preserve these notices, license texts, corresponding source and application build inputs when redistributing.

このMP3専用バンドルにはMediabunny、AAC、FFmpegは含まれません。
Node.js、TypeScript、esbuild、Playwright、テスト用FFmpegは開発用で、アプリには同梱しません。
No Mediabunny, AAC or FFmpeg runtime is bundled. Development tools retain their own licenses
and are not included in the app or release ZIP.
