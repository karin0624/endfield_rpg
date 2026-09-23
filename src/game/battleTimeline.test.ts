import { describe, expect, it } from "vitest";

import {
  advanceToNextActor,
  completeCurrentAction,
  createBattleTimeline,
  getUpcomingActions,
  setCombatantAlive,
} from "./battleTimeline";

describe("battle timeline", () => {
  it("速度と論理時刻から次の行動者を選ぶ", () => {
    let state = createBattleTimeline([
      { id: "A", speed: 100 },
      { id: "B", speed: 50 },
    ]);

    expect(state.combatants).toEqual([
      {
        id: "A",
        speed: 100,
        nextActionTime: 100,
        isAlive: true,
        startOrder: 0,
      },
      {
        id: "B",
        speed: 50,
        nextActionTime: 200,
        isAlive: true,
        startOrder: 1,
      },
    ]);

    state = advanceToNextActor(state);
    expect({ time: state.logicalTime, id: state.currentActorId }).toEqual({
      time: 100,
      id: "A",
    });
    expect(advanceToNextActor(state)).toBe(state);

    state = completeCurrentAction(state);
    state = advanceToNextActor(state);
    expect({ time: state.logicalTime, id: state.currentActorId }).toEqual({
      time: 200,
      id: "A",
    });

    state = completeCurrentAction(state);
    state = advanceToNextActor(state);
    expect({ time: state.logicalTime, id: state.currentActorId }).toEqual({
      time: 200,
      id: "B",
    });
  });

  it("同時刻は戦闘開始時の固定順で選ぶ", () => {
    let state = createBattleTimeline([
      { id: "first", speed: 50 },
      { id: "second", speed: 50 },
    ]);

    state = advanceToNextActor(state);
    expect(state.currentActorId).toBe("first");

    state = completeCurrentAction(state);
    state = advanceToNextActor(state);
    expect({ time: state.logicalTime, id: state.currentActorId }).toEqual({
      time: 200,
      id: "second",
    });
  });

  it("戦闘不能者を候補から除外する", () => {
    let state = createBattleTimeline([
      { id: "dead", speed: 100, isAlive: false },
      { id: "alive", speed: 50 },
    ]);

    state = advanceToNextActor(state);
    expect({ time: state.logicalTime, id: state.currentActorId }).toEqual({
      time: 200,
      id: "alive",
    });

    state = setCombatantAlive(state, "alive", false);
    expect(advanceToNextActor(state)).toEqual(state);
  });

  it("現在の行動者が戦闘不能になったら入力待ちを解除する", () => {
    let state = createBattleTimeline([{ id: "A", speed: 100 }]);
    state = advanceToNextActor(state);

    state = setCombatantAlive(state, "A", false);

    expect(state.currentActorId).toBeNull();
    expect(advanceToNextActor(state)).toEqual(state);
  });

  it("予測は実状態を変更せず、実行時と同じコア計算を使う", () => {
    const state = createBattleTimeline([
      { id: "A", speed: 100 },
      { id: "B", speed: 50 },
    ]);
    const before = structuredClone(state);

    expect(getUpcomingActions(state, 3)).toEqual([
      { id: "A", time: 100 },
      { id: "A", time: 200 },
      { id: "B", time: 200 },
    ]);
    expect(getUpcomingActions(state, 3)).toEqual([
      { id: "A", time: 100 },
      { id: "A", time: 200 },
      { id: "B", time: 200 },
    ]);
    expect(state).toEqual(before);
  });

  it("現在の行動者を含む状態からも予測できる", () => {
    let state = createBattleTimeline([
      { id: "A", speed: 100 },
      { id: "B", speed: 50 },
    ]);
    state = advanceToNextActor(state);

    expect(getUpcomingActions(state, 3)).toEqual([
      { id: "A", time: 100 },
      { id: "A", time: 200 },
      { id: "B", time: 200 },
    ]);
    expect(state.currentActorId).toBe("A");
    expect(state.logicalTime).toBe(100);
  });

  it("同じ初期状態と操作列から同じ順序を再現する", () => {
    const definitions = [
      { id: "A", speed: 75 },
      { id: "B", speed: 60 },
      { id: "C", speed: 60 },
    ];

    const play = () => {
      let state = createBattleTimeline(definitions);
      const result: Array<{ id: string; time: number }> = [];
      for (let index = 0; index < 8; index += 1) {
        state = advanceToNextActor(state);
        if (state.currentActorId === null) throw new Error("次の行動者が見つかりません");
        result.push({ id: state.currentActorId, time: state.logicalTime });
        state = completeCurrentAction(state);
      }
      return result;
    };

    expect(play()).toEqual(play());
  });

  it("行動間隔を整数tickへ丸め、最低1tickにする", () => {
    const state = createBattleTimeline([
      { id: "rounded", speed: 90 },
      { id: "slow-round", speed: 70 },
      { id: "minimum", speed: 20_000 },
    ]);

    expect(state.combatants.map((combatant) => combatant.nextActionTime)).toEqual([111, 143, 1]);
  });

  it("不正な速度・IDと負の予測数を拒否する", () => {
    expect(() => createBattleTimeline([{ id: "A", speed: 0 }])).toThrow();
    expect(() => createBattleTimeline([{ id: "too-slow", speed: 1e-100 }])).toThrow();
    expect(() =>
      createBattleTimeline([
        { id: "A", speed: 100 },
        { id: "A", speed: 50 },
      ]),
    ).toThrow();
    expect(() => getUpcomingActions(createBattleTimeline([{ id: "A", speed: 100 }]), -1)).toThrow();
  });
});
