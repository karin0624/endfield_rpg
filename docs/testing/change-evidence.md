# 仕様テスト整備の検証記録

恒常的な方針は [テスト設計](../testing.md)、仕様の正本は `specs/`、具体的な入力・assertionは各テストコードに置く。この記録は今回の変更理由と検証証跡であり、全assertionを転記する日常台帳ではない。過去の静的監査は [固定commitの記録](https://github.com/karin0624/endfield_rpg/tree/8bee4b79fac4bb95490efa8fc3fc064aa405d640/docs/testing-audit/2026-10-03) を参照する。領域間に重複する監査行数を一意の仕様数やcoverage率と扱わない。

## 既存保証と追加の責務

| 層・技術 | 既存の保証 | 今回補った具体例 |
| --- | --- | --- |
| 静的検査：TypeScript・Biome | 型・整形・lint、配布build | 新しいfixture・HTTPテスト・実行結果確認も対象。runtime仕様の保証とは別扱い |
| 規則：Vitest | 行動順、成長、保存、物品等の公開結果 | 乱数0.5と確率の等値境界、各回の持込み優先消費、成功する重複持込み合算、DAG不正定義 |
| ドメイン接続：Vitest | 探索・帰還・保存の代表経路 | 装備＋成長＋疲労の順序、実戦闘の物品回復後の敵攻撃、負傷控えと療養時計、古い戦闘入力の拒否 |
| 公開I/O：Vitest＋Vite/Node HTTP | 保存APIの正常系と一部不正入力 | 両APIのmethod/origin/content-type、409並行保存、4096/4097byte境界、500でも旧bytes保持、固定保存先 |
| UI接続：Playwright | 対象選択、focus、ARIA、保存導線 | 親capture込みの押し直し、native連続入力の各結果、各着弾HP、表示速度・省略・退出後の実論理状態/RNG |
| 実描画：Playwright＋Babylon.js/WebGL | 初期画面VRT、資源寿命、HTTP取得数、culling | DPR上限、非rootでbuildした実配布、実entryのpagehide。開発HMR・任意設定の構図VRTは下記の必要時suiteへ |
| 通常配布：Playwright | タイトル→探索→帰還→保存再開 | 開発API・fixtureを公開しない短い境界。通常画面10状態の自動画像比較は明示実行のlong suiteへ保持 |

VRTはブラウザの各層で用いる視覚assertionであり、操作・論理規則・I/Oを代替しない。新規基準は現UIの回帰検出用で、ユーザーの完成画像の承認を新たに取得したという意味ではない。共有フォントの仕上げはユーザーが別作業を明示承認した [Issue #99](https://github.com/karin0624/endfield_rpg/issues/99) へ分ける。読めない・操作できない崩れまで免除しない。

## 削除・置換した弱いassertion

- 編成ボタンのRGB/outline値、設定画面のCSS変数だけの比較を、必要状態のVRTと保存後の実会話表示へ置換。ARIA・focus・公開保存形式・仕様化されたWebGL資源数/HTTP取得数は維持した。
- 成長関数に渡していない値の不変比較、未使用payloadの自己比較、健康なstateをJSONコピーするだけの回復検証を削除。実保存、負傷・症状・時計を伴う公開操作で保証する。
- 地面倍率だけの重複した負例を、全設定項目の独立した境界入力表へ統合。値域期待は実装定数から再計算しない。
- 録画専用caseを品質testのskipから切り離し、専用evidence設定へ移動。動画・撮影・overlayの生成を自動テストの成功として数えない。

## 独立レビュー後の修正

- 品質scriptの引数転送に対し、古い成功JSONを残して`--grep built --reporter=list`と`--list --reporter=list`を実CLIで実行すると、部分実行／未実行が古い結果で成功する経路を再現した。実行前にdiscovery/resultを削除し今回のJSON新規生成を必須にした後、全4project成功経路は通り、後2条件は拒否された。ブラウザを使わない実runnerの回帰としてVitestで実行する。
- Vitestのstock JSONだけでは個別retryや `test.fails` を判別しきれないため、公開Reporter APIで `options.fails`・retry回数・残存errorを検査する。実CLIで通常成功／retry成功／期待失敗／suite期待失敗の4条件を検証し、後3条件を非ゼロ終了にした。
- ブラウザcoverageは終了済みの追加contextも共有fixtureで検出する。分離した実行で通常pageは成功し、browserだけを要求して追加contextを閉じたcaseは拒否された。namespaceから素のrunnerをimportする負例もBiomeが拒否した。遷移前の回収を追加し、ケース別の収集annotationを結果照合に含めた。
- 両保存APIは4096 bytesのUTF-8入力が「あ」の途中でHTTP chunkへ分割されると旧実装で413となった。raw Bufferで上限を数え、最後にdecodeする修正後は実HTTP回帰が成功した。
- 構図20項目のcontrol同期・draft・JSON exportは実エディターと描画代替の接続に移した。同じ入力・逆方向同期・export全値・reload全値のassertionを維持して2.3秒で成功した。実地面、設定反映VRT、資源、HMRの保証は実rendererに残す。
- 背景404の早期失敗後、モデルimportが資源を確保する競合を修正した。同時読込のsettlement後に失敗を通知し、保留モデルを解放するcaseも含む4つの素材失敗caseで資源0のassertionが成功した。全projectのcoverage付きrunとは区別する。
- 攻撃／回復の固定時計VRTはPlaywright locatorと同じ整数矩形をpage screenshotへ渡し、paused rAFの安定待ちを避けた。既存画像・許容差を変えず両caseが成功した。
- 初回症状によるカード拡大でHPが上へ動く不具合は、既存の上端を保って情報を下へ展開する修正へ進めた。通常／文字200%の公開座標、説明のキーボード展開・到達性を検証し、初期画面は通常・文字200%・320px幅で修正前との全体pixel diffが0だった。最終CI結果とは区別する。
- 以前の解析buildでJavaScript sourcemap設定によりCSS minificationも無効になっていたため、CSSは通常buildと同じminificationを明示した。現在は下記の通常build＋hidden mapへ統合し、JS/CSSともViteの通常minificationを維持する。ルートVRTの基準・許容差は変更しない。
- 品質scriptへのPlaywright引数が末尾の結果検査へ渡る問題を修正した。3モードで`--update-snapshots`等がrunnerへ届き、全件の発見・結果照合は維持されることを確認した。
- 長い通常campaign通しと10状態VRTを `tests/long/` の明示実行へ移した。テスト本文と基準bytesは保持し、既定CIの短い通常配布・UI・settings・renderer境界は継続する。

## 開発者ツールの用途に応じた検証範囲

ユーザーの用途見直しに従い、低頻度の開発者専用エディターは通常検証を代表的なbattle/adventure設定の標準保存・通常起動・エディター再読込へ絞った。このbridgeは保存値の読込を確認し、新構図のpixelsが期待通りであることまで保証しない。全control・詳細編集VRT・draft・Storage例外・保存失敗時UI・画面組合せ、開発server限定HMR、任意の5control構図VRTは `tests/editor/` と `test:editor` で必要時に確認する。既存本文・基準bytes・許容差を保ち、通常結果へskipとして混ぜない。これは常時保証範囲の用途判断であり、全旧保証が通常CIに残る等価移動ではない。

値の解析と両APIの実HTTP保存・旧bytes保持・固定書込先は通常Nodeテストに残す。browser側の不正値／foreign originだけのAPIケースはこの実HTTP契約と重複するため取り除いた。ユーザー向けキャラ詳細はUIへ移し、本編VRT・実投影・通常モーション・資源解放・pagehide・非root配布・素材境界は通常検証を継続する。本編cameraは保存値で固定し、ユーザーのcamera移動操作がないため、任意のculling四隅・内部／編集previewも必要時へ分けた。通常PC／mobileと未検証環境・別bytes・照合不可の材質fallbackは継続する。上記の追加当時の検証記録を、現在の通常suite範囲へ読み替えない。

## 破壊・修正前との比較

| 対象 | 観測した失敗と復元 |
| --- | --- |
| 見た目proxyの置換 | ボタンのRGBを保ったまま文字を隠す一時変更でVRTが1510pixelの差を検出。変更を復元し更新なしの比較が成功 |
| 確率境界 | 命中・発症・帰還保持の厳密比較を等値も通す比較へ一時変更すると、境界の具体結果assertionが失敗。全変更を復元 |
| 成長の保証技 | 保証技の存在検証を無効にすると追加した定義検証が失敗。復元後の対象テストが成功 |
| 最大安全整数の保存 | 分離コピーで保存側だけ旧`< Number.MAX_SAFE_INTEGER`判定へ戻すと、公開APIが受理した数量/金額のroundtripが`invalid-data`で失敗。修正を戻すと同caseが成功 |
| エディターの一時保存失敗 | localStorage拒否時に警告が通常の保存済みメッセージへ上書きされることを追加caseで再現。警告を保持する修正後に成功 |
| 実行結果 | 実レポートに含まれたNaN/Infinity由来の重複case名をゲートが拒否。パラメータ行を識別できる名前へ修正 |
| focused test禁止 | 分離した負例でVitestの`allowOnly: false`、公式コンテナ内Playwrightの`forbidOnly: true`が`.only`を実際に拒否し非ゼロ終了。品質testへ負例を残していない |

この記録は最終headの全実行を代替しない。PRのCIで最終head＋baseを統合したcommitの`verify`・`browser`とアップロードされた実レポートを確認する。残件はPRに不足・未監査・矛盾を区別して記載し、未実装の将来計画へ逃がさない。権限とレビューの境界は [別表](review-controls.md) に示す。

## 固定監査との照合結果

固定監査の各行を現在の仕様、具体的なassertion、担当runnerへ照合した。以下は領域ごとの変更と例外の要約であり、関連するtest名や成功件数だけから全仕様の保証を宣言しない。監査時の古いファイル位置は、現在の `tests/e2e/{built,debug,ui,settings}/` と必要時の `tests/editor/`・`tests/long/` と照合する。

| 固定監査の領域 | 具体的な不足への対応 | 残る区別・限界 |
| --- | --- | --- |
| UI（UI-C/P/D/B/E/V） | 通常保存・取消・focus、クイック編成の各入力結果、各着弾、実コアのRNG、routeの狭幅、全設定control、実font使用、必要状態VRT。入口は `tests/e2e/built/campaign.spec.ts` と `tests/e2e/{debug,ui,settings}/` | UI-B23の通常幅・文字200%は修正と回帰テストを追加。狭幅のdocument座標固定は分離承認済みIssue #103へ残す。UI-V04の自作plate検証は旧headでの試行として現行テストから除去し、画像上の編成名・halo・重要非文字を含むコントラスト調査は独立品質改善Issue #104へ分離する。全画面タイポグラフィの仕上げは承認済みIssue #99へ分けるが、現在のfont読込・実使用と狭幅操作の保証を混同しない |
| 進行・保存（ADV/DUN/EXP/GROW/REC/SAVE等） | `definitionContracts.test.ts` のDAG/条件分岐負例、`growthRuntime.test.ts` の保証技/習得境界、`multidayAcceptance.test.ts` と `save.test.ts` の公開状態の引継ぎ・拒否 | 公開数量・金額の保存不一致は修正。将来コンテンツや未確定バランスを実装済み保証へ含めない |
| 物品・装備（ITEM/EQUIP/SAVEITEM） | `items.test.ts` の各回優先消費と成功合算、`itemUse.test.ts` の古い入力拒否、`inventoryIntegration.test.ts` の購入→探索→帰還→保存と実戦闘の回復後被弾、装備＋育成＋疲労 | SAVEITEM-03で監査者が推定したversionの包括上限は公開仕様にない。通常版数の保持・不正値拒否は検証するが、version枯渇時の方針は未定義・未検証 |
| 戦闘（BAT-T/A/S/F/L等） | `battleContracts.test.ts` の独立した入力/HP/時刻/出来事/確率等値境界、`skills.test.ts` 等の対象と拒否、Playwrightの途中表示と速度・省略・退出後の論理結果 | BAT-D01〜04の途中速度変更・割込・SP・戦略AI・本編へのmulti/all技提供・最終バランスは未実装計画。実装済みmulti/all runtimeの不足へ読み替えない |
| renderer・tooling・工程（WF-R/C/A/B） | 実WebGL資源/HTTP/cullingの既存契約を維持しDPR・非root・entry寿命・独立設定を追加。両APIの実HTTP拒否・原保存保持、全asset検査、全project実行と生成レポート照合 | WF-B05の手書きID/catalog案は後続の明示指示で不採用。標準coverageと具体的な仕様差分レビューへ置換し、自動で自然言語仕様の完全性を判定したとは扱わない。承認・main保護は別表の工程責任 |

### 分離承認済みの残件

- **UI-V04：画像背景との絶対コントラスト。** 限定したPlayerカードの自作plate計測も現行の通常仕様テストから取り除いた。編成名や見出しの画像／pseudo背景・blur halo、重要非文字を含むコントラスト調査は独立した品質改善として、ユーザーが分離を承認した [Issue #104](https://github.com/karin0624/endfield_rpg/issues/104) へ残す。標準axeのincompleteは不適合の証明でも成功でもない。試作画素解析器はhaloの既知条件で誤判定したため採用しない。VRT・違反0・目視を絶対コントラストの保証へ読み替えない。
ユーザー向けの実装仕様のテスト保証は維持する。開発者ツールの詳細は上記の用途別検証範囲に従う。狭幅HPと上のコントラスト残件はユーザーが別Issueへの分離を承認した。デザインガイドラインは設計指針であり、`specs/`への配置だけで実装仕様・必須テスト・マージ条件に昇格させない。コントラスト改善を未達の実装仕様として完了条件へ置かず、WCAG適合・VRTの視覚回帰・テストの有無を区別する。分離承認をWCAG適合や自動テストの成功へ読み替えない。

### HP位置の修正前後の検証

初期画面は通常・文字200%・320px幅の同じ条件で修正前と全体pixel diffが0だった。通常のdocument上のHP行は`817.03125→801.421875`だったものが`817.03125→817.03125`となり、文字200%では`697.828125→557.421875`が`697.828125→697.828125`となった。320px幅はステージ下へ縦積みするため、上の行動結果パネルの拡大で修正前後とも`737.78125→826.5625`となる。狭幅の後続3カードでは症状行の拡大も加わりHPが126.78125px移動する。仕様は900px以下の縦積みとHP不動を同じ節で規定し、後者に明示的なviewport除外はないため、全幅解決やPC専用条件とは扱わない。狭幅のdocument座標まで固定する受入範囲と追加情報のflow配置は、ユーザーが分離を承認した [Issue #103](https://github.com/karin0624/endfield_rpg/issues/103) へ残す。基準画像を更新せず、初期構図を維持する修正の範囲と別のflow変化をレビューで照合する。

### 旧headの自作contrast試行と分離

旧head [abd6f7c](https://github.com/karin0624/endfield_rpg/tree/abd6f7c8bdcbd073469cd7f0c99347beb556ce9f) では、このPRで追加した [比率計算](https://github.com/karin0624/endfield_rpg/blob/abd6f7c8bdcbd073469cd7f0c99347beb556ce9f/tests/contrast.ts) と [plate前提検証](https://github.com/karin0624/endfield_rpg/blob/abd6f7c8bdcbd073469cd7f0c99347beb556ce9f/tests/e2e/plateContrast.ts) を通常CIで実行していた。限定条件での4.5:1と専用負例を確認した試行であり、画像背景・halo・重要非文字まで含むWCAG適合を示していない。

設計指針から実装仕様の合否条件へ持ち込んでいたため、ユーザーの分離承認に従い、自作計算・plate helper・専用単体テストを削除した。混在していたHP位置ケースからもcontrast前後計測・DOM/CSSを壊す専用負例・contrast添付だけを除き、HP座標・症状表示・キーボード操作・スクリーンショットとHP添付は維持した。optional経路は追加せず、今後の方法・範囲の調査は [独立品質改善Issue #104](https://github.com/karin0624/endfield_rpg/issues/104) で行う。

現在の通常仕様テストはこの試行によるcontrast保証を含まない。基準画像・UI外観を変更せず、既存VRTは承認された画面の構図と視覚回帰を担う。旧headの結果を現在のテスト保証やWCAG適合へ読み替えない。

除去後の`npm run check`は45ファイル・685ケースの発見／全実行／成功を照合した。固定Playwrightコンテナでは通常文字・文字200%のHP位置2ケースが5.7秒で成功し、症状表示・キーボード展開・HP添付と前後スクリーンショットも維持した。この件数は検証時点の観測結果であり、不変要件ではない。対象ケースの撮影をVRT成功として数えず、既存VRTは最終CIで別途確認する。

### 未定義の設計境界

SAVEITEM-03の通常のversion一致・更新・保存は既存／追加テストで検証する。数量・金額の最大安全整数roundtripも公開APIの契約として保証した。versionの枯渇時の最大値・次操作方針は公開仕様にないため、別の設計境界として残す。未定義の極端値から通常契約全体を未テストとしたり、独自の上限・wrap方針を加えたりしない。

## 標準coverage方式の調査と小規模実証

- Vitest 5の標準V8 providerで同じ `battle.test.ts` を実行すると、import済みだけでは8ファイル・行171/395、game全体をincludeすると27ファイル・行170/1512となった。未読込の `time.ts` は後者だけに8行未到達で現れる。全体の品質率としてこの小試験の数字を使わない。
- Playwright native V8＋Monocartで `x < 0.5` と誤った `x <= 0.5` を比較し、入力0.25/0.75だけをassertすると、両方とも行3/3・文4/4・関数1/1・分岐2/2の100%だった。0.5の期待結果は異なる。今回追加した実コアの等値境界テストはこの種類の誤りを検出する。
- 同一originのreloadで `resetOnNavigation: false` にもかかわらずreload前の関数命中が0、後が1になった。遷移前の回収を追加する根拠とした。
- Playwright公式のaxe-core統合も試したが、画像背景上の編成・戦闘コントラストはincompleteだった。違反0を成功保証と読み替えず、独自画素解析器は採用しなかった。

参考: [Vitest coverage](https://vitest.dev/guide/coverage.html)、[Playwright coverage](https://playwright.dev/docs/api/class-coverage)、[Monocart](https://github.com/cenfun/monocart-coverage-reports)、[Googleのcoverage運用](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)。

## 通常ブラウザ実行とV8 coverageの統合

旧CIは同じ170ケースを通常browserで25.2分、専用解析buildのbrowser-coverageで30.3分実行していた。全件discovery・実行結果・VRTの保証を維持し、通常配布と同じminificationのbuildへhidden sourcemapだけを付加して、一回のbrowser実行から合否とproject別coverageを得る構成に統合した。browser内の先行buildも除き、通常・debugをそれぞれ一度生成する。verifyの通常buildは公開build設定の独立した成功確認として残す。`test:coverage`は`test:e2e`と同じ経路の別名とする。

[Viteのhidden map](https://vite.dev/config/build-options.html#build-sourcemap)は外部mapを生成し、実行JSへmap参照コメントを付加しない。Playwrightのnative V8データに、そのchunkの隣接mapをMonocart標準APIの`sourceMap`として渡す。dev fixtureは既存のinline mapを使う。未読込srcの分母、project別report、追加page/contextの拒否、遷移前回収、各case annotationと全件照合は維持する。minified V8からの再mappingによりcounterや率は旧非minify解析buildと一致するとは限らず、旧率の単純比較を合格条件にしない。

分岐指標は生成JSから対応づけられた範囲であり、元TSの全分岐分母を保証しない。[Monocart 2.13の変換処理](https://github.com/cenfun/monocart-coverage-reports/blob/v2.13.0/lib/converter/converter.js#L620-L672)はmapping不能な分岐群を除き、`all`も未収集ファイルの追加だけで読込済みTSのtree shaking削除分や未mapping分岐を埋めない。下記の69src集合一致はsource欠落の確認であり、全分岐維持の証明ではない。

- 単一coverage統合時点の`npm run check`は46ファイル・686ケースを発見し、全実行・成功を照合した。通常・hidden map付き通常・hidden map付きdebugの各buildも実LFS素材で成功した。
- 通常とhidden map付き通常buildのJS/CSS/HTMLは129ファイルすべてSHA-256が一致した。debug同士も151ファイルすべて一致した。通常buildは外部map122個だけが付加され、実行ファイルのbytesは変わらなかった。
- 固定Playwrightコンテナで全4projectの代表6ケースが1.3分で成功した。通常配布の公開境界、debugの実描画VRT、保存reload、uiの選択VRT、settingsの実素材・非root独立buildと構図VRTを含む。6ケース全てにcoverage annotationがあり、global errorは0だった。
- 各projectのreportは69個のsrcを含み、旧CI artifactのsource集合と厳密に一致した。未読込ファイルの0-hitも残った。全件discoveryも従来と同じ170件（built20・debug25・ui80・settings45）だった。この件数一致は今回の実行漏れ比較の観測事実であり、170件や既存ケース構造の不変を要件としない。
- 全件discoveryに上の部分結果を渡すと、未実行caseをゲートが拒否した。通常配布chunkのmapを一時的に外した実ブラウザ実行も共有fixtureが拒否し、mapを復元した。実CLIのVitest回帰では古いJSONによる部分実行／list-onlyの偽成功とcase annotation欠落を拒否した。

この小規模確認を最終headの全件CI成功や5分目標達成と扱わない。最終の統合commitでverify/browserの全実行結果・VRT・coverage artifactを確認する。

[性能改善Issue #102](https://github.com/karin0624/endfield_rpg/issues/102) の診断には工程別・ケース別の時間を含む既存report/logを引き継ぐ。品質維持の判定は実装仕様がテストで担保されていることで行い、同じ仕様保証を実証できる統合・移動・書換え・削除を認める。assertion・ケースの件数や構造を固定せず、保証の対応はテストコードと変更の証拠で説明し、巨大な手書き台帳を追加しない。
