# 素材メモ

2026-09-22確認。実行用素材は`public/assets/`、現時点で使わない方向画像はこのディレクトリに置く。GLBにテクスチャが内包されているため、外部テクスチャのコピーや形式変換は不要だった。

## 使用ファイルと出典

| 現在のファイル | 提供時のファイル / 出典 | 用途・加工 | 利用条件の確認状況 |
| --- | --- | --- | --- |
| `public/assets/ground/ground1.glb` | `assets/ground/ground1.glb`。ユーザーによればChatGPT画像からTripoで生成。GLBのgeneratorも`Tripo` | 地面。内容は変更せず、描画時に一様26倍 | 生成時のプラン・契約・元画像の権利条件は未確認。商用利用可とは断定しない |
| `public/assets/backgrounds/landscape1.png` | `assets/landscape/landscape1.png`。ユーザー提供のGPT Images背景 | 2138×736、RGB。画像の変更なし | 生成時の契約・権利条件は未確認 |
| `public/assets/characters/rossi/front-left.png` | `assets/characters/rossi/ロッシ_左斜め前.png` | 1024×1536。白背景を透過化して戦闘に使用 | ユーザー提供。生成元・キャラクターの権利・利用条件は未確認 |
| `public/assets/characters/rossi/face.png` | `art-src/characters/rossi/ロッシ_正面.png`（ユーザー提供） | 原画の`x=250, y=0, 幅524, 高さ655`を切り出し、256×320へ縮小。行動順と味方カードの顔アイコン | ユーザー提供。生成元・キャラクターの権利・利用条件は未確認 |
| `public/assets/characters/gilberta/front-left.png` | `art-src/characters/gilberta/ギルベルタ_左斜め前.png`（ユーザー提供） | 1024×1536。加工せず味方2人目の立ち絵として使用 | ユーザー提供。生成元・キャラクターの権利・利用条件は未確認 |
| `public/assets/characters/gilberta/face.png` | `art-src/characters/gilberta/ギルベルタ_正面.png`（ユーザー提供） | 原画の`x=328, y=0, 幅368, 高さ460`を切り出し、256×320へ縮小。腕を含めず、行動順と味方カードの顔アイコンに使用 | ユーザー提供。生成元・キャラクターの権利・利用条件は未確認 |
| `art-src/characters/rossi/ロッシ_{正面,左側面,右側面,背面}_2x.png` | 同名の`assets/characters/rossi/`内PNG | 各2048×3072。白背景を透過化、未使用方向として保管 | 斜め左前と同様に未確認 |
| `public/assets/enemies/slime-blue.png` | [Kenney Platformer Art Deluxe](https://kenney.nl/assets/platformer-art-deluxe)、ZIP内`Extra animations and enemies/Enemy sprites/slimeBlue.png` | 49×34、RGBA。画像の変更なし。表示時に左右反転 | 配布ページと同梱license.txtでCC0を確認。ライセンス文を`public/assets/enemies/kenney-license.txt`に保存 |

敵の取得元: [公式ZIP](https://kenney.nl/media/pages/assets/platformer-art-deluxe/cb30f83169-1677696393/kenney_platformer-art-deluxe.zip)。作者Kenney Vleugels。CC0のためクレジットは必須ではないが、出典を残す。今回は見た目を確かめる仮敵として使用し、主人公と画風は統一していない。

## 主人公の透過処理

ユーザーの「全部の画像で背景透過して上書き保存していい」に従い、主人公の5方向を処理した。元のRGB値・寸法を保ち、外周につながる白背景のアルファのみ0にした。白の判定はRGBの最小値235以上、最大値と最小値の差16以下、上下左右の連結で行った。輪郭に囲まれた服・髪の白は残している。元の白背景ファイルを配布用と重複して保管しない。地面と遠景は透過処理していない。

斜め左前の非透明領域は画像左上基準で`x=42..990, y=11..1508`。靴底の基準を`(512,1508)`として配置する。他方向の切り替え・接地調整は未実装。

## Git管理

- `*.glb`と、今後追加する編集元の`*.blend`は`.gitattributes`でGit LFS対象にする。現在の地面は58,790,396 bytes（約56.07 MiB）。通常Gitの履歴に巨大なバイナリを繰り返し入れない。
- 現在の約2〜3 MiBのPNGと確認画面は通常Git。小さく更新頻度も低いため、すべてをLFSにする運用負担は増やさない。大量・高頻度の画像更新が必要になった時点で対象を見直す。
- `dist/`、ダウンロードZIP、一時ファイル、Windowsの`:Zone.Identifier`はコミットしない。実行時は同梱素材を使い、外部サイトへ接続しない。
- Git LFSを導入した環境で`git lfs install`、既存チェックアウトでは`git lfs pull`を実行する。追加時は通常の`git add`でよく、GLBは自動的にポインタになる。`git lfs ls-files`で確認してから通常の`git push`でLFS実体とコミットを送る。
- CIは`actions/checkout`の`lfs: true`で取得。`npm run build`はファイルヘッダーを確認してLFSポインタの誤配布を防ぐ。`npm run check`は素材やブラウザをロードしない。
- ローカルでLFSポインタ生成とビルドへの実体コピーは確認済み。Gitへのpush時にはLFS実体もアップロードする。

[GitHubの大きなファイルに関する説明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)では50 MiB超は警告対象、100 MiB超は通常Gitで拒否される。今回のGLBは拒否サイズ未満だが、今後の更新履歴を考えてLFSを採用した。LFSの保存・転送容量は利用先アカウントの枠に従う。

地面のSHA-256: `0bad77901554e56495e34844a5e63e66380b30d48c732c5c7fbc152c9b976ef9`。
