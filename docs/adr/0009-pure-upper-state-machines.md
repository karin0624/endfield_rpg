# 0009: 本編と探索の上位進行をpure state machineで所有する

日付: 2026-10-06

## 背景

本編と探索の画面unionを条件分岐で判定し、別の分岐で次の画面とchildデータを組み立てていた。画面ごとの有効入力、戻り先、保存待ちと演出中の境界が長いreducerへ分散していた。[0006](0006-synchronous-presentation-models.md)の現在状態への同期入力とcommit後の外部処理は維持する。

## 判断

XStateの`initialTransition`と`transition`を使い、actorを起動せずsnapshotとaction descriptorsを同期計算する。`CampaignModel`と`DungeonModel`はnative snapshotの型とし、上位モードの正本を`value`へ一本化する。旧screen union、独自snapshot adapter、汎用EffectRunnerは置かない。画面の単純な投影switchは維持する。

`context`には本編のgame、持込み・編成draft、確認の目的、保存後の戻り先、focus等を置く。編成から離れるとdraftを解放する。探索childはroute・分岐draft・戦闘の確定recordと演出・資源ownerを持つが、親のgameを保持しない。現在のgameと定義をeventの入力に渡し、コア結果をtyped actionのparamsで親へ返す。コア確定後の内部eventで成長・会話・ルート・結果へ進み、敗北の帰還が既に確定していても演出終了までは戦闘recordを保持する。

Native接続は返されたstateをcommitしてから、保存bytesのI/O、シーン生成・破棄、pointer captureを実行する。同期の再入と遅着完了も、その時点のsnapshotへ適用する。通常版とdebugは同じ探索machineを使う。HP・疲労・乱数・成長・帰還計算にはmachineを持ち込まない。

ts-patternは複合分岐を簡潔にできる場合に限る。今回の上位モード判定はmachineの状態別遷移へ移せたため、残った短い条件や単純switchのためには依存を追加しない。

## 結果

入力受付と遷移先を状態別の設定で読める。snapshot/context参照に合わせて投影、Native接続と直接VRT fixtureを更新する。探索chromeは戦闘時計から独立した必要な葉だけを投影し、見た目・素材・画像基準を維持する。

Vitestはこのゲームの進行・成長必須画面・draft確定・戻り先focus・保存拒否と失敗時game保持・敗北時の先行確定を検証する。ライブラリ内部の関数を含むsnapshot全体のcloneは保証対象にせず、公開モードとcontextの意味データを観測する。schemaの厳密なキー、数値範囲とdomain所有整合は[0008](0008-save-format-validation.md)の境界で維持する。追加依存のbuild費用は生じるが、通常minified buildの成功を性能改善の証明にはしない。
