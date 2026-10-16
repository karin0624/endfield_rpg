# 0012: XStateの同期遷移で不要な初期化を避ける

日付: 2026-10-08

## 背景

XState 5.33.2の公開[`transition`](https://github.com/statelyai/xstate/blob/xstate%405.33.2/packages/core/src/transition.ts)は、inert actorを作る際に初期snapshotを計算してから、渡された現在snapshotへイベントを適用する。本編・探索の通常入力では、この初期計算は使われない。

## 判断

本編と探索のfactoryは公開`initialTransition`で初期化する。本編は呼出しごとに新しいcontextを明示入力し、moduleで共有する初期ゲームや再帰freezeは持たない。直接no-inputでmachineを初期化する経路は使わない。

通常入力と探索のresumeでは、現在snapshotを初期状態として返す小さな`ActorLogic`を公式`transition`に渡す。`transition`と`getPersistedSnapshot`は元machineへ委譲するため、guard、assign、raise、actionの収集は引き続きXStateが担当する。

5.33.2の`ExecutableActionsFrom`は`StateMachine`以外を`never`とするため、返却tupleだけを委譲先machineの公開`transition`返却型として扱う。adapterを`StateMachine`として偽装しない。

適用対象は同期のassign・raise・enqueueと型付き出力を使うmachine。spawn・invoke・delayや永続的なself／system参照を追加する場合は、このadapterの所有・寿命を再検討する。各本編・探索の入れ子データは独立して所有し、後続入力で過去snapshotと返却effectを変更しない。

## 結果

通常入力では不要な初期snapshot計算を省く。factoryの初期macrostepと公式pure APIのinert actor・fresh system生成は残る。system再利用には[上流PR5575](https://github.com/statelyai/xstate/pull/5575)が扱うID登録の分離が必要になるため採用しない。

factoryを`resolveState`へ変える案は、初期macrostepの費用を最初の入力へ移し、最初のfocus・新規開始のwall時間も増えたため採らない。rootと初期状態のentry等を禁じる新たな制約も必要になる。

進行・保存・同期完了、複数セッション、退出と遅着、過去snapshotとeffectの保持は公開入力のモデル検証で確認する。性能比較では初回入力・module import・反復wall・CPU・割当を分け、warmupへの費用移動を改善と数えない。
