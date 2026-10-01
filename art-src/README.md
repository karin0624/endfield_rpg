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
