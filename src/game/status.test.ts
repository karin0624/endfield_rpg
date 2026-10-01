import { describe, expect, it } from "vitest";
import { initialAdventure } from "../content/initialAdventure";
import { initialDungeon } from "../content/initialDungeon";
import { initialGameOptions } from "../content/initialGameOptions";
import { advanceBattleToNextActor, createBattleState, getBattleUpcomingActions, performBasicAttack } from "./battle";
import { createInitialGameState } from "./createInitialGameState";
import { createDungeonState, type DungeonDefinition, enterNextDungeonNode, performDungeonBasicAttack } from "./dungeon";
import {
  actInExpedition,
  applyPartyStatus,
  departOnExpedition,
  type ExpeditionGame,
  leaveExpedition,
  receiveTownRecoverySignal,
} from "./expedition";
import { createGameRandom, nextGameRandom } from "./gameRandom";
import { createParty, setPartySlot } from "./party";
import {
  applyIncapacity,
  applyStagedStatus,
  canParticipate,
  effectiveHitRate,
  effectiveMaxHp,
  healthyStatus,
  recoverTownStep,
} from "./status";

const characters = [
  { id: "player", name: "A", maxHp: 200, hitRate: 0.8, speed: 100, attackPower: 100 },
  { id: "reserve", name: "B", maxHp: 200, speed: 100, attackPower: 100 },
];
function game(): ExpeditionGame {
  return {
    adventure: createInitialGameState(initialGameOptions),
    party: createParty(characters, ["player", "reserve"]),
    dungeon: null,
    randomState: 1,
  };
}
function member(state: ExpeditionGame, id = "player") {
  const found = state.party.members.find((candidate) => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
}
describe("状態異常", () => {
  it("最大HP200を150/100/50、命中80%を72/64/56%へ独立して変更する", () => {
    let status = healthyStatus();
    for (const [maxHp, hitRate] of [
      [150, 0.72],
      [100, 0.64],
      [50, 0.56],
    ]) {
      status = applyStagedStatus(status, "physicalFatigue");
      status = applyStagedStatus(status, "haze");
      expect(effectiveMaxHp(200, status)).toBe(maxHp);
      expect(effectiveHitRate(0.8, status)).toBeCloseTo(hitRate);
    }
    expect(applyStagedStatus(status, "haze").haze).toBe(3);
    expect(applyStagedStatus(status, "physicalFatigue").physicalFatigue).toBe(3);
    expect(effectiveMaxHp(3, status)).toBe(1);
    expect(effectiveMaxHp(7, { ...healthyStatus(), physicalFatigue: 1 })).toBe(5);
    expect(applyStagedStatus(healthyStatus(), "haze").physicalFatigue).toBe(0);
  });
  it.each([1, 2, 3] as const)("段階%sは同じ数の半日signalで回復する", (severity) => {
    let status = { ...healthyStatus(), physicalFatigue: severity, haze: severity };
    for (let elapsed = 1; elapsed <= severity; elapsed++) {
      status = recoverTownStep(status) as typeof status;
      expect(status.physicalFatigue).toBe(severity - elapsed);
      expect(status.haze).toBe(severity - elapsed);
    }
  });
  it("戦闘不能は再付与で延びず、HP回復とは別に6半日を要する", () => {
    let status = applyIncapacity(healthyStatus());
    for (let elapsed = 1; elapsed <= 5; elapsed++) {
      status = recoverTownStep(status);
      expect(applyIncapacity(status).incapacityRecoverySteps).toBe(6 - elapsed);
      expect(canParticipate(200, status)).toBe(false);
    }
    status = recoverTownStep(status);
    expect(status.incapacityRecoverySteps).toBeNull();
    expect(canParticipate(200, status)).toBe(true);
    expect(canParticipate(0, status)).toBe(false);
  });
  it("town signalは控えも回復し、重複・古いsignalは進めず、最大HP増加は治癒しない", () => {
    let state = applyPartyStatus(game(), "player", "physicalFatigue", characters);
    state = applyPartyStatus(state, "reserve", "haze", characters);
    state = applyPartyStatus(state, "reserve", "haze", characters);
    expect(member(state).hp).toBe(150);
    state = receiveTownRecoverySignal(state, 10, characters);
    expect(member(state)).toMatchObject({ hp: 150, status: { physicalFatigue: 0 } });
    expect(member(state, "reserve")).toMatchObject({ hp: 200, status: { haze: 1 } });
    state = receiveTownRecoverySignal(state, 10, characters);
    state = receiveTownRecoverySignal(state, 9, characters);
    expect(member(state, "reserve").status?.haze).toBe(1);
    state = receiveTownRecoverySignal(state, 11, characters);
    expect(member(state, "reserve").status?.haze).toBe(0);
  });
  it("戦闘・会話・退出は回復せず、次戦も状態と乱数を引き継ぐ", () => {
    let state = applyPartyStatus(game(), "player", "physicalFatigue", characters);
    state = applyPartyStatus(state, "player", "haze", characters);
    state = applyPartyStatus(state, "reserve", "incapacity", characters);
    const departed = departOnExpedition(state, characters, initialDungeon, initialAdventure);
    if (!departed.accepted) throw new Error(departed.reason);
    state = receiveTownRecoverySignal(departed.state, 0, characters);
    expect(member(state).status?.haze).toBe(1);
    function act(command: Parameters<typeof actInExpedition>[1]) {
      const result = actInExpedition(state, command, initialDungeon, initialAdventure);
      if (!result.result.accepted) throw new Error(result.result.reason);
      state = result.state;
    }
    act({ type: "enter", nodeId: "battle-a" });
    for (const targetId of ["slime", "slime-2"]) act({ type: "attack", actorId: "player", targetId });
    expect(state.randomState).toBe(1586005467);
    expect(member(state).status).toMatchObject({ physicalFatigue: 1, haze: 1 });
    act({ type: "enter", nodeId: "boss-c" });
    expect(state.dungeon?.activity).toMatchObject({ type: "battle", state: { randomState: 1586005467 } });
    // The third seeded draw also hits at the effective 72% hit rate.
    act({ type: "attack", actorId: "player", targetId: "ruin-warden" });
    const left = leaveExpedition(state);
    if (!left.accepted) throw new Error(left.reason);
    expect(member(left.state, "reserve").status?.incapacityRecoverySteps).toBe(6);
    expect(member(left.state).status?.haze).toBe(1);
    expect(member(receiveTownRecoverySignal(left.state, 0, characters)).status?.haze).toBe(1);
    expect(left.state.randomState).toBe(2165703038);
  });
});
it("省略した基礎最大HPも初戦から固定し、次戦の肉体疲労が複利にならない", () => {
  const route: DungeonDefinition = {
    id: "two",
    entryNodeId: "start",
    nodes: [
      { id: "start", type: "start", label: "start", nextNodeIds: ["first"] },
      {
        id: "first",
        type: "battle",
        label: "first",
        enemies: [{ id: "enemy", team: "enemy", speed: 50, hp: 1, attackPower: 0 }],
        nextNodeIds: ["last"],
      },
      {
        id: "last",
        type: "boss",
        label: "last",
        enemies: [{ id: "enemy", team: "enemy", speed: 50, hp: 1, attackPower: 0 }],
        nextNodeIds: [],
      },
    ],
  };
  let state = createDungeonState(route, initialAdventure, [
    {
      id: "player",
      team: "ally",
      speed: 100,
      hp: 200,
      attackPower: 10,
      status: { ...healthyStatus(), physicalFatigue: 1 },
    },
  ]);
  const first = enterNextDungeonNode(state, "first", route, initialAdventure);
  if (!first.accepted) throw new Error(first.reason);
  const finished = performDungeonBasicAttack(first.state, "player", "enemy", route);
  if (!finished.accepted) throw new Error(finished.reason);
  state = finished.state;
  expect(state.party[0].hp).toBe(150);
  const last = enterNextDungeonNode(state, "last", route, initialAdventure);
  if (!last.accepted) throw new Error(last.reason);
  expect(last.state.party[0].hp).toBe(150);
});
it("探索会話でも状態・回復残りは進まない", () => {
  let state = applyPartyStatus(game(), "player", "haze", characters);
  state = applyPartyStatus(state, "reserve", "incapacity", characters);
  const departed = departOnExpedition(state, characters, initialDungeon, initialAdventure);
  if (!departed.accepted) throw new Error(departed.reason);
  state = departed.state;
  const commands: Parameters<typeof actInExpedition>[1][] = [
    { type: "enter", nodeId: "conversation-b" },
    { type: "advance" },
    { type: "choose", optionId: "mark-on-map" },
  ];
  for (const command of commands) {
    const step = actInExpedition(state, command, initialDungeon, initialAdventure);
    if (!step.result.accepted) throw new Error(step.result.reason);
    state = step.state;
  }
  expect(member(state).status?.haze).toBe(1);
  expect(member(state, "reserve").status?.incapacityRecoverySteps).toBe(6);
  expect(state.randomState).toBe(1);
});
describe("命中と戦闘参加", () => {
  const enemy = { id: "enemy", team: "enemy" as const, speed: 50, hp: 200, attackPower: 0 };
  it("seed1の独立した既知値で命中/失敗を決め、失敗も行動を完了する", () => {
    expect(nextGameRandom(createGameRandom(1))).toEqual({ state: 1015568748, value: 1015568748 / 4294967296 });
    const ally = { id: "ally", team: "ally" as const, speed: 100, hp: 200, attackPower: 10, hitRate: 0.2 };
    const state = advanceBattleToNextActor(createBattleState([ally, enemy], 1));
    const miss = performBasicAttack(state, "ally", "enemy");
    expect(miss.events).toEqual([{ type: "miss", actorId: "ally", targetId: "enemy" }]);
    expect(miss.state.combatants.find(({ id }) => id === "enemy")?.hp).toBe(200);
    expect(miss.state.combatants.find(({ id }) => id === "ally")?.nextActionTime).toBe(200);
    const hit = performBasicAttack(
      advanceBattleToNextActor(createBattleState([{ ...ally, hitRate: 0.3 }, enemy], 1)),
      "ally",
      "enemy",
    );
    expect(hit.events).toMatchObject([{ type: "attack", damage: 10, targetHpAfter: 190 }]);
  });
  it("拒否・行動順参照・確実な攻撃・0ダメージは乱数を消費しない", () => {
    const ally = { id: "ally", team: "ally" as const, speed: 100, hp: 200, attackPower: 10 };
    const state = advanceBattleToNextActor(createBattleState([ally, enemy], 1));
    expect(getBattleUpcomingActions(state, 3)).toHaveLength(3);
    expect(performBasicAttack(state, "ally", "missing").state.randomState).toBe(1);
    expect(performBasicAttack(state, "ally", "enemy").state.randomState).toBe(1);
    const zero = advanceBattleToNextActor(createBattleState([{ ...ally, attackPower: 0, hitRate: 0.5 }, enemy], 1));
    expect(performBasicAttack(zero, "ally", "enemy").state.randomState).toBe(1);
  });
  it("HP正でも戦闘不能者は現在行動者・予告順から外れ、全員なら敗北", () => {
    const blocked = {
      id: "blocked",
      team: "ally" as const,
      speed: 200,
      hp: 200,
      attackPower: 10,
      status: applyIncapacity(healthyStatus()),
    };
    const ally = { ...blocked, id: "ally", status: healthyStatus(), speed: 100 };
    const state = advanceBattleToNextActor(createBattleState([blocked, ally, enemy]));
    expect(state.currentActorId).toBe("ally");
    expect(getBattleUpcomingActions(state, 10).some(({ id }) => id === "blocked")).toBe(false);
    expect(createBattleState([blocked, enemy]).outcome).toBe("defeat");
    let expedition = applyPartyStatus(game(), "player", "incapacity", characters);
    expect(departOnExpedition(expedition, characters, initialDungeon, initialAdventure)).toMatchObject({
      accepted: false,
      reason: "no-living-member",
    });
    const slot = setPartySlot(expedition.party, 1, "reserve");
    if (!slot.accepted) throw new Error(slot.reason);
    expedition = { ...expedition, party: slot.state };
    expect(departOnExpedition(expedition, characters, initialDungeon, initialAdventure).accepted).toBe(true);
  });
  it("HP0への遷移で6半日を付与し、回復済みHP0の再評価は再付与しない", () => {
    const state = advanceBattleToNextActor(
      createBattleState([{ id: "ally", team: "ally", speed: 100, hp: 5, attackPower: 200 }, enemy]),
    );
    const result = performBasicAttack(state, "ally", "enemy");
    expect(result.state.combatants.find(({ id }) => id === "enemy")?.status.incapacityRecoverySteps).toBe(6);
    const recovered = createBattleState([
      { id: "ally", team: "ally", speed: 100, hp: 0, attackPower: 10, status: healthyStatus() },
      enemy,
    ]);
    expect(recovered.combatants[0].status.incapacityRecoverySteps).toBeNull();
    expect(recovered.outcome).toBe("defeat");
  });
});
