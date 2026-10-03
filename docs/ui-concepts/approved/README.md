# 承認済みの編成UI参照画像

実装の見た目を合わせるための参照画像。実装済み画面の証跡やゲームの実行用画像ではない。文字・HP・状態・操作はHTML/CSSとゲームデータで実装し、概念図を一枚貼りしない。既存の[コンセプト資料](../README.md)と元PNGは変更しない。

## 出発準備: HP表示追加版

- 参照: [departure-hp-v1.webp](departure-hp-v1.webp)
- 正本PNG: `endfield-departure-proposed-revision.png`
- Library: `libfile_2d7cce461dd48191bad340226256f77f`, version 0
- 寸法: 1672 × 941 px
- PNG: 1972902 bytes; SHA-256 `d16e06f502da33cb1689474509931c4e001d746f1189a23bfb74d75427d07ef4`
- WebP: 1450144 bytes; SHA-256 `8fc37db3871cbc8747bfce9bdf455f7f0ca191d46b2fb74a7bce2f0350924ee8`
- 復号RGBA: SHA-256 `b68d3684931c483e025f5b62166a2743f17423aecf14ddd33c698bc2f2c62fb4`
- 承認元: Slack message `1791026451.870269`
- 実装指示: Slack message `1791027307.573779`

## 通常の仲間選択: 戻るを削除し確定だけ

- 参照: [selection-quick-v2.webp](selection-quick-v2.webp)
- 正本PNG: `endfield-selection-confirm-only.png`
- Library: `libfile_e9e23a840b548191999c16a7da41c8c0`, version 2
- 寸法: 1672 × 941 px
- PNG: 1641953 bytes; SHA-256 `94f27d35f7472da2377d1b3ed421f3c8136ea8f00cfabc9a106d1b82defe4114`
- WebP: 1208124 bytes; SHA-256 `8c40208b8b27474a0ed8efc1e5486892ab3f6dddc2d6d08721d7289f6700cc8d`
- 復号RGBA: SHA-256 `bfbf9859b854f56c4d3be81e258514732e394fa45d338ccf58fd4eb736299203`
- 提示元: Slack message `1791027906.635569`
- 承認元: Slack message `1791028085.252249`（「それでok」）

## 状態A: 全員HP0・出発無効

- 参照: [departure-all-zero-disabled-v1.webp](departure-all-zero-disabled-v1.webp)
- 正本PNG: `endfield-departure-all-zero-disabled.png`
- Library: `libfile_d78c35f786888191ba73b5d8d51308ca`, version 0
- 寸法: 1672 × 941 px
- PNG: 1938740 bytes; SHA-256 `3592b2b0cf44b5e4584af7424c2ee1f6105014f9f8d3ca0e2cc0a32d5f0925aa`
- WebP: 1421036 bytes; SHA-256 `ac40f823986d70f45b3cc3d95b0f8811ee8355d5ff57cd0c228203436c95f97e`
- 復号RGBA: SHA-256 `529bb319251f959d5db50746e568b259359455f8d91f54fc2eaf597b76db8da5`
- 提示元: Slack message `1791027912.522659`
- 承認元: Slack message `1791028085.252249`（「それでok」）

## 状態B: 肉体疲労・中度と朦朧・重度

- 参照: [selection-fatigue-daze-v1.webp](selection-fatigue-daze-v1.webp)
- 正本PNG: `endfield-selection-fatigue-daze.png`
- Library: `libfile_8a954c268354819191927471e0779d7a`, version 0
- 寸法: 1672 × 941 px
- PNG: 1625951 bytes; SHA-256 `980141d3b62417ff590d947ad2d69a0b528ce7ab4acd91a8a5de9aebe48cf096`
- WebP: 1201178 bytes; SHA-256 `5169feced381d7d4881143b8fe84d0f5b21597a2602e439ee8793e8b4f9ae038`
- 復号RGBA: SHA-256 `3e0f2fe22786473958a98fa22cb3e5e88de374c480ff11c81db28823583d1b15`
- 提示元: Slack message `1791027918.938519`
- 承認元: Slack message `1791028085.252249`（「それでok」）

## 承認版の範囲

通常の仲間選択は戻るボタンを置かず「確定」だけとするv2を参照する。戻るボタンのあった旧v1はこの承認セットに含めない。状態Aは全員HP0で出発を無効にした見本、状態Bは症状がある場合の暫定的な症状名表示の見本。状態アイコンの制作は別作業として扱う。

全画像の右上「検討用・未実装」は資料注記であり、実行時UIには表示しない。これらは承認済みの生成コンセプトの参照用派生データであり、生成物であることは第三者の権利や利用許諾の保証を意味しない。

## 変換と検証

転送容量を抑えるため、Pillowで無劣化WebPへ形式変換した（`lossless=True, exact=True, method=6`）。4点とも、変換前のPNGと変換後のWebPをそれぞれRGBAへ復号し、寸法および全RGBAバイトが完全一致することを確認した。相違バイトは0。元PNGのバイト列が変換前後で不変であることも確認した。拡大縮小・切り抜き・描き直し・色補正・内容変更はしていない。

この参照追加の親コミットは `419a3da4514146ac6e1b46b25252ff1a3e220ff3`。この変更だけでは画面実装やその検証の完了を意味しない。

## 再現fixtureと実画像比較

`tests/fixtures/party-approved.html`を本番の`mountPartyUi`へ接続する。実装初版はcommit `5b3a2dd`。Playwrightの`party-ui.spec.ts`にある「承認画像の4状態」で、1672×941 CSS px、DPR1、reduced-motion、画像decode・同梱フォントの準備完了後に撮影する。

| 状態 | URL query／操作 | 固定条件 |
| --- | --- | --- |
| 通常出発 | `?mode=normal` | ロッシ、ギルベルタ、空き、空き。両名20/20、症状なし |
| 通常選択 | `?mode=normal`、枠1をクリック | 上記と同じ。選択番号1・2、scroll先頭、hoverなし |
| 全員HP0 | `?mode=disabled` | 両名0/20、バー空、出発disabled |
| 症状あり選択 | `?mode=symptoms`、枠1をクリック | ロッシ肉体疲労50／朦朧75、コア適用後13/13、肉体疲労・中度／朦朧・重度。ギルベルタ20/20 |

時計は1日目・昼で固定し可視表示しない。本編のギルベルタ最大HP18は変えず、この独立fixtureだけ画像と同じ最大HP20とする。カードの仮編集中は選択順・欠番を保持し、確定とEscだけで番号順に詰める。

`python3 scripts/compare-party-ui.py test-results test-results/approved-comparison`で4組を生成する。Pillowが必要。画像登録・拡大縮小・色補正・しきい値による合格判定は行わない。唯一の許可領域は資料注記 `(1510,12)–(1664,44)`。全体raw diffはその領域も含む。CIの`party-approval-comparison`には各原画、runtime、50%overlay、raw diff、注記maskのみのdiff、診断範囲、数値とSHA-256を保存する。

現在の実装には背景・人物の輪郭／比率・生成文字・金属材質の差が残る。矩形診断は原因の切り分け用であり許可maskではない。CI成功や操作試験の通過を、画像一致の承認として扱わない。
