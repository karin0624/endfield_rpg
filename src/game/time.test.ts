import { describe, expect, it } from "vitest";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { createInitialGameState } from "./createInitialGameState";
import {
  actInExpedition,
  actInTown,
  applyPartyStatus,
  beginTownExploration,
  completeTownExploration,
  departOnExpedition,
  type ExpeditionGame,
  editExpeditionParty,
  leaveExpedition,
  receiveTownRecoverySignal,
  type TownActionResult,
} from "./expedition";
import { createParty } from "./party";
import { effectiveHitRate, effectiveMaxHp } from "./status";
import { beginTimedAction, completeTimedAction, createActionClock, getCalendar } from "./time";

const characters = [
  { id: "player", name: "A", maxHp: 200, speed: 100, attackPower: 100 },
  { id: "reserve", name: "B", maxHp: 200, speed: 100, attackPower: 100 },
];
function game(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player", "reserve"]),
    dungeon: null,
    randomState: 123,
  };
}
function accepted(result: TownActionResult): ExpeditionGame {
  if (!result.accepted) throw new Error(result.reason);
  return result.state;
}
function town(state: ExpeditionGame): TownActionResult {
  const started = accepted(beginTownExploration(state, "market", initialAdventure));
  const id = started.clock?.pendingAction?.id;
  if (id === undefined) throw new Error("action");
  return actInTown(started, id, { type: "advance" }, characters, initialAdventure);
}
function dungeon(state: ExpeditionGame): ExpeditionGame {
  const departed = departOnExpedition(state, characters, initialDungeon, initialAdventure);
  if (!departed.accepted) throw new Error(departed.reason);
  // Even an early route return accounts one entire expedition, not one charge per node.
  const returned = leaveExpedition(departed.state);
  if (!returned.accepted) throw new Error(returned.reason);
  expect(returned.completion).toMatchObject({
    kind: "dungeon-expedition",
    calendarHalfDays: 1,
    recoverySteps: 0,
    recovery: [],
  });
  return returned.state;
}
describe("生活時計と街回復", () => {
  it("街探索2回で1日、昼→夜→翌日昼。開始・各会話入力では計上しない", () => {
    let state = accepted(beginTownExploration(game(), "guild", initialAdventure));
    expect(getCalendar(state.clock ?? createActionClock())).toEqual({ day: 1, period: "day" });
    expect(state.clock).toMatchObject({ elapsedHalfDays: 0, recoverySteps: 0 });
    const id = state.clock?.pendingAction?.id ?? 0;
    for (let i = 0; i < 2; i++) {
      state = accepted(actInTown(state, id, { type: "advance" }, characters, initialAdventure));
      expect(state.clock).toMatchObject({ elapsedHalfDays: 0, recoverySteps: 0 });
    }
    const end = actInTown(state, id, { type: "choose", optionId: "leave" }, characters, initialAdventure);
    state = accepted(end);
    expect(getCalendar(state.clock ?? createActionClock())).toEqual({ day: 1, period: "night" });
    state = accepted(town(state));
    expect(state.clock).toMatchObject({ elapsedHalfDays: 2, recoverySteps: 2 });
    expect(getCalendar(state.clock ?? createActionClock())).toEqual({ day: 2, period: "day" });
  });
  it("症状値20→街→探索→街は10→10→0。生活1.5日、回復2step", () => {
    let state = game();
    for (let i = 0; i < 2; i++) {
      state = applyPartyStatus(state, "player", { kind: "physicalFatigue", amount: 10 }, characters);
      state = applyPartyStatus(state, "reserve", { kind: "haze", amount: 10 }, characters);
    }
    const first = town(state);
    state = accepted(first);
    expect(first).toMatchObject({
      completion: {
        recoverySteps: 1,
        recovery: [
          {
            id: "player",
            before: { physicalFatigue: 20 },
            after: { physicalFatigue: 10 },
            remainingSteps: { physicalFatigue: 1 },
          },
          { id: "reserve", before: { haze: 20 }, after: { haze: 10 }, remainingSteps: { haze: 1 } },
        ],
      },
    });
    expect(state.party.members[0].hp).toBe(166);
    state = dungeon(state);
    expect(state.party.members[0].hp).toBe(181);
    expect(state.party.members[0].status?.physicalFatigue).toBe(10);
    expect(state.party.members[1].status?.haze).toBe(10);
    state = accepted(town(state));
    expect(state.clock).toMatchObject({ elapsedHalfDays: 3, recoverySteps: 2 });
    expect(state.party.members[0].status?.physicalFatigue).toBe(0);
    expect(state.party.members[1].status?.haze).toBe(0);
    expect(state.party.members[0].hp).toBe(181);
    expect(state.randomState).toBe(123);
  });
  it("症状値30は3街行動で数値と効果を更新し、再発後も現在値から回復する", () => {
    let state = game();
    for (let i = 0; i < 3; i++) {
      state = applyPartyStatus(state, "player", { kind: "physicalFatigue", amount: 10 }, characters);
      state = applyPartyStatus(state, "player", { kind: "haze", amount: 10 }, characters);
    }
    for (const [maxHp, hitRate] of [
      [166, 0.75],
      [181, 0.7741935483870968],
      [200, 0.8],
    ]) {
      state = accepted(town(state));
      const status = state.party.members[0].status;
      if (!status) throw new Error("status");
      expect(effectiveMaxHp(200, status)).toBe(maxHp);
      expect(effectiveHitRate(0.8, status)).toBeCloseTo(hitRate);
    }
    for (let i = 0; i < 2; i++) state = applyPartyStatus(state, "player", { kind: "haze", amount: 10 }, characters);
    state = accepted(town(state));
    expect(state.party.members[0].status?.haze).toBe(10);
    state = accepted(town(state));
    expect(state.party.members[0].status?.haze).toBe(0);
  });
  it("全員戦闘不能でも非戦闘の街探索を6回完了し、HP正なら再出撃できる", () => {
    let state = game();
    for (const id of ["player", "reserve"]) state = applyPartyStatus(state, id, { kind: "incapacity" }, characters);
    expect(departOnExpedition(state, characters, initialDungeon, initialAdventure)).toMatchObject({
      accepted: false,
      reason: "no-living-member",
    });
    for (let step = 1; step <= 5; step++) {
      state = accepted(town(state));
      expect(state.party.members[0].status?.incapacityRecoverySteps).toBe(6 - step);
    }
    expect(departOnExpedition(state, characters, initialDungeon, initialAdventure).accepted).toBe(false);
    state = accepted(town(state));
    expect(state.party.members[0].status?.incapacityRecoverySteps).toBeNull();
    expect(departOnExpedition(state, characters, initialDungeon, initialAdventure).accepted).toBe(true);
    expect(state.party.members[0].hp).toBe(200);
    expect(state.clock).toMatchObject({ elapsedHalfDays: 6, recoverySteps: 6 });
  });
  it("完了再送・古い完了ID・無効な街操作は時間も回復も増やさない", () => {
    let state = accepted(beginTownExploration(game(), "market", initialAdventure));
    const old = state.clock?.pendingAction;
    if (!old) throw new Error("action");
    expect(completeTownExploration(state, old, characters).accepted).toBe(false);
    expect(
      actInTown(state, old.id, { type: "choose", optionId: "missing" }, characters, initialAdventure),
    ).toMatchObject({ accepted: false, reason: "not-a-choice" });
    state = accepted(actInTown(state, old.id, { type: "advance" }, characters, initialAdventure));
    expect(completeTownExploration(state, old, characters)).toMatchObject({
      accepted: false,
      state: { clock: { elapsedHalfDays: 1, recoverySteps: 1 } },
    });
    state = accepted(beginTownExploration(state, "market", initialAdventure));
    expect(actInTown(state, old.id, { type: "advance" }, characters, initialAdventure).accepted).toBe(false);
    expect(beginTownExploration(state, "guild", initialAdventure)).toMatchObject({
      accepted: false,
      reason: "action-in-progress",
    });
    expect(beginTownExploration(game(), "missing", initialAdventure).accepted).toBe(false);
  });
  it("探索内の会話・戦闘・ノードは進めず、帰還だけ1回計上する", () => {
    let state = game();
    const departed = departOnExpedition(state, characters, initialDungeon, initialAdventure);
    if (!departed.accepted) throw new Error(departed.reason);
    state = departed.state;
    const oldId = state.clock?.pendingAction?.id;
    for (const command of [
      { type: "enter", nodeId: "conversation-b" },
      { type: "advance" },
      { type: "choose", optionId: "mark-on-map" },
      { type: "enter", nodeId: "boss-c" },
      { type: "attack", actorId: "player", targetId: "ruin-warden" },
    ] as const) {
      const result = actInExpedition(state, command, initialDungeon, initialAdventure);
      if (!result.result.accepted) throw new Error(result.result.reason);
      state = result.state;
      expect(state.clock).toMatchObject({ elapsedHalfDays: 0, recoverySteps: 0 });
    }
    const returned = leaveExpedition(state, oldId);
    if (!returned.accepted) throw new Error(returned.reason);
    state = returned.state;
    expect(state.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 0 });
    expect(leaveExpedition(state, oldId).accepted).toBe(false);
    const next = departOnExpedition(state, characters, initialDungeon, initialAdventure);
    if (!next.accepted) throw new Error(next.reason);
    expect(leaveExpedition(next.state, oldId)).toMatchObject({
      accepted: false,
      state: { clock: { elapsedHalfDays: 1, recoverySteps: 0 } },
    });
  });
  it("編成・カレンダー参照・保存用stateコピーは回復・時間・乱数を変えない", () => {
    let state = game();
    const edited = editExpeditionParty(state, 1, "reserve");
    if (!edited.accepted) throw new Error(edited.reason);
    state = edited.state;
    const restored = JSON.parse(JSON.stringify(state)) as ExpeditionGame;
    expect(getCalendar(restored.clock ?? createActionClock())).toEqual({ day: 1, period: "day" });
    expect(restored.randomState).toBe(123);
    expect(restored.party.members.map(({ hp }) => hp)).toEqual([200, 200]);
  });
  it("既存の回復signalが先行していても、最初の街完了を抑止しない", () => {
    let state = game();
    for (let i = 0; i < 3; i++) state = applyPartyStatus(state, "player", { kind: "haze", amount: 10 }, characters);
    state = receiveTownRecoverySignal(state, 10, characters);
    expect(state.party.members[0].status?.haze).toBe(20);
    const completed = town(state);
    state = accepted(completed);
    expect(state.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 1 });
    expect(state.party.members[0].status?.haze).toBe(10);
    expect(state.lastTownRecoverySignal).toBe(11);
  });
  it("時計の完了tokenは種類とIDを検査し、再送で二重計上しない", () => {
    const started = beginTimedAction(createActionClock(), "dungeon-expedition");
    const action = started.pendingAction;
    if (!action) throw new Error("action");
    expect(completeTimedAction(started, { ...action, kind: "town-exploration" }).completion).toBeUndefined();
    const completed = completeTimedAction(started, action);
    expect(completed.clock).toMatchObject({ elapsedHalfDays: 1, recoverySteps: 0 });
    expect(completeTimedAction(completed.clock, action).completion).toBeUndefined();
  });
});
