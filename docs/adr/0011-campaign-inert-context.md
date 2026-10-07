# 0011: 本編の初期contextをpure遷移のinert初期化から分ける

日付: 2026-10-07

## 背景

XState 5.33.2の[`transition`](https://github.com/statelyai/xstate/blob/xstate%405.33.2/packages/core/src/transition.ts)は、[`createInertActorScope`](https://github.com/statelyai/xstate/blob/xstate%405.33.2/packages/core/src/getNextSnapshot.ts)でactorを生成する。そのconstructorがinputなしで初期snapshotを評価するため、本編の各イベントで使われない初期ゲームを生成していた。進行中のsnapshotをresetする処理ではない。

## 判断

[0009](0009-pure-upper-state-machines.md)の同期snapshotとaction descriptorsを維持する。`createCampaignModel`でfreshなcontextを生成し、公開`initialTransition(machine, input)`へ渡す。machineのcontext initializerは明示inputをそのまま使い、inputなしのinert初期化にはmoduleで一度生成して再帰的にfreezeしたcontextを返す。新規ゲームの確定は従来どおり`assign(initialContext)`でfreshに生成する。

静的contextを実モデルにも共有する案では、初期ゲームの配列・member・装備と画面draftの所有が共有される。各本編とresetの入れ子データを独立して所有するため、明示inputを採用する。`getNextSnapshot`も同じinert経路を使う。live actorやprivate APIへ切り替えず、ゲームとNativeの意味論を保つ。

## 結果

通常イベントで不要な初期ゲームを生成しない。module初期化の生成・freezeは起動費用へ含める。XState内部のactor・system生成費用は残る。

ゲーム間の独立性、過去snapshot、新規開始、保存・再開・失敗と同期完了の結果は本編モデルの公開入力で検証する。画面・素材・ブラウザ接続は変更しない。
