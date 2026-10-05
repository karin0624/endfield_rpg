# 自動実行とレビュー・権限の境界

ゲーム／UI／公開I/Oの仕様は `specs/`、具体的なassertionはテストコードで管理する。監査に含まれる次の工程・権限の項目は、ゲームの未実装計画へ移さず、この表で責任と限界を明示する。自然言語の意味や承認をunit testで証明した扱いにはしない。

| 監査ID | 担保と限界 | 証拠／担当 |
| --- | --- | --- |
| WF-B01 | Biome・TypeScript・Vitest、通常／debug／直接view build、全game Nativeとcoverage・実行gateの終了コードをCIが検査する。型や整形成功をruntime仕様の網羅としない | `.github/workflows/ci.yml` の単一verify job。同一PR head SHAのrunをマージ担当が確認 |
| WF-B06 | mainの保護とrequired checksは未設定。成功チェックを強制するGitHub権限／プラン変更は本PRに含めない | 最終headのverifyと同job内の全project結果をマージ担当が確認。強制済みとは報告しない |
| WF-B09 | 古いv4、編成取消、ショップ対象外、debug URLの文書を現行の正本へ整合。新仕様の未登録・assertionの十分性は差分レビューの責任 | `specs/`・実装・テストを同じPRで比較。自然言語仕様の自動証明ではない |
| WF-B11 | CIは更新なしのVRT比較。基準画像は更新理由・対象の受入条件・画像自体をレビューし、生成だけで正当化しない | PR本文・基準差分・固定コンテナでの更新なし比較。人の承認をテストと呼ばない |

coverage・全必須projectの実行結果だけでは、仕様の充足やレビュー承認を自動判定できない。リポジトリ設定でマージを強制的に止められない限界は、この工程を実施する側の責任として残る。

監査入力は [8bee4b7の固定記録](https://github.com/karin0624/endfield_rpg/blob/8bee4b79fac4bb95490efa8fc3fc064aa405d640/docs/testing-audit/2026-10-03/README.md)。監査時点のassertion-presentをテスト実行成功と読み替えず、現在の仕様・テストコード・runner結果を使用する。複数領域の行は重なりを持つため、行数を一意の仕様数やcoverage率として合算しない。
