# 0012: 現在snapshotから上位machineのpure遷移を計算する

日付: 2026-10-08

## 背景

XState 5.33.2の公開[`transition`](https://github.com/statelyai/xstate/blob/xstate%405.33.2/packages/core/src/transition.ts)は、inert actorのconstructorで使われない初期snapshotを作ってから、渡された現在snapshotへイベントを適用する。[0011](0011-campaign-inert-context.md)で本編の不要なゲーム生成を除いた後も、初期snapshotのcontext、状態ノード、microstep等の計算は各入力に残った。

本編・探索は[0006](0006-synchronous-presentation-models.md)と[0009](0009-pure-upper-state-machines.md)の単一snapshot、同期入力、純粋な結果とcommit後の具体的な外部処理を維持する。

## 判断

本編と探索のfactoryは従来の公開`initialTransition`による初期化を維持する。本編の`createCampaignModel`は変更しない。探索は初期snapshotへ従来と同じresumeイベントを適用し、そのresumeに通常入力と同じadapterを使う。

通常入力と探索のresumeでは、呼出しごとに小さな公開`ActorLogic`オブジェクトを渡す。`getInitialSnapshot`はその呼出しの現在snapshotを返し、`transition`と`getPersistedSnapshot`は元machineの公開methodへそのまま委譲する。イベント受付、guard、assign、raise、macrostep、action descriptorの収集は公式pure `transition`が担当する。独自runner、private API、live actor、共有scopeや可変の現在snapshot cacheを置かない。

5.33.2の`ExecutableActionsFrom`は`StateMachine`以外を`never`とするため、返却tupleだけを委譲先machineの公開`transition`返却型へ限定して扱う。adapterを`StateMachine`として偽装せず、descriptorの処理や外部effectへの投影は変えない。

現在のmachineは同期のassign、raise、enqueueとtyped outputを使い、actorのspawn・invoke・delayや永続的なself／system参照をcontextへ持たない。これらを追加するときはadapterの適用条件と所有・寿命を再検討する。各本編・探索と新規開始は従来どおりfreshな入れ子データを所有し、過去snapshotと返却effectを後続入力から変更しない。

公開machineへ直接pure APIを使う経路の挙動と費用は変更しない。本編のno-input用inert contextとfreezeを維持し、そのmodule初期化費用も起動計測に含める。factoryとreducerの改善を、その直接経路やmodule初期化の改善へ広げない。

## 結果

通常入力と探索のresumeでは使われない初期snapshotの計算を除く。factory本来の初期macrostepと公式pure APIのinert actor・fresh systemの生成は残る。system再利用は、[上流PR5575](https://github.com/statelyai/xstate/pull/5575)が維持するsystem ID登録の分離と所有境界を持ち込む必要があり、今回の目的には採用しない。

公開`resolveState`によるfactory短縮案は採用しない。同じminifiedモデルを固定Chromiumで自然な入力履歴へ適用した比較では、factoryの短縮と同時にTitleの最初のfocus・新規開始のwall時間が増えた。初期macrostepの省略が初回実行を次eventへ移す面があり、rootと初期状態にentry・初期遷移action・eventless transition・invokeがないという新しい制約も必要になる。factoryを維持して通常遷移の不要snapshotだけを除く構造の方が小さく、初期化契約を保ちやすい。factoryから初回入力までのwall合計は費用移動の確認に使い、関数別CPUの改善と扱わない。先行入力やwarmupを追加して回帰を隠さない。

公開の進行、保存・再開と同期完了、複数本編・探索、演出設定、資源owner、退出と遅着、過去snapshotとeffectの保持をモデル検証で確認する。性能は同じ関数・イベント・状態・履歴・環境で比較し、初回呼出し、module import、反復wall、関数別CPU／割当samplingを区別する。準備の先行実行やwarmupへ費用を移して改善とは扱わない。
