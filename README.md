# endfield_rpg

ブラウザで動くRPGの試作。街のADV、分岐ルート探索、速度で行動順が変わるタイムライン戦闘を組み合わせる。

まず「街で依頼を受ける → 探索で会話・戦闘を行う → 帰還して報酬を得る」という依頼1本を完成させる。実装はCodexを中心に進め、描画なしの高速なテストと必要最小限の実装を優先する。

## 文書の入口

| 文書 | 役割 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 常時適用する短い作業規約と、必要な文書への案内 |
| [specs/overview.md](specs/overview.md) | 合意済みの要件、技術構成、暫定案、未決定事項 |
| [specs/milestones.md](specs/milestones.md) | 段階ごとの完了条件とタスクの依存順 |
| [全体ロードマップ（Issue #1）](https://github.com/karin0624/endfield_rpg/issues/1) | GitHub上の進捗の入口 |

ゲーム仕様の正本は`specs/`、Issueは変更単位と受入条件、`AGENTS.md`は作業規約とする。

## 必要な環境

- Node.js 24（`.nvmrc`あり）
- npm 11

## セットアップと実行

新規チェックアウト後に依存関係を固定済みのlockfileからインストールする。

```sh
nvm use
npm ci
```

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | Viteの開発サーバーを起動する |
| `npm run check` | TypeScriptの型チェックとNode環境のVitestを1回実行する |
| `npm run build` | 型チェック後に配布用ファイルを`dist/`へ生成する |

`check`はwatchモードを使わず、結果を終了コードで返す。ゲーム本体のテストにはブラウザ、DOM、Babylon.js、WebGLを必要としない。

## ソース構成

| ディレクトリ | 責務 |
| --- | --- |
| `src/game/` | 状態とゲームルール。ブラウザ固有機能から独立させる |
| `src/content/` | ゲーム本体へ渡す型付きの定義データ |
| `src/web/` | ブラウザ表示と入力。`src/game/`と同じコア関数を使う |

## 現在の状態

[Issue #3](https://github.com/karin0624/endfield_rpg/issues/3)の最小開発環境があり、街から始まる初期状態をNodeテストとブラウザの双方から生成できる。戦闘・会話・探索、Babylon.js、実素材の取り込みは後続Issueで実装する。
