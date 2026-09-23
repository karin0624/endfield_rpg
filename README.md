# endfield_rpg

ブラウザで動くRPGの試作。街のADV、分岐ルート探索、速度で行動順が変わるタイムライン戦闘を組み合わせる。

まず「街で依頼を受ける → 探索で会話・戦闘を行う → 帰還して報酬を得る」という依頼1本を完成させる。実装はCodexを中心に進め、描画なしの高速なテストと必要最小限の実装を優先する。

## 文書の入口

| 文書 | 役割 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 常時適用する短い作業規約と、必要な文書への案内 |
| [specs/overview.md](specs/overview.md) | 合意済みの要件、技術構成、暫定案、未決定事項 |
| [specs/milestones.md](specs/milestones.md) | 段階ごとの完了条件とタスクの依存順 |
| [specs/battle.md](specs/battle.md) | M1タイムライン戦闘、通常攻撃、勝敗の状態・操作・受入例 |
| [specs/visuals.md](specs/visuals.md) | 戦闘画面の配置・カメラ範囲・確認画面 |
| [specs/design-guidelines.md](specs/design-guidelines.md) | UIの配色、部品、操作状態、マーカー、生成画像の扱い |
| [specs/testing.md](specs/testing.md) | Nodeテスト、ブラウザE2E、VRTの責務と実行環境 |
| [素材メモ](art-src/README.md) | 使用素材の出典・透過処理・Git LFS運用 |
| [全体ロードマップ（Issue #1）](https://github.com/karin0624/endfield_rpg/issues/1) | GitHub上の進捗の入口 |

ゲーム仕様の正本は`specs/`、Issueは変更単位と受入条件、`AGENTS.md`は作業規約とする。

## 必要な環境

- Node.js 24（`.nvmrc`あり）
- npm 11
- Git LFS（地面GLBの取得に必要）

## セットアップと実行

新規チェックアウト後に依存関係を固定済みのlockfileからインストールする。

```sh
nvm use
git lfs install
git lfs pull
npm ci
```

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | Viteの開発サーバーを起動する |
| `npm run check` | TypeScriptの型チェックとNode環境のVitestを1回実行する |
| `npm run build` | 型チェック後に配布用ファイルを`dist/`へ生成する |
| `npm run test:e2e` | Chromiumで実入力・表示・描画・構図設定を確認する。VRTは固定コンテナで実行する |

`check`はwatchモードを使わず、結果を終了コードで返す。ゲーム本体のテストにはブラウザ、DOM、Babylon.js、WebGLを必要としない。

ブラウザテストは固定したPlaywrightコンテナで実行する。基準画像の生成とCIの比較は同じ環境を使う。

```sh
docker run --rm --init --ipc=host --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.63.0-noble sh -c 'npm ci && npm run test:e2e'
```

基準画像を意図的に更新するときだけ、同じコマンドの末尾を`npm run build && npx playwright test --update-snapshots`に変え、生成画像を確認してコミットする。`test:e2e`は配布用をポート4173、設定画面用の一時コピーを4174で起動する。保存テストは本来の設定ファイルを上書きしない。失敗時のスクリーンショットとトレースは`test-results/`に残る。通常の`check`ではブラウザを起動しない。詳しい責務は[テスト設計](specs/testing.md)を参照する。

GLBはGit LFS、現在の数MiBのPNG・文書・コードは通常のGitで管理する。CIもLFSの実体を取得する。`build`は素材のヘッダーを確認し、LFSポインタのままなら配布物を作る前にエラーにする。

## ソース構成

| ディレクトリ | 責務 |
| --- | --- |
| `src/game/` | 状態とゲームルール。ブラウザ固有機能から独立させる |
| `src/content/` | ゲーム本体へ渡す型付きの定義データ |
| `src/web/` | ブラウザ表示と入力。`src/game/`と同じコア関数を使う |
| `public/assets/` | ブラウザが使うGLB・背景・透過立ち絵・敵素材 |
| `art-src/` | 未使用の方向画像と素材メモ。配布物には含めない |

## 現在の状態

[Issue #3](https://github.com/karin0624/endfield_rpg/issues/3)のNodeで検証できるゲーム本体に加え、[Issue #4](https://github.com/karin0624/endfield_rpg/issues/4)・[#5](https://github.com/karin0624/endfield_rpg/issues/5)・[#8](https://github.com/karin0624/endfield_rpg/issues/8)・[#9](https://github.com/karin0624/endfield_rpg/issues/9)の固定2対2戦闘画面を実装。通常表示では敵をクリックして攻撃対象を切り替え、選択中の敵へ通常攻撃できる。初期対象と対象撃破後の選択はカメラに近い敵から決める。HP・行動順、勝敗・再戦も操作できる。画面は同期的に確定したゲーム本体の結果を表示し、攻撃イベントを再生する。攻撃メッセージは少し長く表示し、敵の反撃前に間を置く。OSの「視差効果を減らす」設定では対象マーカーの回転を止め、イベント再生の待ち時間を省く。開発用の構図設定は別画面に分けている。

現在の採用設定は`ground1.glb`と`landscape1.png`の組み合わせ専用の暫定標準。別の地面モデル・遠景画像でフィールドを追加する際は、その組み合わせに固有の設定を用意し、既存フィールドの設定も保持する。複数フィールドの設定管理は追加時に実装する。

現在の画面はゲーム本体の街から始まる初期状態とは独立しており、固定編成の戦闘から始まる。街・会話・探索・画面遷移は後続Issueで接続する。

## 戦闘画面の構図を決める

1. `npm run dev`で起動し、右上の「構図設定」から開く。URLは通常`http://localhost:5173/?edit=1`。
2. カメラ位置・注視点・画角、地面の倍率、遠景の倍率・左右・高さ・前後、味方・敵それぞれの隊列中心と隣への左右差・前後差を調整する。スライダーと数値入力のどちらも使える。確認人数は1人／2人を切り替えられ、配置ルールは常に編成全体へ適用される。
3. 「画面だけで確認」でパネルを隠し、実際の16:9画面を確認する。「設定に戻る」で編集を続けられる。
4. 「標準として保存」で[`src/web/battle-settings.json`](src/web/battle-settings.json)に書き込む。配置した全キャラが地面上にない場合は警告され、保存できない。「保存済みの通常表示」で採用した構図を確認する。次回起動と次回ビルドにも反映されるので、このJSONをコードと一緒にGit管理する。

編集途中の値は同じブラウザの同じオリジンに一時保存し、設定画面を再読み込みすると復元する。一時保存だけでは通常表示を変更しない。「保存済みに戻す」で編集を破棄でき、「JSONを書き出す」で現在の値を共有・保管できる。

設定画面とファイル保存機能は開発サーバー専用。`npm run build`の配布物は、保存したJSONの構図を使い、設定UIやファイル保存機能を含めない。
