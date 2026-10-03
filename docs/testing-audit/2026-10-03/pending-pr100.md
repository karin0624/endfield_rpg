# PR #100 の監査時点の差分

対象: [PR #100](https://github.com/karin0624/endfield_rpg/pull/100)、監査したheadは [`cbda26fb3c98c1deb8559d64b4db47494982fa72`](https://github.com/karin0624/endfield_rpg/commit/cbda26fb3c98c1deb8559d64b4db47494982fa72)。この差分はmain `4866de71c2200781926f2bdb9611410822163ca5`の契約対応件数に含めない。

PRはその後も更新中であり、この記録は最新headのレビュー結果ではない。2026-10-03の確認時にはopenで、mainへのmergeは確認されていない。後続実装では実際に採用するheadの差分を再確認する。

## ソースで確認した改善

- 確定・遷移の重複抑止対象を `data-single-activation` で明示する。通常候補の繰り返し操作と確定操作を分ける。
- 本番campaignの祖先を含む経路でnative clickCount 1–4を送り、各入力直後のARIA、選択番号、選択状態を別々の期待と照合する。
- 候補の選択/非選択に局所的な `toHaveScreenshot` 基準を追加する。全編成/全画面の視覚保証ではない。
- テスト方針とPR説明に、仕様・input・result・test・assertionの対応と不足がある状態でmergeしない方針を追記する。完全な維持catalogや機械gateの実装とは区別する。

主な参照: [party UI](https://github.com/karin0624/endfield_rpg/blob/cbda26fb3c98c1deb8559d64b4db47494982fa72/src/web/partyUi.ts)、[campaign UI](https://github.com/karin0624/endfield_rpg/blob/cbda26fb3c98c1deb8559d64b4db47494982fa72/src/web/campaignUi.ts)、[party tests](https://github.com/karin0624/endfield_rpg/blob/cbda26fb3c98c1deb8559d64b4db47494982fa72/tests/e2e/party-ui.spec.ts)、[campaign tests](https://github.com/karin0624/endfield_rpg/blob/cbda26fb3c98c1deb8559d64b4db47494982fa72/tests/e2e/campaign.spec.ts)、[testing方針](https://github.com/karin0624/endfield_rpg/blob/cbda26fb3c98c1deb8559d64b4db47494982fa72/docs/testing.md)。

## 原因説明で守る区別

mainにも、[通常clickの解除→再選択](https://github.com/karin0624/endfield_rpg/blob/4866de71c2200781926f2bdb9611410822163ca5/tests/e2e/dungeon.spec.ts#L266-L272)は存在した。「選択解除を一度もテストしていなかった」という説明は正確ではない。抜けていたのは `detail > 1` を含む実入力系列と、本番のcapture祖先を組み合わせた検証である。

以前のheadに対する「二回押して終点だけ比較するので、両方捨てても通る」という指摘を、各入力直後の期待へ改善したheadにもそのまま当てはめない。

## WF-B10: 負例の実行証拠

PR本文には旧guardを復元して対象testが失敗したという実行報告がある。この監査はそのrunを再実行していない。分類は **reported-not-reproduced** とする。採用する最終headで、どの原因変更がどのアサーションを失敗させたかを実行結果へ結び付ける必要がある。局所的なred→greenを全仕様の保証へ一般化しない。
