# 共通UI部品

同じ役割の構造と契約を再利用するための参照である。[原則](principles.md)と[基本デザイン](foundations.md)に従い、配置は[画面設計](screens-and-patterns.md)、現在の使用画面は[適用一覧](adoption.md)で確認する。未実装の提案を完成した部品として登録しない。[アクセシビリティの共通要件](accessibility.md)を各部品の入力・状態・画面適用へ対応付ける。

## 現在の部品

| 部品 | 目的と構造 | バリエーション・状態・入力 | 実装 |
| --- | --- | --- | --- |
| `ui-screen` / `ui-dialog` | 共通文字・色・操作の適用範囲。画面とmodalの容器 | クラス自体はmodal制御を行わない。dialogの開閉・背面抑止・復帰は対象view/modelが所有 | [`ui.css`](../../src/web/ui.css)、[`Party.svelte`](../../src/web/components/Party.svelte)、[`CharacterDetails.svelte`](../../src/web/components/CharacterDetails.svelte) |
| `ui-title` / `ui-heading` | 画面見出しと区切り | 狭幅用文字サイズはCSSに定義。見出しの有無・位置は画面で決める | `ui.css` |
| `ui-button` | ラベルを持つ矩形操作。装飾層のみclipし、focusは外側に残す | 通常・hover・active・disabled・focus-visible。寸法はCSSの最小値と内容で決まり、Native buttonの意味入力を使う | `ui.css` |
| `ui-back` | 仕様で定める戻り操作。方向を補助する図案 | 通常ボタンより幅・切欠き・paddingが異なる。戻る結果をクラスで決めない | `ui.css`と対象model |
| `ui-primary` | 画面の主たる確定・実行を強調 | 通常より広い最小寸法、別の面・文字色・方向図案。disabled時は図案を除く。出発の有無はmodelに従う | `ui.css`、[`partyProjection.ts`](../../src/presentation/partyProjection.ts) |
| `ui-frame` | 情報カード等の装飾枠 | 中空枠で透過下地を見せる。入力先や選択の意味を自動で付与しない | `ui.css` |
| 編成枠・仲間候補・詳細入口 | 編成編集、候補の選択、表示専用詳細を分ける | 選択番号・HP・症状・内部scroll・選択解除・詳細復帰は[編成仕様](../../specs/party.md)。共通ボタンへ機械的に置換しない | `Party.svelte`、[`party.css`](../../src/web/party.css)、[`partyModel.ts`](../../src/presentation/partyModel.ts) |
| 四面体マーカー | 対象と入力先の対応を補助する既存の図案 | 戦闘の選択敵と会話選択肢の契約は[戦闘画面](../../specs/visuals.md)・[会話](../../specs/adventure.md)。既存意匠の一般的な使用数方針は原則1個・最大2個。別対象での必要性を検討し、他の選択表示へ重ねる理由を求める | [`style.css`](../../src/web/style.css)、戦闘描画・[`Conversation.svelte`](../../src/web/components/Conversation.svelte) |

共通部品の採用は完成画面への一致や承認を意味しない。専用部品、画像上のアンカー、図案型入口等の例外は目的と承認範囲で判断する。既存の部品名だけを揃えるために、他画面や演出の構造を変更しない。

## サイズ・図案・状態を検証する

容器の寸法、SVG/image箱、clipと変形後の図案占有、線幅・内部の空間、ラベルの占有、hit領域を記録する。図案の光学的な中心と重さも実表示で比較する。大きさの群や例外は、用途・内容・入力と比較結果に根拠を求める。ホーム・街案の円型入口は試験中であり、既存矩形部品の最小寸法や未承認の円径を共通S/M/L値にしない。

各部品を通常・hover・pressed・focus・選択・disabled等の実際に存在する状態で確認する。保持選択の無い操作に選択状態を捏造しない。透過・画像下地・枠と図案内部の隣接色、CSS詳細度やfilterによる実色の差も確認する。色だけ、容器だけ、図案占有だけの変更を区別できる比較は[制作手順](production-and-validation.md#仮説と比較条件)に従う。

## 編成の接続契約

旧`PartyUiOptions.context`の`edit`／`departure`が表した責務を現行modelへ対応付ける。現在の[`CampaignParty.context`](../../src/presentation/campaignModel.ts)は両文脈を区別し、同ファイルの`partyInput`が出発文脈だけに`PartyInput.departure`を渡す。編集から実出発を追加しない。`PartyUiOptions`や旧コールバックを現在のAPI名として記載しない。

ホーム・探索先・持込みdraft・保存・実入場は本編model、編成の選択と確定は編成modelが所有する。出発成功まで在庫や時間を消費せず、編集・出発の戻り先を保持する。具体的な契約と検証は[編成](../../specs/party.md)・[物品](../../specs/items.md)・[テスト設計](../testing.md)を参照する。
