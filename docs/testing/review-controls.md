# 自動検査とレビュー・権限の境界

ゲーム／UI／公開I/Oの仕様は`specs/`、具体的なassertionはテストコードで管理する。自動検査、文書の整合、画像の判断、マージ権限の確認は、それぞれの対象と限界を持つ。

| 確認対象 | 担保と限界 | 証拠／担当 |
| --- | --- | --- |
| 品質の実行 | Biome・TypeScript・Vitest、通常／debug／直接view build、全game Nativeとcoverage・実行gateの終了コードをCIが検査する。型や整形成功をruntime仕様の網羅としない | `.github/workflows/ci.yml`の単一verify job。同一PR head SHAのrunをマージ担当が確認 |
| マージの制御 | mainの保護とrequired checksは未設定。成功チェックの強制と運用による確認を区別する | 最終headのverifyと同job内の全project結果をマージ担当が確認。強制済みとは報告しない |
| 仕様の整合 | 現行の入力・結果・保存形式・起動経路を文書・実装・テストで照合する。新仕様の未登録・assertionの十分性は差分レビューの責任 | `specs/`・実装・テストを同じPRで比較。自然言語仕様の自動証明ではない |
| 外観 | CIは更新なしのVRT比較。基準画像は更新理由・対象の受入条件・画像自体をレビューし、生成だけで正当化しない | PR本文・基準差分・固定コンテナでの更新なし比較。人の承認をテストと呼ばない |

coverage・全必須projectの実行結果だけでは、仕様の充足やレビュー承認を自動判定できない。リポジトリ設定でマージを強制的に止められない限界は、この工程を実施する側の責任として残る。

参考：[過去の監査資料](https://github.com/karin0624/endfield_rpg/blob/8bee4b79fac4bb95490efa8fc3fc064aa405d640/docs/testing-audit/2026-10-03/README.md)
