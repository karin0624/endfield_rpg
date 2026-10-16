# 素材メモ

元画像は`art-src/`に置き、実行時に使う画像は`public/assets/`へコピーして適切な名前で管理する。`art-src/`の素材を直接importしたり、上書き加工したりしない。

## 使用中の素材

| 実行用ファイル | 元素材・出典 | 加工と用途 | 利用条件 |
| --- | --- | --- | --- |
| `public/assets/ground/ground1.glb` | ユーザー提供。ChatGPT画像からTripoで生成したと提供時に説明あり | モデルは変更せず、描画時に拡大して地面に使う | 生成時の条件は未確認 |
| `public/assets/backgrounds/landscape1.png` | ユーザー提供のGPT Images背景 | 画像は変更せず、街と会話の背景に使う | 生成時の条件は未確認 |
| `public/assets/characters/rossi/front-left.png` | `art-src/characters/rossi/ロッシ_左斜め前.png`。ユーザー提供 | 白背景を透過化して戦闘に使う | 生成元と利用条件は未確認 |
| `public/assets/characters/rossi/face.png` | `art-src/characters/rossi/ロッシ_正面.png`。ユーザー提供 | 原画の`x=250, y=0, 幅524, 高さ655`を切り出し、256×320へ縮小。行動順と味方カードに使う | 生成元と利用条件は未確認 |
| `public/assets/characters/rossi/expressions/neutral.png` | `art-src/characters/rossi/ロッシ_正面.png`。ユーザー提供 | 透過済み原画をそのままコピーし、会話と出撃編成に使う | 生成元と利用条件は未確認 |
| `public/assets/characters/rossi/expressions/smile.png` | `art-src/characters/rossi/正面差分/微笑み.png`。ユーザー提供 | 透過済み原画をそのままコピーし、会話に使う | 生成元と利用条件は未確認 |
| `public/assets/characters/gilberta/front-left.png` | `art-src/characters/gilberta/ギルベルタ_左斜め前.png`。ユーザー提供 | 画像は変更せず、戦闘に使う | 生成元と利用条件は未確認 |
| `public/assets/characters/gilberta/face.png` | `art-src/characters/gilberta/ギルベルタ_正面.png`。ユーザー提供 | 原画の`x=328, y=0, 幅368, 高さ460`を切り出し、256×320へ縮小。行動順と味方カードに使う | 生成元と利用条件は未確認 |
| `public/assets/characters/gilberta/expressions/neutral.png` | `art-src/characters/gilberta/ギルベルタ_正面.png`。ユーザー提供 | 透過済み原画をそのままコピーし、会話と出撃編成に使う | 生成元と利用条件は未確認 |
| `public/assets/characters/gilberta/expressions/smile.png` | `art-src/characters/gilberta/正面差分/微笑み.png`。ユーザー提供 | 透過済み原画をそのままコピーし、会話に使う | 生成元と利用条件は未確認 |
| `public/assets/enemies/slime-blue.png` | [Kenney Platformer Art Deluxe](https://kenney.nl/assets/platformer-art-deluxe)の`slimeBlue.png` | 画像は変更せず、描画時に左右反転して敵に使う | [同梱ライセンス](../public/assets/enemies/kenney-license.txt)でCC0を確認 |
| `public/assets/backgrounds/dungeon-route.png` | `art-src/background/dangeon/背景1.png`。ユーザー提供 | 画像はそのままコピー。画面CSSでぼかしと不透明度を調整する | 外部の出典・利用条件は未提示 |
| `public/assets/dungeon-nodes/{focus,unfocus}/{battle,encounter,boss}.png` | `art-src/icons/dangeon/nodes/{focus,unfocus}/{戦闘,遭遇,ボス}.png`。ユーザー提供 | 対応するPNGをそのままコピー。選択可能なノードには`focus`、それ以外には`unfocus`を使う | 外部の出典・利用条件は未提示 |

主人公の戦闘用立ち絵は、提供された原画の外周につながる白背景だけを透過化した。会話用の正面立ち絵と表情差分には追加の透過処理をしていない。

## Git管理

`.gitattributes`はGLBとBlendファイルをGit LFS対象にしている。既存チェックアウトでは`git lfs pull`で実体を取得する。PNGは通常のGitで管理し、`dist/`や一時ファイルはコミットしない。

## 出撃準備の生成背景

`art-src/background/departure/endfield-departure-industrial-background.webp`は、承認済みの出撃準備コンセプトから生成した背景の保存用データ。実行用には同一バイト列を`public/assets/backgrounds/endfield-departure-industrial-background.webp`へコピーする。UI、文字、キャラクター、HP表示は別途HTML/CSS等で描画し、背景のみを実行用素材とする。この素材の出典・採用記録は、完成画面の承認を意味しない。必要情報を反映した完成画像の承認と同一解像度比較は[UI開発の必須ゲート](../docs/ui-asset-production.md#ui開発の必須ゲート)に従う。

この背景の生成時に用いた主な出典は[エンドフィールド公式PlayStation Blog](https://blog.playstation.com/?p=420605)、補助参照は[原作アークナイツのPRTSホーム背景一覧](https://prts.wiki/w/首页场景一览)の「视野」。参照画像そのものは同梱していない。生成物であることは第三者の権利や利用許諾の保証を意味せず、参照元および生成時の利用条件は未確認。

元PNGは原素材の保管先に保持。リポジトリには無劣化WebP派生を保存し、元PNGを上書きしない。寸法1672×941を維持した派生物で、拡大・色変更・内容変更はしない。WebPも通常のGitで管理する。

## 共通UIのフォント

Noto Serif JP（weight 500・700）とNoto Sans JP（weight 400）を`public/assets/fonts/`に同梱する。Google Fontsの[Serif JP](https://github.com/google/fonts/tree/main/ofl/notoserifjp)・[Sans JP](https://github.com/google/fonts/tree/main/ofl/notosansjp)の可変TrueType原本をFontToolsで指定weightへ固定し、WOFF2へ可逆圧縮した。グリフを削る部分集合化は行っていない。各原本のSIL Open Font License 1.1を同じディレクトリへ同梱する。CSSでは既存画面に影響しない`Endfield UI Serif` / `Endfield UI Sans`の名前で参照する。

編成用の`public/assets/ui/*.svg`は承認画像の罫線・角・材質をHTML部品の背景として再現するためのベクター部品。文字・数値・人物を含まず、完成画面を背景へ貼っていない。生成画像の元レイヤーは未提供であり、元画像との材質一致は未解消。

OpenPencil用の[TTF](openpencil/fonts/)は同じWOFF2を可逆展開したもの。ファミリー名とスタイル名はOSで`Noto Serif JP / Bold`と`Noto Sans JP / Regular`として選べるように揃え、アウトラインとメトリクスは保持する。同じOFLを併置する。

## 拠点UIの素材

`public/assets/ui/hubs/`の17 PNGは、提供された背景・図案・frame・日付・人物portraitの実行用素材。原画像のbytes・寸法を保持し、表示時の範囲と縮尺は[hub-art.json](../src/web/hub-art.json)で管理する。日付は元画像をSVG clipPathで表示し、数字はHTML。人物の顔だけは楕円viewportを使う。素材ごとの利用方法は[拠点部品仕様](../docs/ui-screens/hub-components.md)を参照する。

非配布の参照画像・動画や個人識別を含むスクリーンショットは配布物へ含めない。原素材と承認の管理は対象課題のアクセス可能な資料で行い、非公開識別子を公開文書へ転記しない。外部の利用条件は未提示。
