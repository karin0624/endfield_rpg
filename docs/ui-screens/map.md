# 探索先

街またはダンジョンへの行き先を選ぶ画面。[拠点部品仕様](hub-components.md)と[共通DS](../design-guidelines.md)を参照する。場所の選択と実際の活動・出発を区別する。

## 全パーツと配置

| 要素 | 割当 | 用途・配置 |
| --- | --- | --- |
| 背景 | `map.png`、装飾画像 | 行き先の空間的な対応を示す |
| 街 | PlaceEntry／行き先、`town-icon`図案＋吹き出し＋label | 街への入口。基準anchor (480,670) |
| ダンジョン | PlaceEntry／行き先、`dungeon`図案＋吹き出し＋label | 出発準備への入口。基準anchor (1365,260) |
| 閉じる | IconButton／close | 「地図を閉じる」のaccessible name。右上の通常操作 |

anchorは1920×1080基準の図案中心に対応する指定であり、CSSの左上座標ではない。背景cover変換とcompactの折返しは[共通の拠点配置](hub-components.md#配置と表示条件)へ従う。日付、メニュー、活動結果、常設確認面は追加しない。

## 操作と復帰

| 入力 | 結果 | 保持とfocus |
| --- | --- | --- |
| 街 | 必須成長選択があれば解決してから[街](town.md)へ | 閲覧だけでは活動開始・持込み移動・時間進行を行わない |
| ダンジョン | 既存の出発準備へ | 実出発の受理で持込みと入場を反映。参加不可と出発disabledは[編成仕様](../../specs/party.md) |
| 閉じる／Esc | [ホーム](home.md)へ | 数量draftを保持、出かけるへfocus。変更する場合は任意準備を開く |
| 出発準備の戻る | 探索先へ | 地図側に持込み編集や新しい確定点を追加しない |

既定focusは街。wideとcompactはDOM順で街→ダンジョン→close、またはclose→街→ダンジョン。mode切替中のcloseのkeyboard focusを保持する。街・ダンジョン・closeの各状態と、狭幅・文字拡大時の折返し・到達性を確認する。

ゲームの規則は[仕様概要](../../specs/overview.md)、[成長](../../specs/progression.md)、[物品](../../specs/items.md)、[ダンジョン](../../specs/dungeon.md)を参照する。表示案に合わせて購入・移動・ノードごとの時間消費を新設しない。
