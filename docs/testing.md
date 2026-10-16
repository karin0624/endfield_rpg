# テスト設計と実行

仕様は`specs/`に定める。同じ入力と結果を保証できれば、テストの統合・移動・書換え・削除を認める。件数やファイル構成を維持すること自体を目的にしない。

## 責務と観測結果

ゲームと画面モデルの公開入力・結果を検証する。現在状態への同期適用、A→B→Aの往復後の再入力、commit後の外部I/Oと同期・遅着完了も対象とする。

| 層 | 保証する結果 |
| --- | --- |
| `src/game/` のVitest | HP・症状・疲労・論理時刻・乱数・所持・権利・公開保存形式。実データと独立した具体的期待値 |
| `src/presentation/` と親子結合のVitest | 実コアへ意味入力を順に適用した画面遷移、draft、選択、focus移動／復元、dialog、保存成功／失敗、各演出時点の確定表示。純粋投影の文言・入力可否・位置 |
| 実HTTP／ファイル／Storage境界 | 開発設定APIの保存と失敗時旧bytes保持、通常配布への開発機能・fixture混入禁止、確定済み保存bytesのI/O |
| 直接状態VRT | 正当な代表状態・phase・表示時刻を実view／実素材へ与え、既存画像と比較。ゲーム進行、クリック連鎖、実時間待機を使わず到達する |
| 直接Native WebGL | 実Buffer／Texture／Programの生成・切替・解放、warm再利用、取得回数、DPR割当、失敗・遅着・pagehide・必要時HMRの資源寿命。ゲーム操作journeyは通さない |

本編・探索のXState設定はゲームの公開入力を通して検証する。state machineやValibot自体の一般的な挙動を再検証するテストは作らない。一方、現行保存の厳密なキー集合・数値範囲、保存拒否理由、所有・権利のdomain整合、無効入力で現在gameを変えない保証は、このプロジェクトの契約として残す。snapshot内部の関数等をcloneや期待値へ含めず、モードとcontextの意味データ、外部処理へ返す確定結果を観測する。

E2Eは設けない。ブラウザadapterはNative操作と意味イベントの接続、測定値の通知、commit済みモデル／frameのSvelteへの受渡しを行う。click配線をなぞる追加テストやDOM上のゲーム判断を例外として残さない。入力受付とfocusはモデルで検証し、外観は実VRTで検証する。RGB、私的属性、SVGの要素数を見た目の代理にしない。

確定したゲーム結果と演出表示を分ける。各HP・症状・疲労を確定recordから代入し、表示でルールや乱数を再実行しない。wall msと1倍相当のcue進捗は別の表示入力で、速度変更は次phaseから適用する。CSSの既存keyframes／easingを保ち、[Web AnimationsのcurrentTime](https://www.w3.org/TR/web-animations-1/#setting-the-current-time-of-an-animation)で描画時刻を与える。DOMの最新標本とcanvasが最後に描いた標本も区別する。

必要な検証層は境界と費用から選ぶ。[GoogleのTesting Pyramid](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)と[Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)も参考にするが、件数の割合を合否目標にしない。公開入力・結果・非変更・実I/O資源を検証し、内部関数、呼出順、配列の偶然の位置、非仕様のJSONキー順や診断文言を固定しない。検証対象自体から期待値・負例一覧を作らない。

## 実行方法

Node.jsは `.nvmrc` の24系、ブラウザは `mcr.microsoft.com/playwright:v1.63.0-noble` と実LFS素材を使う。ホストのscriptは同じ固定Dockerを `--init --ipc=host` で起動する。

| コマンド | 範囲 |
| --- | --- |
| `npm run typecheck` | `svelte-check --tsgo`によるTS・Svelteテンプレートの検査。TypeScript 7のnative checkerを使い、警告も失敗にする |
| `npm run check` | Biome・型・素材検査・現在の通常minified build・全Vitest／V8 coverage／発見と実行の照合。ブラウザなし |
| `npm run test:browser` | ゲーム本体CIの全工程。checkに続けて異なるdebug／直接view入口を各一度buildし、views／rendererの直接VRT・Native資源検証・native V8を一回実行し、既存結果から品質summaryを生成 |
| `npm run test:editor` | checkとview build、開発者専用の直接構図VRT・Native HMRを必要時に全実行 |
| `npm run test:all` | check・必要な3build・既定とeditorの全projectを同じ一回の直列ブラウザ実行で確認 |
| `npm run review:party` | UI変更時の画像レビュー用。直近の4状態の実撮影と承認資料を同解像度で直接比較し、raw diff・overlay・数値を明示生成（Python／Pillowが必要） |

CIは固定コンテナの単一jobで`npm ci`後に`test:browser:inside`を実行する。ローカルも同じ`run-game-quality.sh`をworkspace所有者で使い、通常buildをその場で再利用する。結果・revision・失敗・skip・retry・global errorと、0-hitを含むsource数・coverageをログとActions summaryへ残す。summaryは既存JSONを読むだけで、品質検証を再実行せず、元の失敗を成功へ変えない。JSON・画像・trace・mapは同じworkspaceで確認する。

固定版とのraw比較は撮影後にPython／Pillow環境で`npm run review:party`を明示実行する。全体・注記領域・診断領域のdiff、原画・実画面・overlay、寸法・hash・JSONを`test-results/approved-comparison/`へ生成する。数値だけなら`--metrics-only`を指定する。通常CIには含めず、[制作手順](ui-asset-production.md#ui開発の必須ゲート)の画像レビューに使う。

コンテナ内では対応する`:inside` scriptを使う。全工程はcheck→必要build→Native→集計の順。通常配布と素材・型の前処理は再利用し、異なる入口だけを追加buildする。gameのNativeは2workersでfile単位に配分し、editor・allは既定1worker。直列条件は`npm run test:browser -- --workers=1`で再現できる。単独の各buildは素材・型の前処理を含む。

並行するcaseはそれぞれcontext／pageと出力先を持ち、coverageは全worker終了後に一度集計する。実行時間は同じsource・scope・環境・worker条件で比較し、起動からshutdownまでの全工程を記録する。共有cgroupのCPU／memory／throttle観測はgameの専有消費やGPU elapsedではない。単一runの時間を安定したCI時間のSLA、直列での短縮不可能性、Actions runner上の実測へ読み替えない。

画像比較を持たないrenderer／editor-resourcesは既存DPR検証と同じ800×900 viewportを使う。実GLB・PNG・PBR・shaderを準備して実drawを行い、viewportを変えてもcanvasの16:9比率とカメラ構図は保つ。DPR1／3と800→640のresize、資源生成・warm切替・遅着／失敗・HMR・退出時0の保証を維持する。性能の改善でもVRTのviewport・DPR・基準画像・許容差を保持する。

通常 `dist/` の初期タイトル、debug `dist-debug/` の初期戦闘を実際に描く。attack／healのFXは同じrendererの実地形を保持し、実コアから別々の直接snapshot・BattleScene・UIを生成して既存6画像を比較する。editorの初期2対2はconstructorの準備済み構図を使い、人数変更とresizeだけを再描画する。任意の画面状態は標準Viteの[multi-page build](https://vite.dev/guide/build.html#multi-page-app)で `dist-views/` へ生成する。同じ標準minifierを使い、通常配布へfixtureを混入しない。3出力は異なる実入口の検証であり、coverage専用の解析buildではない。通常4173、debug4175、直接view4174。viewの実 `BASE_URL=/rpg/` で素材を取得し、非root専用buildやURL書換えを重ねない。

開発エディター・標準構図・HMR変更時は `tests/editor/` も必要になる。低頻度の詳細操作は純粋モデルで、構図と会話の見た目は必要時VRTで担う。単独control構図は条件ごとに独立caseとfresh rendererを生成し、default更新後の次BattleSceneへの設定引継ぎも確認する。editor-viewsの各caseは独立pageを持ち、Playwrightの標準 `fullyParallel` でcase単位に割り当てられる。worker数が1なら直列に実行する。同じsceneの内部／preview更新では既存の画面状態とviewを保持し、準備完了や初期選択をやり直さない。四隅の構図VRTは最初だけrendererを生成し、次の構図は同じ地面へ設定を適用して次BattleSceneとUIを生成する。4枚の同じ基準画像を保ち、共通地形の再importとshader準備を反復しない。初期設定をconstructorへ渡す保証は独立した5つの単独control構図に残す。任意四隅・内部／previewは必要時、本編のPC／mobile・既知素材と材質fallbackは既定に残す。通常結果へskipとして混ぜない。

## Coverageと実行漏れ

Vitest 5の標準 `@vitest/coverage-v8` で `src/**/*.{ts,svelte}` と `scripts/*.{ts,mjs}` をincludeし、未読込も分母へ含める。ゲームとpresentationは行97・文95・関数100・分岐93の閾値を適用する。率のために来ない入力・不可能状態・冗長防御を作らない。

ブラウザは同じ必要実行へPlaywright native V8を付随させ、Monocartで自前srcへmappingする。buildの[hidden sourcemap](https://vite.dev/config/build-options.html#build-sourcemap)は実行JSへ注釈を加えない。共有fixtureが各chunkの隣接mapを渡す。実HMRのdev sourceだけはinline mapを使う。全srcの未読込を0-hitとして残し、vendor・テスト・CSSを混ぜない。Svelteコンポーネントと`.svelte.ts`もsource集合に含め、`.svelte`の未読込分は公式Svelte compilerのJS／mapから補う。実行分は通常Vite pluginのmapを使う。`coverage/browser/<実project名>/` は由来別のreportであり、同じ分母を合算・平均したりunit率へ統合したりしない。

素材照合は実GLB bytesのNative WebCrypto、利用不能／digest拒否時の未照合結果をI/O境界で検証する。未照合から元材質を選ぶ判断は純粋モデルで、既知／未検証環境と同パス別bytesの実材質はPC／mobileのNative VRTで確認する。同じ元材質画像をI/O失敗分岐ごとに再描画しない。warm資源はfull／smallそれぞれの実描画後のBuffer／Texture／Program数を記録し、再度small→fullへ切り替えた両状態の不増加と退出時0を確認する。

生成JSから対応づけられた分岐の指標であり、元TSの全分岐分母を保証しない。[Monocart 2.13](https://github.com/cenfun/monocart-coverage-reports/blob/v2.13.0/lib/converter/converter.js#L620-L672)はmapping不能な分岐群を除く。`all`は未収集ファイルを追加するが、読込済みTSのtree shaking削除分・未mapping分岐は補完しない。source集合一致は欠落確認であり、全分岐維持の証明ではない。

git上の全品質spec、runnerの実collection、今回の実JSONを照合する。Playwright discoveryは実行引数によるfilterを掛けずに取得する。Vitestは公開Reporterの `onTestModuleCollected` で、実行前の全ケースをprimitiveなfile／fullNameへ記録する。実CLIのname filterで未実行になるケースも残し、発見用の別起動と全test moduleの再importを省く。既定はeditorだけ明示scope除外、editor単独はそのscope、allは全specを照合する。未知のディレクトリへ置いた品質specも未発見なら失敗する。ファイル解決はnative reportの `config.rootDir`、必須projectとcoverageのproject集合は実configから導く。手書きの仕様ID／case台帳は作らない。

開始時に旧runner reportを消し、未生成のreportを成功に数えない。空／未発見ファイル、重複名、未実行、skip/todo/only、失敗・retry・期待失敗・global errorを拒否する。実CLI filterやlist-onlyに過去JSONを流用して成功としない。共有coverage fixtureを必須にし、追加context／page・遷移前回収漏れ・map欠落／不正・各caseの収集欠落を拒否する。[Playwright coverage](https://playwright.dev/docs/api/class-coverage)は `resetOnNavigation:false` でも旧documentの保持を保証しないため、必要なdocument移動前にcheckpointを置く。

## 表示負荷の計測

性能結果は対象revision・環境・測定条件・生データ・限界を対象Issue／PRへ記録する。現在の手順と過去の一実行の結果を分ける。

`tests/fixtures/performance-view.html`は直接状態fixtureで、通常配布へ含めない。通常戦闘の選択更新、連続marker、確定recordのcue、home／destinations／town切替を各180frameで測る。実Babylon・素材・shader・fonts・画像decodeを準備し、20rAFのwarm後にGC・profilingを開始する。通常戦闘の入力更新とclockを通し、Svelteでは実行中と同じ`renderModel`を使う。

本編切替用のhome／destinations／town snapshotは`profilerReady`通知前に準備し、各切替でsnapshotを選んで`projectCampaign`を実行する。初回empty→homeの描画、DOM更新とlayout readは計測区間に含む。直接状態fixtureのため、`reduceCampaign`による進行遷移の費用は測らない。

次の例は固定Docker内で現在sourceをbuildし、他の品質実行が終わってから3回ずつ測る。結果は`test-results/perf/`のJSON、CDP trace、CPU profileへ置く。品質テストやVRT合否の代用にはしない。

```sh
docker run --rm --init --ipc=host --name endfield-view-profile --user "$(id -u):$(id -g)" \
  -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.63.0-noble \
  sh -c 'npm run build && COVERAGE_BROWSER=1 npm run build:views && \
    npx vite preview --config vite.views.config.ts --host 127.0.0.1 --port 4174 --strictPort & wait'
```

別terminalでLocal出力を確認してから`docker exec --user "$(id -u):$(id -g)" -w /work endfield-view-profile node scripts/measure-view.mjs test-results/perf http://127.0.0.1:4174 3`を実行し、終了後に`docker stop endfield-view-profile`する。CAが必要な環境では通常のブラウザwrapperと同じ読み取り専用CAを渡す。

末尾に`switch,switch-paced`などのcomma-separated workloadを指定すると、その負荷だけを測る。省略時の4負荷は変わらない。`switch-paced`は180frameのうち30frameごとに6回描画し、`switches`へ切替元・先・frame番号・settledとlayout readまでの単発apply wallを保存する。初回empty→homeと以後の切替を分けて読む。30frameは比較用の間隔で、ユーザーの通常操作頻度を実測した値ではない。疎な負荷の全frame p95は主にidleを表すため、切替の単発費用に使わない。CPU profile、traceに加え、source内訳を調べるためのallocation sampling profileも保存する。

| 観測 | 意味と限界 |
| --- | --- |
| apply wall／phase | model、projection、Native submit、DOM／model submit、settled、layout read。Svelteの遅延projection・DOM反映はsettledまでのapplyに含む。submitだけでDOM費用と扱わない |
| sampled CPU | `Profiler.start`から`Profiler.stop`まで。180frameの負荷に加え、disposeと退出後1rAFを含む。1ms設定のV8 sampleを標準build mapで元sourceへ戻し、projection、browser view、Babylonのinclusive時間を推定。カテゴリは重なり、短い関数はsampleされない。正確な呼出数や独立したCPU合計ではない |
| main task／rAF | traceの`view-workload-start`〜`view-workload-end`の180frame区間。renderer main threadのRunTaskをframe区間へ割り当てたwall時間と実rAF間隔。ソフトウェアWebGLの待機を含み、CPU占有時間・実GPU elapsedとは異なる |
| layout／paint／GC | traceのworkload mark間だけのphase総時間。退出を含めない |
| sampled allocation | `HeapProfiler.startSampling`から`HeapProfiler.stopSampling`までの16KiB設定の割当推定。180frameの負荷に加え、disposeと退出後1rAF、GC済みobjectsも含む。frameごとの割当や退出を除いた割当量ではない |
| bundle／起動／資源 | 通常distの全JS raw／gzip合計、実sceneと画像までの準備時間、退出後のBuffer／Texture／Programが0であること。全chunk合計は初回転送量ではなく、warm fixture準備時間はcold network起動ではない |

結果JSONの`measurementWindows`に各区間を記録する。CPU・割当samplingはtraceの180frame区間と一致しない。DOM mutation、強制GC前後のheapとNodesも保存するが、これらは割当samplingとは別の観測である。

GPUを含むframe費用は実rAF間隔とtraceを合わせて評価する。SwiftShaderの結果と実機の60fps保証を区別し、描画区間と未確認の実GPU条件を示す。採用前後は同じDocker・viewport・DPR・素材・workload・profiling条件で比較する。

## 外観と提出前検証

[Playwright画像比較](https://playwright.dev/docs/test-snapshots)の固定環境、既存baselineのpath／bytes／許容差を保つ。画像不一致をsleep・許容差増加・無審査baseline生成で隠さない。必要な字体・画像decode・pointer／keyboard modality・viewport・scrollを撮影前に揃える。レビュー資料の撮影やoverlayはVRT成功を代替せず、旧実行参考画像を新たな承認済みgoldenと扱わない。

文書だけの変更は、差分が文書に限られること、リンク・見出し、要求・仕様・設計・制作手順の整合を確認する。規則の変更では既知の失敗案を引き続き棄却できるか確かめる。製品source・CSS・素材・golden・テスト設定を変えなければ、ゲーム全suiteや新しい画像承認は不要。

実装中は必要な短い検証で原因と費用を確認する。提出前はsourceを固定し、check・必要な全直接VRT・資源検証・editorをローカルで完走する。代表数件だけで全件をCIへ委ねない。source／LFS実体／CSS・素材・goldenの前後一致、正確なhead／tree、開始・終了・shutdown、実runnerのworker設定、層別時間、failure／retry別記を残す。GitHub権限・required checks・Actions固有のrunner条件等、ローカルで不可能な条件だけを理由付き例外とする。

ゲーム本体CI対象（`npm run test:browser`）の時間条件は、品質を維持したローカル全工程が起動から終了まで5分以内、または同品質で5分以内にできない明確な根拠が成立すること。条件の充足を実測と検討結果で示し、未確認点を残したまま達成扱いにしない。設定画面の`editor-views`／`editor-resources`はこの判定へ含めず、`npm run test:editor`で必要時に明示実行する。`test:all`は両scopeを検証するコマンドであり、5分の判定対象ではない。部分成功、実描画が多い事実、未測定の推測を不可避の根拠へ置き換えない。公開・マージはユーザー判断に従う。

実runner固有のreport生成・古いJSONの再利用拒否・list-onlyは実CLIで検証する。未登録ファイル、部分結果、coverage欠落はその実reportを入力として実行照合を検証し、同じfixtureを再実行して準備を重複させない。ケース別coverage annotationには回収のwall msを含め、ブラウザcase全体や終了時の集計費用と区別する。共有fixtureは実初期viewport／DPR、標準CDPのGPU deviceと共有page fixture内のprocess CPU累積値も記録する。CPU累積値は全threadの消費量であり、GPU elapsedや排他的なcase CPU時間と扱わない。

VRTは既存画像との回帰を検出し、絶対コントラストやWCAG全体への適合を保証しない。画像背景・半透明・halo上の文字と重要な非文字の読取りは、実際の合成結果と適用条件を別途確認する。設計上の目標、現在のassertion、未確認の範囲を混同しない。

自動検査は自然言語仕様の完全性やassertionの意味を証明しない。レビューでは、公開入力・独立した期待結果・担当層・旧保証の移行先・未確認事項を具体的に読む。

実装と必要な全ローカル検証後に、Codexがpush・通常PRの作成を行う。その後、実装会話を継承しない新しいsubagentを起動し、独立レビューを依頼する。レビュアーはPRの正確なbase／headを確認し、対応するコード・仕様・テスト・依存関係を直接調査する。作業treeを読む場合は対象headと一致させる。親は読取範囲を限定せず、実装担当の自己確認だけで済ませない。

指摘の根拠と実害から必要な修正を選び、再検証・PR更新後のheadを再レビューする。最終headのCI、レビュー結果、未解決事項、現在の許可を確認してマージする。

複雑なPRでChatGPT Proへ補助レビューを依頼する場合は、新しいセッションで対象コードを直接調査させ、回答の根拠を確認する。これは独立subagentのレビューとは別に扱う。マージ担当は、その時点のmain保護・required checks・権限も確認する。設定で強制される条件と運用で確認する条件を分け、CI成功だけで仕様の充足・画像の承認・レビュー判断を代用しない。
