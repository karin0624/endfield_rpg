# 画面設計

画面の目的から情報・操作・部品の組合せを決める。共通の表現は[デザインシステム](design-guidelines.md)、素材制作と実装・比較は[制作手順](ui-asset-production.md)、ゲーム規則は[仕様](../specs/overview.md)を参照する。

## 設計の順序

1. プレイヤーの目標、入口・出口、完了条件、変更範囲を決める。
2. 情報0個から始め、判断に必要な情報と操作だけを加える。既存要素にも残す理由を求める。
3. 全パーツを棚卸しし、文字・数値・図案・枠・面・状態表示を完成部品へ対応付ける。
4. 各部品にfamily・variant・token・stateを割り当てる。共通規則で不足する場合は、実画像で問題と改善案を確かめる。
5. 情報の関係、視線と入力の順序から構図を作り、固定版Figmaと必要な状態画像で局所・全体を確認する。

寸法や配置は実書体・図案・背景で判断する。新しい構成を考える際は旧CSSを前提にせず、指定された保持条件と承認済み固定版の範囲を守る。

## 画面ごとに決めること

画面仕様に次を記す。既存デザインへ位置を合わせる修正では、その固定版を参照して今回の差を特定する。

| 項目 | 内容 |
| --- | --- |
| 目的と範囲 | 何を判断・完了する画面か、入口・出口、変更対象 |
| 判断と情報 | 必要な理由、データの所在、常設／必要時／別画面、優先度 |
| 全パーツ割当 | 完成部品、family／variant／token／state、構成と選択理由 |
| 全操作 | 入力方式、許可条件、直後の結果、再入力、確定・取消・戻る |
| 保持と復帰 | draftと確定、保持・破棄する内容、focus・scrollの復元 |
| ゲームへの影響 | 時間・HP・所持・フラグ・乱数・保存の担当仕様へのリンク |
| 使用不可と失敗 | 理由、修正・再試行、待機中の入力、失敗時の保持 |
| 表示条件 | 基準寸法、固定／伸縮領域、長文・最大桁・欠損・小画面・文字拡大 |
| 資料と確認 | 原画像の役割、Figmaの対象版、実画像、一致・操作の検証、未確認点 |

各操作は「入力→許可条件→直後の結果→確定・取消→保持する状態→復帰先」を追えるように書く。未決、表示案、実装済み、承認済みを明示する。

## 仕様と画面の境界

場所を開く、選ぶ、活動を始める、購入する、完了する、保存する、を区別する。画面移動へ消費や時間進行を加えない。ゲーム規則の変更が必要なら、具体的な入力と結果を担当仕様へ反映する。

静的な場所選択、会話、購入、編成、保存確認は別の設計対象。接続先があることを子画面の制作指示とせず、未決の場所・人物・機能を仮コンテンツから確定しない。

## 現行画面への入口

| 対象 | 仕様 | 実装 |
| --- | --- | --- |
| ホーム | [管理・任意準備・保存](ui-screens/home.md) | [CampaignHub](../src/web/components/CampaignHub/CampaignHub.svelte) |
| 探索先 | [行き先選択](ui-screens/map.md) | [HubScene](../src/web/components/HubScene/HubScene.svelte) |
| 街 | [場所・人物から活動を開始](ui-screens/town.md) | [HubScene](../src/web/components/HubScene/HubScene.svelte)、[townModel](../src/presentation/townModel.ts) |
| 拠点部品 | [上記3画面の値と状態](ui-screens/hub-components.md) | [IllustratedAction](../src/web/components/IllustratedAction/IllustratedAction.svelte)、[HubCalendar](../src/web/components/HubCalendar/HubCalendar.svelte)、[hub.css](../src/web/hub.css)、[hub-art.json](../src/web/hub-art.json) |
| 編成・人物詳細 | [編成](../specs/party.md)、[固定版画像](ui-concepts/approved/README.md) | [Party](../src/web/components/Party/Party.svelte)、[CharacterDetails](../src/web/components/CharacterDetails/CharacterDetails.svelte)、[party.css](../src/web/party.css) |
| タイトル・装備 | [本編](../specs/overview.md)、[物品](../specs/items.md)、[保存](../specs/save.md) | [Campaign](../src/web/components/Campaign/Campaign.svelte)、[campaign.css](../src/web/campaign.css)、[items.css](../src/web/items.css) |
| 会話・買物 | [会話](../specs/adventure.md)、[物品](../specs/items.md) | [Conversation](../src/web/components/Conversation/Conversation.svelte)、[ItemShop](../src/web/components/ItemShop/ItemShop.svelte) |
| ルート・成長 | [ダンジョン](../specs/dungeon.md)、[成長](../specs/progression.md) | [Dungeon](../src/web/components/Dungeon/Dungeon.svelte)、[GrowthChoice](../src/web/components/GrowthChoice/GrowthChoice.svelte) |
| 戦闘・演出 | [戦闘画面](../specs/visuals.md) | [BattleHud](../src/web/components/BattleHud/BattleHud.svelte)、[BattleSequence](../src/web/components/BattleSequence/BattleSequence.svelte)、[style.css](../src/web/style.css)、[battleSequence.css](../src/web/battleSequence.css) |

通常UIの共通値は[ui.css](../src/web/ui.css)。状態・意味入力は`src/presentation/`、ゲーム規則は`src/game/`が担う。承認元と対象版の検証結果は対象Issue／PRへ記録する。
