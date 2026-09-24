# マイルストーンと実装順

[仕様概要](../specs/overview.md)を前提とする。[Issue #1](https://github.com/karin0624/endfield_rpg/issues/1)を進捗の入口とし、この文書では到達点と依存順を管理する。各タスクの詳細な受入条件は対象Issueに置く。

## 段階ごとの完了条件

| 段階 | 到達点・完了条件 |
| --- | --- |
| M0 | 作業規約・仕様・開発経路を整え、Nodeでゲーム本体を検証できる。実素材で3D地面・2D遠景・2Dキャラを表示し、接地とカメラ範囲を確認できる |
| M1 | タイムライン戦闘を開始から勝敗・再戦まで遊べる。行動順・攻撃・勝敗をNodeで、実際の入力と表示をブラウザで検証できる |
| M2a | 街の場所選択から会話・選択肢・フラグ更新を経て戻れる。再訪時の分岐をNodeと画面の双方で確認できる |
| M2b | 固定ルートの分岐・合流を選び、戦闘・会話の終了後に正しい探索状態へ戻れる。接続先以外への移動とノードの重複解決を拒否できる |
| M2c | 受注→探索→帰還→報告→報酬・保存まで一周できる。失敗・再受注・復元も検証し、ユーザーの試遊結果と次に強化する体験を記録する |
| M3（保留） | 試遊で選んだ体験を一つずつ追加し、選択によって結果が変わる受入例を満たす。詳細な完了条件は#20から作る追加Issueで決める |
| M4（保留） | 決めた短編を最初から結末まで遊べる。採用した仕上げを終え、配信先で起動・素材読み込み・保存・再開を確認する |

Issue #20・#21は後続計画を決めるタスクであり、それらを閉じただけでM3・M4の実装完了とはしない。

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
| M2c | [#16 依頼1本の接続](https://github.com/karin0624/endfield_rpg/issues/16) | #15 |
| M2c | [#17 街でのセーブ](https://github.com/karin0624/endfield_rpg/issues/17) | #16 |
| M2c | [#18 一周の通し検証](https://github.com/karin0624/endfield_rpg/issues/18) | #17、#11 |
| M2c | [#19 試遊と次の判断](https://github.com/karin0624/endfield_rpg/issues/19) | #18、#5。敵は識別できる仮表示でよい |
| M3 | [#20 追加仕様とタスク分割](https://github.com/karin0624/endfield_rpg/issues/20) | #19の試遊結果とユーザーの判断が出るまで保留 |
| M4 | [#21 短編の範囲と仕上げ計画](https://github.com/karin0624/endfield_rpg/issues/21) | #20と、そこで採用した追加実装の完了・評価まで保留 |

## 進め方

まず#2→#3。その後は#4（描画）、#6（戦闘本体）、#12（ADV本体）を並行して進められる。依存先が未完了なら独立した別タスクを選び、後続Issueの機能を一緒に実装しない。

実素材の確認は#5で行う。未提供の間も仮表示でコア開発を進められるが、実素材確認済みとして#5を閉じない。M0の美術確認を待たずに独立したM1・M2のコアへ着手してよい。

M2cの主要な機械的完了条件は、同じゲーム本体に対して「街→会話→受注→ルート選択→戦闘→帰還→報告→保存・復元」をブラウザなしで実行できること。ブラウザ側では実ボタン操作、表示、素材読み込みの接続だけを少数ケースで確認する。

M2を一周できた時点でいったん試遊する。ユーザーが次に重視する体験を選ぶまで、M3・M4の機能追加やコンテンツ量産へ進まない。

## 進捗更新

完了状態は各Issueで追跡する。計画変更時はこの文書とIssue #1を更新し、採用した追加Issueをリンクする。文書やIssueを登録しただけで、実装・テスト・素材確認を完了扱いにしない。
