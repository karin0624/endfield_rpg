# endfield_rpg

ブラウザで動くRPGの試作。街での会話・加入、固定分岐ルートの探索、速度で行動順が変わる戦闘をつなぎ、ホームでの準備・保存と街探索による療養を繰り返す。

## 文書の入口

| 文書 | 内容 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 作業と文書更新の規約 |
| [仕様概要](specs/overview.md) | 本編の流れ、責務境界、各ゲーム仕様への入口 |
| [画面設計](docs/ui-screen-design.md) | 画面の目的・情報・操作と、画面仕様・実装への案内 |
| [デザインシステム](docs/design-guidelines.md) | 共通の文字・色・部品・状態の規則 |
| [制作手順](docs/ui-asset-production.md) | Figmaからの実装、素材制作、実画像の確認 |
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

setupは現在のcheckoutでGit LFSと依存を準備し、配布素材の実体を検証して`check`を実行する。Git同期・認証は[Git認証skill](.agents/skills/endfield-git-auth/SKILL.md)を参照する。

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
| `npm run test:browser` | ゲーム本体の全品質検証を固定Dockerで実行 |
| `npm run test:editor` | 開発エディターの構図・資源検証 |
| `npm run test:all` | ゲーム本体とエディターの全品質検証 |
| `npm run review:party` | 撮影済みの編成4状態と比較元のdiff・overlayを生成（Python／Pillow） |

一部のファイルだけ整形する場合は`npx biome check --write path/to/file`を使う。ブラウザ検証は上記wrapperから固定コンテナで実行し、画像・trace・JSONは`test-results/`へ保存する。対象範囲と提出前の確認は[テスト設計](docs/testing.md)を参照する。

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

詳しい操作は[画面仕様](docs/ui-screen-design.md#現行画面への入口)、試用値と対象外の範囲は[ゲーム仕様](specs/overview.md)を参照する。

## デバッグと配置設定

通常配布はデバッグURLを受け付けない。開発サーバーまたはdebug版では、`/?debug=1`で街、`/?debug=1&battle=1`で固定戦闘、`/?debug=1&dungeon=1`で直接探索を開ける。デバッグ保存は通常保存と別スロット。

配置設定は開発サーバーだけで使える。調整・標準保存・下書きの扱いは各仕様を参照する。

- [会話画面](specs/adventure.md#ブラウザ画面)：`/?debug=1&adventureEdit=1`
- [戦闘構図](specs/visuals.md#調整保存共有)：`/?debug=1&edit=1`
