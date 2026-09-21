# endfield_rpg

ブラウザで動くRPGの試作。街のADV、分岐ルート探索、速度で行動順が変わるタイムライン戦闘を組み合わせる。

まず「街で依頼を受ける → 探索で会話・戦闘を行う → 帰還して報酬を得る」という依頼1本を完成させる。実装はCodexを中心に進め、描画なしの高速なテストと必要最小限の実装を優先する。

## 文書の入口

| 文書 | 役割 |
| --- | --- |
| [AGENTS.md](AGENTS.md) | 実装者向けの作業規約・検証方針 |
| [specs/overview.md](specs/overview.md) | 合意済みの要件、技術構成、暫定案、未決定事項 |
| [specs/milestones.md](specs/milestones.md) | 段階ごとの完了条件とタスクの依存順 |
| [全体ロードマップ（Issue #1）](https://github.com/karin0624/endfield_rpg/issues/1) | GitHub上の進捗の入口 |

ゲーム仕様の正本は`specs/`、Issueは変更単位と受入条件、`AGENTS.md`は作業規約とする。

## 現在の状態

文書のみを整備した段階。ゲーム本体、開発環境、テスト、CI、素材の取り込みは未実装。

次は[Issue #3：開発・テスト環境](https://github.com/karin0624/endfield_rpg/issues/3)に着手する。現時点では`package.json`も実行・ビルド・テストコマンドもない。導入したIssueで、実際に動作確認した手順をこのREADMEと`AGENTS.md`に追記する。
