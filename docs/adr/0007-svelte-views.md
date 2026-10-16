# 0007: Svelte 5で画面を宣言する

日付: 2026-10-05

## 背景

画面ごとのHTML文字列、querySelector、属性代入、イベント配線とJSONによる描き直し判定が、同期モデルの純粋な投影と重複していた。会話・人物詳細・設定入力の構造を再利用しにくく、画面の局所的な変更にもDOM生成と更新の両方を追う必要があった。[0006](0006-synchronous-presentation-models.md)の同期state／意味イベントと実資源所有者は有用で、表示実装だけを標準的な宣言へ移す。

## 判断

通常UI・戦闘HUD・開発エディターはSvelte 5の型付きテンプレートで描く。DOM生成・更新・イベント配線の自作範囲を減らし、表示構造と型・操作を同じ部品で読めるようにする。ReactやSolidも候補としたが、同期モデルへ表示入力を渡す構成と、テンプレート・runes・compilerの標準機能を採用理由とする。

ゲーム・画面判断は同期モデルに残し、commit後にSvelteへ表示入力を渡す。`$state.raw`と`$derived`は表示接続に使い、操作は既存の意味イベントへつなぐ。

戦闘HUDの投影は意味状態の葉を入力とし、毎frame変わるmarker角度・cue時刻と分ける。探索の通常chromeも戦闘時計から分ける。純粋投影は直接状態VRT用の全frameを生成できるが、実行中に毎frame巨大frameを作らない。DOM上の位置・scroll・focus・native dialog、WAAPI、画像完了、canvas・renderer／sceneの寿命はbrowserが持ち、ゲーム状態のcommitと独立した実資源ownerを維持する。

型検査は`svelte-check --tsgo`で安定版TypeScript 7を使う。公式のnpm alias構成に従い、`@typescript/native`へ7系を置き、`typescript`名の6系はSvelte変換のJavaScript API用に残す。native checkerのexperimental APIは使わない。

## 結果

会話・人物画像・設定入力を部品へまとめ、表示構造・型・イベントを同じテンプレートで読む。追加依存とcompiler処理、テンプレート型検査の費用が生じる。純粋モデルの単体検証、既存画像／許容差のVRT、実WebGLの生成・切替・warm再利用・退出時解放、全sourceのcoverage収集は維持する。

検証層と性能計測の条件は[テスト設計](../testing.md)を参照する。
