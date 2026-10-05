# テスト設計と実行

仕様の正本は `specs/`。デザインガイドラインは設計指針であり、実装仕様・必須テスト・マージ条件とは区別する。品質維持とは必要な実装仕様の保証を保つことで、assertion・ケース件数・ファイル構造の不変を意味しない。同じ保証を実証できる統合・移動・書換え・削除を認める。

## 責務と観測結果

ゲーム規則と画面の状態・入力・focus・dialog・演出はブラウザ非依存の明示状態と意味イベントで扱う。イベントを現在状態へ同期適用してから次のイベントを受ける。A→B→Aと戻った後の有効入力も受理し、クリック回数・時間窓・直前履歴・汎用ID台帳で抑止しない。外部I/Oは状態確定後に開始し、完了結果を意味イベントとして適用する。

| 層 | 保証する結果 |
| --- | --- |
| `src/game/` のVitest | HP・症状・疲労・論理時刻・乱数・所持・権利・公開保存形式。実データと独立した具体的期待値 |
| `src/presentation/` と親子結合のVitest | 実コアへ意味入力を順に適用した画面遷移、draft、選択、focus移動／復元、dialog、保存成功／失敗、各演出時点の確定表示。純粋投影の文言・入力可否・位置 |
| 実HTTP／ファイル／Storage境界 | 開発設定APIの保存と失敗時旧bytes保持、通常配布への開発機能・fixture混入禁止、確定済み保存bytesのI/O |
| 直接状態VRT | 正当な代表状態・phase・表示時刻を実view／実素材へ与え、既存画像と比較。ゲーム進行、クリック連鎖、実時間待機を使わず到達する |
| 直接Native WebGL | 実Buffer／Texture／Programの生成・切替・解放、warm再利用、取得回数、DPR割当、失敗・遅着・pagehide・必要時HMRの資源寿命。ゲーム操作journeyは通さない |

E2Eは設けない。ブラウザadapterはNative操作と意味イベントの1対1接続、測定値の通知、確定frameの適用だけを行う。click配線をなぞる追加テストやDOM上のゲーム判断を例外として残さない。入力受付とfocusはモデルで検証し、外観は実VRTで検証する。RGB、私的属性、SVGの要素数を見た目の代理にしない。

確定したゲーム結果と演出表示を分ける。各HP・症状・疲労を確定recordから代入し、表示でルールや乱数を再実行しない。wall msと1倍相当のcue進捗は別の表示入力で、速度変更は次phaseから適用する。CSSの既存keyframes／easingを保ち、[Web AnimationsのcurrentTime](https://www.w3.org/TR/web-animations-1/#setting-the-current-time-of-an-animation)で描画時刻を与える。DOMの最新標本とcanvasが最後に描いた標本も区別する。

必要な検証層は境界と費用から選ぶ。[GoogleのTesting Pyramid](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)と[Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)も参考にするが、件数の割合を合否目標にしない。公開入力・結果・非変更・実I/O資源を検証し、内部関数、呼出順、配列の偶然の位置、非仕様のJSONキー順や診断文言を固定しない。検証対象自体から期待値・負例一覧を作らない。

## 実行方法

Node.jsは `.nvmrc` の24系、ブラウザは `mcr.microsoft.com/playwright:v1.63.0-noble` と実LFS素材を使う。ホストのscriptは同じ固定Dockerを `--init --ipc=host` で起動する。

| コマンド | 範囲 |
| --- | --- |
| `npm run check` | Biome・型・素材検査・現在の通常minified build・全Vitest／V8 coverage／発見と実行の照合。ブラウザなし |
| `npm run test:browser` | ゲーム本体CIの全工程。checkに続けて異なるdebug／直接view入口を各一度buildし、views／rendererの直接VRT・Native資源検証・native V8を一回実行 |
| `npm run test:editor` | checkとview build、開発者専用の直接構図VRT・Native HMRを必要時に全実行 |
| `npm run test:all` | check・必要な3build・既定とeditorの全projectを同じ一回の直列ブラウザ実行で確認 |

コンテナ内では対応する `:inside` scriptを使う。`test:browser`／`test:all` はcheckが作った通常配布を共用し、素材・型の前処理を後続buildで反復しない。単独の `build`／`build:debug`／`build:views` は前処理を含む。Vitestのfile並列設定を目標のために増やさず、Playwrightは1worker。工程は直列に実行する。

画像比較を持たないrenderer／editor-resourcesは既存DPR検証と同じ800×900 viewportを使う。実GLB・PNG・PBR・shaderを準備して実drawを行い、viewportを変えてもcanvasの16:9比率とカメラ構図は保つ。DPR1／3と800→640のresize、資源生成・warm切替・遅着／失敗・HMR・退出時0の保証を維持する。VRTのviewport・DPR・基準画像・許容差をこの費用整理で変えない。

通常 `dist/` の初期タイトル、debug `dist-debug/` の初期戦闘を実際に描く。attack／healのFXは同じrendererの実地形を保持し、実コアから別々の直接snapshot・BattleScene・UIを生成して既存6画像を比較する。editorの初期2対2はconstructorの準備済み構図を使い、人数変更とresizeだけを再描画する。任意の画面状態は標準Viteの[multi-page build](https://vite.dev/guide/build.html#multi-page-app)で `dist-views/` へ生成する。同じ標準minifierを使い、通常配布へfixtureを混入しない。3出力は異なる実入口の検証であり、coverage専用の解析buildではない。通常4173、debug4175、直接view4174。viewの実 `BASE_URL=/rpg/` で素材を取得し、非root専用buildやURL書換えを重ねない。

開発エディター・標準構図・HMR変更時は `tests/editor/` も必要になる。低頻度の詳細操作は純粋モデルで、構図と会話の見た目は必要時VRTで担う。単独control構図は条件ごとに独立caseとfresh rendererを生成し、default更新後の次BattleSceneへの設定引継ぎも確認する。editor-viewsの各caseは独立pageを持ち、Playwrightの標準 `fullyParallel` でcase単位に割り当てられる。worker数が1なら直列に実行する。同じsceneの内部／preview更新では既存の画面状態とviewを保持し、準備完了や初期選択をやり直さない。四隅の構図VRTは最初だけrendererを生成し、次の構図は同じ地面へ設定を適用して次BattleSceneとUIを生成する。4枚の同じ基準画像を保ち、共通地形の再importとshader準備を反復しない。初期設定をconstructorへ渡す保証は独立した5つの単独control構図に残す。任意四隅・内部／previewは必要時、本編のPC／mobile・既知素材と材質fallbackは既定に残す。通常結果へskipとして混ぜない。

## Coverageと実行漏れ

Vitest 5の標準 `@vitest/coverage-v8` で `src/**/*.ts` と `scripts/*.{ts,mjs}` をincludeし、未読込も分母へ含める。ゲームとpresentationは行97・文95・関数100・分岐93の閾値を適用する。率のために来ない入力・不可能状態・冗長防御を作らない。

ブラウザは同じ必要実行へPlaywright native V8を付随させ、Monocartで自前srcへmappingする。buildの[hidden sourcemap](https://vite.dev/config/build-options.html#build-sourcemap)は実行JSへ注釈を加えない。共有fixtureが各chunkの隣接mapを渡す。実HMRのdev sourceだけはinline mapを使う。全srcの未読込を0-hitとして残し、vendor・テスト・CSSを混ぜない。`coverage/browser/<実project名>/` は由来別のreportであり、同じ分母を合算・平均したりunit率へ統合したりしない。

素材照合は実GLB bytesのNative WebCrypto、利用不能／digest拒否時の未照合結果をI/O境界で検証する。未照合から元材質を選ぶ判断は純粋モデルで、既知／未検証環境と同パス別bytesの実材質はPC／mobileのNative VRTで確認する。同じ元材質画像をI/O失敗分岐ごとに再描画しない。warm資源はfull／smallそれぞれの実描画後のBuffer／Texture／Program数を記録し、再度small→fullへ切り替えた両状態の不増加と退出時0を確認する。

生成JSから対応づけられた分岐の指標であり、元TSの全分岐分母を保証しない。[Monocart 2.13](https://github.com/cenfun/monocart-coverage-reports/blob/v2.13.0/lib/converter/converter.js#L620-L672)はmapping不能な分岐群を除く。`all`は未収集ファイルを追加するが、読込済みTSのtree shaking削除分・未mapping分岐は補完しない。source集合一致は欠落確認であり、全分岐維持の証明ではない。

git上の全品質spec、runnerの実collection、今回の実JSONを照合する。Playwright discoveryは実行引数によるfilterを掛けずに取得する。Vitestは公開Reporterの `onTestModuleCollected` で、実行前の全ケースをprimitiveなfile／fullNameへ記録する。実CLIのname filterで未実行になるケースも残し、発見用の別起動と全test moduleの再importを省く。既定はeditorだけ明示scope除外、editor単独はそのscope、allは全specを照合する。未知のディレクトリへ置いた品質specも未発見なら失敗する。ファイル解決はnative reportの `config.rootDir`、必須projectとcoverageのproject集合は実configから導く。手書きの仕様ID／case台帳は作らない。

空／未発見ファイル、重複名、未実行、skip/todo/only、失敗・retry・期待失敗・global errorを拒否する。実CLI filterやlist-onlyに過去JSONを流用して成功としない。共有coverage fixtureを必須にし、追加context／page・遷移前回収漏れ・map欠落／不正・各caseの収集欠落を拒否する。[Playwright coverage](https://playwright.dev/docs/api/class-coverage)は `resetOnNavigation:false` でも旧documentの保持を保証しないため、必要なdocument移動前にcheckpointを置く。

## 外観と提出前検証

[Playwright画像比較](https://playwright.dev/docs/test-snapshots)の固定環境、既存baselineのpath／bytes／許容差を保つ。画像不一致をsleep・許容差増加・無審査baseline生成で隠さない。必要な字体・画像decode・pointer／keyboard modality・viewport・scrollを撮影前に揃える。レビュー資料の撮影やoverlayはVRT成功を代替せず、旧実行参考画像を新たな承認済みgoldenと扱わない。

実装中は必要な短い検証で原因と費用を確認する。提出前はsourceを固定し、check・必要な全直接VRT・資源検証・editorをローカルで完走する。代表数件だけで全件をCIへ委ねない。source／LFS実体／CSS・素材・goldenの前後一致、正確なhead／tree、開始・終了・shutdown、実runnerのworker設定、層別時間、failure／retry別記を残す。GitHub権限・required checks・Actions固有artifact等、ローカルで不可能な条件だけを理由付き例外とする。

[#102](https://github.com/karin0624/endfield_rpg/issues/102)では、品質維持した同条件・直列のゲーム本体CI対象（`npm run test:browser`）のローカル全工程が起動から終了まで5分以内、または同品質で5分以内にできない明確な根拠が成立するまでPR禁止。設定画面の`editor-views`／`editor-resources`はこの5分判定へ含めず、`npm run test:editor`で明示的に別実行する。`test:all`は両scopeを必要時に検証するコマンドであり、5分の判定対象ではない。成立後もユーザー確認まで公開を再開しない。部分成功、実描画が多い事実、未測定の推測を不可避の根拠・課題解決としない。

実runner固有のreport生成・古いJSONの再利用拒否・list-onlyは実CLIで検証する。未登録ファイル、部分結果、coverage欠落はその実reportを入力として実行照合を検証し、同じfixtureを再実行して準備を重複させない。ケース別coverage annotationには回収のwall msを含め、ブラウザcase全体や終了時の集計費用と区別する。共有fixtureは実初期viewport／DPR、標準CDPのGPU deviceとbody前後のprocess CPU累積値も記録する。CPU累積値は全threadの消費量であり、GPU elapsedや排他的なcase CPU時間と扱わない。

自動検査は自然言語仕様の完全性やassertionの意味を証明しない。差分レビューでは、変更対象の公開入力・独立した期待結果・担当層・旧保証の移行先・未確認事項を具体的に読む。実装と全必要ローカル検証を終えてからまとめて提出する。今回の最終独立レビューはPR後に手配するfresh reviewerが行い、実装中のsource確認・部分検証をその承認と呼ばない。main保護と最終承認の責任は[別表](testing/review-controls.md)を参照する。
