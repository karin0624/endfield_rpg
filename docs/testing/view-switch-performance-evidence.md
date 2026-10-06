# Svelte移行後の街生成・切替負荷の検証記録

性能測定日: 2026-10-05。これはローカルの固定Dockerによる観測であり、実機GPUやActionsの結果ではない。移行自体の比較は[既存記録](view-refactor-evidence.md)、恒常的な手順と測定区間は[テスト設計](../testing.md#表示負荷の計測)を参照する。

## 対象と採用した変更

測定baseはPR106のmain `53dc488fa5f7bc4e4322f2865238c07c14936de6`。提出baseはLFS復旧後の `8161c900573c471d394dcf4cf31309a694cbffde` で、間の変更はGit認証手順とその記録だけである。保持していた性能差分はfast-forward同期前後でbytes一致を確認した。

`Adventure.svelte`の街生成時には、要素binding後のeffectが24個のCSS変数を個別に書いていた。同じfield定義・値・単位からstyle文字列を導出し、Svelteのstyle属性として生成時にまとめて反映する。設定が変わったときも同じderivedを更新する。要素binding用stateと設定反映effectが不要になった。

採用対象はこの設定反映だけである。画面の分岐・生成破棄、focus、イベント受付、dialog、rendererの寿命は既存のまま。CSS、素材、golden、許容差、依存version、state/schema library、品質gateとbudgetは変更していない。campaign／dungeonの上位モデルや保存境界へ変更を加えていない。

## 条件と区間

- `mcr.microsoft.com/playwright:v1.63.0-noble`、digest `sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27`。
- Node 24.20.0、Chromium 153.0.8010.12、1440×1080／DPR1、SwiftShader。Svelte 5.57.1。
- 既存の実Babylon・GLB・PNG・shader・font／画像decodeと20rAF warm、180frame、CPU 1ms／allocation 16KiB samplingを使った。品質suiteと重ねていない。
- `switch`は毎frame、`switch-paced`は30frameごとにhome→destinations→townを描く。後者は6回の切替で、初回empty→homeを分ける。実rAFが遅れるので常に0.5秒間隔とは限らず、実際のプレイヤー操作頻度の分布は未測定。
- 元fixtureと同じく、switchでもNative rendererのloopは退出まで保持し、canvasはDOMから除去する。projection、遅延Svelte flush、強制layout readまでのapply wallを測る。

CPUとallocationのsampling全体はdispose・退出後1rAFを含む。既存記録のsample値を180frameだけのtraceと混同しない。以下のAdventure CPU内訳だけは、raw CPU profileの`startTime + timeDeltas`をCDP traceの`view-workload-start`〜`view-workload-end`へclipしている。両時計の包含関係を確認し、sampleが跨ぐ境界は重なる時間だけを割り当てた。標準build mapでAdventureを含むstackのinclusive時間を数え、同じsourceは1sampleにつき一度数えた。子component・Native DOM処理を含む推定で、カテゴリの合算や正確な呼出数には使わない。

## 既存profileからの判断

baselineのstress 3回では、workload内のSvelte batch inclusiveが200.58／246.24／220.34ms、Campaignが150.91／181.78／156.19ms、Adventureが64.36／78.95／81.15msだった。projectionの明示phase総量は8.1／8.5／7.6msで、submitだけでは説明できない分岐の生成・破棄と遅延反映に費用があった。これらのinclusiveカテゴリは重なる。

最初に、街で非表示のConversation／ItemShop subtreeを会話開始時に生成する案を一要因で試した。別3回でstress apply総量は335.1／397.9／468.1ms、allocation全体は6.30／6.89／6.81MiBだった。baselineの340.0／430.3／350.4ms、6.64／6.25／6.99MiBに対し安定した改善を確認できず、破棄してからCSS反映案を測った。採用案へこの遅延生成変更は含めていない。

## 採用案のstress比較

同じharnessでbaseline 3回、採用案3回、その後baselineへ戻して1回、採用案へ戻して1回を順に測った。追加の1組は順序・hostのばらつきを確認する対照であり、3回と混ぜて精度を誇張しない。

| 観測 | baseline 3回 | 採用案3回 |
| --- | --- | --- |
| Adventure CPU inclusive、workloadのみ（ms） | 64.36／78.95／81.15 | 57.78／63.32／51.94 |
| apply総量、180frame（ms） | 340.0／430.3／350.4 | 304.7／341.3／409.3 |
| apply p95（ms） | 3.3／5.3／3.4 | 2.7／3.2／4.3 |
| 属性mutation通知 | 各1562 | 各122 |
| allocation全体、退出込み（MiB） | 6.64／6.25／6.99 | 6.95／7.09／6.97 |

Adventure sampleの平均は74.82→57.68ms（約22.9%減）、apply平均は373.57→351.77ms（約5.8%減）だった。追加の対照ではAdventureが68.88→62.22ms、applyが347.5→320.8ms、p95が3.3→2.7msだった。街生成に関係するCPU負荷の低下を採用根拠にし、全切替が一様に速くなったとは扱わない。

単発のdestinations→townはstress各180sampleで平均2.376→2.188ms、中央値2.2→2.0msだった。追加対照の各60sampleでは平均2.277→2.047ms。home→destinationsとtown→homeにもhostの変動があり、town→homeには採用案側で17.7msの外れ値がある。ばらつきが大きく、統計的な有意差やCI時間のSLAを証明していない。

24個の個別style writeは1回の反映になる。mutation通知の1440件減には、まとめたstyleがDOMへの挿入前に設定されてobserverへ通知されない効果もある。通知数はDOM割当件数やCPU時間の代理ではない。

allocation平均は6.63→7.00MiB（約5.7%増）で、追加対照でも6.71→7.09MiBだった。割当削減は確認できていない。sample粒度の変動と退出を含む値だが、この増加を隠さず、CPU費用を減らす限定的な変更として評価する。frame単位の割当や退出分の増減は特定できない。

## 疎な切替の単発費用と限界

以下は初回を除き、3回でhome→destinationsが6sample、destinations→townが6sample、town→homeが3sample。平均／最小〜最大のapply wall（ms）を示す。

| 切替 | baseline | 採用案 |
| --- | --- | --- |
| home→destinations | 1.917／1.1–2.7 | 2.250／1.2–3.5 |
| destinations→town | 5.400／2.5–8.1 | 5.483／2.6–8.5 |
| town→home | 2.400／2.0–2.6 | 2.500／2.3–2.6 |

初回empty→homeはbaseline 8.7–17.2ms、採用案8.4–9.7msで、以後の切替とまとめない。追加対照のdestinations→townはbaseline 2.8／7.5ms、採用案2.8／12.5msだった。疎な切替のwall改善はこのsampleでは確認できない。全180frame p95は主にidleを測るため根拠にしていない。

stressでの街生成CPU削減は観測したが、通常頻度での体感速度、全画面切替、物理GPU、mobile性能の改善は未確認。Native loopを含むmain-task wall／rAFはソフトウェアWebGLと待機・cacheの変動を含む。初期stressのrAF総量には約5秒→約3秒の差もあったが、逆順のbaselineでは約3秒になり、この差を製品変更の効果として主張しない。BattleHud／BattleOverlayのResizeObserverやlayout順序には今回変更を加えていない。

通常distは126 JS chunk。raw bytesは3,079,901→3,079,944（+43）、gzipは775,729→775,757（+28）。全chunk合計であり、初回転送量ではない。

全比較runはbrowser error 0、退出後の実Buffer／Texture／Programすべて0だった。既存のNative suiteによる遅着・失敗・HMRの保証とは分けて評価する。

## 提出前の品質検証

2026-10-06、最新mainへ同期したlocal実装head `6f4b90e520a5de0ffbc8bd9af0b9359453852e0b`、tree `83572c04cceae8f7f326600943226f1153ef1443`を固定して、以下を順に完走した。以後の提出差分はこの記録と計測手順の文書だけで、検証済み製品・test・scriptを変更していない。以前停止したeditor実行（exit 143）は成功に数えていない。

| 実行 | 結果 |
| --- | --- |
| `npm run test:browser` | exit 0。起動2026-10-06 02:25:23.765312〜shutdown 02:27:43.519041 UTC、139.754秒。check、通常／debug／直接view build、65ファイル804単体、views 13／renderer 10の23caseが成功。Native runner 91.877秒、既定2workers |
| `npm run test:editor` | exit 0。02:28:02.587397〜02:30:12.121435 UTC、129.534秒。check、通常／直接view build、804単体、editor-views 9／editor-resources 1の10caseが成功。Native runner 91.249秒、既定1worker |
| 実行照合・coverage | 無filter discoveryと全実行、project／各caseのnative V8、既存閾値のgateが成功。失敗・skip・retry・flaky・global errorは0。各4projectは0-hit込み121/121 source、unitは131 source |
| 外観・実資源 | 既存54 unique goldenへの62画像assertionが成功。会話390px、会話editorの編集／保存済み表示、PC／mobile、warm再利用、DPR／resize、素材失敗・遅着、HMR・退出時0の既存保証を維持 |

CSS・実素材・goldenの98 tracked pathはbaseから変更がなく、作業treeのSHA-256 manifestも保存した。地形は58,790,396 bytes、SHA-256 `0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9`で一致する。renderer、品質runner、baseline、許容差、coverage閾値、5分budgetは変更していない。今回のgame全工程は5分以内だが、実行時間の安定性やActions runnerでの結果を保証しない。

受入条件は「既存の外観・入力・決定論・資源寿命を保ち、街生成のCPU費用を減らす」。費用は上記の実profile／単発apply、外観は`tests/views/adventure.spec.ts`の話者／選択肢と`tests/editor/views/editor.spec.ts`の編集／保存済み会話を含む全既存VRTで確認した。入力・focus・dialog・保存・決定論の仕様は変更せず、既存game／presentationの804単体とNative資源suiteを全実行した。新しい画面・入力・保証やその代替テストは追加していない。実装担当の確認であり、dot側の独立レビュー・最終headのCI確認は公開後の工程である。

## ローカル証跡と再現

生成物はgitへ追加していない。

| 資料 | パス |
| --- | --- |
| baseline 3×2のresult／CPU／trace／allocation profile | `test-results/perf-before/` |
| 不採用の遅延生成案3×2 | `test-results/perf-after/` |
| 採用案3×2 | `test-results/perf-style/` |
| 追加対照baseline／採用案各1×2 | `test-results/perf-control/`、`test-results/perf-style-confirm/` |
| 上記CPUのworkload内source内訳 | 各directoryの`profile-breakdown.json` |
| 再開後のgame JSON／discovery／coverage・起動〜shutdown | `test-results/perf-validation-game/` |
| 再開後のeditor JSON／discovery・起動〜shutdown | `test-results/playwright-editor*.json`、`test-results/perf-resume-editor-timing.json` |
| 素材／CSS／goldenのSHA-256 manifest | `test-results/perf-protected-bytes.json` |
| 再開後の全game／editorログ | `/tmp/endfield-perf-resume-game-quality.log`、`/tmp/endfield-perf-resume-editor-quality.log` |

実行は[既存手順](../testing.md#表示負荷の計測)のbuild／preview後、`node scripts/measure-view.mjs test-results/perf http://127.0.0.1:4174 3 switch,switch-paced`。baselineへ同じharnessを持ち込み、製品2ファイルだけをbaseへ戻して比較した。source mappingには各buildの隣接mapを使い、別buildのmapをprofileへ当てていない。採用案だけの新しい測定を旧版の記録値と比較する方法にはしていない。
