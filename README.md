# endfield_rpg

ブラウザで動くRPGの試作。街のADV、分岐ルート探索、速度で行動順が変わるタイムライン戦闘を組み合わせる。

まず「街で仲間を編成 → 探索で会話・戦闘 → 帰還して療養」という生活ループを小さく接続する。実装はCodexを中心に進め、描画なしの高速なテストと必要最小限の実装を優先する。

## 文書の入口

| 文書 | 役割 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 常時適用する短い作業規約と、必要な文書への案内 |
| [specs/overview.md](specs/overview.md) | 現在の全体要件と責務境界 |
| [specs/party.md](specs/party.md) | 仲間一覧、空き枠可4枠PT、単独出撃と状態の引継ぎ |
| [specs/dungeon.md](specs/dungeon.md) | 固定ルート、ノード進行、戦闘・会話からの復帰 |
| [docs/milestones.md](docs/milestones.md) | 段階ごとの完了条件とタスクの依存順 |
| [specs/adventure.md](specs/adventure.md) | 街・会話のゲーム状態、入力、条件、型付き会話データ |
| [specs/battle.md](specs/battle.md) | タイムライン戦闘、通常攻撃、勝敗の状態・操作・受入例 |
| [specs/visuals.md](specs/visuals.md) | 戦闘画面の配置・構図設定・描画 |
| [specs/design-guidelines.md](specs/design-guidelines.md) | UIの配色、部品、操作状態、マーカー |
| [docs/ui-asset-production.md](docs/ui-asset-production.md) | AIによるUI用画像の制作手順 |
| [docs/testing.md](docs/testing.md) | Nodeテスト、ブラウザE2E、VRTの責務と実行環境 |
| [docs/documentation.md](docs/documentation.md) | 文書の役割、仕様とADRの書き分け、更新規則 |
| [docs/adr/](docs/adr/) | 採用した判断とその経緯 |
| [docs/visual-records/](docs/visual-records/) | 過去の画面記録 |
| [素材メモ](art-src/README.md) | 使用素材の出典・透過処理・Git LFS運用 |
| [全体ロードマップ（Issue #1）](https://github.com/karin0624/endfield_rpg/issues/1) | GitHub上の進捗の入口 |

現在のゲーム仕様の正本は`specs/`、判断の経緯は`docs/adr/`、計画とテスト方針は`docs/`、Issueは変更単位と受入条件、`AGENTS.md`は作業規約とする。

## 必要な環境

- Node.js 24（`.nvmrc`あり）
- npm 11
- Git LFS（地面GLBの取得に必要）
- Docker（ブラウザテストに必要）

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
| `npm run lint` | Biomeで整形・import順・推奨ルールと追加ルールを確認する |
| `npm run format` | Biomeで整形・import順・安全なlint修正を適用する |
| `npm run check` | Biome、TypeScriptの型チェック、Node環境のVitestを1回実行する |
| `npm run build` | 型チェック後に配布用ファイルを`dist/`へ生成する |
| `npm run test:e2e` | 固定コンテナでChromiumを起動し、戦闘の実入力・表示・描画を少数ケースで確認する |
| `npm run test:editor` | 固定コンテナで必要時だけ構図設定のVRT・保存操作を確認する |

`lint`と`check`はwatchモードを使わず、結果を終了コードで返す。Biomeの設定は[`biome.json`](biome.json)。`npm run format`はリポジトリ全体を書き換えるため、変更ファイルだけ整えるときは`npx biome check --write path/to/file`を使う。Codexは[`AGENTS.md`](AGENTS.md)の指示に従い、コード変更後に`npm run check`を実行する。ゲーム本体のテストにはブラウザ、DOM、Babylon.js、WebGLを必要としない。

ブラウザテストは以下のコマンドから固定したPlaywrightコンテナで実行する。基準画像の生成とCIの比較は同じ環境を使う。Playwrightを直接起動すると、コンテナ外ではエラーになる。

```sh
npm run test:e2e
```

基準画像を意図的に更新するときだけ`npm run test:e2e -- --update-snapshots`を実行し、生成画像を確認してコミットする。`test:e2e`は配布用をポート4173で起動する。`test:editor`は設定画面用の一時コピーをポート4174で起動し、本来の設定ファイルを上書きしない。失敗時のスクリーンショットとトレースは`test-results/`に残る。通常の`check`ではブラウザを起動しない。詳しい責務は[テスト設計](docs/testing.md)を参照する。

構図設定を確認するときは`npm run test:editor`を実行する。構図設定の基準画像更新には`npm run test:editor -- --update-snapshots`を使う。CIのコンテナジョブはDockerを入れ子で起動せず、コンテナ内専用の`npm run test:e2e:inside`を実行する。

クラウド環境で`NODE_EXTRA_CA_CERTS`が既存の`/usr/local/share/ca-certificates/environment-proxy-ca.crt`を指し、そのファイルを読み取れる場合、ブラウザテストの起動スクリプトが証明書をコンテナへ読み取り専用で渡す。コンテナ内のNode.jsだけに同じCAを追加し、TLS検証は有効のままにする。OSの信頼設定は変更せず、証明書はリポジトリに保存しない。この条件に当てはまらないローカル環境とGitHub Actionsの実行方法は変わらない。

GLBはGit LFS、現在の数MiBのPNG・文書・コードは通常のGitで管理する。CIもLFSの実体を取得する。`build`は素材のヘッダーを確認し、LFSポインタのままなら配布物を作る前にエラーにする。

## ソース構成

| ディレクトリ | 責務 |
| --- | --- |
| `src/game/` | 状態とゲームルール。ブラウザ固有機能から独立させる |
| `src/content/` | ゲーム本体へ渡す型付きの定義データ |
| `src/web/` | ブラウザ表示と入力。`src/game/`と同じコア関数を使う |
| `public/assets/` | ブラウザが使うGLB・背景・透過立ち絵・敵素材・ルートノード画像 |
| `art-src/` | 元素材と素材メモ。配布物には含めない |

## 現在の状態

[Issue #3](https://github.com/karin0624/endfield_rpg/issues/3)のNodeで検証できるゲーム本体に加え、[Issue #4](https://github.com/karin0624/endfield_rpg/issues/4)・[#5](https://github.com/karin0624/endfield_rpg/issues/5)・[#8](https://github.com/karin0624/endfield_rpg/issues/8)・[#9](https://github.com/karin0624/endfield_rpg/issues/9)の固定2対2戦闘画面を実装。通常表示では敵をクリックして攻撃対象を切り替え、選択中の敵へ通常攻撃できる。初期対象と対象撃破後の選択はカメラに近い敵から決める。HP・行動順、勝敗・再戦も操作できる。画面は同期的に確定したゲーム本体の結果を表示し、攻撃イベントを再生する。攻撃メッセージは少し長く表示し、敵の反撃前に間を置く。OSの「視差効果を減らす」設定では対象マーカーの回転を止め、イベント再生の待ち時間を省く。開発用の構図設定は別画面に分けている。

現在の採用設定は`ground1.glb`と`landscape1.png`の組み合わせ専用の暫定標準。別の地面モデル・遠景画像でフィールドを追加する際は、その組み合わせに固有の設定を用意し、既存フィールドの設定も保持する。複数フィールドの設定管理は追加時に実装する。

通常起動では街から場所を選び、会話をクリックまたはSpaceで進める。選択肢はボタンか表示番号の数字キーで選ぶ。街の「出撃編成を見る」で編成画面を開き、「出撃」から固定ルートへ進む。「戻る」で編成を保持して街へ戻れる。初期仲間はロッシだけで、空き3枠のまま出撃できる。`/?dungeon=1`もロッシ単独の新規探索を始める。ルートのノードを選ぶと戦闘・会話へ移り、完了後は同じ探索状態を保ったルートへ戻る。戦闘デモは街の「戦闘デモを見る」または`/?battle=1`から開ける。場所の解放・会話分岐・フラグ更新はゲーム本体の`src/game/adventure.ts`が管理し、表示と入力は`src/web/adventureUi.ts`が接続する。

仲間とPTは`src/game/party.ts`、生活ループの共通セッションは`src/game/expedition.ts`が管理する。「同行者を探す（仮）」でギルベルタを控えへ迎え、編成から配置できる。街探索完了は生活半日と回復1step、ダンジョン全体は帰還時に生活半日だけを計上する。帰還では出撃者のHPが肉体疲労補正後の最大値へ戻るが、症状は持ち越す。全滅後も街探索を6回完了すれば戦闘不能から復帰して再出撃できる。街・編成・ルートに日数と昼夜、街に回復結果、編成に残る症状を表示する。画面を切り替えても仲間・PT・フラグ・時計・症状を保持し、リロードで初期化する。永続保存、精神疲労の数値曲線、探索育成とその帰還初期化は未実装。

ダンジョンのゲーム本体は`src/game/dungeon.ts`、入口から分岐・合流してボスへ進む固定ルートは`src/content/initialDungeon.ts`で定義する。画面の接続は`src/web/dungeonUi.ts`が担当する。

## 会話画面の配置を決める

1. `npm run dev`で起動し、街の「会話画面の配置設定」から開く。URLは`http://localhost:5173/?adventureEdit=1`。
2. 左・中央・右の立ち絵の水平位置、全員共通の高さと足元、本文パネル・話者名・本文・送り矢印・選択肢の位置を数値入力かスライダーで調整する。ギルド初回会話がプレビューに開き、クリックで別の話者と選択肢も確認できる。
3. 「画面だけで確認」で設定パネルを隠せる。「標準として保存」で[`src/web/adventure-settings.json`](src/web/adventure-settings.json)に保存すると、通常表示と次回ビルドに反映される。未保存の調整は同じブラウザに下書きとして残る。

会話画面の設定は戦闘画面の構図設定と別で、開発サーバー専用。配布ビルドには保存済みの値だけを含める。

## 戦闘画面の構図を決める

1. `npm run dev`で起動し、右上の「構図設定」から開く。URLは通常`http://localhost:5173/?edit=1`。
2. カメラ位置・注視点・画角、地面の倍率、遠景の倍率・左右・高さ・前後、味方・敵それぞれの隊列中心と隣への左右差・前後差を調整する。スライダーと数値入力のどちらも使える。確認人数は1人／2人を切り替えられ、配置ルールは常に編成全体へ適用される。
3. 「画面だけで確認」でパネルを隠し、実際の16:9画面を確認する。「設定に戻る」で編集を続けられる。
4. 「標準として保存」で[`src/web/battle-settings.json`](src/web/battle-settings.json)に書き込む。配置した全キャラが地面上にない場合は警告され、保存できない。「保存済みの通常表示」で採用した構図を確認する。次回起動と次回ビルドにも反映されるので、このJSONをコードと一緒にGit管理する。

編集途中の値は同じブラウザの同じオリジンに一時保存し、設定画面を再読み込みすると復元する。一時保存だけでは通常表示を変更しない。「保存済みに戻す」で編集を破棄でき、「JSONを書き出す」で現在の値を共有・保管できる。

設定画面とファイル保存機能は開発サーバー専用。`npm run build`の配布物は、保存したJSONの構図を使い、設定UIやファイル保存機能を含めない。
