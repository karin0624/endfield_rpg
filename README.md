# endfield_rpg

ブラウザで動くRPGの試作。街のADV、分岐ルート探索、速度で行動順が変わるタイムライン戦闘を組み合わせる。

まず「ホームで準備・編成 → 街やダンジョンを探索 → 帰還 → 街探索で療養」という生活ループを小さく接続する。実装はCodexを中心に進め、描画なしの高速なテストと必要最小限の実装を優先する。

## 文書の入口

| 文書 | 役割 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 常時適用する短い作業規約と、必要な文書への案内 |
| [specs/overview.md](specs/overview.md) | 現在の全体要件と責務境界 |
| [specs/save.md](specs/save.md) | ホームの1スロット保存、復元、入力検証と保存I/Oの境界 |
| [specs/party.md](specs/party.md) | 仲間一覧、空き枠可4枠PT、単独出撃と状態の引継ぎ |
| [specs/dungeon.md](specs/dungeon.md) | 固定ルート、ノード進行、戦闘・会話からの復帰 |
| [specs/adventure.md](specs/adventure.md) | 街・会話のゲーム状態、入力、条件、型付き会話データ |
| [specs/battle.md](specs/battle.md) | タイムライン戦闘、通常攻撃、勝敗の状態・操作・受入例 |
| [specs/visuals.md](specs/visuals.md) | 戦闘画面の配置・構図設定・描画 |
| [docs/ui-screen-design.md](docs/ui-screen-design.md) | 画面の目的・情報・操作・構図の設計方法と現行画面仕様への入口 |
| [docs/design-guidelines.md](docs/design-guidelines.md) | 共通原則・基盤・意味トークン・部品契約・状態・複合パターン |
| [docs/ui-asset-production.md](docs/ui-asset-production.md) | 本人Figmaからの実装、素材制作、実画像レビュー、一致・操作検証の責務 |
| [docs/testing.md](docs/testing.md) | 純粋モデル、直接VRT、Native資源検証の責務と実行環境 |
| [docs/adr/](docs/adr/) | 採用した判断とその経緯 |
| [docs/visual-records/](docs/visual-records/) | 保存画像の索引 |
| [素材メモ](art-src/README.md) | 使用素材の出典・透過処理・Git LFS運用 |
| [全体ロードマップ（Issue #1）](https://github.com/karin0624/endfield_rpg/issues/1) | GitHub上の進捗の入口 |

開発計画・受入条件・進捗・対象版の検証結果はIssue／PR、継続的な技術判断はADRで扱う。文書の規約は[AGENTS.md](AGENTS.md#文書の更新)を参照する。
本人がローカルのOpenPencilで`.fig`を編集し、実装担当は指定された固定版と操作仕様を製品へ反映する。導入・編集は[OpenPencilの手順](#openpencilでfigを編集する)を参照する。共通DSの記載を全画面への適用済み・承認済みと扱わない。

## 必要な環境

- Node.js 24（`.nvmrc`あり）
- npm 11
- Git LFS（地面GLBの取得に必要）
- Docker（ブラウザテストに必要）

## OpenPencilで.figを編集する

対象は[open-pencil/open-pencil](https://github.com/open-pencil/open-pencil/tree/v0.16.0)の**0.16.0**。同名の別製品と取り違えない。画面ファイルの制作と、ツールの導入は別作業として扱う。

| 導入物 | 役割 |
| --- | --- |
| デスクトップアプリ | 本人が画面を見て`.fig`を編集・保存する。MCPで編集する場合も起動しておく |
| `@open-pencil/cli` | ファイルを読取・編集・保存する。ファイルパスを渡すheadless操作はアプリなしでも実行できる |
| `@open-pencil/mcp` | アプリ側サーバーと、クライアント用stdio bridge。bridge単体では文書を編集できない |

### 初回だけ行うこと

1. [0.16.0の公式リリース](https://github.com/open-pencil/open-pencil/releases/tag/v0.16.0)からOS／CPUに合うアプリをインストールする。macOSは`brew install --cask openpencil`でも導入できるが、取得版はHomebrewの現行版になる。アプリとMCPのmajor.minorを揃え、ここでは0.16.0を使う。
2. Node.js 24／npm 11を用意し、このrepoのルートで`npm ci`を実行する。lockfileで固定されたCLI／MCP 0.16.0がrepo内へ入る。ゲーム環境も準備する場合は[既存のsetup](#セットアップと実行)を使う。
3. デスクトップがMCPサーバーを自動起動できるよう、本人の端末で次を一度実行し、アプリを再起動する。これはnpmのglobal領域への明示的なインストール。repoのsetupやMCP起動スクリプトはglobal installを行わない。

   ```sh
   npm install --global @open-pencil/mcp@0.16.0
   ```

4. アプリで対象`.fig`を開き、Settings → MCPでLocal serverの起動状態とフォルダーを確認する。ファイルを開く・保存する範囲をこのcheckoutに合わせる。選択限定やTool accessで編集を制限している場合は、必要な範囲を本人が判断する。認証は有効のまま使う。
5. **同じPC・OSユーザー**で、repoルートからCodexを開く。`.codex/config.toml`に`open-pencil`を設定済み。プロジェクトの信頼確認が表示された場合は本人が内容を確認し、クライアントを再起動／再接続して`/mcp`で状態を確認する。他の対応クライアント用には`.mcp.json`もある。自動読込の対応と初回承認はクライアントに従う。

手動編集やこのローカルMCP接続にAI providerのAPI keyは不要。内蔵AIを使う場合の設定は別。repoはPCの設定・認証・永続許可を変更しない。bridgeはアプリのdiscoveryを使い、トークンをrepoへ保存しない。MCPの`eval`も追加で有効化しない。

### 次回からの編集

アプリを開き、このrepoで「`対象パス.fig`の○○を編集して」と指示する。設定済みクライアントでは再登録は不要。担当は[編集skill](.agents/skills/endfield-openpencil/SKILL.md)に従って既存文書・ページを読み、専用MCPツールで編集し、同じ対象へ保存して再読取する。本人の未保存編集とGit差分を先に確認する。

接続は同じマシンのアプリに限られる。クラウドのCodexから本人PCのアプリへ、この設定だけで接続はできない。クラウドでは同期済みの`.fig`をCLIで編集できるが、開いているローカル文書には反映しない。本人はアプリで保存してからGitで受け渡し、更新後のファイルを開き直す。

repoルートでの確認とheadless編集例（パスを実在する対象へ置き換える）:

```sh
npm run openpencil -- --version
npm run openpencil:mcp -- --version
npm run openpencil -- info path/to/existing.fig
npm run openpencil -- tree path/to/existing.fig
npm run openpencil -- eval path/to/existing.fig -c "figma.currentPage.name = 'Updated'" --output path/to/edited.fig
npm run openpencil -- info path/to/edited.fig
```

CLIの`--output`は別ファイルへ保存する。原本へ保存するときだけ対象を確認して`--write`を使う。MCPのランチャーはこのcheckoutをファイル操作のrootにする。MCPクライアントはrepoルートから起動する。他の作業ディレクトリから登録するクライアントでは`args`のスクリプトパスを絶対パスにする。アプリ側の許可範囲がより狭い場合、その制限は引き続き適用される。

### 対応OSと検証の境界

| デスクトップ | 公式0.16.0の要件・配布 |
| --- | --- |
| macOS | 13 Ventura以降＋現行Safari更新。Apple Silicon／IntelのDMG |
| Windows | 10以降＋WebView2 Evergreen。x64／ARM64のMSI／EXE |
| Linux | WebKitGTK 2.40以降（webkit2gtk-4.1）。x64のAppImage／DEB／RPM |

repoのCLI／MCPはNode.js 24で検証する。LinuxのGUIなし環境では、setup再実行、CLIの`.fig`読取・編集・保存・再読取、認証を保ったMCPサーバーとstdioの起動を確認できる。デスクトップの画面操作、アプリとMCPの接続、macOS／Windowsの実動作、本人PCの初回信頼確認は別途実機での確認が必要。CLIの保存成功を表示の一致や本人承認と扱わない。

公式仕様: [導入・OS要件](https://github.com/open-pencil/open-pencil/blob/v0.16.0/packages/docs/getting-started.md)、[MCP](https://github.com/open-pencil/open-pencil/blob/v0.16.0/packages/docs/programmable/mcp-server.md)、[CLI編集・保存](https://github.com/open-pencil/open-pencil/blob/v0.16.0/packages/docs/programmable/cli/scripting.md)。

## セットアップと実行

CodexでGitの取得・同期や認証を扱うときは、[endfield-git-auth skill](.agents/skills/endfield-git-auth/SKILL.md)に従う。GitHub API・公開、workspaceのGit同期、Git LFS実体取得を用途別に扱う手順をここにまとめる。

新規チェックアウト後の準備と検査は一つの入口で実行する。Node.js 24／npm 11を確認し、local Git LFS導入、lockfileからの依存導入、必要な配布LFS素材の取得・SHA-256 oid／size照合を終えてから `check` を一度実行する。準備済みの素材は再取得しない。失敗時は後続工程へ進まない。

```sh
nvm use
node scripts/setup.mjs
```

Codexの保存環境の **Install script** はrepositoryを作業ディレクトリとして、次の一行を設定する。

```sh
node scripts/setup.mjs --cache /workspace/.npm
```

Install scriptを環境起動の実行入口とする。`SessionStart`で同じ準備を重ねず、追加の `npm run build` も不要（`check` が通常buildを含む）。保存環境への設定・公開と新規taskでの実行確認は別途必要であり、repositoryのscript追加だけでは自動実行されない。同期は対象taskの取得手順で行い、setupは現在のcheckoutを変更しない。

Install scriptには独立checkoutを使い、共有worktreeの設定を変更しない。LFS取得失敗時の限定的な自動診断と停止条件は[Git認証skill](.agents/skills/endfield-git-auth/SKILL.md#install-scriptとの関係)を参照する。素材の実体照合に失敗したまま後続検査へ進めず、認証・権限の拒否を別経路で回避しない。

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | Viteの開発サーバーを起動する |
| `npm run lint` | Biomeで整形・import順・推奨ルールと追加ルールを確認する |
| `npm run format` | Biomeで整形・import順・安全なlint修正を適用する |
| `npm run typecheck` | TypeScript 7のnative checkerでTS・Svelteテンプレートを検査する |
| `npm run check` | Biome・型・素材検査・通常minified build・全VitestとV8 coverage・発見／実行照合 |
| `npm run build` | 通常配布を`dist/`へ生成する |
| `npm run build:debug` | 専用debug入口を`dist-debug/`へ生成する |
| `npm run build:views` | 直接状態fixtureを同じ標準minifier・非root baseで`dist-views/`へ生成する |
| `npm run test:browser` | ゲーム本体CI対象のcheck・必要build・views／rendererの直接VRT・Native WebGL資源検証と同じ実行のcoverageを確認する |
| `npm run test:editor` | 開発者用の直接構図VRT・Native HMRを必要時に全実行する |
| `npm run test:all` | check・必要build・既定とeditorの全ブラウザprojectを一回の直列実行で確認する |
| `npm run review:party` | UI変更の画像レビュー時に、直近の実撮影と承認資料のraw diff・overlay・数値を明示生成する（Python／Pillowが必要） |

`lint`と`check`はwatchモードを使わず、結果を終了コードで返す。Biomeの設定は[`biome.json`](biome.json)。`npm run format`はリポジトリ全体を書き換えるため、変更ファイルだけ整えるときは`npx biome check --write path/to/file`を使う。Codexは[`AGENTS.md`](AGENTS.md)の指示に従い、コード変更後に`npm run check`を実行する。ゲーム本体のテストにはブラウザ、DOM、Babylon.js、WebGLを必要としない。

ブラウザテストは以下のコマンドから固定したPlaywrightコンテナで実行する。基準画像の生成とCIの比較は同じ環境を使う。Playwrightを直接起動すると、コンテナ外ではエラーになる。

```sh
npm run test:browser
```

基準画像の比較環境を固定し、失敗時の画像・traceと実JSONは`test-results/`へ保存する。通常配布4173、debug4175、標準minifiedの直接fixture4174を使用する。任意state・phaseを直接描き、ゲームjourneyや実時間待機をテストへ残さない。ゲーム操作・focus・dialog・保存等の結果は実コアをつないだ純粋モデルで確認し、ブラウザは実外観と直接WebGL資源だけを担当する。詳しくは[テスト設計](docs/testing.md)を参照する。

開発エディター・標準構図・HMR変更時は`npm run test:editor`も必要になる。`test:all`で両scopeを同じ必要build／ブラウザ実行へまとめられる。基準画像を意図的に変更するときだけ対応scopeの`--update-snapshots`を使用し、承認と画像レビューを経る。基準bytes・許容差は回帰検出の契約として管理する。5分目標の全工程計測は`test:browser`が対象で、設定画面の`test:editor`と両scopeの`test:all`は含めない。CIは固定コンテナの一つのjob／workspaceで`test:browser:inside`を実行する。checkの通常配布をその場で再利用し、別入口のdebug／viewだけを一度ずつ追加buildする。artifactのupload／downloadや保存容量に依存せず、対象revision・全実行結果・coverageをログとjob summaryへ記録する。ローカルの`test:browser`も同じ工程をworkspace所有者として実行する。gameのNative実行は既定2workers、`test:editor`／`test:all`は既定1worker。直列のgameを明示実行するには`npm run test:browser -- --workers=1`を使う。

UI変更の画像レビューには、`test:browser`で撮影した4状態を使い、Pillowを用意したPython環境で`npm run review:party`を明示実行する。`test-results/approved-comparison/`へ同解像度の原画・実画面・raw diff・overlay・領域別数値を生成し、レビュー資料として確認する。この診断とPillow導入は通常CIの工程へ含めない。画像レビューの必要条件は[UI開発の必須ゲート](docs/ui-asset-production.md#ui開発の必須ゲート)を参照する。

クラウド環境で`NODE_EXTRA_CA_CERTS`が既存の`/usr/local/share/ca-certificates/environment-proxy-ca.crt`を指し、そのファイルを読み取れる場合、ブラウザテストの起動スクリプトが証明書をコンテナへ読み取り専用で渡す。コンテナ内のNode.jsだけに同じCAを追加し、TLS検証は有効のままにする。OSの信頼設定は変更せず、証明書はリポジトリに保存しない。この条件に当てはまらないローカル環境とGitHub Actionsの実行方法は変わらない。

GLBはGit LFS、現在の数MiBのPNG・文書・コードは通常のGitで管理する。CIもLFSの実体を取得する。`build`は素材のヘッダーを確認し、LFSポインタのままなら配布物を作る前にエラーにする。

## ソース構成

| ディレクトリ | 責務 |
| --- | --- |
| `src/game/` | 状態とゲームルール。ブラウザ固有機能から独立させる |
| `src/presentation/` | 本編・街・会話・編成・人物詳細・成長・探索・戦闘・開発設定の画面状態、意味イベント、純粋な表示投影 |
| `src/content/` | ゲーム本体へ渡す型付きの定義データ |
| `src/web/` | 意味イベントへの薄いNative接続、確定frameの描画、測定・実I/O・GPU資源の寿命 |
| `public/assets/` | ブラウザが使うGLB・背景・透過立ち絵・敵素材・ルートノード画像 |
| `art-src/` | 元素材と素材メモ。配布物には含めない |

通常UIと開発エディターは`src/web/components/*.svelte`のSvelte 5テンプレートで描く。`.svelte.ts`はmount・破棄、確定モデルの受渡し、必要な表示粒度の`$derived`を担当する。純粋な同期state／意味イベントは`src/presentation/`に保ち、canvas・実測・WAAPI・画像完了・保存・GPU資源はbrowser側で所有する。戦闘HUDは意味状態の変化で投影し、連続するmarker／cue時刻を別に描く。[採用判断](docs/adr/0007-svelte-views.md)を参照する。

`svelte-check --tsgo`は`@typescript/native`のnpm aliasに置く安定版TypeScript 7を検査に使う。`typescript`名のTypeScript 6はSvelteのテンプレート変換が使うJavaScript API用であり、検査のfallbackではない。型検査は`npm run typecheck`へ一本化する。

## 現在試せる範囲

通常版はタイトルから導入・ホームへ進み、ロッシ単独で開始する。空き枠を含む4枠編成、会話または戦闘を通る固定分岐ルート、ボス勝利・全滅帰還、街探索による療養、ギルベルタの加入・控え、再探索、ホームでの1スロット保存・タイトルからの再開まで接続している。ホーム・街・編成・探索を移動しても同じセッションを保持する。

街探索完了とダンジョン全体は各半日。ダンジョン内部では生活時計と療養を進めず、帰還時に生活時計だけを進める。帰還は全員の一時成長を初期化してから出撃者のHPを症状補正後の最大値へ戻す。症状を持ち越し、控えのHPは成長消失後の上限へ収めるだけで回復しない。肉体疲労・朦朧は連続数値を保持し、街探索ごとに一定量回復する。軽重は表示区分で、重度後も個別上限まで悪化する。戦闘不能の仲間はHP満タンでも戦闘へ参加せず、街探索6回で復帰する。表示は回復結果、現在HP、症状、残り街探索回数、日数と昼夜を示す。

ゲーム用乱数・精神疲労の数値・街回復回数と療養残量を含む論理状態を保存する。リロードではタイトルへ戻り、「続きから」で保存時点のホームへ戻る。読込で時間・回復・加入を再実行せず、現実時間による回復もない。保存は現行v5のみを扱い、旧形式の変換・自動削除は行わない。同じブラウザ・オリジンのホームだけで、会話・探索・戦闘途中、複数スロット、クラウド同期は扱わない。

通常探索の戦闘では、試用の初期攻撃・回復アクティブを選択して使える。対象スキルは使用前の精神疲労から連続倍率を計算して効果を適用し、その後に疲労を加算し、使用後疲労に応じて使用者へ肉体疲労・朦朧を追加発症させる。付与量は今回のスキル負荷から決め、内部上限の候補だけを除外する。疲労は次戦・帰還・保存読込・再出撃へ持ち越し、既存の街探索完了で数値が回復する。スキル選択には予測効果・疲労増加量、街の結果とキャラ詳細には現在の疲労を表示する。初期技構成・効果量・倍率曲線・回復量は試用値で、詳細は[状態異常仕様](specs/status.md)と[スキル仕様](specs/skills.md)を参照する。

### 短い試遊手順

1. `npm run dev`で `/` を開き、「新規開始」の確認→「（仮テキスト）」の導入→「ホームへ」と進む。
2. ホームの「出かける」→任意準備の「行き先へ」→「ダンジョン」→出発準備の「出発する」。会話分岐・必須3択・ボス戦・帰還を進める。画面の閲覧だけでは半日は進まない。
3. 「出かける」→「行き先へ」→「街」では従来の会話・加入・療養を使える。会話完了時だけ半日・回復を一度反映する。街からホームへ戻って編成する。
4. ホームのメニュー→タイトルへ→「保存してタイトルへ」を確認し、タイトルの「続きから」で保存時点へ戻る。保存失敗時はホームに留まる。新規開始・保存せずタイトル復帰・リロードでは既存スロットを消さないが、未保存の変更は保持しない。

通常配布は `npm run build` の `dist/` を使う。`?debug=1`、`?battle=1`、`?dungeon=1` 等を付けてもデバッグを起動できない。開発サーバー、または `npm run build:debug` の `dist-debug/` だけが `/?debug=1`（街の検証）、`/?debug=1&battle=1`（固定戦闘デモ）、`/?debug=1&dungeon=1`（直接探索）を受け付ける。デバッグ保存は通常保存と別キー。旧デバッグURLを通常配布の入口として使わない。

ホーム・街・探索先地図の構成と表示条件は[画面仕様](docs/ui-screen-design.md#現行画面への入口)を参照する。通常ホームの「仲間」は全加入者の装備画面を開き、「アイテム」は表示のみの入口である。「出かける」から任意の持込み・装備・編成を行える。保存・タイトル復帰はメニューから選ぶ。

### 接続済み機能と残る範囲

通常プレイでは街・探索の試用XP、複数レベル分の必須3択、パッシブ強化、次戦への成長投影、帰還時の全員の育成初期化を接続している。追加発症と連続症状も戦闘・街回復・保存へ接続し、ゲージ下のアイコンを開くと効果と回復回数を確認できる。詳細画面は内部数値も表示する。係数・上限・回復量は調整可能な試用値で、最終バランスではない。

探索分岐では「分岐で回復」から使用者・習得済み回復技・生存味方を選べる。取消では何も消費せず、有効使用でも日数やノードは進めない。SP、恒久育成、終了日・エンディング、コンテンツ量産も対象外。ショップ・装備の現行契約は[物品仕様](specs/items.md)を参照する。加入イベントと生活半日の長さは試作用の定義である。

戦闘の敵札・選択マーカーは、画面サイズと札自身の折返しによる寸法変更に追従する。画面上の投影位置と札の実寸を使って配置する。

出撃編成は枠から顔カード一覧を開き、顔カードを押すごとに番号順へ追加し、押し直しで解除する。「確定」またはEscで残った番号順の4枠を一度に反映する。配置済みキャラと未確定候補は「詳細」からHP・攻撃力・速度・命中率・現在症状・精神疲労の数値とラベルを確認できる。「編成へ戻る」またはEscで編集枠・候補・スクロール・フォーカスを保持して戻り、閲覧だけではゲーム状態を変えない。成長と習得は通常プレイの必須3択・戦闘へ反映する。キャラ詳細では現在レベルと実習得アクティブ／パッシブを確認できる。パッシブは現在ランク・上限・効果、アクティブは使用場面・対象・精神疲労増加を表示する。開くたびに現在の成長・習得を読み、帰還後は初期化後の値を示す。未接続の情報と習得なしを区別し、未習得候補や編集操作は表示しない。

採用構図は`ground1.glb`と`landscape1.png`専用の暫定標準。地面はGit LFSの実体が必要で、コードだけでは描画できない。素材の出典・利用条件は[素材メモ](art-src/README.md)に分ける。別の地面・遠景を追加する場合は別の構図設定を用意する。

仲間・PTは`src/game/party.ts`、生活ループは`src/game/expedition.ts`、保存検証は`src/game/save.ts`、保存I/Oは`src/web/saveSlot.ts`が担当する。街・会話・ルート・戦闘の判断は`src/presentation/`が同じコアへ意味入力を同期適用し、`src/web/`は結果を描く。

## 会話画面の配置を決める

1. `npm run dev`で起動し、デバッグ街の「会話画面の配置設定」から開く。URLは`http://localhost:5173/?debug=1&adventureEdit=1`。
2. 左・中央・右の立ち絵の水平位置、全員共通の高さと足元、本文パネル・話者名・本文・送り矢印・選択肢の位置を数値入力かスライダーで調整する。ギルド初回会話がプレビューに開き、クリックで別の話者と選択肢も確認できる。
3. 「画面だけで確認」で設定パネルを隠せる。「標準として保存」で[`src/web/adventure-settings.json`](src/web/adventure-settings.json)に保存すると、通常表示と次回ビルドに反映される。未保存の調整は同じブラウザに下書きとして残る。

会話画面の設定は戦闘画面の構図設定と別で、開発サーバー専用。配布ビルドには保存済みの値だけを含める。

## 戦闘画面の構図を決める

1. `npm run dev`で起動し、右上の「構図設定」から開く。URLは通常`http://localhost:5173/?debug=1&edit=1`。
2. カメラ位置・注視点・画角、地面の倍率、遠景の倍率・左右・高さ・前後、味方・敵それぞれの隊列中心と隣への左右差・前後差を調整する。スライダーと数値入力のどちらも使える。確認人数は1人／2人を切り替えられ、配置ルールは常に編成全体へ適用される。
3. 「画面だけで確認」でパネルを隠し、実際の16:9画面を確認する。「設定に戻る」で編集を続けられる。
4. 「標準として保存」で[`src/web/battle-settings.json`](src/web/battle-settings.json)に書き込む。配置した全キャラが地面上にない場合は警告され、保存できない。「保存済みの通常表示」で採用した構図を確認する。次回起動と次回ビルドにも反映されるので、このJSONをコードと一緒にGit管理する。

編集途中の値は同じブラウザの同じオリジンに一時保存し、設定画面を再読み込みすると復元する。一時保存だけでは通常表示を変更しない。「保存済みに戻す」で編集を破棄でき、「JSONを書き出す」で現在の値を共有・保管できる。

設定画面とファイル保存機能は開発サーバー専用。`npm run build`の配布物は、保存したJSONの構図を使い、設定UIやファイル保存機能を含めない。
