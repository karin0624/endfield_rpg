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
| 実描画：Playwright＋Babylon.js/WebGL | 初期画面VRT、資源寿命、HTTP取得数、culling | DPR上限、非rootでbuildした実配布、実entryのpagehide/HMR、設定ごとの独立構図VRT |
| 通常配布：Playwright | タイトル→探索→帰還→保存再開 | 開発API・fixtureを公開しない短い境界。通常画面10状態の自動画像比較は明示実行のlong suiteへ保持 |

VRTはブラウザの各層で用いる視覚assertionであり、操作・論理規則・I/Oを代替しない。新規基準は現UIの回帰検出用で、ユーザーの完成画像の承認を新たに取得したという意味ではない。共有フォントの仕上げはユーザーが別作業を明示承認した [Issue #99](https://github.com/karin0624/endfield_rpg/issues/99) へ分ける。読めない・操作できない崩れまで免除しない。

## 削除・置換した弱いassertion

- 編成ボタンのRGB/outline値、設定画面のCSS変数だけの比較を、必要状態のVRTと保存後の実会話表示へ置換。ARIA・focus・公開保存形式・仕様化されたWebGL資源数/HTTP取得数は維持した。
- 成長関数に渡していない値の不変比較、未使用payloadの自己比較、健康なstateをJSONコピーするだけの回復検証を削除。実保存、負傷・症状・時計を伴う公開操作で保証する。
- 地面倍率だけの重複した負例を、全設定項目の独立した境界入力表へ統合。値域期待は実装定数から再計算しない。
- 録画専用caseを品質testのskipから切り離し、専用evidence設定へ移動。動画・撮影・overlayの生成を自動テストの成功として数えない。

## 独立レビュー後の修正

- Vitestのstock JSONだけでは個別retryや `test.fails` を判別しきれないため、公開Reporter APIで `options.fails`・retry回数・残存errorを検査する。実CLIで通常成功／retry成功／期待失敗／suite期待失敗の4条件を検証し、後3条件を非ゼロ終了にした。
- ブラウザcoverageは終了済みの追加contextも共有fixtureで検出する。分離した実行で通常pageは成功し、browserだけを要求して追加contextを閉じたcaseは拒否された。namespaceから素のrunnerをimportする負例もBiomeが拒否した。遷移前の回収を追加し、ケース別の収集annotationを結果照合に含めた。
- 両保存APIは4096 bytesのUTF-8入力が「あ」の途中でHTTP chunkへ分割されると旧実装で413となった。raw Bufferで上限を数え、最後にdecodeする修正後は実HTTP回帰が成功した。
- 構図20項目のcontrol同期・draft・JSON exportは実エディターと描画代替の接続に移した。同じ入力・逆方向同期・export全値・reload全値のassertionを維持して2.3秒で成功した。実地面、設定反映VRT、資源、HMRの保証は実rendererに残す。
- 背景404の早期失敗後、モデルimportが資源を確保する競合を修正した。同時読込のsettlement後に失敗を通知し、保留モデルを解放するcaseも含む4つの素材失敗caseで資源0のassertionが成功した。全projectの解析runとは区別する。
- 攻撃／回復の固定時計VRTはPlaywright locatorと同じ整数矩形をpage screenshotへ渡し、paused rAFの安定待ちを避けた。既存画像・許容差を変えず両caseが成功した。
- 初回症状によるカード拡大でHPが上へ動く不具合は、既存の上端を保って情報を下へ展開する修正へ進めた。通常／文字200%の公開座標、説明のキーボード展開・到達性を検証し、初期画面は通常・文字200%・320px幅で修正前との全体pixel diffが0だった。最終CI結果とは区別する。
- 解析buildのJavaScript sourcemap設定でCSS minificationも無効になっていたため、CSSは通常buildと同じminificationを明示した。ルートVRTの基準・許容差は変更しない。
- 品質scriptへのPlaywright引数が末尾の結果検査へ渡る問題を修正した。3モードで`--update-snapshots`等がrunnerへ届き、全件の発見・結果照合は維持されることを確認した。
- 長い通常campaign通しと10状態VRTを `tests/long/` の明示実行へ移した。テスト本文と基準bytesは保持し、既定CIの短い通常配布・UI・settings・renderer境界は継続する。

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

この記録は最終headの全実行を代替しない。PRのCIで最終head＋baseを統合したcommitの`verify`・`browser`・`browser-coverage`とアップロードされた実レポートを確認する。残件はPRに不足・未監査・矛盾を区別して記載し、未実装の将来計画へ逃がさない。権限とレビューの境界は [別表](review-controls.md) に示す。

## 固定監査との照合結果

固定監査の各行を現在の仕様、具体的なassertion、担当runnerへ照合した。以下は領域ごとの変更と例外の要約であり、関連するtest名や成功件数だけから全仕様の保証を宣言しない。監査時の古いファイル位置は、現在の `tests/e2e/{built,debug,ui,settings}/` と照合する。

| 固定監査の領域 | 具体的な不足への対応 | 残る区別・限界 |
| --- | --- | --- |
| UI（UI-C/P/D/B/E/V） | 通常保存・取消・focus、クイック編成の各入力結果、各着弾、実コアのRNG、routeの狭幅、全設定control、実font使用、必要状態VRT。入口は `tests/e2e/built/campaign.spec.ts` と `tests/e2e/{debug,ui,settings}/` | UI-B23のHP位置不変は修正と回帰テストを追加し、最終CIを待つ。UI-V04の絶対コントラストは未検証。全画面タイポグラフィの仕上げは承認済みIssue #99へ分けるが、現在のfont読込・実使用と狭幅操作の保証を混同しない |
| 進行・保存（ADV/DUN/EXP/GROW/REC/SAVE等） | `definitionContracts.test.ts` のDAG/条件分岐負例、`growthRuntime.test.ts` の保証技/習得境界、`multidayAcceptance.test.ts` と `save.test.ts` の公開状態の引継ぎ・拒否 | 公開数量・金額の保存不一致は修正。将来コンテンツや未確定バランスを実装済み保証へ含めない |
| 物品・装備（ITEM/EQUIP/SAVEITEM） | `items.test.ts` の各回優先消費と成功合算、`itemUse.test.ts` の古い入力拒否、`inventoryIntegration.test.ts` の購入→探索→帰還→保存と実戦闘の回復後被弾、装備＋育成＋疲労 | SAVEITEM-03で監査者が推定したversionの包括上限は公開仕様にない。通常版数の保持・不正値拒否は検証するが、version枯渇時の方針は未定義・未検証 |
| 戦闘（BAT-T/A/S/F/L等） | `battleContracts.test.ts` の独立した入力/HP/時刻/出来事/確率等値境界、`skills.test.ts` 等の対象と拒否、Playwrightの途中表示と速度・省略・退出後の論理結果 | BAT-D01〜04の途中速度変更・割込・SP・戦略AI・本編へのmulti/all技提供・最終バランスは未実装計画。実装済みmulti/all runtimeの不足へ読み替えない |
| renderer・tooling・工程（WF-R/C/A/B） | 実WebGL資源/HTTP/cullingの既存契約を維持しDPR・非root・entry寿命・独立設定を追加。両APIの実HTTP拒否・原保存保持、全asset検査、全project実行と生成レポート照合 | WF-B05の手書きID/catalog案は後続の明示指示で不採用。標準coverageと具体的な仕様差分レビューへ置換し、自動で自然言語仕様の完全性を判定したとは扱わない。承認・main保護は別表の工程責任 |

### 未解決の実装仕様

- **UI-V04：画像背景との絶対コントラスト。** VRTで表示回帰は検出するが、文字4.5:1・重要非文字3:1を満たす証明にはならない。標準axeの画像背景検査がincompleteだったため未検証として残す。違反0や目視をテスト成功へ読み替えない。
全実装済み仕様をテストする要求は維持する。上の未解決を残している間は、その要求を達成した・マージ可能とは報告しない。

### HP位置の修正前後の検証

初期画面は通常・文字200%・320px幅の同じ条件で修正前と全体pixel diffが0だった。通常のdocument上のHP行は`817.03125→801.421875`だったものが`817.03125→817.03125`となり、文字200%では`697.828125→557.421875`が`697.828125→697.828125`となった。320px幅はステージ下へ縦積みするため、上の行動結果パネルの拡大で修正前後とも`737.78125→826.5625`となる。狭幅のdocument座標まで固定したとは報告しない。基準画像を更新せず、初期構図を維持する修正の範囲と別のflow変化をレビューで照合する。

### 未定義の設計境界

SAVEITEM-03の通常のversion一致・更新・保存は既存／追加テストで検証する。数量・金額の最大安全整数roundtripも公開APIの契約として保証した。versionの枯渇時の最大値・次操作方針は公開仕様にないため、別の設計境界として残す。未定義の極端値から通常契約全体を未テストとしたり、独自の上限・wrap方針を加えたりしない。

## 標準coverage方式の調査と小規模実証

- Vitest 5の標準V8 providerで同じ `battle.test.ts` を実行すると、import済みだけでは8ファイル・行171/395、game全体をincludeすると27ファイル・行170/1512となった。未読込の `time.ts` は後者だけに8行未到達で現れる。全体の品質率としてこの小試験の数字を使わない。
- Playwright native V8＋Monocartで `x < 0.5` と誤った `x <= 0.5` を比較し、入力0.25/0.75だけをassertすると、両方とも行3/3・文4/4・関数1/1・分岐2/2の100%だった。0.5の期待結果は異なる。今回追加した実コアの等値境界テストはこの種類の誤りを検出する。
- 同一originのreloadで `resetOnNavigation: false` にもかかわらずreload前の関数命中が0、後が1になった。遷移前の回収を追加する根拠とした。
- Playwright公式のaxe-core統合も試したが、画像背景上の編成・戦闘コントラストはincompleteだった。違反0を成功保証と読み替えず、独自画素解析器は採用しなかった。

参考: [Vitest coverage](https://vitest.dev/guide/coverage.html)、[Playwright coverage](https://playwright.dev/docs/api/class-coverage)、[Monocart](https://github.com/cenfun/monocart-coverage-reports)、[Googleのcoverage運用](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html)。
