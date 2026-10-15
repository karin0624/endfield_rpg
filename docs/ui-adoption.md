# UIの実装対応

共通規則は[デザインシステム](design-guidelines.md)、具体的な対象は[画面仕様](ui-screen-design.md#現行画面への入口)から読む。本書はコードへの案内であり、見た目の承認や一致検証の結果を示すものではない。

| 画面・部品 | 実装・値 | 契約の参照先 |
| --- | --- | --- |
| ホーム・探索先・静的な街 | [CampaignHub](../src/web/components/CampaignHub.svelte)、[HubScene](../src/web/components/HubScene.svelte)、[hub.css](../src/web/hub.css)、[hub-art.json](../src/web/hub-art.json) | [拠点部品](ui-screens/hub-components.md)、各画面仕様 |
| 絵付き入口・場所入口・日付 | [IllustratedAction](../src/web/components/IllustratedAction.svelte)、[HubCalendar](../src/web/components/HubCalendar.svelte) | 横長の入口／背景上の場所／受動情報を使い分ける |
| 編成・仲間選択・詳細 | [Party](../src/web/components/Party.svelte)、[CharacterDetails](../src/web/components/CharacterDetails.svelte)、[party.css](../src/web/party.css)、[ui.css](../src/web/ui.css) | [編成仕様](../specs/party.md)。編集文脈と出発文脈を区別 |
| タイトル・装備等 | [Campaign](../src/web/components/Campaign.svelte)、[campaign.css](../src/web/campaign.css)、[items.css](../src/web/items.css) | [本編](../specs/overview.md)、[物品](../specs/items.md)、[保存](../specs/save.md) |
| 会話・買物 | [Conversation](../src/web/components/Conversation.svelte)、[ItemShop](../src/web/components/ItemShop.svelte) | [会話](../specs/adventure.md)、[物品](../specs/items.md) |
| ルート・成長 | [Dungeon](../src/web/components/Dungeon.svelte)、[GrowthChoice](../src/web/components/GrowthChoice.svelte) | [ダンジョン](../specs/dungeon.md)、[成長](../specs/progression.md) |
| 戦闘・演出 | [BattleHud](../src/web/components/BattleHud.svelte)、[BattleSequence](../src/web/components/BattleSequence.svelte)、[style.css](../src/web/style.css)、[battleSequence.css](../src/web/battleSequence.css) | [戦闘画面](../specs/visuals.md) |

意味イベント・draft・focus・dialog状態は`src/presentation/`、ゲーム規則は`src/game/`と担当specsを正本とする。CSSの採用を理由に意味入力やゲームの確定点を変えない。同じ役割と採用意匠の部品を再利用し、異なる役割を同じ外観へ押し込まない。

画像・font・値の更新では、対応する画面仕様と[素材メモ](../art-src/README.md)を確認する。既存CSSへの移行を全画面の自動要件にしない。操作・外観・資源の検証方法は[テスト設計](testing.md)、Figmaとの比較と本人判断は[制作手順](ui-asset-production.md)を参照する。
