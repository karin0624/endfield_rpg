# マイルストーンと実装順

[仕様概要](../specs/overview.md)を前提とする。[Issue #1](https://github.com/karin0624/endfield_rpg/issues/1)を進捗の入口とし、この文書では到達点と依存順を管理する。各タスクの詳細な受入条件は対象Issueに置く。

## 段階ごとの完了条件

| 段階 | 到達点・完了条件 |
| --- | --- |
| M0 | 作業規約・仕様・開発経路を整え、Nodeでゲーム本体を検証できる。実素材で3D地面・2D遠景・2Dキャラを表示し、接地とカメラ範囲を確認できる |
| M1 | タイムライン戦闘を開始から勝敗・再戦まで遊べる。行動順・攻撃・勝敗をNodeで、実際の入力と表示をブラウザで検証できる |
| M2a | 街の場所選択から会話・選択肢・フラグ更新を経て戻れる。再訪時の分岐をNodeと画面の双方で確認できる |
| M2b | 固定ルートの分岐・合流を選び、戦闘・会話の終了後に正しい探索状態へ戻れる。接続先以外への移動とノードの重複解決を拒否できる |
| M2c | 仲間一覧と4枠PT、半日行動、段階回復と帰還HP回復を接続し、街保存・復元まで検証する |
| M3 | 探索内育成・スキル3択・精神疲労・帰還育成初期化を接続する |
| M4 | 最小サンプル・定義・追加手順と通し検証を整え、ユーザー試遊から拡充へ移る |

採用済みのM3機能を再び採否判断待ちに戻さない。Issueや仕様の更新を実装完了として扱わない。

## タスクと依存先

依存先は原則として完了後に着手する。素材の選定など、独立して進められる作業は備考のとおり。着手時には対象Issueの最新の依存欄も確認し、変更があればこの表と整合させる。

| 段階 | タスク | 依存先・備考 |
| --- | --- | --- |
| M0 | [#2 規約・仕様の整理](https://github.com/karin0624/endfield_rpg/issues/2) | なし |
| M0 | [#3 開発・高速テスト環境](https://github.com/karin0624/endfield_rpg/issues/3) | #2 |
| M0 | [#4 最小戦闘画面](https://github.com/karin0624/endfield_rpg/issues/4) | #3。仮素材で進められる |
| M0 | [#5 実素材の取り込み](https://github.com/karin0624/endfield_rpg/issues/5) | #4＋ユーザーの実ファイル |
| M1 | [#6 タイムライン](https://github.com/karin0624/endfield_rpg/issues/6) | #3。描画・実素材を待たない |
| M1 | [#7 通常攻撃・勝敗](https://github.com/karin0624/endfield_rpg/issues/7) | #6 |
| M1 | [#8 敵行動・戦闘ループ](https://github.com/karin0624/endfield_rpg/issues/8) | #7 |
| M1 | [#9 戦闘UI・最小演出](https://github.com/karin0624/endfield_rpg/issues/9) | #4、#8。#5とは並行可 |
| M1 | [#10 仮敵素材](https://github.com/karin0624/endfield_rpg/issues/10) | #4・#5でCC0スライム1種の導入と出典記録を先行実施。Issue自体の完了判定は別途行う。他のゲーム本体タスクを待たせない |
| M1 | [#11 最小ブラウザテスト](https://github.com/karin0624/endfield_rpg/issues/11) | #9 |
| M2a | [#12 街・会話のゲーム本体](https://github.com/karin0624/endfield_rpg/issues/12) | #3。戦闘側と並行可 |
| M2a | [#13 街・会話の画面](https://github.com/karin0624/endfield_rpg/issues/13) | #12、#11 |
| M2b | [#14 ルート・ノード進行](https://github.com/karin0624/endfield_rpg/issues/14) | #8、#12 |
| M2b | [#15 ルート画面と接続](https://github.com/karin0624/endfield_rpg/issues/15) | #14、#13、#9 |
| M2c | [#34 仕様同期](https://github.com/karin0624/endfield_rpg/issues/34) | 各担当の実装に合わせて確定事項と試用値を区別する |
| M2c | [#35 仲間・4枠PT・単独出撃](https://github.com/karin0624/endfield_rpg/issues/35) | #34、#8、#14 |
| M2c | [#47 状態異常・命中・段階回復](https://github.com/karin0624/endfield_rpg/issues/47) | #34、#35、#8 |
| M2c | [#36 生活時計・街滞在](https://github.com/karin0624/endfield_rpg/issues/36) | #34、#35、#47 |
| M2c | [#37 街探索による加入](https://github.com/karin0624/endfield_rpg/issues/37) | #35後に並行可能 |
| M2c | [#16 帰還と生活ループ](https://github.com/karin0624/endfield_rpg/issues/16) | #36、#37、#47 |
| M2c | [#17 街保存](https://github.com/karin0624/endfield_rpg/issues/17) | #16 |
| M2c | [#18 一周の通し検証](https://github.com/karin0624/endfield_rpg/issues/18) | #17、#11 |
| M3 | [#20 探索育成・スキルの追跡](https://github.com/karin0624/endfield_rpg/issues/20) | #38 経験値・成長、#39 スキル定義、#40 3択、#41 精神疲労、#42 戦闘、#43 分岐、#45 帰還・保存、#44 UI。詳細依存は各Issue |
| M4 | [#21 拡充準備](https://github.com/karin0624/endfield_rpg/issues/21) | M3後に#21→#46通し検証→#19試遊 |

## 進め方

M2cの順は#34→#35→#47→#36。#37は#35後に並行可能。#36・#37・#47→#16→#17→#18と接続する。状態異常の付与・効果・回復は#47、回復対象の街半日の通知は#36、帰還のHP回復と画面統合は#16が担当する。精神疲労の数値連動はM3の#41に分け、上流の完了を下流待ちにしない。

#35の最初の実装は仲間と4枠PTの分離、最小編成UI、単独出撃、HP・フラグの引継ぎ。加入イベント・症状・生活時計・回復・保存を先行しない。この段階の退出はHPを維持し、帰還全回復は#16で統合する。回復前に全滅した場合は再出撃を拒否し、試作の再試行はページ再読込による新規ゲームとする。無料蘇生や休養コマンドを編成機能へ追加しない。

M3では#38と#39を並行可能とし、#40・#41後に#42／#43、保存前提が揃えば#45も進め、最後に#44へ接続する。数値の未確定事項は担当機能ごとに試用値と確定値を分け、小さく試遊できる変更にする。

#34の同期は継続作業で、今回の編成とoverview更新だけでtime/status/progression/skills/saveの詳細仕様まで完了としない。独立レビューと機械的検証を行い、画像・ブラウザ確認の未実施は明示する。

## 進捗更新

完了状態は各Issueで追跡する。計画変更時はこの文書とIssue #1を更新し、採用した追加Issueをリンクする。文書やIssueを登録しただけで、実装・テスト・素材確認を完了扱いにしない。
