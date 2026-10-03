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

## 変換と検証

転送容量を抑えるため、Pillowで無劣化WebPへ形式変換した（`lossless=True, exact=True, method=6`）。変換前のPNGと変換後のWebPをそれぞれRGBAへ復号し、寸法および全RGBAバイトが完全一致することを確認した。相違バイトは0。元PNGのバイト列が変換前後で不変であることも確認した。拡大縮小・切り抜き・描き直し・色補正・内容変更はしていない。

この参照追加の親コミットは `419a3da4514146ac6e1b46b25252ff1a3e220ff3`。この変更だけでは画面実装やその検証の完了を意味しない。
