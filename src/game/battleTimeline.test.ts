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

    state = advanceToNextActor(state);
    expect({ time: state.logicalTime, id: state.currentActorId }).toEqual({
      time: 100,
      id: "A",
    });
    expect(advanceToNextActor(state).currentActorId).toBe("A");

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
    expect(getUpcomingActions(state, 1)).toEqual([]);
  });

  it("現在の行動者が戦闘不能になったら入力待ちを解除する", () => {
    let state = createBattleTimeline([{ id: "A", speed: 100 }]);
    state = advanceToNextActor(state);

    state = setCombatantAlive(state, "A", false);

    expect(state.currentActorId).toBeNull();
    expect(getUpcomingActions(state, 1)).toEqual([]);
  });

  it("予測を繰り返しても実状態を変更しない", () => {
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

  it("行動間隔を整数tickへ丸め、最低1tickにする", () => {
    expect(getUpcomingActions(createBattleTimeline([{ id: "rounded", speed: 90 }]), 1)).toEqual([
      { id: "rounded", time: 111 },
    ]);
    expect(getUpcomingActions(createBattleTimeline([{ id: "slow-round", speed: 70 }]), 1)).toEqual([
      { id: "slow-round", time: 143 },
    ]);
    expect(getUpcomingActions(createBattleTimeline([{ id: "minimum", speed: 20_000 }]), 1)).toEqual([
      { id: "minimum", time: 1 },
    ]);
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
