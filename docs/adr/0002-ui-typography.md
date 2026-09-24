# 0002 UIの文字サイズを用途別に定める

- 記録日: 2026-09-24
- 状態: 採用

## 背景

戦闘画面の常設UIを控えめにするとき、文字を縮めて情報を詰め込むと、名前・HP・操作対象が読み取りにくくなる。

### 文字設計の参考資料

| 参照先 | 本書に取り入れる考え方 |
| --- | --- |
| [デジタル庁デザインシステム：タイポグラフィ](https://design.digital.go.jp/dads/foundations/typography/) | 本文・UIの16pxを基準とし、14pxは補助的な用途に限定する。読み物の行高は1.5倍以上とする |
| [Material Design 3：Typography](https://developer.android.com/develop/ui/compose/designsystems/material3#typography) | 本文・ラベル・見出しなどの役割に文字スタイルを割り当てる |
| [IBM Carbon：Typography](https://carbondesignsystem.com/elements/typography/overview/) | 操作に集中する文字体系と、大きく印象を与える文字体系を使い分ける |

サイズ表はブラウザ向けの本作の基準であり、AndroidのspやXboxの実描画文字高と同じ尺度ではない。外部基準への適合は、各基準の測定方法に従って別途検証する。

## 判断

本文・コマンド・主要数値・補助情報に用途別の基準サイズを割り当て、狭い画面では配置を変える。現在の値と適用範囲は[UIデザインガイドライン](../../specs/design-guidelines.md)を正本とする。

## 結果

CSSのトークンを変更するときは仕様の表も更新する。文字の収まりは改行・領域の拡張・縦積みで扱う。
