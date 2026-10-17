# 原稿のフォント

`.fig` の文字は通常のテキストとして保持する。起動時とCLIで同じTTFを登録し、オンラインのフォント取得を必要としない。

| ファイル | family / style | 用途 | ライセンス |
| --- | --- | --- | --- |
| `noto-serif-jp-500.ttf` | Noto Serif JP / Medium | 共通UIの見出し | [OFL 1.1](NotoSerifJP-OFL.txt) |
| `noto-serif-jp-700.ttf` | Noto Serif JP / Bold | 拠点・街・地図の見出し | [OFL 1.1](NotoSerifJP-OFL.txt) |
| `noto-sans-jp-400.ttf` | Noto Sans JP / Regular | 共通UIの本文 | [OFL 1.1](NotoSansJP-OFL.txt) |
| `LiberationSans-Bold.ttf` | Liberation Sans / Bold | 未移行画面の欧文サンセリフ体・記号 | [OFL 1.1](LiberationSerif-LICENSE.txt) |
| `LiberationSerif-Regular.ttf` | Liberation Serif / Regular | 未移行画面の欧文セリフ体 | [OFL 1.1](LiberationSerif-LICENSE.txt) |
| `wqy-zenhei-regular.ttf` | WenQuanYi Zen Hei / Regular | 未移行画面の日本語・本文 | [GPL 2＋埋込例外、M+](WenQuanYiZenHei-LICENSE.txt) |
| `wqy-zenhei-mono-regular.ttf` | WenQuanYi Zen Hei Mono / Regular | 未移行画面の等幅文字 | [GPL 2＋埋込例外、M+](WenQuanYiZenHei-LICENSE.txt) |

NotoのTTFは実装のWOFF2を可逆展開し、family/styleの名前だけを選択可能な正式名へ揃えたもの。グリフ・文字対応・メトリクスは変更しない。

Liberationは固定Playwright環境の`fonts-liberation 1:2.1.5-3`から変更せず取得した。WenQuanYiは同環境の`fonts-wqy-zenhei 0.9.45-8`にある`wqy-zenhei.ttc`のface 0・1を標準TTFへ取り出した。全テーブルの内容を保持し、standaloneファイルの`head`チェックサムだけを再計算した。

WenQuanYiの正式style名は`Regular`。内部のweight値は500だが、原稿のAPIでは`fontName: { family: "WenQuanYi Zen Hei", style: "Regular" }`を使う（OpenPencilの数値表現は400）。別の`Medium` faceとして扱わない。

未移行画面のセリフ体は、欧文のLiberation Serifをテキストの基底スタイルにし、日本語範囲にWenQuanYiの通常の文字書式を適用する。`.fig`標準のテキスト・文字範囲として保存し、画像やアウトラインへ変換しない。既存範囲内での編集はその文字書式を継承し、全文に適用した書式はTEXTプロパティや`characters`で全文を置き換えた後も全文に適用する。異なる書式範囲を編集する場合は、通常のテキスト編集で範囲とフォントを指定する。
