# 編成4状態の画像索引

[編成仕様](../../../specs/party.md)に対応する過去のデザイン承認資料。対象は下記の編成4状態・1672×941に限り、ホーム・街・会話や別寸法のデザインへ適用しない。採用元の会話や原素材の管理情報は対象課題のアクセス可能な資料で扱う。

## 対象画像

| 状態 | ファイル |
| --- | --- |
| 通常の出発準備 | [departure-hp-v1.webp](departure-hp-v1.webp) |
| 通常の仲間選択 | [selection-quick-v2.webp](selection-quick-v2.webp) |
| 全員HP0・出発不可 | [departure-all-zero-disabled-v1.webp](departure-all-zero-disabled-v1.webp) |
| 症状ありの仲間選択 | [selection-fatigue-daze-v1.webp](selection-fatigue-daze-v1.webp) |

4画像は過去の承認資料として保持する。現在の外観マスターは[単一のFig原稿](../../../art-src/openpencil/endfield-rpg.fig)であり、これらの画像をVRTの比較元にはしない。画像右上の資料注記は実行UIへ表示しない。

## 現在の検証

編成の部品・画面は[Party](../../../src/web/components/Party/)などの同居Storyから描画し、Fig原稿と寸法・全RGBAを比較する。操作の結合はStoryの`play`、ゲームの状態遷移はコア・presentationで確認する。[テスト設計](../../testing.md#デザイン原稿と実装の比較)を参照する。
