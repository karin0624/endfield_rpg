# 戦闘コア（タイムライン・通常攻撃・スキル・勝敗）

この文書は、速度と論理時刻で次の行動者を決め、通常攻撃から勝敗までを同期的に
解決する戦闘コアの仕様である。タイムラインの正本は
`src/game/battleTimeline.ts`、HP・陣営・攻撃と攻撃結果の正本は
`src/game/battle.ts` に置く。どちらもDOM、描画、実時間APIから独立する。

## 状態

`src/game/battleTimeline.ts` の `BattleTimelineState` がタイムライン部分の正本を持つ。

- `logicalTime`: 次の行動を選ぶための論理時刻。初期値は`0`。
- `currentActorId`: 入力を受け付けている行動者のID。入力待ちでないときは`null`。
- `combatants`: 戦闘者の少人数配列。各要素は次を持つ。
  - `id`: 戦闘中で一意なID。
  - `speed`: 戦闘開始時に固定する正の速度。
  - `nextActionTime`: その戦闘者を次に選べる論理時刻。
  - `isAlive`: 行動可能な生存者かどうか。
  - `startOrder`: 戦闘開始時の配列順。時刻が同じときの優先順位に使う。

戦闘者の行動間隔は整数tickの`max(1, round(10000 / speed))`である。開始時の
`nextActionTime`はこの行動間隔に設定する。速度から安全な整数tickを計算できない定義は拒否する。
速度を戦闘途中で変更する操作は提供しない。画面の行動値も論理時刻からの残りtickを整数で示し、
実時間の秒数として扱わない。

`src/game/battle.ts` の `BattleState` はタイムラインへ次の試作用データを加える。

- `team`: `ally`または`enemy`。通常攻撃の対象は相手陣営だけに限る。
- `hp`: 0以上のHP。攻撃力分だけ減り、0未満にはならない。
- `attackPower`: 命中時にそのまま与える固定ダメージ。
- `outcome`: `ongoing`、`victory`、`defeat`のいずれか。

戦闘開始時の数値は型付きの定義データ（`BattleCombatantDefinition`）から作る。
本編の味方は入場時の1〜4人の[PT](party.md)から作り、現在HP・基礎最大HP・基礎命中率・初期習得スキル・精神疲労の数値・[状態異常](status.md)とゲーム乱数を次戦へ引き継ぐ。配列順を戦闘者の固定順・同時刻の優先順として扱う。
[`src/content/initialBattle.ts`](../src/content/initialBattle.ts)の固定2対2（`player`、`gilberta`、`slime`、`slime-2`）は独立した戦闘デモ用で、本編の人数を制限しない。

## 操作

タイムラインの操作は状態を直接変更せず、次の状態を返す。これにより、表示用の
予測や参照を何度行っても本体状態を変更しない。

- `createBattleTimeline(definitions)`: 入力配列の順を固定順として初期状態を作る。
- `advanceToNextActor(state)`: 現在の行動者がいないとき、生存者のうち
  `nextActionTime`が最も早い者を選ぶ。論理時刻をその時刻へ進め、
  `currentActorId`を設定する。同時刻は`startOrder`の小さい者を選ぶ。
  行動者が入力待ちの間に再度呼んでも状態は進めない。
- `completeCurrentAction(state)`: 現在の行動者の行動を確定する。
  `nextActionTime`を`logicalTime + max(1, round(10000 / speed))`に設定し、
  `currentActorId`を`null`にする。行動者を選び直す処理はこの操作に含めない。
- `setCombatantAlive(state, id, isAlive)`: 生存状態を更新する。戦闘不能者は次の
  行動者の候補から除外する。現在の行動者が戦闘不能になった場合は入力待ちを解除する。
- `getUpcomingActions(state, count)`: 現在の状態から続く行動順を`{id, time}`の配列で
  予測する。内部では`advanceToNextActor`と`completeCurrentAction`と同じ遷移を
  コピー上で使い、本体状態を変更しない。`count`が0なら空配列を返す。

通常攻撃と勝敗は`src/game/battle.ts`の操作で扱う。

- `createBattleState(definitions)`: 型付きデータから戦闘状態を作る。味方と敵を
  少なくとも1体ずつ必要とし、初期状態ですでに片方が全滅している場合はその勝敗を
  確定する。
- `advanceBattleToNextActor(state)`: 戦闘継続中だけタイムラインから行動者を選ぶ。
  `outcome`確定後は状態を進めない。
- `performBasicAttack(state, actorId, targetId)`: 現在行動者が相手陣営の生存者を
  攻撃する。攻撃イベント、戦闘不能イベント、勝敗イベントをこの順で配列に積み、
  新しい状態とともに返す。継続時だけ行動を完了して次の行動者を選ぶ。
- `getBattleUpcomingActions(state, count)`: 戦闘終了後は空配列を返し、それ以外は
  タイムラインの予測を返す。

敵行動を含む同期ループは`advanceBattleToNextAllyInput(state)`で扱う。開始時または味方の
行動後に次の行動者を選び、敵なら固定順で最初に生存している味方へ
`performBasicAttack`を繰り返す。次の味方入力待ち、または勝敗確定で停止し、敵の攻撃イベントを
実行順に返す。`performBasicAttackAndAdvanceToAllyInput`は味方の通常攻撃と直後の敵行動を
連結する補助操作である。敵AI・実時間待ち・アニメーションは参照しない。命中判定だけはseed付きゲーム乱数を使用する。

通常攻撃の結果は`{accepted, state, events}`で返す。無効な操作は
`accepted: false`と理由を返し、元の状態をそのまま返す。行動順外の行動、存在しない
対象、味方、戦闘不能者、勝敗確定後の入力は、HP・論理時刻・行動順を変更しない。
状態の内部不整合は無効入力として扱わず、例外で検出する。

入力待ち、表示更新、行動順の参照だけでは論理時刻を進めない。`Date.now`、
`setTimeout`、フレーム更新などの実時間APIは戦闘コアから参照しない。

## アクティブ使用

`performBattleSkill` は習得済みアクティブを現在行動者が使用する。使用前疲労で効果を評価し、実HP変化、疲労更新、勝敗を一度に返す。`performBattleSkillAndAdvanceToAllyInput` は同じ敵行動ループへ接続する。通常攻撃と同じ行動間隔を使い、通常攻撃の効果量・疲労を変更しない。

確定結果は `{ type: "skill", actorId, targetId, skillId, effect, amount, fatigueBefore, fatigueAfter, hit }`。`amount` は実HP変化量で、外れ・HP上限なら予測量と異なる。スキルイベントの後に必要な戦闘不能・勝敗・敵行動イベントを返す。[スキル](skills.md)と[精神疲労](status.md)の試用規則を共有する。

## 受入例

速度100のAを先に、速度50のBを後に開始すると、間隔はそれぞれ100と200 tickになる。
初期状態から3回分を予測すると次の通りである。

```ts
getUpcomingActions(state, 3)
// [{ id: "A", time: 100 }, { id: "A", time: 200 }, { id: "B", time: 200 }]
```

同時刻は開始順で決定し、配列の順を変えずに同じ初期状態と操作列を実行すれば同じ
順序になる。`isAlive: false`の戦闘者は予測・選択から除外する。HPが正でも戦闘不能状態が残る者は`isAlive: false`とする。予測や表示用の
行動順を繰り返し参照しても、元の`logicalTime`、`currentActorId`、各戦闘者の
`nextActionTime`は変化しない。

通常攻撃が命中したとき、指定した対象のHPだけが`attackPower`分減る。失敗はHPを減らさず行動を完了する。HPが0になった対象は
`isAlive: false`となり、以後の行動順から除外する。敵が全滅した時点で`victory`、
味方が全滅した時点で`defeat`を確定し、同じ勝敗イベントを重複して返さない。

## 通常攻撃イベント

`events`は通常の配列で、次の形を使う。

```ts
{ type: "attack", actorId, targetId, damage, targetHpBefore, targetHpAfter }
{ type: "miss", actorId, targetId }
{ type: "combatant-defeated", combatantId }
{ type: "battle-ended", outcome: "victory" | "defeat" }
```

HPが0にならない攻撃は`attack`だけを返す。戦闘不能になった場合はその後に
`combatant-defeated`を追加し、最後の敵または味方が倒れた場合だけ最後に
`battle-ended`を追加する。

## 対象外

戦闘中の速度変更、遅延・割込・追加ターン、ラウンド、実時間ATB、防御、
逃走、装備、報酬、敵AI、演出はこの仕様に含めない。

状態異常の暫定係数・回復signal・基礎命中率と乱数消費の境界は[状態異常](status.md)を参照する。アクティブ使用の対象・効果・命中・再送拒否と表示は[スキル](skills.md)を参照する。
