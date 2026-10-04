# 編成・選択・キャラ詳細の実画面

以下のWebPはクイック選択導入前の履歴。PR #96の現在の4状態は[固定版fixture・比較手順](../../ui-concepts/approved/README.md#再現fixtureと実画像比較)で撮影し、Actionsの`party-approval-comparison`と`campaign-flow-previews`へ保存する。旧選択画面の右側4枠を現在の仕様として参照しない。

2026-10-03、通常起動から新規ゲーム→ホーム→編成／探索先→ダンジョン出発準備へ進んだ実画面。1920×1080、deviceScaleFactor 1、固定PlaywrightコンテナのChromium。同梱Noto Serif JP / Noto Sans JPの読込と表示画像のdecodeを待って撮影した。元のPNGスクリーンショットをlossless WebPへ変換した。背景の原画は1672×941であり、この記録の1920pxは画面の表示寸法である。

これは当時の実装の記録であり、完成画面のユーザー承認や承認画像とのpixel一致を示す証跡ではない。この画像を承認画像の代わりに使わず、以後のUI変更は[必須ゲート](../../ui-asset-production.md#ui開発の必須ゲート)で確認する。

- [ホームの編成編集](home-formation-1920.webp)：出発ボタンなし。
- [出発準備](departure-1920.webp)：既存ロッシ原画と実HP、空き3枠、右下の出発。
- [仲間選択](selection-1920.webp)：候補一覧、1か所のHP・詳細操作、右側の配置先4枠。重複する全身プレビュー・状態文言は表示しない。初期仲間はロッシのみ。
- [キャラ詳細](details-1920.webp)：実HP・能力・症状・習得、読取り専用。
- [キャラ詳細の末尾](details-bottom-1920.webp)：Tabで能力領域へ移り、Endで内部スクロールした実画面。最後の習得「回復」の説明まで全体表示。

[位置計測](geometry.json)は通常画面のDOM bboxと主操作24px・戻る16pxの角落ちのcomputed style。pageerrorは0件。[読込確認](readiness.json)には顔PNGのHTTP 200・自然寸法256×320、使用フォントのCDP記録を残す。概念図は[別の資料](../../ui-concepts/README.md)であり、この記録は画像を一枚貼りした画面ではない。

多数候補・長文・症状・非活性の検証は`tests/e2e/ui/party-ui.spec.ts`の隔離fixtureを使い、実ゲームへ仲間や症状を追加しない。固定Playwrightコンテナの画面はテスト出力に残る。背景・人物の取得を失敗させた追加確認では暗い下地と名前・HP・操作を保持する。配布ビルドと実素材の通しE2EはPRのActions結果を参照する。

新しいUIへ変更した際は、古い画面を現在の表示例として流用せず、本記録と共通仕様・適用一覧の整合を確認する。

詳細は常時の説明文を置かず、スクロールバーと続きのある上下端の矢印を使う。末尾に24pxの余白を確保する。[末尾の計測](details-scroll.json)は通常フローのTab→End後の値。CIも同じキー操作で最終スキル全体がviewport内に入ることを確認し、先頭と末尾を別々に保存する。
