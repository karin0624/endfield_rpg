# 編成4状態の画像索引

[編成仕様](../../../specs/party.md)に対応する固定の実装比較資料。対象は下記の編成4状態・1672×941に限り、ホーム・街・会話や別寸法のデザインへ適用しない。採用元の会話や原素材の管理情報は対象課題のアクセス可能な資料で扱う。

## 対象画像

| 状態 | ファイル | bytes | SHA-256 |
| --- | --- | --- | --- |
| 通常の出発準備 | [departure-hp-v1.webp](departure-hp-v1.webp) | 1450144 | `8fc37db3871cbc8747bfce9bdf455f7f0ca191d46b2fb74a7bce2f0350924ee8` |
| 通常の仲間選択 | [selection-quick-v2.webp](selection-quick-v2.webp) | 1208124 | `8c40208b8b27474a0ed8efc1e5486892ab3f6dddc2d6d08721d7289f6700cc8d` |
| 全員HP0・出発不可 | [departure-all-zero-disabled-v1.webp](departure-all-zero-disabled-v1.webp) | 1421036 | `ac40f823986d70f45b3cc3d95b0f8811ee8355d5ff57cd0c228203436c95f97e` |
| 症状ありの仲間選択 | [selection-fatigue-daze-v1.webp](selection-fatigue-daze-v1.webp) | 1201178 | `5169feced381d7d4881143b8fe84d0f5b21597a2602e439ee8793e8b4f9ae038` |

画像の右上の資料注記は実行UIの要素ではない。参照画像の追加・維持を製品実装や一致検証の成功と扱わない。ゲームの文字・HP・状態・操作は実データとHTML/CSSで描く。既存の[コンセプト資料](../README.md)と原出力は保持する。

## 再現fixtureと実画像比較

[party-approved.html](../../../tests/fixtures/party-approved.html)と[party-view.ts](../../../tests/fixtures/party-view.ts)は、明示したsnapshotを本番のviewへ渡して直接描画する。状態へ到達するゲーム操作の試験とは別である。

| 状態 | query |
| --- | --- |
| 通常の出発準備 | `?mode=normal` |
| 通常の仲間選択 | `?mode=normal&selection=1` |
| 全員HP0・出発不可 | `?mode=disabled` |
| 症状ありの仲間選択 | `?mode=symptoms&selection=1` |

撮影条件と正式VRTは[party.spec.ts](../../../tests/views/party.spec.ts)、画像準備は[formationEvidence](../../../tests/browser/formationEvidence.ts)を正本とする。承認資料との手動診断は[compare-party-ui.py](../../../scripts/compare-party-ui.py)と[テスト設計](../../testing.md)を参照する。診断は同解像度でraw diff・overlay・全体数値を保持し、資料注記の扱いとその他の差を分ける。

VRT、操作試験、素材からの描画差の診断、本人の判断は別の証拠である。既存参照を変更する場合は、[制作手順](../../ui-asset-production.md)に従って対象と固定版を特定する。差分を隠すための画像伸縮・補正・許容範囲の追加を行わない。
