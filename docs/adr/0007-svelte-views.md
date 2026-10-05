# 0007: Svelte 5で画面を宣言する

日付: 2026-10-05

## 背景

画面ごとのHTML文字列、querySelector、属性代入、イベント配線とJSONによる描き直し判定が、同期モデルの純粋な投影と重複していた。会話・人物詳細・設定入力の構造を再利用しにくく、画面の局所的な変更にもDOM生成と更新の両方を追う必要があった。[0006](0006-synchronous-presentation-models.md)の同期state／意味イベントと実資源所有者は有用で、表示実装だけを標準的な宣言へ移す。

## 判断

ユーザー承認に基づき、通常UI・戦闘HUD／overlay・開発editorをSvelte 5の型付きテンプレートへ移す。直接DOM記法の整理だけでは生成・更新・配線の自作範囲が残る。Reactは広いツール支援があるがこの独立した同期モデルとの接続に別の購読構成を要し、Solidも細粒度表示に適するが、今回はSvelteの標準テンプレート・runes・compilerを採用する。AIとの親和性は記法の標準性、型検査、部品内の局所性で評価し、未測定のモデル別成功率や性能順位を根拠にしない。

ゲーム・画面判断の正本は純粋な同期モデルに置く。commit後に表示入力を渡し、Svelteの`$state.raw`と`$derived`は表示接続に使う。クリック・キー・dialog取消等は既存の意味イベントへつなぐ。汎用event bus、独自reactive framework、SvelteKit、全体snapshotのJSON比較は作らない。

戦闘HUDの投影は意味状態の葉を入力とし、毎frame変わるmarker角度・cue時刻と分ける。探索の通常chromeも戦闘時計から分ける。純粋投影は直接状態VRT用の全frameを生成できるが、実行中に毎frame巨大frameを作らない。DOM上の位置・scroll・focus・native dialog、WAAPI、画像完了、canvas・renderer／sceneの寿命はbrowserが持ち、ゲーム状態のcommitと独立した実資源ownerを維持する。

型検査は`svelte-check --tsgo`で安定版TypeScript 7を使う。公式のnpm alias構成に従い、`@typescript/native`へ7系を置き、`typescript`名の6系はSvelte変換のJavaScript API用に残す。native checkerのexperimental APIは使わない。

[Ponytail](https://github.com/dietrichgebert/ponytail)の「書かなくていいことを書かない」を今後の設計・実装へ適用する。既存ライブラリ、設定、責務の再検討で自作範囲を減らす。必要な仕様保証・テストは維持し、仕組み全体や将来用の抽象化は導入しない。

通常のUIはSvelteで扱う。多数のオブジェクトが連続して動く領域は、実負荷を測り、必要ならその領域だけをPhaser等の適切な外部描画／ゲームライブラリへ委ねる。現時点ではPhaserを追加せず、Babylon全体の置換や未使用の切替基盤も作らない。採用時はDOMとGPUを含む全frame費用、資源寿命、bundle／起動費用を比較する。

## 結果

会話・人物画像・設定入力を部品へまとめ、表示構造・型・イベントを同じテンプレートで読む。追加依存とcompiler処理、テンプレート型検査の費用が生じる。純粋モデルの単体検証、既存画像／許容差のVRT、実WebGLの生成・切替・warm再利用・退出時解放、全sourceのcoverage収集は維持する。

DOM適用が16.6msを下回るだけではゲームframeの余裕を示さない。代表負荷のprojection、DOM、layout／paint、割当・GC、Babylonを含むframe、bundleと起動を実測し、ソフトウェアGPUの結果と実機の限界を区別する。計測結果と未確認事項は検証記録へ残す。

non-viewの重複・ルール・定義・保存の整理は後続の別PRにし、viewとnon-viewの両整理を機能実装より先に進める。
