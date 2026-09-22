# 戦闘コア（M1 タイムライン）

この文書は、速度と論理時刻で次の行動者を決める戦闘コアの仕様である。対象は
タイムラインのスケジューリングだけで、攻撃・ダメージ・敵AI・演出は後続のIssueで
扱う。

## 状態

`src/game/battleTimeline.ts` の `BattleTimelineState` が戦闘の正本を持つ。

- `logicalTime`: 次の行動を選ぶための論理時刻。初期値は`0`。
- `currentActorId`: 入力を受け付けている行動者のID。入力待ちでないときは`null`。
- `combatants`: 戦闘者の少人数配列。各要素は次を持つ。
  - `id`: 戦闘中で一意なID。
  - `speed`: 戦闘開始時に固定する正の速度。
  - `nextActionTime`: その戦闘者を次に選べる論理時刻。
  - `isAlive`: 行動可能な生存者かどうか。
  - `startOrder`: 戦闘開始時の配列順。時刻が同じときの優先順位に使う。

戦闘者の行動間隔は`1000 / speed`である。開始時の`nextActionTime`は行動間隔に
設定する。速度を戦闘途中で変更する操作は提供しない。

## 操作

タイムラインの操作は状態を直接変更せず、次の状態を返す。これにより、表示用の
予測や参照を何度行っても本体状態を変更しない。

- `createBattleTimeline(definitions)`: 入力配列の順を固定順として初期状態を作る。
- `advanceToNextActor(state)`: 現在の行動者がいないとき、生存者のうち
  `nextActionTime`が最も早い者を選ぶ。論理時刻をその時刻へ進め、
  `currentActorId`を設定する。同時刻は`startOrder`の小さい者を選ぶ。
  行動者が入力待ちの間に再度呼んでも状態は進めない。
- `completeCurrentAction(state)`: 現在の行動者の行動を確定する。
  `nextActionTime`を`logicalTime + 1000 / speed`に設定し、
  `currentActorId`を`null`にする。行動者を選び直す処理はこの操作に含めない。
- `setCombatantAlive(state, id, isAlive)`: 生存状態を更新する。戦闘不能者は次の
  行動者の候補から除外する。現在の行動者が戦闘不能になった場合は入力待ちを解除する。
- `getUpcomingActions(state, count)`: 現在の状態から続く行動順を`{id, time}`の配列で
  予測する。内部では`advanceToNextActor`と`completeCurrentAction`と同じ遷移を
  コピー上で使い、本体状態を変更しない。`count`が0なら空配列を返す。

入力待ち、表示更新、行動順の参照だけでは論理時刻を進めない。`Date.now`、
`setTimeout`、フレーム更新などの実時間APIは戦闘コアから参照しない。

## 受入例

速度100のAを先に、速度50のBを後に開始すると、間隔はそれぞれ10と20になる。
初期状態から3回分を予測すると次の通りである。

```ts
getUpcomingActions(state, 3)
// [{ id: "A", time: 10 }, { id: "A", time: 20 }, { id: "B", time: 20 }]
```

同時刻は開始順で決定し、配列の順を変えずに同じ初期状態と操作列を実行すれば同じ
順序になる。`isAlive: false`の戦闘者は予測・選択から除外する。予測や表示用の
行動順を繰り返し参照しても、元の`logicalTime`、`currentActorId`、各戦闘者の
`nextActionTime`は変化しない。

## 対象外

戦闘中の速度変更、遅延・割込・追加ターン、ラウンド、実時間ATB、ダメージ、敵AI、
演出はこの仕様に含めない。
