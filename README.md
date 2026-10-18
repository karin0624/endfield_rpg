# endfield_rpg

ブラウザで動くRPGの試作。街での会話・加入、固定分岐ルートの探索、速度で行動順が変わる戦闘をつなぎ、ホームでの準備・保存と街探索による療養を繰り返す。

## 文書の入口

| 文書 | 内容 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 作業と文書更新の規約 |
| [仕様概要](specs/overview.md) | 本編の流れ、責務境界、各ゲーム仕様への入口 |
| [Figからの実装skill](.agents/skills/design-to-code/SKILL.md) | 人が変更した原稿の調査、製品・Storyへの反映、不一致の切り分け |
| [テスト設計](docs/testing.md) | 保証する結果、検証層、実行方法、PRと独立レビュー |
| [コンテンツ追加](docs/content-authoring.md) | 仲間・会話・既存効果を増やす手順 |
| [ADR](docs/adr/) | 技術的な選択の理由 |
| [素材メモ](art-src/README.md) | 素材の出典・加工・利用条件 |
| [ロードマップ](https://github.com/karin0624/endfield_rpg/issues/1) | 開発計画と進捗 |

## 必要な環境

- Node.js 24（`.nvmrc`）、npm 11
- Git LFS（地面GLBの取得）
- Docker（ブラウザ検証）

## セットアップと実行

```sh
nvm use
node scripts/setup.mjs
npm run dev
```

setupは現在のcheckoutでGit LFSと依存を準備し、配布素材の実体を検証して`check`を実行する。Git同期・認証は[Git認証skill](.agents/skills/git-auth/SKILL.md)を参照する。

環境のセットアップコマンドはrepositoryを作業ディレクトリにする。npm cacheを指定する場合は次を使う。

```sh
node scripts/setup.mjs --cache /workspace/.npm
```

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | Viteの開発サーバー |
| `npm run lint` | Biomeによる整形・import順・lintの確認 |
| `npm run format` | repository全体の整形と安全なlint修正 |
| `npm run typecheck` | TS・Svelteテンプレートの型検査 |
| `npm run check` | Biome・素材・型・通常build・全Vitest・coverage・実行漏れの確認 |
| `npm run build` | 通常配布を`dist/`へ生成 |
| `npm run build:debug` | debug版を`dist-debug/`へ生成 |
| `npm run build:views` | 直接状態fixtureを`dist-views/`へ生成 |
| `npm run storybook` | 実製品コンポーネントのStorybookを起動 |
| `npm run build:storybook` | Storybookを`test-results/storybook/`へ生成 |
| `npm run test:storybook` | 部品の描画・操作結合テストを固定Dockerで実行 |
| `npm run test:browser` | ゲーム本体の全品質検証を固定Dockerで実行 |
| `npm run test:editor` | 開発時のNative HMR資源検証 |
| `npm run test:all` | ゲーム本体とエディターの全品質検証 |

一部のファイルだけ整形する場合は`npx biome check --write path/to/file`を使う。ブラウザ検証は上記wrapperから固定コンテナで実行し、画像・trace・JSONは`test-results/`へ保存する。対象範囲と提出前の確認は[テスト設計](docs/testing.md)を参照する。

## OpenPencilでデザインマスターを編集する

ゲームのデザインマスターは[endfield-rpg.fig](art-src/openpencil/endfield-rpg.fig)。デザイン・素材制作・原稿編集は人が行い、AIは原稿を読んで実装と検証を行う。構成の不備は指摘し、原稿を勝手に修正しない。ゲームや操作の契約は[仕様](specs/overview.md)、AIの作業手順は[実装skill](.agents/skills/design-to-code/SKILL.md)を参照する。

一つのファイルに共通定義と複数の画面を管理する。現在のページと区画は次のとおり。

| 場所 | 内容 |
| --- | --- |
| `Design System` | 機能や画面に依存しない基盤の色トークン・Typography・共通記号。特定機能名を持つ定義は置かない |
| `Components / Hub` | ホーム・街・地図で共有する部品と、部品内部のframe素材 |
| `Components/Dungeon` | 探索で共有する部品 |
| `Screens` | ホーム・街・地図とダイアログの画面フレーム、画面専用のローカル要素 |
| `Components / DS未対応` | 編成・会話・探索・物品・戦闘UIなど、複数画面で使う既存の独自部品。領域ごとに区分する |
| `Screens / DS未対応` | タイトル・導入・編成・会話・探索・装備・準備・ショップの画面フレームと、画面専用のローカル要素 |

`Design System`は機能群の共有部品より上の基盤層、`Components`は機能群の共有部品を置く層とする。アセット・コンポーネント・変数・スタイルの共通登録は、この2層の定義に限定する。`Screens`配下は画面とローカルな非登録要素だけを置き、共通定義の登録元にしない。ネイティブ形式が内部ページに保持する変数・スタイルも、この配置方針の定義から作る。

`Hub`はホーム・街・地図の画面群を指す実装上の名前。画面には共有部品のインスタンスを配置する。モーダルは標準のOverlayフレーム、文字・色・図案・状態は標準のテキスト、変数、スタイル、Text／Boolean／Instance swapプロパティとVariantsで保持する。既存の独自フォント・意匠は`DS未対応`で識別する。戦闘はHUDや操作ボタンなどのUI部品だけを管理し、画面フレーム・3D・戦闘エフェクトは含めない。

`npm ci`の`postinstall`で固定版のOpenPencilを準備する。本体はバージョン単位で`.openpencil/`へ保持し、初回または本体のバージョン変更時に取得する。同じ版へのパッチ更新では本体と依存を再利用し、保存済みの旧パッチを戻して新パッチを適用する。適用に失敗した場合は旧パッチへ戻してエラーにする。GUI・CLIともに同じ保存形式の修正と実装と同一のフォントを適用する。

通常起動では取得・依存導入・ビルドを行わない。パッチやフォントを更新した後は`npm ci`または`npm run openpencil:setup`で反映する。変更がなければ準備処理を省略し、GUIだけのパッチ変更ではパッケージの再ビルドも省略する。初回の準備にはGitとネットワーク接続が必要。

```sh
npm run openpencil
npm run openpencil -- info art-src/openpencil/endfield-rpg.fig
npm run openpencil -- tree art-src/openpencil/endfield-rpg.fig
npm run openpencil:render -- art-src/openpencil/endfield-rpg.fig --page Screens --node Home --output test-results/home.png
npm run openpencil:verify
```

引数なしの`npm run openpencil`でGUIとブラウザが起動し、リポジトリの`endfield-rpg.fig`を自動で読み込む。ブラウザが自動で開かない環境では表示されたローカルURLを開く。原稿の選択・ドロップは不要。編集後は`.fig`として保存して元の原稿を更新する。GUI・CLIともに[フォント](art-src/openpencil/fonts/)を同梱するため、OSへのフォント導入とMCP設定は不要。Figmaで直接開く場合は同じTTFをOSへ導入する。ライセンスと元のWebフォントは[素材メモ](art-src/README.md#共通uiのフォント)を参照する。

通常のGUI起動ではMCPサーバーを起動せず、7600番ポートとMCPソケットを使用しない。上記のファイル指定CLI・描画・比較もMCPなしで使える。実行中のGUIをCLIやMCPから操作する場合だけ、`OPENPENCIL_DEV_MCP=1 npm run openpencil`で有効にする。既定の7600番が使用中なら`OPENPENCIL_DEV_MCP_PORT`で空いているポートを指定する。

公開Web版OpenPencil 0.16.0には、このリポジトリで適用する保存・描画・プロトタイプの修正が含まれない。編集・保存には上記コマンドで起動するローカル版を使う。

`openpencil:render`はOpenPencilのHTML出力を、ゲームのVRTと同じ固定PlaywrightコンテナでPNGにする。Dockerが必要で、編集後も同じコマンドを使う。`--compare <比較先PNG>`を加えると、寸法と全RGBAを比較し、差分0のときだけ成功する。

`openpencil:verify`は、製品部品と同居するStoryの`parameters.design`から対応を集計し、Figの部品・variant・画面と実装を比較する。通常の変更確認と提出前には`--changed`を使い、有効な成功済み入力signatureがなければ全件を比較する。対応一覧は`--list`、撮影せず影響対象と理由を調べる場合は`--diff`、指定IDの調査には`--select`を使う。

出力は`test-results/openpencil/verification/`。比較範囲・条件、差分判定、signature、完了判定、CI成果物は[テスト設計](docs/testing.md#デザイン原稿と実装の比較)を参照する。

```sh
npm run openpencil:verify -- --list
npm run openpencil:verify -- --diff
npm run openpencil:verify -- --changed
npm run openpencil:verify -- --select items/equipment-select/default --keep-export
```

並列数は実行先の資源から自動で決め、`--workers 1`などでも指定できる。標準HTML出力と素材を調べる場合は`--keep-export`を使う。

共通の画像・SVG図案は[原稿設定](art-src/openpencil/bindings.json)の`assets`で管理し、登録元は`Design System`または`Components`配下に限定する。素材単体の画素比較は行わない。UI部品内の共有素材は通常のインスタンスとして再利用し、その部品全体の比較に含める。SVG図案は原稿で編集可能なベクターとして保持し、`assets`に保存先と標準の書出し設定を登録する。`npm run openpencil:export-assets`は通常のSVG出力を変更せず製品の素材へ保存する。図案を編集した場合は、この出力と使用部品・画面の比較を実行する。

`openpencil:render`と`openpencil:verify`で既存の固定Playwrightコンテナを使う場合は`--container NAME`を指定する。リポジトリのマウント先が`/work`以外なら、`--container-root /path/to/project`も指定する。

部品・画面の実装とStory・部品テストは`src/web/components/<Name>/`にまとめる。対応設定の書式は[scripts/verify-design-bindings.mjs](scripts/verify-design-bindings.mjs)、集計は[scripts/storybook-design-manifest.mjs](scripts/storybook-design-manifest.mjs)を参照する。編集した`.fig`を保存した後は同じコマンドで比較でき、原稿の再生成は不要。

GUIプレビューと標準のPNG出力はCanvasKitで描画され、ブラウザ描画とは画素差がある。実装との比較用PNGは`openpencil:render`または`openpencil:verify`で作り、完了判定は[比較スクリプトの結果](docs/testing.md#デザイン原稿と実装の比較)に従う。文字・図形・マスク・色変数・部品は原稿のネイティブ構造で保持する。

## ソース構成

| ディレクトリ | 責務 |
| --- | --- |
| `src/game/` | 状態とゲームルール |
| `src/presentation/` | 画面状態、意味イベント、表示データの投影 |
| `src/content/` | ゲームへ渡す型付き定義 |
| `src/web/` | Svelte画面、ブラウザ入力・測定・I/O、描画資源 |
| `public/assets/` | 実行用の素材 |
| `art-src/` | 配布に含めない原素材 |

依存方向と状態の所有は[仕様概要](specs/overview.md#責務境界)に定める。型検査は`svelte-check --tsgo`を使う。`@typescript/native`のTypeScript 7が検査を担当し、`typescript`の6系はSvelte変換のJavaScript API用に残している。

## 短い試遊手順

1. `/`で「新規開始」を確認し、仮の導入から「ホームへ」進む。初期仲間はロッシ1人。
2. 「出かける」→「行き先へ」→「ダンジョン」→「出発する」で探索する。任意準備から持込み・装備・編成も変更できる。
3. 行き先で「街」を選び、場所・人物との会話、加入、街探索による療養を試す。
4. ホームのメニューで保存し、タイトルの「続きから」で再開する。リロードはタイトルへ戻るため、未保存の変更は失われる。

詳しい操作、試用値と対象外の範囲は[ゲーム仕様](specs/overview.md)を参照する。

## デバッグと配置設定

通常配布はデバッグURLを受け付けない。開発サーバーまたはdebug版では、`/?debug=1`で街、`/?debug=1&battle=1`で固定戦闘、`/?debug=1&dungeon=1`で直接探索を開ける。デバッグ保存は通常保存と別スロット。

配置設定は開発サーバーだけで使える。調整・標準保存・下書きの扱いは各仕様を参照する。

- [会話画面](specs/adventure.md#ブラウザ画面)：`/?debug=1&adventureEdit=1`
- [戦闘構図](specs/visuals.md#調整保存共有)：`/?debug=1&edit=1`
