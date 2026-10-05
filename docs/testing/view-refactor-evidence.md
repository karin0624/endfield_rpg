# Svelte view移行の検証記録

日付: 2026-10-05。判断は[ADR 0007](../adr/0007-svelte-views.md)、恒常的な検証方法は[テスト設計](../testing.md)を参照する。以下はローカル実測であり、Actionsや実機GPUの結果ではない。

## 対象と実装

- 比較元: main／PR105 squash `c08a065e2965e0ee76a12e72dc5bb4e7abe62682`。
- 製品実装: `db2e1e79e3603b3a23dd7b9e3043006c594bccd3`。全scope検証時のtreeは `0e96cbdb5044d7d8fb9a91fb96a201241981a490`。
- 本編・戦闘HUD／overlay／cue・探索・編成／人物詳細・会話・買物・成長・debug・両editorを19個のSvelte componentと14個の型付きadapterへ移した。会話、人物画像、設定入力を共用する。
- 同期state／意味イベントのcommitを先に行い、Native効果を後に実行する。戦闘HUD・探索chromeの意味投影を連続時計から分離した。canvas、scene、renderer、focus／scroll／dialog、WAAPIと画像ownerはbrowserの具体的な寿命に接続する。
- runtimeはSvelte 5.57.1、開発時はVite plugin 7.3.1／svelte-check 4.7.6。`svelte-check --tsgo`はTypeScript 7.0.2を使い、`typescript`名の6.0.3は変換用JavaScript API、`@typescript/native` aliasの7系は実checkerを提供する。
- 最終計測ではswitch fixtureに `app.replaceChildren()` を明示した。旧factoryが暗黙に除去していたcanvasを新fixtureも除去し、両方の物理条件を合わせるためで、製品コードの変更ではない。この一行を含めて既定game全工程を検証した。

製品CSS、素材、既存golden PNG、VRT許容差、`.github`は比較元から変更していない。地形LFS実体は58,790,396 bytes、SHA256 `0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9`。Babylon rendererの実資源処理も変更していない。

## 品質検証

固定Dockerは `mcr.microsoft.com/playwright:v1.63.0-noble`、digest `sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`。コンテナ内Nodeは24.20.0、Chromiumは153.0.8010.12、WebGLはANGLE Vulkan SwiftShaderである。

| 実行 | 結果 |
| --- | --- |
| `npm run test:all` | lint、型、素材、通常／debug／直接view build、65ファイル804単体、4project／12ファイル32ブラウザが成功。Native runner 349.949秒、1worker。editorを含むためgameの5分判定には使わない |
| `npm run test:browser` | 同じcheck・必要build、views 12／renderer 10の22ブラウザと全実行／project／各case coverage gateが成功。Docker起動〜shutdown **240.154秒**、exit 0、Native runner 154.226秒、既定2workers |
| 型／lint | TS7・Svelte templateは0 error／0 warning。Biomeは成功し、以前からあるtownModelのfindIndexに関するinfoのみ |
| VRT／実資源 | 既存54 unique基準画像・62画像assertionを全scopeで使用。warm再利用、DPR1／3とresize、素材失敗・遅着GLB／画像decode、RGBD shader準備中退出、pagehide、実debug HMRと退出時Buffer／Texture／Program 0が成功 |
| 収集漏れ | 単体・ブラウザとも無filter discoveryと実行を照合。失敗、skip、retry、flaky、global errorは0。各ブラウザprojectは0-hit込みの実source **121/121**、19 `.svelte` と14 `.svelte.ts`を含む |

game全工程は2026-10-05 15:14:33.310534〜15:18:33.463887 UTC。既存のbudget、閾値、runner設定を変更せず、今回の一回は5分以内だった。安定したCI時間のSLAやSvelte導入によるCI高速化の証明にはしない。

単体の既存閾値（行97／文95／関数100／分岐93）は維持した。率は領域内のcovered／totalを合計して算出する。

| 領域 | 文 | 分岐 | 関数 | 行 |
| --- | ---: | ---: | ---: | ---: |
| game | 95.33% | 93.29% | 100% | 97.18% |
| presentation | 98.88% | 93.73% | 100% | 99.62% |

全131単体sourceの分母には10 scriptとbrowser用sourceも含む。ブラウザcoverageはprojectごとに同じ121 sourceを保持し、率を単体へ合算しない。型宣言 `.d.ts`だけを非実行sourceとして除外し、未実行Svelteを削っていない。source一致は未mapping分岐までの完全性を証明しない。

`npm run review:party`も明示実行し、1672×941の4状態、28 PNG／4 JSONを生成した。実装担当が実撮影とoverlayを確認したが、これは独立レビューではない。承認用コンセプト画像とのraw比較は約99.98%差であり、既存goldenとの正式VRT成功とは区別する。今回の実撮影と変更していないgoldenのraw pixel差はdeparture 10、disabled 9、selection 0、symptoms 0で、既存許容差の正式VRTは成功している。コンセプト画像との一致や残差の解消を主張しない。

## 表示負荷の前後比較

`scripts/measure-view.mjs`と`tests/fixtures/performance-view.*`を使い、1440×1080／DPR1、固定Docker、実素材・Babylon、同じclock入力とprofiling設定で4負荷×3回ずつ順に測った。他の品質実行とは重ねていない。各負荷は180rAF、実scene／shader、font／画像decodeと20rAFのwarm後に開始する。

戦闘は実コアの初期2対2・通常攻撃demo。battleは10frameごとの敵選択とclock、markerは連続marker、cueは0／90frameで確定recordの表示を開始、switchはhome／destinations／townを毎frame切り替えるstressである。switchでもNative rendererのloopは計測終了まで保ち、canvasは両版ともDOMから除去する。実機の典型操作頻度や多数の物体の負荷を再現したものではない。

次の範囲は3回それぞれのp95の最小〜最大、単位はms。

| 負荷 | apply wall: 旧→新 | main task wall: 旧→新 | 実rAF間隔: 旧→新 |
| --- | --- | --- | --- |
| battle | 3.00–4.20 → 3.00–5.80 | 5.01–7.14 → 5.11–12.25 | 16.70–16.80 → 16.80–16.80 |
| marker | 2.00–2.80 → 2.20–4.00 | 3.77–6.11 → 4.83–9.46 | 16.70–16.80 → 16.70–16.80 |
| cue | 11.20–13.00 → 10.20–12.60 | 1464.58–1511.38 → 1312.70–1386.17 | 1466.60–1516.70 → 1316.60–1383.20 |
| switch | 5.30–6.90 → 6.90–12.10 | 17.49–26.50 → 23.18–41.13 | 16.80–33.40 → 33.30–50.00 |

applyはmodel／projection／Native submit、DOM更新のsettled、強制layout readまでを含む。SvelteのsubmitのみをDOM費用とせず、遅延projectionとDOM反映を含めたwallで比べる。main taskはframe区間のRunTaskのwallで、GPU待機を含み得る。CPU占有時間やGPU elapsedではない。

次は各180frameの総量の最小〜最大。投影は1ms CPU sampleのinclusive推定、layout／paint／GCはtraceのphase総時間（ms）、割当は16KiB samplingによる推定（MiB）である。

| 負荷 | 投影: 旧→新 | layout: 旧→新 | paint: 旧→新 | 割当MiB: 旧→新 | GC: 旧→新 |
| --- | --- | --- | --- | --- | --- |
| battle | 20.01–32.80 → 8.86–19.42 | 23.98–26.49 → 23.90–30.00 | 28.53–31.14 → 33.90–42.50 | 8.90–9.15 → 8.60–9.10 | 5.78–16.19 → 10.13–22.02 |
| marker | 25.13–29.92 → 4.06–18.88 | 12.30–18.55 → 14.81–23.84 | 24.99–30.30 → 33.52–37.89 | 6.60–7.29 → 6.46–6.94 | 6.67–11.17 → 12.09–14.90 |
| cue | 25.69–53.89 → 9.62–15.52 | 23.29–42.15 → 24.60–33.03 | 16.58–34.40 → 18.36–19.73 | 10.94–11.17 → 10.17–10.53 | 24.62–75.38 → 27.15–29.93 |
| switch | 3.62–9.02 → 3.30–5.61 | 129.22–147.97 → 144.12–197.66 | 107.00–108.92 → 102.53–122.78 | 2.64–2.72 → 6.08–6.63 | 8.57–10.59 → 18.70–40.83 |

CPU profileは標準build mapでprojection／browser view／Babylonへ分類し、カテゴリは重なる。短い関数はsampleされず、呼出数や独立した費用の合計ではない。割当はminor／major GC済みobjectsも含める。強制GC前後のheap差にはGLB準備時の一時領域の解放が入るので、漏れの不在をheap差だけで判断しない。

DOMのadded／removed mutation通知は、battle 2700／2700→26／26、marker 2520／2520→26／26、cue 1220／1220→11／11だった。移動も通知へ含まれるため、DOM allocation件数ではない。属性・text更新は増えており、ノード通知減だけから描画費用全体の削減を主張しない。

意味投影とノードの再生成は減ったが、通常のapply／paint／GCと毎frame画面切替は一様には改善していない。switchはcomponentの条件付き生成・破棄とreactive処理による追加割当があり、stressのrAF間隔も悪化した。CPU sample、trace、wallの変動と合わせ、全体を高速化したとは結論しない。隠れたcueのWAAPI書換えと非表示markerの幾何再投影は除去したが、数字のために画面・素材・テスト条件は変更していない。

cueは両版ともソフトウェアWebGLで1秒超のframeを含む。DOM適用が16.6ms未満でも、Babylonを含む全frameの余裕・実機60fpsは保証できない。物理GPU、skillが多いHUD、多数の連続物体は未測定。必要なら実負荷で該当領域を測り、ADRの方針に従ってその領域への適切な外部描画ライブラリを比較する。

## bundle・起動・退出

| 通常distの全JS 126 chunk | 旧 | 新 | 差 |
| --- | ---: | ---: | ---: |
| raw bytes | 3,029,155 | 3,079,905 | +50,750（約1.68%） |
| gzip bytes | 754,595 | 775,739 | +21,144（約2.80%） |

全chunk合計であり、初回転送量ではない。既存のbuild chunk-size warningは残る。Svelte runtimeとcompiler／checker依存の追加費用を含む。

warm fixtureのscene準備は旧1964.7–3082.0ms／新2276.3–3999.8ms、font／画像までの準備は旧4234.0–5421.6ms／新4611.9–6968.8msだった。この値はHTML／JS読み込み後からで、cold起動時間ではない。

別に通常minified配布のタイトルを新しいcontextで各3回開き、`goto`開始から見出し・font／画像decode完了まで測った。旧806.4／424.9／321.8ms、新401.1／297.3／322.3ms。固定Docker・同じ1440×1080／DPR1、ローカルHTTPだが、旧3回→新3回の順、OS／browser process cache、profilingなしという条件である。全OS cacheのcold、実ネットワーク、mobile、描画完了時間を保証せず、速度改善の因果を断定しない。

4負荷×3回の全計測でbrowser errorは0、退出後の実Buffer／Texture／Programはすべて0。正式Native suiteの遅着・失敗・HMR保証と合わせて評価する。

## ローカル証跡と引継ぎ

以下は生成物でgitへ追加しない。別checkoutで再実行する場合は[表示負荷の計測](../testing.md#表示負荷の計測)に従う。

| 資料 | パス |
| --- | --- |
| 全scopeのrunner／discovery／各project coverage／unit summary | `test-results/svelte-all/` |
| gameのrunnerと正確な起動〜shutdown | `test-results/playwright.json`、`test-results/svelte-game-timing.json` |
| 新実装4×3のJSON／trace／CPU profile | `test-results/perf-svelte/` |
| 比較元4×3 | `/workspace/endfield_rpg-svelte/test-results/perf-base-profile/` |
| 通常タイトル起動のscript／結果 | `test-results/measure-startup.mjs`、`test-results/startup-results.json` |
| 同解像度の撮影／raw diff／overlay | `test-results/approved-comparison/` |
| 全scope／game／性能ログ | `/tmp/endfield-svelte-all-final.log`、`/tmp/endfield-svelte-game-quality.log`、`/tmp/endfield-svelte-perf.log` |

ローカル実装と必要な検証の完了時点では未公開だった。その後、GitHubコネクタで[PR #106](https://github.com/karin0624/endfield_rpg/pull/106)を公開した。初回公開head `8b40afd1a191a9517f57fbf663a6f92a7859b13c`とローカル完成head `46017e5949fb56e69c928b8f158a8dc7f4c5e4ed`のtreeは `a918d3cc8189ee59f4b1955b474f5aa8753e069b`で一致する。実装担当の確認を独立承認とは呼ばず、完成したPRをdot側でレビューする。現在の提出・レビュー手順は[テスト設計](../testing.md#外観と提出前検証)に従う。
