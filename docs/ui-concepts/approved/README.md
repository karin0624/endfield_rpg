# 編成4状態の画像索引

[編成仕様](../../../specs/party.md)に対応する固定の実装比較資料。対象は下記の編成4状態・1672×941に限り、ホーム・街・会話や別寸法のデザインへ適用しない。採用元の会話や原素材の管理情報は対象課題のアクセス可能な資料で扱う。

## 対象画像

| 状態 | ファイル |
| --- | --- |
| 通常の出発準備 | [departure-hp-v1.webp](departure-hp-v1.webp) |
| 通常の仲間選択 | [selection-quick-v2.webp](selection-quick-v2.webp) |
| 全員HP0・出発不可 | [departure-all-zero-disabled-v1.webp](departure-all-zero-disabled-v1.webp) |
| 症状ありの仲間選択 | [selection-fatigue-daze-v1.webp](selection-fatigue-daze-v1.webp) |

4画像は実装とのdiff・overlayに使う比較元であり、正式VRTのgoldenとは別である。Figmaの比較元へ移行するまでは削除・置換せず、移行時に本人の指示で整理する。画像右上の資料注記は実行UIへ表示せず、ゲームの文字・HP・状態・操作は実データとHTML/CSSで描く。

## 再現fixtureと実画像比較

[party-approved.html](../../../tests/fixtures/party-approved.html)と[party-view.ts](../../../tests/fixtures/party-view.ts)は、明示したsnapshotを本番のviewへ渡して直接描画する。状態へ到達するゲーム操作の試験とは別である。

撮影条件と正式VRTは[party.spec.ts](../../../tests/views/party.spec.ts)、画像準備は[formationEvidence](../../../tests/browser/formationEvidence.ts)を正本とする。承認資料との手動診断は[compare-party-ui.py](../../../scripts/compare-party-ui.py)と[テスト設計](../../testing.md)を参照する。診断は同解像度でraw diff・overlay・全体数値を保持し、資料注記の扱いとその他の差を分ける。

VRT、操作試験、素材からの描画差の診断、本人の判断は別の証拠である。既存参照を変更する場合は、[制作手順](../../ui-asset-production.md)に従って対象と固定版を特定する。差分を隠すための画像伸縮・補正・許容範囲の追加を行わない。
