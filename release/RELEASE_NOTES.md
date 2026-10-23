# Narration Tempo v__APP_VERSION__

## v0.1.5：フォルマント分析の自動探索と試聴

- 最後に操作した全体／プレビューの再生位置から、先の最大10秒を探索。開始位置の手入力は任意に変更。
- 音量・周期性・発声の安定性で候補を選別し、近接3窓で確認した包絡の差が大きい順に表示。抽出候補内の比較で、全体の最大差や音質スコアではありません。
- 分析ボタン横に前後A/B試聴、シーク、分析50 msの位置表示を追加。周囲の最大1.6秒（原音換算）を実音から切り出して音量をそろえます。
- 「次の候補」「次の10秒を探索」、候補番号・実際の分析位置・比較元の表示を追加。
- 全体変換済み／プレビューの実音を優先して再利用。単独分析も最大36秒の局所範囲だけを参照します。
- 日英UI・ヒント・マニュアルと回帰テストを更新。音声処理・保存形式・ライブラリは変更していません。

## v0.1.4：速度詳細設定と音色の比較

- WSOLAの操作項目を処理区間・探索範囲・つなぎの3項目に整理。1倍では設定を無効にし、速度変換をバイパス。
- 30秒プレビューに、原音／最終処理後の音量をそろえた平均スペクトルを追加。
- 詳細設定内に、同じ発声付近のWSOLA直前／直後のスペクトル包絡比較を追加。全体結果・プレビューがなければ周辺だけを処理。
- 実際のWSOLA接続位置を記録して比較位置を対応付け。F1〜F3の自動検出や音質判定は行いません。
- 日英UI、ツールチップ、マニュアルを更新。再生・保存の音には分析処理の影響を加えません。


## v0.1.3 の変更

- 速度変更で末尾の音が欠ける問題を修正。指定の出力長を維持し、最終区間を原音の終端に合わせます。
- 接続位置の粗探索で最大6候補を残し、基準位置を含め全サンプルで精密評価するよう改善。
- 短い音源の窓長を調整し、末尾・候補品質の回帰テストを追加。
- マニュアルと日英ヒントを更新。「比較の間引き」は粗探索だけに作用します。
- 1倍のバイパス、左右共通の接続位置、単一HTML・オフライン動作を維持。

## v0.1.2 の変更

- 詳細ユーザーマニュアル（HTML／Markdown）と画面からのリンクを追加。
- 初期速度を1.000倍に変更。1倍時は既存の速度変換バイパスを使用。
- 30秒プレビュー完了後に処理後の音を自動再生。
- 各操作に日英のマウスオーバーヒントを追加。

`narration-tempo-__APP_VERSION__-user.zip` を展開し、`index.html` をChromeで開いてください。
単一HTML・ローカル処理・サーバー不要。レベラー、速度調整、区間プレビュー、原音／処理後の再生とシーク、WAV／MP3保存に対応しています。

v0.1.1では、公開用フォルダと利用者向けZIPの起動ファイル名を `index.html` に統一しました。
GitHub Pagesでは、公開用フォルダの中身をリポジトリのルートへ配置し、Settings → Pagesで公開ブランチと / (root) を指定してください。

アプリ本体はMIT、MP3エンコーダーはLGPL-3.0です。
利用者向けZIPにはライセンス本文とNarration Tempo固有の変更・再結合用補助ファイルを添付しています。

**対応ソース（Browser Media I/O v0.5.0）:**
[browser-media-io-sources-0.5.0.zip](https://github.com/cityedge/browser-media-i-o/releases/download/v0.5.0/browser-media-io-sources-0.5.0.zip)
（[Releaseページ](https://github.com/cityedge/browser-media-i-o/releases/tag/v0.5.0)）

SHA-256: `ea4637dbbc8d44b7d46d8a04647867ce92f47775c8bca69f21a955b653e4db11`

ソース取得・再ビルド・ライブラリ差し替え方法は、利用者向けZIPの `SOURCES.md` を参照してください。

Extract the user ZIP and open the HTML in Chrome. The application is MIT; its MP3 encoder is LGPL-3.0.
The exact upstream corresponding source is linked above. Application-specific changes and relinking instructions
are included in the user ZIP. No source download or development tools are required to use the app.
