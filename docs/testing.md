# テスト設計

## 基本方針

実装済みの仕様は用途・使用頻度・失敗時の影響に応じてテストする。ユーザー向け機能と、低頻度の開発者専用ツールで毎回必要な品質保証を分ける。仕様の正本は `specs/`、公開の入力・前提・独立した期待結果はテストコードに置く。仕様やassertionを巨大な別台帳へ転記しない。目視確認は開発中のデバッグ・デザインレビューであり、テストではない。撮影・録画・overlayの生成も、自動VRTの成功とは区別する。

`docs/design-guidelines.md` は設計指針であり、`specs/`への配置だけで実装仕様・必須テスト・マージ条件に昇格させない。外観回帰の期待結果は承認された画面仕様とVRT基準に基づく。

型検査、coverage率、似た名前のテスト、成功件数だけでは仕様の充足を証明できない。受入条件に対して、何を入力し、どの結果をどこでassertするかをレビューする。未対応・未監査・仕様矛盾・将来未実装を区別し、実装に合わせて期待を狭めたり、テストの不足を目視で埋め合わせたりしない。

「品質を維持する」とは、実装仕様がテストで担保されていることを維持することであり、assertion・ケースの件数や構造の不変を要件としない。同じ仕様保証を実証できる統合・移動・書換え・削除は認める。保証の対応と検証結果は具体的なテストコードと変更の証拠で説明し、巨大な手書き台帳は作らない。

開発者専用の構図・会話エディターは、通常検証では代表値の標準保存→通常読込を各一本確認する。値の解析と、保存失敗でも旧ファイルを壊さず固定先だけへ書く実HTTP契約は既存Nodeテストで継続する。詳細control・draft・例外UI・画面組合せ・任意設定VRT・HMRは `test:editor` の必要時検証へ分ける。これは用途による常時保証範囲の見直しであり、全旧保証が通常CIに残る等価移動とは扱わない。本編の入力・VRT・実投影・通常モーション・資源解放は継続する。

本編の戦闘cameraは保存設定で固定し、ユーザーのcamera移動操作を持たない。任意の四隅・内部視点・編集previewのVRTは必要時suiteに含める。通常のPC／mobile構図と、未検証環境・別bytes・素材照合不可の元材質fallbackは通常検証に残す。

同じ保証は、必要な境界を通る最も低コストの層で担う。規則の全組合せをブラウザへ複製しない。VRTはブラウザテストに置く**視覚assertion**であり、操作やゲーム状態を一括で保証する独立層ではない。

[GoogleのTesting Pyramid](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)と[Kent C. DoddsのTesting Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)を参考に、割合を合否目標とせず、保証に必要な境界と実測した費用からテストを選ぶ。

## 保証対象からテストを選ぶ

層は使用する通信方式やファイルの置き場ではなく、保証する責務で分ける。必要な境界を実際に通し、同じ保証をより低コストで検証できる層を優先する。

### 1. 静的な整合性

型・構文・依存・コード規約の整合性を保証する。実行時の振る舞いを保証する層ではない。TypeScriptとBiomeを使う。

### 2. 個々の規則

独立した規則について、公開入力に対する結果と境界条件を保証する。複数機能の接続が必要な条件は次の層で担う。Vitestを使い、仕様から決めた期待値をassertする。

### 3. ロジックの結合とゲームの内部状態のテスト

実際の複数機能を接続し、状態遷移と副作用の整合性を保証する。モデルや表示用ロジックも、DOMや描画なしで検証できる接続はここで担う。UI入力や描画の正しさはブラウザ側に委ねる。

Vitestを使う。公開I/Oを通す必要がある場合は実Vite/Node HTTPも使う。HTTPは接続を再現する技術であり、保証対象を分ける独立した分類ではない。

### 4. 入力から画面・状態への接続

実際の入力経路を通じて、操作に応じた表示・状態の変化を検証する。実UIと必要な実ロジックを接続し、規則の全組合せや実描画固有の責務は他の層へ委ねる。描画を必要としない条件では描画だけを代替する。

Playwrightを使う。実表示の比較にはVRTを視覚assertionとして使う。

### 5. 実描画と資源の接続

実描画の結果と、その準備・更新・解放に関する契約を保証する。描画代替では検証できない境界をここで担い、ゲームの規則を重複して検証しない。

Playwrightと実Babylon.js/WebGLを使う。実表示の比較にはVRTを使う。

### 6. 通常配布の境界と代表経路

配布されたアプリの起動・接続と、利用者が辿る代表経路を保証する。実配布を通す必要がある境界に絞り、詳細な規則・組合せは低い層へ委ねる。

通常buildとPlaywrightを使う。実表示の比較が必要な状態にはVRTを使う。

## 代表例

以下は各責務を具体化した例であり、全仕様を転記したcatalogではない。方針の定義は上の節で独立して示す。今回の既存保証・追加・削除代替・残件は [変更の検証記録](testing/change-evidence.md) を参照する。

| 責務 | 受入条件と具体的な検出方法 |
| --- | --- |
| 個々の規則 | 命中率0.5では乱数0.5が外れるとVitestでassert。両分岐のcoverageが100%でも `<` と `<=` の違いは保証できない |
| 個々の規則 | 持込みを消費ごとに2→1→0、その次に獲得分が減るとassert。4回後の最終値だけで済ませない |
| ロジックの結合と内部状態 | 実探索・成長・装備・疲労・帰還・保存復元を接続し、操作ごとの実状態と副作用をassert |
| ロジックの結合と内部状態 | 実 `actInExpedition` の回復7→敵被弾4→3、最終HP13・RNG1・バッグ1を独立期待でassert |
| ロジックの結合と内部状態 | 保存APIに409の並行処理、413の上限入力、500の書込み失敗を実HTTPで渡し、応答と旧保存bytes保持をassert。mock呼出回数だけで保存成功としない |
| 入力から画面・状態への接続 | campaignの親capture／bubbleを通す候補の押し直しで、各入力直後の選択状態をassert。dialogを閉じた後のfocus、ARIA、保存結果も実入力から確認 |
| 入力から画面・状態への接続 | Playwright Clockで表示時刻を制御し、各着弾のHPと、速度・省略・退出後の実論理状態／RNGをassert |
| 入力から画面・状態への接続 | 開発エディターは代表値の保存・通常読込を通常検証に残す。全control・draft・失敗UI・JSON出力・編集VRTは必要時の `test:editor` で確認 |
| 入力・実表示 | 編成の選択／解除、押下／focus／disabled、狭幅をVRT比較。RGB／outline／CSS変数だけの比較を見た目の保証にしない。開発エディター保存後の実会話VRTは必要時suiteで確認 |
| 実描画と資源 | 実投影・素材・DPR・非rootのasset URL・culling、退出・pagehideの資源解放、仕様化されたWebGL資源数／HTTP取得回数をassert。開発server限定のHMRは必要時suiteで確認 |
| 通常配布 | 通常buildの起動・入力・保存導線と、デバッグ機能・開発API・fixtureの混入禁止を確認 |

描画代替fixtureでは途中のHP・勝敗・RNGを注入して成功とせず、実コアの操作から到達させる。代替rendererの座標は実投影の正しさを保証しない。ARIA、focus、公開保存形式、仕様化された資源／取得数は意味ある観測結果として維持する。

探索・帰還・保存・療養のUI接続は `tests/e2e/ui/debug-session.spec.ts` で実devエントリーと実セッションの配線を使い、描画moduleへの通信だけを既存renderer代替のfixture URLへHTTP redirectする。[Playwrightのroute](https://playwright.dev/docs/api/class-route#route-fulfill)をケースのファイル内に限定し、ゲーム状態・結果・保存処理を置換しない。fixtureの実URLで読み込むことで、代替コードを `src/web/battleScene.ts` のcoverageへ誤帰属させない。通常debug buildの加入→編成→ボス帰還→再訪・保存の代表経路、実素材の投影・通常モーション・VRT・資源解放は実rendererで確認する。

必要時の単独control構図VRTは条件ごとに実rendererを作り直し、初期設定の受渡しと既定へ戻す更新を両方比較する。ページ・module・HTTP cacheの読込みだけを共用し、初期設定の検証を同rendererへの更新だけで置き換えない。

必要時のdraft検証は実エディターの既存fixtureで入力し、draft追加前後の通常表示は実WebGLのcanvasを二回比較する。最後は通常表示のリンクから実エディターを起動し、draftが存在する実エントリーでの復元も確認する。

## 実行と速度

Node.jsは `.nvmrc` の24系を使う。ブラウザは固定した `mcr.microsoft.com/playwright:v1.63.0-noble` と実LFS素材を使い、基準生成と比較の環境を揃える。ホストからは以下のscriptを使う。CIはコンテナ内の `:inside` を実行する。

| コマンド | 担当 |
| --- | --- |
| `npm run check` | Biome・型・Vitest・V8 coverage・発見／実行結果照合。ブラウザなし |
| `npm run test:e2e` | 既定の `built`・`debug`・`ui`・`settings` 全projectを一回実行し、合否・VRT・native V8 coverageを確認 |
| `npm run test:ui` | UI変更箇所の短い確認。全projectの最終チェックは代替しない |
| `npm run test:editor` | 開発エディター・任意構図・HMRの詳細を必要時に明示実行。通常PR CIには含めない |
| `npm run test:coverage` | `test:e2e`と同じ全件実行・coverage生成の別名。CIでは二重実行しない |
| `npm run test:long` | 明示実行する長い通常campaign経路と10状態VRT |

長いタイトル→導入→街→編成→戦闘→帰還→保存再開と10状態VRTは `tests/long/campaign.spec.ts` に内容と基準bytesを保持し、明示実行する。開発エディター・標準構図JSON・HMRを変更したときは `tests/editor/` の詳細suiteも実行する。両suiteは専用configで全件を発見・照合し、skipや未実行として通常結果へ混ぜない。短い通常配布・入力・VRT・renderer境界と代表設定の保存・読込は既定CIに残す。

本番の通常buildは4173、専用debug buildは4175、一時ソースコピーのfixture／エディターは4174で起動する。エディターの保存テストは本来の標準設定を上書きしない。`built`等のproject名はテストの所属を表し、取得元buildを厳密に限定するものではない。例えば通常配布テストも保存key隔離のためdebug originへ移動し、通常の`settings`には独立buildもある。HMRは必要時のeditor suiteで確認する。

待機は対象の完了条件を再試行付きassertionやイベントで待つ。準備完了と無関係なボタン、固定sleep、操作間のcooldownを同期条件にしない。表示時間はPlaywright Clockで制御し、実ネットワークの保留は解放可能なgateを使う。リサイズは最終ステージ寸法と札／マーカーの位置関係を同時に確認し、途中の寸法を成功にしない。画像不一致をsleep、許容差増加、無審査のbaseline更新で隠さない。

[Playwright Clock](https://playwright.dev/docs/clock)はアプリがtimerやrAFを登録する前に導入する。`runFor`は途中の全timer・rAFを実行する。段階の到達とその状態が保証対象である場合に限り、非同期に連鎖する各段階の期限へ個別に`fastForward`できる。`fastForward`は期限を超えたtimer・rAFを各一回だけ発火し、連続描画の検証を代替しない。一括の大きなjumpでは後続timerの開始が遅れる。補間や連続描画を保証するケースは必要なフレームを実行し、固定段階VRTでは撮影時刻と最後の描画標本を保つ。構図入力の一括操作では編集中の時計を止め、再開後に実接地の完了と既存VRTを確認できる。いずれも、実入力・実ロジック・必要な実描画を通す責務を変えない。[画像比較](https://playwright.dev/docs/test-snapshots)の基準・許容差・固定環境を保ち、撮影資料の生成でVRT成功を代替しない。

段階時刻・途中演出を保証しない成長・帰還・保存などの接続ケースは、既存の演出速度UIで「即時」を明示できる。速度によるHP・時計・疲労・RNG・次入力の不変性は専用ケースで検証し、各着弾・補間・取消・速度変更期限・通常モーション・VRTの検証を即時設定で代替しない。

CIを直列実行して5分未満にすることを目指すが、超過だけをPR却下やtimeoutの理由にしない。品質を先に担保し、低コスト層への移動、重複除去、時計制御、明示実行の範囲を検討する。同じ保証で目標へ収まらない場合は、実測と残る保証をIssueへ示し、次の最適化で相談する。同じ仕様保証を欠く削除やassertionの弱化で時間を合わせない。実測と受入条件は [性能改善Issue #102](https://github.com/karin0624/endfield_rpg/issues/102) へ記録する。診断への引継ぎでは工程別・ケース別の時間とログを保全し、件数や構造の固定ではなく同じ仕様保証を実証できる再編を検討する。

録画・承認画像とのoverlayは `playwright.evidence.config.ts` 等のレビュー資料であり、品質ケースのskipとして混ぜない。失敗時の画像・trace・JSON、coverageのHTML/LCOVをartifactへ保存する。基準画像の更新は差分理由と実画像をレビューし、自動生成したから正しいとは扱わない。

### ローカルで検証してから提出する

実装中は変更箇所の短いテストとtraceで失敗原因・費用を確かめる。コード変更の提出前は実装を終え、`npm run check`、変更に必要な全ローカルテスト、固定Dockerの全既定project・coverage・関連VRT・通常buildを完走し、独立レビューで指摘された点を修正する。代表数件の成功だけで全件確認をCIへ委ねない。修正が保証へ影響する場合は、必要なローカル検証を再実行する。文書だけの変更はリンク・内容・差分など、変更に必要な検査を行う。

レビューと修正後の差分・実行結果・ログを揃えてから、変更をまとめてpushしPRする。CIの実行ごとに小修正を送る反復を通常の開発手順にしない。GitHub側の権限・required checksやActions固有のartifact処理など、ローカルでは確認できない条件だけを例外とし、理由と未確認内容をPRへ示してCIで確認する。依存・実素材・固定ブラウザを取得すれば実行できるテストは、この例外にしない。

## Coverageと差分レビュー

Vitest 5の標準 `@vitest/coverage-v8` で `src/**/*.ts` と `scripts/*.{ts,mjs}` をincludeし、未読込ファイルも分母へ含める。`coverage/unit/` を責務に照らして確認する。率を上げるだけのテストは追加しない。

ブラウザはPlaywright native V8とMonocartを使い、自前のsrc TSをsourcemapで正規化する。全srcの未読込も含め、vendor・テスト・CSSを混ぜない。`coverage/browser/{built,debug,ui,settings}/` はprojectごとの実行由来のレポートであり、同じ分母を平均・合算したり、unit率と統合したりしない。通常配布と同じminification・tree shakingのbuildを`dist/`・`dist-debug/`へ一度生成し、hidden sourcemapだけを付加する。共有fixtureが実行中のV8データへ隣接する外部mapを渡す。fixture／エディターのdevソースはViteのinline mapを使う。専用の非minify解析buildは作らない。配布・操作・VRTの合否とcoverageは同じ実行から得る。全srcの未読込ファイルは分母から除外しない。minification後のV8データを再mappingするため、counterや率は旧非minify解析buildと同じになるとは限らない。旧レポートとの率の単純比較を品質の判定に使わない。

ブラウザの分岐指標は生成JSから元TSへ対応づけられた範囲を表し、元TSの全分岐分母を保証しない。[Monocart 2.13の変換処理](https://github.com/cenfun/monocart-coverage-reports/blob/v2.13.0/lib/converter/converter.js#L620-L672)はmapping不能な分岐群を除く。`all`は未収集ファイルを追加するが、読込済みTSのtree shakingで削除された部分や未mapping分岐を補完しない。今回の69src集合の一致はsource欠落の確認であり、全分岐維持の証明ではない。

CIは通常suiteのgit上の品質テストファイル、runnerの `--list`、実JSON結果を照合し、空／未発見ファイル、重複名、未実行、skip/todo/only、失敗・retry・期待失敗を拒否する。`long`・`editor` は各ディレクトリを専用modeで同じ実行照合へ渡す。Vitestの標準Reporter APIで個別retryと期待失敗も確認する。全件ブラウザ実行は共有fixtureを必須にし、追加context/pageや遷移前回収漏れ、map欠落・不正、ケースごとの収集欠落を拒否する。手書きの仕様ID・テストID台帳や独自runnerは増やさない。

自動検査は登録漏れや未実行を検出するが、assertionの意味や自然言語仕様の完全性は証明しない。PRでは次を確認する。

- 変更する仕様参照、公開入力、期待結果、具体的なテスト名とassertion、担当する保証責務を示す。
- テストが実際に通す入力経路と、観測結果が受入条件を満たす根拠を読む。実装による制限が通常操作を損なわないことを確認する。
- 修正前や妥当な一時的破壊で回帰テストが失敗することを確認し、復元後結果を記録する。全テストへ機械的な変異試験を足すという意味ではない。
- 既存仕様の不足・未監査・矛盾が判明したら明記する。将来未実装を混ぜず、目視やCI成功で不足を消さない。
- 正確な最終headとbaseの統合commitで全既定project、実行JSON、coverage、VRT差分を確認する。基準画像の承認とテスト成功は別に確認する。

mainの保護・required checksが未設定のため、CIを実装しただけでマージを強制的に止めたとは報告しない。最終チェックと承認は [マージ実施側の確認](testing/review-controls.md) が担う。
