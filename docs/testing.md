# テスト設計と実行

仕様は`specs/`に定める。同じ入力と結果を保証できれば、テストの統合・移動・書換え・削除を認める。件数やファイル構成を維持すること自体を目的にしない。

## 責務と観測結果

ゲームと画面モデルの公開入力・結果を検証する。現在状態への同期適用、A→B→Aの往復後の再入力、commit後の外部I/Oと同期・遅着完了も対象とする。

| 層 | 保証する結果 |
| --- | --- |
| `src/game/` のVitest | HP・症状・疲労・論理時刻・乱数・所持・権利・公開保存形式。実データと独立した具体的期待値 |
| `src/presentation/` と親子結合のVitest | 実コアへ意味入力を順に適用した画面遷移、draft、選択、focus移動／復元、dialog、保存成功／失敗、各演出時点の確定表示。純粋投影の文言・入力可否・位置 |
| 実HTTP／ファイル／Storage境界 | 開発設定APIの保存と失敗時旧bytes保持、通常配布への開発機能・fixture混入禁止、確定済み保存bytesのI/O |
| StorybookとVitest Browser | 製品Svelte部品の単体描画、実入力から意味イベントへの接続、入力・選択・focus・dialogなどの部品間の結合。CSFの公開propsと`play`を同じ状態の再現に使う |
| デザイン原稿との比較 | `.fig`の部品・variant・画面と、対応する独立Storyを同じ固定環境で描画し、寸法と全RGBAの差分0を確認する |
| 直接状態VRT | Fig対象外の戦闘3D・FX・地形を実素材と正当な表示時刻で描画し、既存画像と比較する |
| 直接Native WebGL | 実Buffer／Texture／Programの生成・切替・解放、warm再利用、取得回数、DPR割当、失敗・遅着・pagehide・必要時HMRの資源寿命。ゲーム操作journeyは通さない |

本編・探索のXState設定はゲームの公開入力を通して検証する。state machineやValibot自体の一般的な挙動を再検証するテストは作らない。一方、現行保存の厳密なキー集合・数値範囲、保存拒否理由、所有・権利のdomain整合、無効入力で現在gameを変えない保証は、このプロジェクトの契約として残す。snapshot内部の関数等をcloneや期待値へ含めず、モードとcontextの意味データ、外部処理へ返す確定結果を観測する。

通常のUI結合は、直接状態を与えたStorybookの実部品で検証する。`play`で実際の入力とDOMの公開結果、意味イベントを観測し、複数部品の連携やブラウザ固有のfocus・dialogを確認する。ゲーム進行を長い操作journeyで再実行するE2Eは設けず、ゲーム判断はコア・presentationの検証へ置く。ブラウザadapterはNative操作と意味イベントの接続、測定値の通知、commit済みモデル／frameのSvelteへの受渡しを行う。外観は画素比較で検証し、RGB、私的属性、SVGの要素数を見た目の代理にしない。

確定したゲーム結果と演出表示を分ける。各HP・症状・疲労を確定recordから代入し、表示でルールや乱数を再実行しない。wall msと1倍相当のcue進捗は別の表示入力で、速度変更は次phaseから適用する。CSSの既存keyframes／easingを保ち、[Web AnimationsのcurrentTime](https://www.w3.org/TR/web-animations-1/#setting-the-current-time-of-an-animation)で描画時刻を与える。DOMの最新標本とcanvasが最後に描いた標本も区別する。

必要な検証層は境界と費用から選ぶ。[GoogleのTesting Pyramid](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)と[Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)も参考にするが、件数の割合を合否目標にしない。公開入力・結果・非変更・実I/O資源を検証し、内部関数、呼出順、配列の偶然の位置、非仕様のJSONキー順や診断文言を固定しない。検証対象自体から期待値・負例一覧を作らない。

## 実行方法

Node.jsは `.nvmrc` の24系、ブラウザ・ネイティブライブラリ・システムフォントは[scripts/design-environment.mjs](../scripts/design-environment.mjs)でdigestまで固定するDockerイメージと実LFS素材を使う。ホストのscriptとCIは同じイメージを使い、ローカルのwrapperは`--init --ipc=host`で起動する。viewport・DPR・pointer／keyboard modalityは各比較の入力として別に固定する。

| コマンド | 範囲 |
| --- | --- |
| `npm run typecheck` | `svelte-check --tsgo`によるTS・Svelteテンプレートの検査。TypeScript 7のnative checkerを使い、警告も失敗にする |
| `npm run check` | Biome・型・素材検査・現在の通常minified build・全Vitest／V8 coverage／発見と実行の照合。ブラウザなし |
| `npm run test:browser` | ゲーム本体CIの全工程。checkに続けて異なるdebug／直接view入口を各一度buildし、views／rendererの直接VRT・Native資源検証・native V8を一回実行し、既存結果から品質summaryを生成 |
| `npm run test:editor` | checkと開発時のNative HMR資源検証を必要時に実行 |
| `npm run test:all` | check・必要な3build・既定とeditorの全projectを同じ一回の直列ブラウザ実行で確認 |
| `npm run storybook` | 製品部品・画面のCSFストーリーを手動確認する開発UI |
| `npm run test:storybook` | Vitest BrowserのChromiumでストーリーの描画と`play`を実行。Storybookサーバーの起動・ビルドは不要 |
| `npm run openpencil:verify` | 原稿を標準HTML出力し、独立Storyの描画と全件比較する。export・撮影・比較を同じ固定Docker内で実行 |

CIは共通の固定Dockerイメージを解決した後、一つの検証jobでLFSと`npm ci`を各一度準備し、Nodeはイメージ内の固定版を使う。`test:browser:inside`、`test:storybook:inside`、`DESIGN_IN_CONTAINER=1 npm run openpencil:verify -- --changed`を実行し、後述の成功済み入力signatureを使う。利用可能なsignatureがなければ全件を比較する。結果の件数・失敗・原稿hash・実行環境をActions summaryへ残し、成功時にPNGをアップロードしない。

ローカルのゲーム検証も同じ`run-game-quality.sh`をworkspace所有者で使い、通常buildをその場で再利用する。結果・revision・失敗・skip・retry・global errorと、0-hitを含むsource数・coverageをログとActions summaryへ残す。summaryは既存JSONを読むだけで、品質検証を再実行せず、元の失敗を成功へ変えない。JSON・画像・trace・mapは同じworkspaceで確認する。

コンテナ内では対応する`:inside` scriptを使う。全工程はcheck→必要build→Native→集計の順。通常配布と素材・型の前処理は再利用し、異なる入口だけを追加buildする。gameのNativeは2workersでfile単位に配分し、editor・allは既定1worker。直列条件は`npm run test:browser -- --workers=1`で再現できる。単独の各buildは素材・型の前処理を含む。

並行するcaseはそれぞれcontext／pageと出力先を持ち、coverageは全worker終了後に一度集計する。実行時間は同じsource・scope・環境・worker条件で比較し、起動からshutdownまでの全工程を記録する。共有cgroupのCPU／memory／throttle観測はgameの専有消費やGPU elapsedではない。単一runの時間を安定したCI時間のSLA、直列での短縮不可能性、Actions runner上の実測へ読み替えない。

画像比較を持たないrenderer／editor-resourcesは既存DPR検証と同じ800×900 viewportを使う。実GLB・PNG・PBR・shaderを準備して実drawを行い、viewportを変えてもcanvasの16:9比率とカメラ構図は保つ。DPR1／3と800→640のresize、資源生成・warm切替・遅着／失敗・HMR・退出時0の保証を維持する。性能の改善でもVRTのviewport・DPR・基準画像・許容差を保持する。

通常 `dist/` の初期タイトルは画像比較なしの起動検証を行い、debug `dist-debug/` の初期戦闘は3DのVRTで確認する。attack／healのFXは同じrendererの実地形を保持し、実コアから別々の直接snapshot・BattleScene・UIを生成して既存6画像を比較する。editorの初期2対2はconstructorの準備済み構図を使い、人数変更とresizeだけを再描画する。任意の画面状態は標準Viteの[multi-page build](https://vite.dev/guide/build.html#multi-page-app)で `dist-views/` へ生成する。同じ標準minifierを使い、通常配布へfixtureを混入しない。3出力は異なる実入口の検証であり、coverage専用の解析buildではない。通常4173、debug4175、直接view4174。viewの実 `BASE_URL=/rpg/` で素材を取得し、非root専用buildやURL書換えを重ねない。

開発エディターの状態・設定反映・保存失敗はモデルとAPI境界で検証し、Native HMRと資源寿命は`tests/editor/renderer/`で検証する。エディタ画面・構図のVRTは設けず、Figmaでも管理しない。本編のPC／mobile・既知素材と材質fallbackの直接VRTは通常ゲームの検査として残す。

## デザイン原稿と実装の比較

デザインの正本は[単一の`.fig`](../art-src/openpencil/endfield-rpg.fig)で、部品・variant・画面は編集可能な標準ノードとして保持する。製品部品と同居する`*.stories.ts`の`parameters.design`に原稿ノード・variant・比較条件を定義する。Storybook標準のprepared parametersとindexの`componentPath`から対応一覧を自動集計し、別の手書き対応表は持たない。[原稿設定](../art-src/openpencil/bindings.json)はdocumentと素材だけを保持する。部品はCSFストーリーへ実propsを直接与えて描画する。専用の操作テストも同じディレクトリに置き、複数部品で共有するfixtureは`.storybook/fixtures/`に置く。共通hostはテーマと利用可能な幅・高さ・paddingを与え、他の画面を描いて隠す方法や親画面の実測座標には依存しない。画面は部品を配置する画面コンポーネントとして別に比較する。

画像比較の対象は部品全体と外観が変わるvariant・表示状態で、hover・focus・pressedも通常のブラウザ操作で再現する。任意の文字列・数値・座標の全組合せ、内部の文字・アイコン、素材画像そのものを独立した比較対象にしない。操作結合テスト用のストーリーには、見た目のvariantでない操作手順だけを理由に`.fig`や画像比較を追加しない。戦闘はHUD・操作ボタンなどのUI部品だけを扱い、3D画面全体・戦闘エフェクト・開発エディターをデザイン原稿の比較に含めない。既存のゲーム用VRTとNative WebGLの資源検証は別の保証として維持する。

標準`select`の候補行の強調表示は、一覧を開いて上下キーで再現する。確定済みの`value`が変わらないことを`expectedValue`で検査し、本体の一時表示ラベルは原稿の通常のテキストプロパティへ指定する。候補一覧も含む部品全体を全RGBAで比較する。OSポインタ操作やXvfbは使わない。

参照PNGはOpenPencilの標準HTML出力を固定Chromiumで撮影する。Figの部品は自身の原点から独立してexportし、実装と参照の各DOMの描画領域とpaddingをそれぞれ撮影する。親の座標・合成レイヤーを転写せず、画面は全viewportを比較する。CanvasKitの直接PNG exportとは別の方式で、標準の比較にはHTML経由の出力を使う。原稿と実装の寸法・全画素・全RGBAが一致した場合だけ成功し、許容差・除外領域・拡縮・色補正を使わない。PNGは実行時の生成物であり、承認して更新するbaselineとしてコミットしない。

| 引数 | 実行内容 |
| --- | --- |
| なし | 登録した全部品・必要状態・画面を比較する |
| `--list` | Story設定から部品・variant・画面の対応一覧を`report.json`へ集計する。画像生成・比較・signature更新は行わない |
| `--diff` | 成功済み入力との差分、選択対象と理由を`report.json`へ出す。撮影・画素比較・signature更新は行わない |
| `--changed` | 変更に依存する対象だけを生成・撮影・比較する。有効な成功済みsignatureがない初回は全件を選択する |
| `--select ID,ID` | 指定IDだけの調査用実行。成功しても全体の`complete`は`false`で、共有signatureを更新しない |
| `--workers auto\|N` | CPU割当と利用可能メモリによる自動並列数、または指定した正整数の並列数で実行 |

引数は`npm run openpencil:verify -- --changed`のように渡す。差分判定は、原稿のノードツリーと参照する部品定義・variant・色変数とalias・文字等のスタイル・画像bytes・フォントを辿る。独立した部品の原稿上の配置座標と編集用メタデータは判定から外し、その部品を含む画面内の配置は画面の入力として扱う。実装側はViteの解決済みimport依存にあるSvelte・TS・CSSと、撮影時に利用した公開素材のファイルhashを使う。ファイル単位の依存なので、共通CSSなどの変更ではそのファイルを利用する複数部品を保守的に再比較する。`--diff`でも依存を解決するStorybookのbuildは必要になる。

比較に成功した入力signatureは`.openpencil/design-snapshot.json`へ保存する。全件、または成功済みsignatureから選んだ変更対象の全件が一致した場合だけ更新し、失敗・明示選択・差分表示では更新しない。JSONには入力hashと依存関係を保存し、参照・実装PNGのキャッシュは持たない。選ばれた対象の参照・実装PNGは毎回生成する。削除・破損・未検証・非互換のsignatureは再利用せず、初回と同様に全件を選択する。提出前はこの差分選択にかかわらず全件比較を行う。

デザイン差分判定のCIキャッシュも成功したsignatureのJSON一つだけを対象とし、PNG・HTML・原稿本体は含めない。保存keyはmainとPR番号・検証commitを分ける。同じ検証commitの成功済みkeyがなければ、同じPRの直近成功key、PRのbase main SHAのkey、同じ共通pipelineのmain keyの順に復元する。main実行ではPRのkeyを使わない。共通のexport・撮影・比較・差分判定、Storybook設定、依存lockfileの変更でキャッシュのnamespaceを変え、初回の全件比較へ戻す。全検証scopeが成功したjobだけがsignatureを保存する。ローカルとCIは[scripts/design-pipeline.mjs](../scripts/design-pipeline.mjs)で同じfingerprintを計算する。CI専用のhash定義を持たない。

並列数は[scripts/design-workers.mjs](../scripts/design-workers.mjs)で実行先のCPU割当・cgroup quota・利用可能メモリから決め、環境別の固定上限を設けない。ローカルから新しいDockerを起動するときもホストのCPU・メモリ制限を引き継ぐ。exportと撮影では必要メモリが異なるため、各工程の開始時に並列数を再計算する。各export workerは独立したFig graphを持ち、各撮影workerは独立したブラウザを持つ。対象・出力先を分離し、失敗時は開始済みworkerの終了を待ってから終了する。`report.json`には資源情報・実並列数・build／集計／差分判定／export／撮影と比較／終了までの全体時間を記録する。

結果は`test-results/openpencil/verification/report.json`へ保存する。CIは成功時にPNGをアップロードしない。失敗時だけ[scripts/design-artifacts.mjs](../scripts/design-artifacts.mjs)で失敗対象の参照・実装・差分PNGと診断JSONを`test-results/design-failures/`へまとめ、1日だけ保存する。PNGの合計予算は一実行20MiBで、超過時は画像だけを省き、全失敗一覧と画像の省略対象はJSONに残す。比較件数を減らして予算へ合わせることはしない。

## Coverageと実行漏れ

Vitest 5の標準 `@vitest/coverage-v8` で `src/**/*.{ts,svelte}` と `scripts/*.{ts,mjs}` をincludeし、未読込も分母へ含める。部品と同居する`*.stories.ts`とStory専用の`*.stories.svelte`は検証用コードとして除外する。ゲームとpresentationは行97・文95・関数100・分岐93の閾値を適用する。率のために来ない入力・不可能状態・冗長防御を作らない。

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

デザインマスターと実装の同期には、[デザイン原稿と実装の比較](#デザイン原稿と実装の比較)も使う。提出前は`npm run openpencil:verify`を全件実行し、原稿に登録した部品・variant・画面の全RGBAの差分0を要求する。差分実行や明示選択だけを、全件比較を行った証拠にしない。

文書だけの変更は、差分が文書に限られること、リンク・見出し、要求・仕様・設計・制作手順の整合を確認する。規則の変更では既知の失敗案を引き続き棄却できるか確かめる。製品source・CSS・素材・golden・テスト設定を変えなければ、ゲーム全suiteや新しい画像承認は不要。

実装中は必要な短い検証で原因と費用を確認する。提出前はsourceを固定し、check・必要な全直接VRT・資源検証・editorをローカルで完走する。代表数件だけで全件をCIへ委ねない。source／LFS実体／CSS・素材・goldenの前後一致、正確なhead／tree、開始・終了・shutdown、実runnerのworker設定、層別時間、failure／retry別記を残す。GitHub権限・required checks・Actions固有のrunner条件等、ローカルで不可能な条件だけを理由付き例外とする。

ゲーム本体CI対象（`npm run test:browser`）の時間条件は、品質を維持したローカル全工程が起動から終了まで5分以内、または同品質で5分以内にできない明確な根拠が成立すること。条件の充足を実測と検討結果で示し、未確認点を残したまま達成扱いにしない。開発時の`editor-resources`はこの判定へ含めず、`npm run test:editor`で必要時に明示実行する。`test:all`は両scopeを検証するコマンドであり、5分の判定対象ではない。部分成功、実描画が多い事実、未測定の推測を不可避の根拠へ置き換えない。公開・マージはユーザー判断に従う。

実runner固有のreport生成・古いJSONの再利用拒否・list-onlyは実CLIで検証する。未登録ファイル、部分結果、coverage欠落はその実reportを入力として実行照合を検証し、同じfixtureを再実行して準備を重複させない。ケース別coverage annotationには回収のwall msを含め、ブラウザcase全体や終了時の集計費用と区別する。共有fixtureは実初期viewport／DPR、標準CDPのGPU deviceと共有page fixture内のprocess CPU累積値も記録する。CPU累積値は全threadの消費量であり、GPU elapsedや排他的なcase CPU時間と扱わない。

VRTは既存画像との回帰を検出し、絶対コントラストやWCAG全体への適合を保証しない。画像背景・半透明・halo上の文字と重要な非文字の読取りは、実際の合成結果と適用条件を別途確認する。設計上の目標、現在のassertion、未確認の範囲を混同しない。

自動検査は自然言語仕様の完全性やassertionの意味を証明しない。レビューでは、公開入力・独立した期待結果・担当層・旧保証の移行先・未確認事項を具体的に読む。

## 独立レビューとPR

実装と必要なローカル検証後に変更をコミットし、[reviewer定義](../.codex/agents/reviewer.toml)のCodex subagentを、実装会話を継承しない新しいコンテキストで起動する。比較元と対象のコミットSHA、目的・受入条件、検証結果を渡す。PR作成は起動条件にせず、定義のモデル・推論強度を使う。実装担当の結論で誘導せず、コード・仕様・テストを直接調査させる。レビューの判断基準と出力はagent定義を正本とする。

指摘の根拠と実害から必要な修正を選び、再検証・コミット後の対象SHAを再レビューする。レビュー完了後、許可された範囲でpush・通常PR作成または既存PR更新を行う。PR上で変更した場合も、新しい対象SHAを同じ手順で確認する。

マージ担当は、最終headのCI、レビュー結果、未解決事項、その時点のmain保護・required checks・権限と現在の許可を確認する。設定で強制される条件と運用で確認する条件を分け、CI成功だけで仕様の充足・画像の承認・レビュー判断を代用しない。
